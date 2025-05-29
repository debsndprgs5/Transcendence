import { WebSocketServer, WebSocket, RawData } from 'ws';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import * as GameManagement from '../db/gameManagement';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { players } from '../types/game'
import path from 'path';
//import {getRenderData, beginGame} from '../services/pong'


const MappedPlayers= new Map<number, players>();


dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
}); // get env

const jwtSecret = process.env.JWT_SECRET!;
if (!jwtSecret) {
	throw new Error("JWT_SECRET environment variable is not defined");
}

function send(ws: WebSocket, message: any) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
}


export async function initGameSocket(ws: WebSocket, request: any) {
	const result = await verifyAndExtractUser(ws, request).catch(e => {
	console.error('[verifyAndExtractUser ERROR]', e);
	return null;
	});
	console.log('[verifyAndExtractUser RESULT]', result);
	if (!result) return;

	const { userId, fullUser } = result;

	const existingPlayer = MappedPlayers.get(userId);

	// Handle reconnect
	if (existingPlayer?.hasDisconnected) {
		console.log(`User ${userId} reconnected`);
		existingPlayer.hasDisconnected = false;
		existingPlayer.socket = ws;

		// Clear old timeout if saved
		if ((existingPlayer as any).disconnectTimeout)
			clearTimeout((existingPlayer as any).disconnectTimeout);

		send(ws, {
			type: 'reconnected',
			state: existingPlayer.state,
			gameID: existingPlayer.gameID,
		});

		setupMessageHandlers(ws, existingPlayer);
		return;
	}

	// Disconnect old connection if needed
	if (existingPlayer) {
		try {
			existingPlayer.socket.close(1000, '[GAME]:New connection established');
		} catch (e) {
			console.warn('Failed to close previous socket:', e);
		}
	}

	const player: players = {
		socket: ws,
		userID: userId,
		state: 'init',
		hasDisconnected: false
	};

	MappedPlayers.set(userId, player);

	send(ws,{
		type: 'init',
		success: 'true'
	});

	setupMessageHandlers(ws, player);
}

async function verifyAndExtractUser(
	ws: WebSocket,
	request: any
): Promise<{ userId: number; fullUser: user } | null> {
	const url = new URL(request.url, `https://${request.headers.host}`);
	const token = url.searchParams.get('token');

	if (!token) {
		console.log('Connection rejected: No token provided');
		ws.close(1008, 'No token');
		return null;
	}

	try {
		const payload = jwt.verify(token, jwtSecret) as JwtPayload;
		const rand_id = payload.sub as string;

		const fullUser: user | null = await UserManagement.getUserByRand(rand_id);
		if (!fullUser) {
			ws.close(1008, 'User not found');
			return null;
		}

		return {
			userId: fullUser.our_index,
			fullUser,
		};
	} catch (error) {
		console.log('Connection rejected: Invalid token', error);
		ws.close(1008, 'Invalid token');
		return null;
	}
}


export async function setupMessageHandlers(ws: WebSocket, player: players) {
	ws.on('message', async (data: RawData) => {

		let parsed: any;
		try {
			parsed = JSON.parse(data.toString());
		} catch {
			return send(ws, { error: 'Failed to receive gameSocket' });
		}
		console.log('GAME : Message received from client:', parsed);
		switch (parsed.type) {
			case 'init': await handleInit(parsed, player); break;
			case 'joinGame': await handleJoin(parsed, player); break;
			case 'invite': await handleInvite(parsed, player); break;
			case 'startGame': beginGame(parsed.roomID); break;
			case 'playerMove': await handlePlayerMove(parsed, player); break;
			case 'render': await handleRender(parsed, player); break;
			default:
				send(ws, { error: 'Unknown message type' });
		}
	});

	ws.on('close', () => handleDisconnect(player));
}



function beginGame(roomID:number){
	console.log('GAME IS NOT IMPLEMENTED YET SORRY');

}

async function handleInit(parsed:any, player:players){
	
	const {userID} = parsed;
	console.log(`HANDLE INIT CALLED : ${userID}`)
	if(userID !== player.userID)
		player.socket.send(JSON.stringify({
			type: 'init',
			success: 'failure'
		}));
	if(userID === player.userID)
		player.socket.send(JSON.stringify({
			type: 'init',
			userID:player.userID,
			state:'init',
			success: 'true',
		}));
}


function handleDisconnect(player: players) {
	console.log(`User ${player.userID} disconnected. Waiting 15s for reconnect...`);
	player.hasDisconnected = true;

	// Store timeout so we can cancel it if they reconnect
	const timeout = setTimeout(() => {
		const stillDisconnected = MappedPlayers.get(player.userID);
		if (stillDisconnected && stillDisconnected.hasDisconnected) {
			console.log(`User ${player.userID} did not reconnect in time. Removing from game.`);
			MappedPlayers.delete(player.userID);
			cleanupPlayerFromGame(player);
		}
	}, 15000);

	// Save the timeout on the player object (optional but handy)
	(player as any).disconnectTimeout = timeout;
}

//When user create gameRoom front send joinGame for him 
export async function handleJoin(parsed:any, player:players){
const { userID, gameName, gameID } = parsed;

	if (player.state !== 'init') {
		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: false,
			reason: 'You are not ready to play',
		}));
		return;
	}

	try {
		await GameManagement.addMemberToGameRoom(gameID, userID);
		player.state = 'waiting';
		player.gameID = gameID;
		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: true,
			state: player.state,
			gameID,
			userID,
		}));

		await tryStartGameIfReady(gameID);
	} catch (err) {
		console.error('handleJoin error', err);
		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: false,
			reason: 'Join failed',
		}));
	}

}

export async function handleInvite(parsed:any, player:players){
	const { actionRequested } = parsed;

	if (actionRequested === 'send') {
		const { userID, alias, targetID, gameID } = parsed;
		const target = MappedPlayers.get(targetID);

		if (!target) {
			player.socket.send(JSON.stringify({ type: 'invite', action: 'reply', response: 'offline' }));
			return;
		}

		if (target.state !== 'init') {
			player.socket.send(JSON.stringify({ type: 'invite', action: 'reply', response: 'busy' }));
			return;
		}

		player.state = 'waiting';
		target.state = 'invited';

		target.socket.send(JSON.stringify({
			type: 'invite',
			action: 'receive',
			fromID: userID,
			fromAlias: alias,
			gameID
		}));
	}

	if (actionRequested === 'reply') {
		const { fromID, toID, response, gameID } = parsed;
		const inviter = MappedPlayers.get(fromID);
		const invitee = MappedPlayers.get(toID);

		if (inviter)
			inviter.socket.send(JSON.stringify({
				type: 'invite',
				action: 'reply',
				response,
				targetID: toID
			}));

		if (response === 'accept') {
			await GameManagement.addMemberToGameRoom(gameID, toID);
			invitee!.state = 'waiting';
			if (inviter) inviter.state = 'waiting';

			await tryStartGameIfReady(gameID, 2);
		} else {
			if (invitee) invitee.state = 'init';
		}
	}
}


export async function handleRender(parsed:any, player:players){
	//Send all players and balls pos/velocity/angle 
	//const renderData = await getRenderData()
	const renderData=null;
	player.socket.send(JSON.stringify({
		type:'render',
		gameID:player.gameID,
		userID:player.userID,
		data:renderData
	}));
}

async function cleanupPlayerFromGame(player: players) {
	const gameID = player.gameID;
	if (!gameID) {
		console.warn(`cleanupPlayerFromGame called with no gameID`);
		return;
	}

	// Remove player from DB and update their state
	await GameManagement.delMemberFromGameRoom(gameID, player.userID);
	player.state = 'init';

	// Notify them (if socket still open)
	if (player.socket.readyState === WebSocket.OPEN) {
		player.socket.send(JSON.stringify({
			type: 'removed',
			reason: 'Disconnected for too long',
			gameID
		}));
	}

	// Check if other players remain in the game room
	const remainingPlayers = await GameManagement.getAllMembersFromGameRoom(gameID);

	if (remainingPlayers.length === 0) {
		console.log(`Room ${gameID} is now empty. Deleting it.`);

		// ❌ Remove from gameRooms
		await GameManagement.deleteGameRoom(gameID);

		// ✅ Add here any future cleanup (like ending match stats or timers)
		// e.g. cancelGameLoop(gameID);
	}
}


//does same logic but up to maxplayers instead 
export async function tryStartGameIfReady(gameID:number, maxPlayers = 2){
	const playersInGameRoom = await GameManagement.getAllMembersFromGameRoom(gameID);

	if (playersInGameRoom.length > maxPlayers) {
		const playerToKick = await GameManagement.getLastAddedToRoom(gameID);
		if(!playerToKick?.userID)
			return;
		const excluded = MappedPlayers.get(playerToKick?.userID);
		await kickFromGameRoom(gameID, excluded);
		return tryStartGameIfReady(gameID, maxPlayers);
	}

	if (playersInGameRoom.length === maxPlayers) {
		const playerObjs = playersInGameRoom
			.map(p => MappedPlayers.get(p.userID))
			.filter(p => p?.state === 'waiting') as players[];

		if (playerObjs.length === maxPlayers) {
			playerObjs.forEach(p => {
				p.state = 'playing';
				p.socket.send(JSON.stringify({ type: 'startGame', gameID }));
			});

			// send first render and start game loop
			 beginGame(gameID);
		}
	}
}


export async function kickFromGameRoom(gameID:number, player?:players){
	if(!player){
		console.warn('IS PLAYER STILL CONNECTED ??');
		return;
	}
	await GameManagement.delMemberFromGameRoom(gameID, player.userID);
	player.state = 'init';
	player.socket.send(JSON.stringify({
		type: 'kicked',
		reason: 'too many players in room',
		gameID
	}));
}

export async function handlePlayerMove(parsed: any, player: players) {
	const { direction, gameID } = parsed;

	// Get all players from the game room
	const allPlayers = await GameManagement.getAllMembersFromGameRoom(gameID);
	//send the move , the player ID and roomID to the gameLoop?
	// Broadcast to all players in the room except the one who moved
	for (const p of allPlayers) {
		if (p.userID === player.userID) continue;

		const targetPlayer = MappedPlayers.get(p.userID);
		if (targetPlayer && targetPlayer.socket.readyState === WebSocket.OPEN) {
			targetPlayer.socket.send(JSON.stringify({
				type: 'playerMove', 
				userID: player.userID,
				direction
			}));
		}
	}
}

export default fp(async (fastify) => {
  const wss = new WebSocketServer({ noServer: true });

  fastify.server.on('upgrade', (request, socket, head) => {
    const { url } = request;
	console.log('[GAME][onupgrade]');
    if (url?.startsWith('/gameSocket')) {
		console.log('[startWith/game]')
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', initGameSocket);
});

