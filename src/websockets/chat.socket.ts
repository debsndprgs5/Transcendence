import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import { getChatRoomMembers } from '../db/chatManagement';
import * as chatManagement from '../db/chatManagement';
import { getMembersByTourID, getPlayerState } from './game.socket';
import { playerInterface } from '../shared/gameTypes';
import fp from 'fastify-plugin';
import * as dotenv from 'dotenv';
import path from 'path';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from '../vault/vaultPlugin';

// dotenv.config({
// 	path: path.resolve(process.cwd(), '.env'),
// });

const MappedClients = new Map<number, WebSocket>();

const PRESENCE_TTL_MS = 30000;
const DisconnectTimers = new Map<number, NodeJS.Timeout>();

// Helper: do we currently have a chat socket for this user?
function isChatConnected(userID: number): boolean {
  const s = MappedClients.get(userID);
  return !!s && s.readyState === WebSocket.OPEN;
}

// Compute *presence* for UI (authoritative on the chat side)
// - If chat connected: "playing" if the game says so, else "online"
// - If chat not connected: "busy" if grace timer is running, else "offline"
function computePresence(userID: number, hint?: string): 'online'|'busy'|'offline'|'playing' {
  if (isChatConnected(userID)) {
    const raw = getPlayerState(userID);
    if (hint === 'playing' || raw === 'playing') return 'playing';
    return 'online';
  }
  return DisconnectTimers.has(userID) ? 'busy' : 'offline';
}


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

export async function sendSystemMessage(chatRoomID:number, content:string){
	if(chatRoomID <= 0 || !chatRoomID){
		SendGeneralMessage(0, content); //A VOIR SI CA MARCHE CA MAIS TFACON ON ENVOYE R EN GENERALE JE PENSE
		return ;
	}
	const members = await getChatRoomMembers(chatRoomID);
	const membersID = members.map(m => m.userID);
	for(const m of membersID){
		const payload = JSON.stringify({
			type: 'system',
			roomID:chatRoomID,
			content,
		});
		const socket =  MappedClients.get(m);
		if(!socket)continue;
		socket.send(payload);
	}
		
}

export async function sendPrivateSystemMessage(chatID:number, userID:number, content:string){

	//check if user have chatID for room 
	const userRooms = await chatManagement.getChatRoomsByUserId(userID);
	for(const room of userRooms){
		if(chatID === room.roomID){
			const socket = MappedClients.get(userID);
			socket!.send(JSON.stringify({
				type:'system',
				roomID:chatID,
				content
			}));
			return;
		}
	}
	console.warn(`[SYSTM] trying to send message but user${userID} is not in chat${chatID}`);
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
		const dynamicSecret = getJwtSecret();
		if (!dynamicSecret) {
			console.warn('JWT secret not yet initialized');
			return ws.close(1008, 'Server not ready');
		}
		payload = jwt.verify(token, dynamicSecret) as JwtPayload;
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
	const t = DisconnectTimers.get(userId);
	if (t) { clearTimeout(t); DisconnectTimers.delete(userId); }

	// Broadcast immediate presence to friends: "online" or "playing" if game says so
	try {
	  const relatedFriends = await chatManagement.getAllUsersWhoHaveMeAsFriend(userId) ?? [];
	  const now = computePresence(userId); // chat-connected => online/playing
	  for (const fid of relatedFriends) {
	    const friendSocket = MappedClients.get(fid);
	    if (friendSocket && friendSocket.readyState === WebSocket.OPEN) {
	      friendSocket.send(JSON.stringify({
	        type: 'friendStatus',
	        action: 'updateStatus',
	        targetID: fid,
	        friendID: userId,
	        status: now
	      }));
	    }
	  }
	} catch (e) {
	  console.error('Failed to broadcast online on connect:', e);
	}
	
		ws.on('close', async () => {
		  const userID = fullUser.our_index;
		  try {
		    if (!userID) return;

		    // 1) Start/refresh the 30s grace period timer
		    if (DisconnectTimers.has(userID)) {
		      clearTimeout(DisconnectTimers.get(userID)!);
		    }
		    const timer = setTimeout(async () => {
		      try {
		        // If still not reconnected after TTL => broadcast "offline"
		        if (!isChatConnected(userID)) {
		          const friendIDs: number[] = await chatManagement.getAllUsersWhoHaveMeAsFriend(userID) ?? [];
		          for (const fid of friendIDs) {
		            const friendSocket = MappedClients.get(fid);
		            if (friendSocket && friendSocket.readyState === WebSocket.OPEN) {
		              friendSocket.send(JSON.stringify({
		                type: 'friendStatus',
		                action: 'updateStatus',
		                targetID: fid,
		                friendID: userID,
		                status: 'offline'
		              }));
		            }
		          }
		        }
		      } catch (e) {
		        console.error('Failed to broadcast offline after TTL:', e);
		      } finally {
		        DisconnectTimers.delete(userID);
		      }
		    }, PRESENCE_TTL_MS);
		    DisconnectTimers.set(userID, timer);

		    // 2) Broadcast immediate "busy" (grace period)
		    const friendIDs: number[] = await chatManagement.getAllUsersWhoHaveMeAsFriend(userID) ?? [];
		    for (const fid of friendIDs) {
		      const friendSocket = MappedClients.get(fid);
		      if (friendSocket && friendSocket.readyState === WebSocket.OPEN) {
		        friendSocket.send(JSON.stringify({
		          type: 'friendStatus',
		          action: 'updateStatus',
		          targetID: fid,
		          friendID: userID,
		          status: 'busy'
		        }));
		      }
		    }
		  } catch (err) {
		    console.error('Failed to broadcast busy on close:', err);
		  } finally {
		    // Remove mapping once done
		    handleDisconnect(userId, fullUser.username, ws);
		  }
		});
		ws.on('message', async (data: RawData) => {
			let parsed: any;
			try {
				parsed = JSON.parse(data.toString());
			} catch {
				return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
			}
	
			// --- Handle message types ---
			switch (parsed.type) {
				case 'systemMessage':{
					const{ chatRoomID, content} = parsed;
					await sendSystemMessage(chatRoomID, content);
					break;
				}
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

                case 'roomDeleted': {
                    const { roomID, targetUserID } = parsed;
                    const socket = MappedClients.get(targetUserID);
                    if (socket) {
                        socket.send(JSON.stringify({ type: 'roomDeleted', roomID: roomID }));
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
		  if (!Array.isArray(friendList)) {
		    ws.send(JSON.stringify({ error: 'Invalid friend list' }));
		    return;
		  }
		  const updatedStatus = friendList.map(({ friendID }) => ({
		    friendID,
		    status: computePresence(friendID) // authoritative presence
		  }));
		  ws.send(JSON.stringify({ type: 'friendStatus', action: 'response', list: updatedStatus }));
		  break;
		}
		//from front A send update
		//Back send live update to any one friends with A, A has B for friends, B join the app, A is "notify"
		case 'update': {

			try {
				// 1) Get all user-IDs who have 'userID' as a friend
				const relatedFriends = await chatManagement.getAllUsersWhoHaveMeAsFriend(userID) ?? [];

				// 2) For each friend, if they have a connected socket, send them the update
				for (const friendID of relatedFriends) {
				  const friendSocket = MappedClients.get(friendID);
				  if (friendSocket) {
				    const presence =
				      parsed.state === 'playing' ? 'playing' : computePresence(userID);

				    friendSocket.send(JSON.stringify({
				      type: 'friendStatus',
				      action: 'updateStatus',
				      targetID: friendID,  // the friend receiving the update
				      friendID: userID,    // the user whose status changed
				      status: presence
				    }));
				  }
				}
			} catch (err) {
				console.error('Failed to update friend status:', err);
				ws.send(JSON.stringify({ error: 'Failed to update friend status' }));
			}

		break;
	}
	}
}

function cleanState(
  raw?: string
): 'online' | 'offline' | 'busy' | 'playing' {
  if (!raw || raw === 'offline' || raw === 'init') return 'offline';
  if (raw === 'playing') return 'playing';
  // Treat lobby/idle/menu/etc. as plain online
  if (raw === 'waiting' || raw === 'idle' || raw === 'menu' || raw === 'ready' || raw === 'matching') {
    return 'online';
  }
  // Anything else (e.g., 'busy') falls back to busy
  return 'busy';
}

function handleDisconnect(userId: number, username: string, ws: WebSocket) {
	const existingSocket = MappedClients.get(userId);

	if (existingSocket === ws) {
		MappedClients.delete(userId);
	} else {
		console.warn(`CHAT : WebSocket mismatch for user ${userId}, not removing.`);
	}
}
	

export default fp(async fastify => {
    // jwtSecret = fastify.vault.jwt;
    // if (!jwtSecret) {
    //     throw new Error("JWT_SECRET was not loaded from Vault. Chat socket cannot start.");
    // }
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
