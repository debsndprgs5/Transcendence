"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chatRoutes;
const chatMgr = __importStar(require("../db/chatManagement"));
const UserManagement = __importStar(require("../db/userManagement"));
// Helper to extract and validate signed userId cookie
function getUserId(request, reply) {
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
async function chatRoutes(fastify) {
    // helper to get id by username
    fastify.get('/users/by-username/:username', async (request, reply) => {
        try {
            const { username } = request.params;
            if (!username) {
                return reply.code(400).send({
                    error: 'Username parameter is required'
                });
            }
            const userobj = await UserManagement.getUserByName(username);
            if (!userobj || !userobj.our_index) {
                return reply.code(404).send({
                    error: `User "${username}" not found`
                });
            }
            return reply.send({ userId: userobj.our_index });
        }
        catch (error) {
            console.error('Error in /api/users/by-username:', error);
            return reply.code(500).send({
                error: 'Internal server error'
            });
        }
    });
    // ───── FRIENDS ─────────────────────────────────────────────────────────
    fastify.post('/friends/:userId', {
        config: {
            allowEmptyBody: true
        }
    }, async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const targetId = Number(request.params.userId);
        await chatMgr.addFriend(currentUserId, targetId);
        return reply.send({ success: true });
    });
    fastify.delete('/friends/:userId', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const targetId = Number(request.params.userId);
        await chatMgr.removeFriend(currentUserId, targetId);
        return reply.send({ success: true });
    });
    fastify.get('/friends', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const friends = await chatMgr.getFriends(currentUserId);
        return reply.send(friends);
    });
    // ───── BLOCKS ──────────────────────────────────────────────────────────
    fastify.post('/blocks/:userId', {
        config: {
            allowEmptyBody: true
        }
    }, async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const targetId = Number(request.params.userId);
        await chatMgr.blockUser(currentUserId, targetId);
        return reply.send({ success: true });
    });
    fastify.delete('/blocks/:userId', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const targetId = Number(request.params.userId);
        await chatMgr.unblockUser(currentUserId, targetId);
        return reply.send({ success: true });
    });
    fastify.get('/blocks', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const blocks = await chatMgr.getBlockedUsers(currentUserId);
        return reply.send(blocks);
    });
    // ───── CHATROOMS ────────────────────────────────────────────────────────
    fastify.get('/chat/rooms/mine', async (request, reply) => {
        const userId = getUserId(request, reply);
        if (userId === undefined)
            return;
        const rooms = await chatMgr.getChatRoomsByUserId(userId);
        return reply.send(rooms);
    });
    fastify.post('/chat/rooms', async (request, reply) => {
        const ownerId = getUserId(request, reply);
        if (ownerId === undefined)
            return;
        const { name } = request.body;
        const result = await chatMgr.createChatRoom(ownerId, name ?? 'Room');
        return reply.code(201).send({ roomID: result.lastID });
    });
    fastify.get('/chat/rooms', async (request, reply) => {
        const ownerId = getUserId(request, reply);
        if (ownerId === undefined)
            return;
        const rooms = await chatMgr.getChatRoomsByOwner(ownerId);
        return reply.send(rooms);
    });
    fastify.get('/chat/rooms/:roomId', async (request, reply) => {
        const roomId = Number(request.params.roomId);
        const room = await chatMgr.getChatRoomByID(roomId);
        if (!room)
            return reply.code(404).send({ error: 'Room not found' });
        return reply.send(room);
    });
    fastify.delete('/chat/rooms/:roomId', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined)
            return;
        const roomId = Number(request.params.roomId);
        const room = await chatMgr.getChatRoomByID(roomId);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found' });
        }
        if (room.ownerID !== currentUserId) {
            return reply.code(403).send({ error: 'You don\'t have the rights to delete this room.' });
        }
        await chatMgr.deleteChatRoomByID(roomId);
        return reply.send({ success: true });
    });
    // ─ Add/Remove members ─────────────────────────────────────────────────
    fastify.post('/chat/rooms/:roomId/members', async (request, reply) => {
        const currentUserId = getUserId(request, reply);
        if (currentUserId === undefined) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const roomId = Number(request.params.roomId);
        const { userId } = request.body;
        if (!userId || isNaN(roomId)) {
            return reply.status(400).send({ error: 'Missing or invalid userId' });
        }
        try {
            await chatMgr.createChatRoomMember(roomId, userId);
            return reply.send({ success: true });
        }
        catch (error) {
            console.error('Error adding member to room:', error);
            return reply.status(500).send({
                error: 'Failed to add member to room',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    fastify.delete('/chat/rooms/:roomId/members/:userId', async (request, reply) => {
        const roomId = Number(request.params.roomId);
        const memberId = Number(request.params.userId);
        await chatMgr.removeChatRoomMember(roomId, memberId);
        return reply.send({ success: true });
    });
    fastify.get('/chat/rooms/:roomId/members', async (request, reply) => {
        const roomId = Number(request.params.roomId);
        const members = await chatMgr.getChatRoomMembers(roomId);
        return reply.send(members);
    });
    // ───── MESSAGES ─────────────────────────────────────────────────────────
    fastify.post('/chat/rooms/:roomId/messages', async (request, reply) => {
        const authorId = getUserId(request, reply);
        if (authorId === undefined)
            return;
        const roomId = Number(request.params.roomId);
        const { content } = request.body;
        await chatMgr.createMessage(roomId, authorId, content);
        return reply.code(201).send({ success: true });
    });
    //get all messages from unblock authors
    fastify.get('/chat/rooms/:roomId/messages', async (request, reply) => {
        const roomId = Number(request.params.roomId);
        const userID = Number(request.params.userID);
        const limit = Number(request.query.limit) || 50;
        const messages = await chatMgr.getCleanHistory(roomId, userID);
        return reply.send(messages);
    });
}
