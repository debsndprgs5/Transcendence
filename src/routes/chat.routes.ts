import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as chatMgr from '../db/chatManagement';

// Helper to extract and validate signed userId cookie
function getUserId(request: FastifyRequest, reply: FastifyReply): number | undefined {
  const raw = request.cookies?.userId;
  if (!raw) {
    reply.code(401).send({ error: 'Missing userId cookie' });
    return;
  }
  const { valid, value } = request.unsignCookie(raw);
  if (!valid) {
    reply.code(401).send({ error: 'Invalid userId cookie' });
    return;
  }
  const id = Number(value);
  if (Number.isNaN(id)) {
    reply.code(400).send({ error: 'Malformed userId cookie' });
    return;
  }
  return id;
}

export default async function chatRoutes(fastify: FastifyInstance) {
  // ───── FRIENDS ─────────────────────────────────────────────────────────
  fastify.post('/friends/:userId', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const targetId = Number((request.params as any).userId);
    await chatMgr.addFriend(currentUserId, targetId);
    return reply.send({ success: true });
  });

  fastify.delete('/friends/:userId', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const targetId = Number((request.params as any).userId);
    await chatMgr.removeFriend(currentUserId, targetId);
    return reply.send({ success: true });
  });

  fastify.get('/friends', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const friends = await chatMgr.getFriends(currentUserId);
    return reply.send(friends);
  });

  // ───── BLOCKS ──────────────────────────────────────────────────────────
  fastify.post('/blocks/:userId', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const targetId = Number((request.params as any).userId);
    await chatMgr.blockUser(currentUserId, targetId);
    return reply.send({ success: true });
  });

  fastify.delete('/blocks/:userId', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const targetId = Number((request.params as any).userId);
    await chatMgr.unblockUser(currentUserId, targetId);
    return reply.send({ success: true });
  });

  fastify.get('/blocks', async (request, reply) => {
    const currentUserId = getUserId(request, reply);
    if (currentUserId === undefined) return;
    const blocks = await chatMgr.getBlockedUsers(currentUserId);
    return reply.send(blocks);
  });

  // ───── CHATROOMS ────────────────────────────────────────────────────────
  fastify.post('/chat/rooms', async (request, reply) => {
    const ownerId = getUserId(request, reply);
    if (ownerId === undefined) return;
    const { name } = request.body as { name?: string; };
    const result = await chatMgr.createChatRoom(ownerId, name ?? 'Salon');
    return reply.code(201).send({ roomID: (result as any).lastID });
  });

  fastify.get('/chat/rooms', async (request, reply) => {
    const ownerId = getUserId(request, reply);
    if (ownerId === undefined) return;
    const rooms = await chatMgr.getChatRoomsByOwner(ownerId);
    return reply.send(rooms);
  });

  fastify.get('/chat/rooms/:roomId', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const room = await chatMgr.getChatRoomByID(roomId);
    if (!room) return reply.code(404).send({ error: 'Salon non trouvé' });
    return reply.send(room);
  });

  // ─ Add/Remove members ─────────────────────────────────────────────────
fastify.post('/chat/rooms/:roomId/members', async (request, reply) => {
    const userId = getUserId(request, reply);
    if (userId === undefined) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    const roomId = Number((request.params as any).roomId);
    if (isNaN(roomId)) {
        return reply.status(400).send({ error: 'Invalid room ID' });
    }
    try {
        await chatMgr.createChatRoomMember(roomId, userId);
        return reply.send({ success: true });
    } catch (error) {
        console.error('Error adding member to room:', error);
        return reply.status(500).send({ 
            error: 'Failed to add member to room',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

  fastify.delete('/chat/rooms/:roomId/members/:userId', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const memberId = Number((request.params as any).userId);
    await chatMgr.removeChatRoomMember(roomId, memberId);
    return reply.send({ success: true });
  });

  fastify.get('/chat/rooms/:roomId/members', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const members = await chatMgr.getChatRoomMembers(roomId);
    return reply.send(members);
  });

  // ───── MESSAGES ─────────────────────────────────────────────────────────
  fastify.post('/chat/rooms/:roomId/messages', async (request, reply) => {
    const authorId = getUserId(request, reply);
    if (authorId === undefined) return;
    const roomId = Number((request.params as any).roomId);
    const { content } = request.body as { content: string };
    await chatMgr.createMessage(roomId, authorId, content);
    return reply.code(201).send({ success: true });
  });

  //get all messages from unblock authors
  fastify.get('/chat/rooms/:roomId/messages', async (request, reply) => {
    const roomId = Number((request.params as any).roomId);
    const userID = Number((request.params as any).userID)
    const limit = Number((request.query as any).limit) || 50;
    const messages = await chatMgr.getCleanHistory(roomId,userID)
    return reply.send(messages);
  });
}
