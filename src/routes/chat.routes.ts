import { FastifyInstance } from 'fastify'
import * as chatMgr from '../db/chatManagement'
import * as userManagment from '../db/userManagment'
import cookie from '@fastify/cookie';

export default async function (fastify: FastifyInstance) {
  // Add friend
  fastify.post('/api/friends/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const currentUserId = Number(result.value);

    await chatMgr.addFriend(currentUserId, Number(userId));

    return { success: true };
  });

  // Remove friend
  fastify.delete('/api/friends/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // const currentUserId = request.user.id;

    await chatMgr.removeFriend(currentUserId, Number(userId));


    return { success: true };
  });

  // Block user
  fastify.post('/api/blocks/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const currentUserId = Number(result.value);

    await chatMgr.blockUser(currentUserId, Number(userId));

    return { success: true };
  });

  // Unblock user
  fastify.delete('/api/blocks/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const currentUserId = Number(result.value);

   await chatMgr.unblockUser(currentUserId, Number(userId));

    return { success: true };
  });

  // Get friends list
  fastify.get('/api/friends', async (request, reply) => {
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const currentUserId = Number(result.value);

   const friends = await chatMgr.getFriends(currentUserId);

    return friends;
  });

  // Get blocked users
  fastify.get('/api/blocks', async (request, reply) => {
   const result = request.unsignCookie(request.cookies.userId);
   if (!result.valid) {
   return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
   }
   const currentUserId = Number(result.value);

   const blocks = await chatMgr.getBlockedUsers(currentUserId);

    return blocks;
  });
}


export default async function (fastify: FastifyInstance) {
   // Create a room
  fastify.post('/api/chat/rooms', async (request, reply) => {
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const ownerId = Number(result.value);
    const { name } = request.body as { name?: string };
    const result = await chatMgr.createChatRoom(ownerId, name);
    return reply.code(201).send({ roomID: result.lastID });
  });


  // ─ List the rooms belonging to a user
  fastify.get('/api/chat/rooms', async (request, reply) => {
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const ownerId = Number(result.value);
    const rooms = await chatMgr.getChatRoomsByOwner(ownerId);
    return rooms; 
  });

  // ─ Get Room details
  fastify.get('/api/chat/rooms/:roomId', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const room = await chatMgr.getChatRoomByID(roomId);
    if (!room) return reply.code(404).send({ error: 'Salon non trouvé' });
    return room;
  });

  // ─ Add member to room
  fastify.post('/api/chat/rooms/:roomId/members', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const ownerId = Number(result.value);
    await chatMgr.createChatRoomMember(roomId, userId);
    return { success: true };
  });

  // ─ Remove member from room
  fastify.delete('/api/chat/rooms/:roomId/members/:userId', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const userId = Number((request.params as any).userId);
    await chatMgr.removeChatRoomMember(roomId, userId);
    return { success: true };
  });

  // ─ List room members
  fastify.get('/api/chat/rooms/:roomId/members', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const members = await chatMgr.getChatRoomMembers(roomId);
    return members; 
  });

  // ─ Send a message in a room
  fastify.post('/api/chat/rooms/:roomId/messages', async (request, reply) => {
    const roomId   = Number((request.params as any).roomId);
    const result = request.unsignCookie(request.cookies.userId);
    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid or missing userId cookie' });
    }
    const ownerId = Number(result.value);
    const { content } = request.body as { content: string };
    await chatMgr.createMessage(roomId, authorId, content);
    return reply.code(201).send({ success: true });
  });

  // ─ Get the messages from a room
  fastify.get('/api/chat/rooms/:roomId/messages', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const limit  = Number((request.query as any).limit) || 50;
    const messages = await chatMgr.getMessagesByChatRoom(roomId, limit);
    return messages;
  });
}