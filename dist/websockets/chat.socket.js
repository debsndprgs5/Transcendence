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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const UserManagement = __importStar(require("../db/userManagement"));
const chatManagement_1 = require("../db/chatManagement");
const chatManagement = __importStar(require("../db/chatManagement"));
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv.config({
    path: path_1.default.resolve(process.cwd(), '.env'),
}); // get env
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is not defined");
}
const MappedClients = new Map();
async function getRightSockets(authorID) {
    const filtered = new Map(MappedClients);
    for (const [clientID, sockets] of MappedClients.entries()) {
        const blocked = await chatManagement.getBlockedUsers(clientID);
        const hasBlocked = blocked.some(user => user.related_userID === authorID);
        if (!hasBlocked) {
            filtered.set(clientID, sockets);
        }
    }
    return filtered;
}
async function SendGeneralMessage(authorID, message) {
    const socketsMap = new Map();
    for (const [clientID, sockets] of MappedClients.entries()) {
        const blockedByClient = await chatManagement.isBlocked(clientID, authorID);
        const blockedByAuthor = await chatManagement.isBlocked(authorID, clientID);
        if (!blockedByClient && !blockedByAuthor) {
            socketsMap.set(clientID, sockets);
        }
    }
    for (const sockets of socketsMap.values()) {
        sockets.forEach(ws => ws.send(message));
    }
}
async function SendChatRoomMessage(roomID, authorID, message) {
    const authorName = (await UserManagement.getUnameByIndex(authorID))?.username ?? `Utilisateur ${authorID}`;
    const payload = JSON.stringify({
        type: 'chatRoomMessage',
        roomID: roomID,
        from: authorID,
        name_from: authorName,
        content: message
    });
    if (roomID === 0) {
        await chatManagement.createMessage(0, authorID, message);
        return await SendGeneralMessage(authorID, payload);
    }
    try {
        const members = await (0, chatManagement_1.getChatRoomMembers)(roomID);
        const memberIDs = members.map(m => m.userID);
        for (const memberID of memberIDs) {
            const hasBlocked = await chatManagement.isBlocked(memberID, authorID);
            if (hasBlocked)
                continue;
            const sockets = MappedClients.get(memberID);
            if (!sockets)
                continue;
            sockets.forEach(ws => ws.send(payload));
        }
        await chatManagement.createMessage(roomID, authorID, message);
    }
    catch (err) {
        console.error("Error sending chat room message:", err);
    }
}
async function handleConnection(ws, request) {
    console.log('New WS connection attempt from:', request.socket.remoteAddress);
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
        console.log('Connection rejected: No token provided');
        return ws.close(1008, 'No token');
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, jwtSecret);
    }
    catch (error) {
        console.log('Connection rejected: Invalid token', error);
        return ws.close(1008, 'Invalid token');
    }
    const rand_id = payload.sub;
    const fullUser = await UserManagement.getUserByRand(rand_id);
    if (!fullUser) {
        return ws.close(1008, 'User not found');
    }
    const userId = fullUser.our_index;
    // If an old socket exists for this user, close it
    const existingSockets = MappedClients.get(userId);
    if (existingSockets && existingSockets.length > 0) {
        for (const oldWs of existingSockets) {
            try {
                oldWs.close(1000, 'New connection established');
            }
            catch (e) {
                console.warn('Failed to close previous socket:', e);
            }
        }
    }
    // Set the new socket as the only one
    MappedClients.set(userId, [ws]);
    ws.on('close', () => handleDisconnect(userId, fullUser.username, ws));
    ws.on('message', async (data) => {
        console.log('Message received from client:', data.toString());
        let parsed;
        try {
            parsed = JSON.parse(data.toString());
        }
        catch {
            return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        }
        // --- Handle message types ---
        switch (parsed.type) {
            case 'chatRoomMessage': {
                const { chatRoomID, userID, content } = parsed;
                if (typeof chatRoomID !== 'number' ||
                    typeof userID !== 'number' ||
                    typeof content !== 'string' ||
                    !content.trim()) {
                    return ws.send(JSON.stringify({ error: 'Invalid message format' }));
                }
                try {
                    await SendChatRoomMessage(chatRoomID, userID, content);
                }
                catch (err) {
                    console.error('Failed to send chat room message:', err);
                    ws.send(JSON.stringify({ error: 'Failed to deliver message' }));
                }
                break;
            }
            case 'chatHistory': {
                const { roomID, limit } = parsed;
                if (typeof roomID !== 'number' || (limit !== undefined && typeof limit !== 'number')) {
                    return ws.send(JSON.stringify({ error: 'Invalid history request' }));
                }
                try {
                    const messages = await chatManagement.getMessagesByChatRoom(roomID, limit ?? 10);
                    const result = [];
                    for (const msg of messages.reverse()) {
                        const blocked = await chatManagement.isBlocked(userId, msg.authorID);
                        if (blocked === true)
                            continue;
                        const author = await UserManagement.getUnameByIndex(msg.authorID);
                        result.push({
                            from: msg.authorID,
                            name_from: author?.username ?? `Utilisateur ${msg.authorID}`,
                            content: msg.content
                        });
                    }
                    ws.send(JSON.stringify({
                        type: 'chatHistory',
                        roomID: roomID,
                        messages: result
                    }));
                }
                catch (err) {
                    console.error('Failed to load history:', err);
                    ws.send(JSON.stringify({ type: 'system', message: 'Erreur chargement historique.' }));
                }
                break;
            }
            default:
                ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
    });
}
function handleDisconnect(userId, username, ws) {
    const sockets = MappedClients.get(userId) || [];
    const updated = sockets.filter(s => s !== ws);
    if (updated.length === 0) {
        MappedClients.delete(userId);
    }
    else if (updated.length < sockets.length) {
        MappedClients.set(userId, updated);
    }
    else {
        console.warn(`WebSocket to remove not found for user ${userId}`);
    }
}
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const wss = new ws_1.WebSocketServer({ noServer: true });
    wss.on('connection', handleConnection);
    fastify.server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });
});
