import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import { getChatRoomMembers } from '../db/chatManagement';
import fp from 'fastify-plugin';
import * as dotenv from 'dotenv';
import path from 'path';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';



dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
}); // get env


const jwtSecret = process.env.JWT_SECRET!;
if (!jwtSecret) {
  throw new Error("JWT_SECRET environment variable is not defined");
}

const MappedClients = new Map<number, WebSocket[]>();

function SendGeneralMessage(message: string) {
  for (const sockets of MappedClients.values()) {
    sockets.forEach(ws => ws.send(message));
  }
}

async function SendChatRoomMessage(roomID: number, authorID: number, message: string) {
  if (roomID === 0) {
    SendGeneralMessage(message);
    return;
  }
  try {
    const members = await getChatRoomMembers(roomID);
    for (const member of members) {
      const sockets = MappedClients.get(member.userID);
      if (sockets) {
        for (const ws of sockets) {
          ws.send(JSON.stringify({
            type: 'chatRoomMessage',
            roomID,
            from: authorID,
            content: message
          }));
        }
      }
    }
  } catch (err) {
    console.error("Error sending chat room message:", err);
  }
}

async function handleConnection(ws: WebSocket, request: any) {
  const token = (request.headers.authorization || "").split(' ')[1];
  if (!token) return ws.close(1008, 'No token');

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return ws.close(1008, 'Invalid token');
  }

  const rand_id = payload.sub as string;
  const fullUser: user | null = await UserManagement.getUserByRand(rand_id);
  if (!fullUser) {
    return ws.close(1008, 'User not found');
  }

  const userId = fullUser.our_index;
  if (!MappedClients.has(userId)) MappedClients.set(userId, []);
  MappedClients.get(userId)!.push(ws);

  SendGeneralMessage(JSON.stringify({
    type: 'system',
    room: 0,
    message: `👋 ${fullUser.username} joined general chat.`
  }));

  ws.on('close', () => handleDisconnect(userId, fullUser.username, ws));

  ws.on('message', async (data: RawData) => {
    let parsed: any;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }

    const { chatRoomID, userID, content } = parsed;
    if (
      typeof chatRoomID !== 'number' ||
      typeof userID   !== 'number' ||
      typeof content  !== 'string' ||
      !content.trim()
    ) {
      return ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }

    try {
      await SendChatRoomMessage(chatRoomID, userID, content);
    } catch (err) {
      console.error('Failed to send chat room message:', err);
      ws.send(JSON.stringify({ error: 'Failed to deliver message' }));
    }
  });
}

function handleDisconnect(userId: number, username: string, ws: WebSocket) {
  const sockets = MappedClients.get(userId) || [];
  const updated = sockets.filter(s => s !== ws);

  if (updated.length === 0) {
    MappedClients.delete(userId);
  } else {
    MappedClients.set(userId, updated);
  }

  SendGeneralMessage(JSON.stringify({
    type: 'system',
    room: 0,
    message: `👋 ${username} left general chat.`
  }));
}

export default fp(async fastify => {
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', handleConnection);

  fastify.server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  });
});
