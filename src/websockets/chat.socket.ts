import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import { getChatRoomMembers } from '../db/chatManagement';
import * as chatManagement from '../db/chatManagement';
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

async function getRightSockets(authorID: number): Promise<Map<number, WebSocket[]>> {
  const filtered = new Map<number, WebSocket[]>();

  for (const [clientID, sockets] of MappedClients.entries()) {
    const blocked = await chatManagement.getBlockedUsers(clientID); // Who this client blocked
    const hasBlocked = blocked.some(user => user.related_userID === authorID);

    if (!hasBlocked) {
      filtered.set(clientID, sockets);
    }
  }

  return filtered;
}


async function SendGeneralMessage(authorID: number, message: string) {
    const socketsMap = await getRightSockets(authorID);
    for (const sockets of socketsMap.values()) {
      sockets.forEach(ws => ws.send(message));
    }
  }

  async function SendChatRoomMessage(roomID: number, authorID: number, message: string) {
    const authorName = (await UserManagement.getUnameByIndex(authorID))?.username ?? `Utilisateur ${authorID}`;
  
    const payload = JSON.stringify({
      type: 'chatRoomMessage',
      roomID:roomID,
      from: authorID,
      name_from: authorName,
      content: message
    });
  
    if (roomID === 0) {
      return await SendGeneralMessage(authorID, payload);
    }
  
    try {
      const members = await getChatRoomMembers(roomID);
      const allowedMap = await getRightSockets(authorID);
  
      for (const member of members) {
        const sockets = allowedMap.get(member.userID);
        if (sockets) {
          sockets.forEach(ws => ws.send(payload));
        }
      }
  
      await chatManagement.createMessage(roomID, authorID, message);
    } catch (err) {
      console.error("Error sending chat room message:", err);
    }
  }
  

async function handleConnection(ws: WebSocket, request: any) {
  // Extract token from URL parameters instead of headers
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    console.log('Connection rejected: No token provided');
    return ws.close(1008, 'No token');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret) as JwtPayload;
  } catch (error) {
    console.log('Connection rejected: Invalid token', error);
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

  SendGeneralMessage(0,JSON.stringify({
    type: 'system',
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

  SendGeneralMessage(0,JSON.stringify({
    type: 'system',
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
