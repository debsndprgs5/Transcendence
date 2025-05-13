import { user } from '../types/user';
import { chatRooms, chatRoomMembers, messages } from '../types/chat';
import * as UserManagment from '../db/userManagment';
import fp from 'fastify-plugin';
import * as dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

dotenv.config();
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET environment variable is not defined");
}

const MappedClients = new Map<number, WebSocket[]>();


function SendGeneralMessage(message: string) {
  for (const [userId, sockets] of MappedClients.entries()) {
    sockets.forEach((ws) => {
      ws.send(message);
    });
  }
}

async function SendChatRoomMessage(roomID: number, authorID: number, message: string) {
    if (roomID === 0) {
      SendGeneralMessage(message);
      return;
    }
  
    try {
      const members = await getChatRoomMembers(roomID); // [{ userID: 1 }, { userID: 2 }, ...]
      for (const member of members) {
        const sockets = MappedClients.get(member.userID);
        if (sockets) {
          for (const socket of sockets) {
            socket.send(JSON.stringify({
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

// Handle user connection
async function handleConnection(socket: WebSocket, request: any) {
  const token = (request.headers.authorization || "").split(" ")[1];
  let payload: any;

  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    socket.close(1008, "Invalid token");
    return;
  }

  const rand_id = payload.sub;
  const fullUser: user | null = await UserManagment.getUserByRand(rand_id);
  if (!fullUser) {
    socket.close(1008, "User not found");
    return;
  }

  const userId = fullUser.our_index;
  if (!MappedClients.has(userId)) MappedClients.set(userId, []);
  MappedClients.get(userId)!.push(socket);

  // Send welcome message to general chat
  const welcomeMsg = JSON.stringify({
    type: 'system',
    room: 0,
    message: `👋 ${fullUser.username} joined general chat.`,
  });
  SendGeneralMessage(welcomeMsg);

  // Handle disconnect
  socket.on("close", () => handleDisconnect(userId, fullUser.username, socket));

  socket.on("message", async (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data.toString());
    } catch (err) {
      socket.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
  
    const { chatRoomID, userID, content } = parsed;
  
    if (
      typeof chatRoomID !== "number" ||
      typeof userID !== "number" ||
      typeof content !== "string" ||
      content.trim() === ""
    ) {
      socket.send(JSON.stringify({ error: "Invalid message format" }));
      return;
    }
  
    try {
      await SendChatRoomMessage(chatRoomID, userID, content);
    } catch (err) {
      console.error("Failed to send chat room message:", err);
      socket.send(JSON.stringify({ error: "Failed to deliver message" }));
    }
  }); 
}

// Handle user disconnection
function handleDisconnect(userId: number, username: string, socket: WebSocket) {
  const sockets = MappedClients.get(userId) || [];
  const updated = sockets.filter(s => s !== socket);

  if (updated.length === 0) {
    MappedClients.delete(userId);
  } else {
    MappedClients.set(userId, updated);
  }

  // Send goodbye message to general chat
  const byeMsg = JSON.stringify({
    type: 'system',
    room: 0,
    message: `👋 ${username} left general chat.`,
  });
  SendGeneralMessage( byeMsg);
}

export default fp(async (fastify) => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", handleConnection);

  fastify.server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
});


//add/remove from room

//Add/remove Friends

//Un\Block user