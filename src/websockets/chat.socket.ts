import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import { getChatRoomMembers } from '../db/chatManagement';
import * as chatManagement from '../db/chatManagement';
import { getPlayerState } from './game.socket';
import { playerInterface } from '../shared/gameTypes';
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

const MappedClients = new Map<number, WebSocket>();

async function getRightSockets(authorID: number): Promise<Map<number, WebSocket>> {
	const filtered = new Map<number, WebSocket>();

	for (const [clientID, socket] of MappedClients.entries()) {
		const blocked = await chatManagement.getBlockedUsers(clientID);
		const hasBlocked = blocked.some(user => user.related_userID === authorID);

		if (!hasBlocked) {
			filtered.set(clientID, socket);
		}
	}
	return filtered;
}


async function SendGeneralMessage(authorID: number, message: string) {
	for (const [clientID, socket] of MappedClients.entries()) {
		const blockedByClient = await chatManagement.isBlocked(clientID, authorID);

		if (!blockedByClient) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(message);
			}
		}
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

			const socket = MappedClients.get(memberID);
			if (!socket) continue;
			socket.send(payload);
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
	const oldWs = MappedClients.get(userId);
	if (oldWs) {
		try {
			oldWs.close(1000, 'New connection established');
		} catch (e) {
			console.warn('Failed to close previous socket:', e);
		}
	}

	// Set the new socket as the only one
	MappedClients.set(userId, ws);
	
	
		ws.on('close', () => handleDisconnect(userId, fullUser.username, ws));
	
		ws.on('message', async (data: RawData) => {
			console.log('CHAT:Message received from client:', data.toString());
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
					const { roomID, userID, limit } = parsed;
					if (typeof roomID !== 'number' || (limit !== undefined && typeof limit !== 'number')) {
						return ws.send(JSON.stringify({ error: 'Invalid history request' }));
					}
	
					try {
						const messages = await chatManagement.getMessagesByChatRoom(roomID, limit ?? 10);
						const result = [];
	
						for (const msg of messages.reverse()) {
							const blocked = await chatManagement.isBlocked(userID, msg.authorID);
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
					const socket = MappedClients.get(newUser);
					if(!socket) break;
					socket.send(JSON.stringify({
						type: 'loadChatRooms',
						roomID:roomID,
						userID:userID,
						newUser:newUser
						}));	
					//else {client is not connect should keep in notif ?}
				}
				catch{
					ws.send(JSON.stringify({ type: 'system', message: 'Error while loading chat rooms.' }));
				} 
			 	break;
			 }
			 case 'friendStatus' : {
				 handleFriendStatus(parsed, ws)
			 	break;
			 }
				default:
					ws.send(JSON.stringify({ error: 'Unknown message type' }));
			}
		});
	}

async function  handleFriendStatus(parsed:any, ws:WebSocket){
	const {action, userID, friendList} = parsed;
	switch(parsed.action){
		//Front is asking for the full list
	case 'request': {
		console.log('[BACK] friendStatus action=request', friendList);
		if (!Array.isArray(friendList)) {
			ws.send(JSON.stringify({ error: 'Invalid friend list' }));
			return;
		}
		const updatedStatus = friendList.map(friend => {
		const status = getPlayerState(friend.friendID);
		return {
			friendID: friend.friendID,
			status
		};
		});
		console.log('[BACK] friendStatus action=response', updatedStatus);
		ws.send(JSON.stringify({
			type: 'friendStatus',
			action: 'response',
			list: updatedStatus
		}));
		break;
	}	
		//from front A send update
		//Back send live update to any one friends with A, A has B for friends, B join the app, A is "notify"
	case 'update': {
		// Validate inputs
		// if (typeof userID !== 'number' || typeof parsed.status !== 'string') {
		// 	ws.send(JSON.stringify({ error: 'Invalid update data' }));
		// 	return;
		// }
		console.log(`[CHAT][PLAYERUPDATE] data.state : ${parsed.state}`)
		try {
			// 1) Get all user-IDs who have 'userID' as a friend
			const relatedFriends = await chatManagement.getAllUsersWhoHaveMeAsFriend(userID) ?? [];

			// 2) For each friend, if they have a connected socket, send them the update
			for (const friendID of relatedFriends) {
				console.log(`friend ID:${friendID} found to friend woth userID:${userID}`)
				const friendSocket = MappedClients.get(friendID);
				if (friendSocket) {
					console.log(`friendSocket FOUND sending state updated`)
					friendSocket.send(JSON.stringify({
					type: 'friendStatus',
					action: 'updateStatus',
					targetID: friendID,  // the friend receiving the update
					friendID: userID,    // the user whose status changed
					status:cleanState(parsed.state)
					}));
				}
				console.log(`NO SOCKET FOUND FOR FRIEND`)
			}
		} catch (err) {
			console.error('Failed to update friend status:', err);
			ws.send(JSON.stringify({ error: 'Failed to update friend status' }));
		}

		break;
	}
	}
}

function cleanState(OgState:string):'online'|'offline'|'in-game'{

	if(!OgState || OgState === undefined || OgState === 'offline')
		return('offline');
	if(OgState === 'init' || OgState === 'online')
		return ('online')
	return ('in-game')
	
}

function handleDisconnect(userId: number, username: string, ws: WebSocket) {
	const existingSocket = MappedClients.get(userId);

	if (existingSocket === ws) {
		MappedClients.delete(userId);
		console.log(`CHAT: User ${username} (ID: ${userId}) disconnected.`);
	} else {
		console.warn(`CHAT : WebSocket mismatch for user ${userId}, not removing.`);
	}
}
	

export default fp(async fastify => {
	const wss = new WebSocketServer({ noServer: true });
	wss.on('connection', handleConnection);

	fastify.server.on('upgrade', (request, socket, head) => {
		const { url } = request;
		if(url?.startsWith('/chat'))
			wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
				wss.emit('connection', ws, request);
			});
	});
});
