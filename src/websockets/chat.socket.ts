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
	const filtered = new Map<number, WebSocket[]>(MappedClients);

	for (const [clientID, sockets] of MappedClients.entries()) {
		const blocked = await chatManagement.getBlockedUsers(clientID);
		const hasBlocked = blocked.some(user => user.related_userID === authorID);

		if (!hasBlocked) {
			filtered.set(clientID, sockets);
		}
	}
	return filtered;
}


async function SendGeneralMessage(authorID: number, message: string) {
	const socketsMap = new Map<number, WebSocket[]>();

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
			await chatManagement.createMessage(0, authorID, message);
			return await SendGeneralMessage(authorID, payload);
		}
	
		try {
			const members = await getChatRoomMembers(roomID);
			const memberIDs = members.map(m => m.userID);

			for (const memberID of memberIDs) {
				const hasBlocked = await chatManagement.isBlocked(memberID, authorID);
				if (hasBlocked) continue;

				const sockets = MappedClients.get(memberID);
				if (!sockets) continue;

				sockets.forEach(ws => ws.send(payload));
			}
	
			await chatManagement.createMessage(roomID, authorID, message);
		} catch (err) {
			console.error("Error sending chat room message:", err);
		}
	}
	

	async function handleConnection(ws: WebSocket, request: any) {
		const url = new URL(request.url, `https://${request.headers.host}`);
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
		// If an old socket exists for this user, close it
	const existingSockets = MappedClients.get(userId);
	if (existingSockets && existingSockets.length > 0) {
		for (const oldWs of existingSockets) {
			try {
				oldWs.close(1000, 'New connection established');
			} catch (e) {
				console.warn('Failed to close previous socket:', e);
			}
		}
	}
	// Set the new socket as the only one
	MappedClients.set(userId, [ws]);
	
	
		ws.on('close', () => handleDisconnect(userId, fullUser.username, ws));
	
		ws.on('message', async (data: RawData) => {
			console.log('Message received from client:', data.toString());
			let parsed: any;
			try {
				parsed = JSON.parse(data.toString());
			} catch {
				return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
			}
	
			// --- Handle message types ---
			switch (parsed.type) {
				case 'chatRoomMessage': {
					const { chatRoomID, userID, content } = parsed;
	
					if (
						typeof chatRoomID !== 'number' ||
						typeof userID !== 'number' ||
						typeof content !== 'string' ||
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
							if (blocked === true) continue;
	
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
							messages:result
						}));
					} catch (err) {
						console.error('Failed to load history:', err);
						ws.send(JSON.stringify({ type: 'system', message: 'Erreur chargement historique.' }));
					}
					break;
				}
			 case 'loadChatRooms': {
				const { roomID , userID , newUser } = parsed
				try{
					const sockets = MappedClients.get(newUser);
					if(sockets){
						for (const socket of sockets) {
							if (socket.readyState === WebSocket.OPEN) {
								console.log('SENDIN ACTUAL LOADROOMS SOCKETS')
								socket.send(JSON.stringify({
								type: 'loadChatRooms',
								roomID:roomID,
								userID:userID,
								newUser:newUser
								}));
							}
					}}		
					//else {client is not connect should keep in notif ?}
				}
				catch{
					ws.send(JSON.stringify({ type: 'system', message: 'Error while loading chat rooms.' }));
				} 
			 	break;
			 }
	
				default:
					ws.send(JSON.stringify({ error: 'Unknown message type' }));
			}
		});
	}
	
	function handleDisconnect(userId: number, username: string, ws: WebSocket) {
		const sockets = MappedClients.get(userId) || [];
		const updated = sockets.filter(s => s !== ws);
	
		if (updated.length === 0) {
			MappedClients.delete(userId);
		} else if (updated.length < sockets.length) {
			MappedClients.set(userId, updated);
		} else {
			console.warn(`WebSocket to remove not found for user ${userId}`);
		}
	
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
