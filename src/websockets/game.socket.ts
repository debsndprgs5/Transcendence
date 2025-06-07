import { WebSocketServer, WebSocket, RawData } from 'ws';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import * as GameManagement from '../db/gameManagement';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
//import {setPongRoom} from '../utils/pongUtils'
import * as Interfaces from '../shared/gameTypes'
import {beginMockGame, playerMove} from '../services/pong'


const MappedPlayers= new Map<number, Interfaces.playerInterface>();


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
	console.log('[verifyAndExtractUser SUCCESS]');
	if (!result) return;

	const { userId, fullUser } = result;

	const existingPlayer = MappedPlayers.get(userId);

	// Handle reconnect
	if (existingPlayer?.hasDisconnected && existingPlayer?.socket) {
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
		console.log(`RECONCETION HANDLE FOR BACK`)
		setupMessageHandlers(ws, existingPlayer);
		return;
	}

	if (existingPlayer?.socket) {
		console.log(`[GAME] Closing old socket for user ${userId}`);
		try {
			existingPlayer.socket.close(1000, '[GAME]:New connection established');
		} catch (e) {
			console.warn('Failed to close previous socket:', e);
		}
		console.log(`[GAME] Old socket close triggered for user ${userId}`);
	}

	const player: Interfaces.playerInterface<WebSocket> = {
		socket: ws,
		userID: userId,
		state: 'init',
		hasDisconnected: false
	};

	MappedPlayers.set(userId, player);
	console.log(`TRYING TO SEND INIT GAME`)
	send(ws,{
		type: 'init',
		userID:player.userID,
		state:'init',
		success: true
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


export async function setupMessageHandlers(ws: WebSocket, player: Interfaces.playerInterface) {
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
			case 'leaveGame': handleLeaveGame(parsed, player); break;
			case 'playerMove': await handlePlayerMove(parsed, player); break;
			case 'render': await handleRender(parsed, player); break;
			case 'reconnected' :  handleDisconnect(player);break;
			default:
				send(ws, { error: 'Unknown message type' });
		}
	});

	ws.on('close', () => handleDisconnect(player));
}



async function beginGame(roomID:number, players:Interfaces.playerInterface[]){
	console.log('GAME IS NOT IMPLEMENTED YET SORRY');
	//Creates Room object
	//const newGame:pongRoom = await setPongRoom(roomID, players);
	for(const p of players)
		p.socket?.send(JSON.stringify({
			type:'startGame',
			//Send first render ? 
			//all players Uname ? 
			//all players pos ? 
		}));
	await beginMockGame(roomID, players);
	//send socket to all players to startGame
	//Call the loop/gameLogic with newGame
}

async function handleInit(parsed:any, player:Interfaces.playerInterface){
	
	const {userID} = parsed;
	console.log(`HANDLE INIT CALLED : ${userID}`)
	if(userID !== player.userID)
		player.socket?.send(JSON.stringify({
			type: 'init',
			success: false
		}));
	if(userID === player.userID)
		player.socket?.send(JSON.stringify({
			type: 'init',
			userID:player.userID,
			state:'init',
			success: true
		}));
}
async function handleReconnect(userID: number, newSocket: WebSocket) {
	const player = MappedPlayers.get(userID);
	if (!player || !player.hasDisconnected) {
		console.log(`[GAME] Reconnect failed or not needed for user ${userID}`);
		return;
	}

	console.log(`[GAME] Reconnected: user ${userID}`);

	// Re-associate new socket
	player.socket = newSocket;
	player.hasDisconnected = false;

	// Clear the disconnect timeout
	if ((player as any).disconnectTimeout) {
		clearTimeout((player as any).disconnectTimeout);
		delete (player as any).disconnectTimeout;
	}

	// You might want to notify the game loop/UI here
}


function handleDisconnect(player: Interfaces.playerInterface) {
	console.log(`User ${player.userID} disconnected. Waiting 15s for reconnect...`);
	player.hasDisconnected = true;

	// Store timeout so we can cancel it if they reconnect
	const timeout = setTimeout(() => {
		const stillDisconnected = MappedPlayers.get(player.userID);
		if (stillDisconnected && stillDisconnected.hasDisconnected) {
			console.log(`User ${player.userID} in game: ${player.gameID} did not reconnect in time. Removing from game.`);
			cleanupPlayerFromGame(player);
			MappedPlayers.delete(player.userID);
		}
	}, 15000);

	// Save the timeout on the player object (optional but handy)
	(player as any).disconnectTimeout = timeout;
}

//When user create gameRoom front send joinGame for him 
export async function handleJoin(parsed:any, player:Interfaces.playerInterface){
const { userID, gameName, gameID } = parsed;

	if (player.state !== 'init') {
		player.socket?.send(JSON.stringify({
			type: 'joinGame',
			success: false,
			reason: `you are in ${player.state} mode`,
		}));
		return;
	}

	try {
		await GameManagement.addMemberToGameRoom(gameID, userID);
		console.log(`ADDING [USERID]${userID} in gameRoom : ${gameID}`);
		player.state = 'waiting';
		player.gameID = gameID;
		player.socket?.send(JSON.stringify({
			type: 'joinGame',
			success: true,
			state: player.state,
			gameID:player.gameID,
			gameName:gameName,
			userID: player.userID
		}));
	} catch (err) {
		console.error('handleJoin error', err);
		player.socket?.send(JSON.stringify({
			type: 'joinGame',
			success: false,
			reason: 'Join failed',
		}));
	}
	await tryStartGameIfReady(gameID);
}

export async function handleInvite(parsed:any, player:Interfaces.playerInterface){
	const { actionRequested } = parsed;

	if (actionRequested === 'send') {
		const { userID, alias, targetID, gameID } = parsed;
		const target = MappedPlayers.get(targetID);

		if (!target) {
			player.socket?.send(JSON.stringify({ type: 'invite', action: 'reply', response: 'offline' }));
			return;
		}

		if (target.state !== 'init') {
			player.socket?.send(JSON.stringify({ type: 'invite', action: 'reply', response: 'busy' }));
			return;
		}

		player.state = 'waiting';
		target.state = 'invited';

		target.socket?.send(JSON.stringify({
			type: 'invite',
			action: 'receive',
			fromID: userID,
			gameID
		}));
	}

	if (actionRequested === 'reply') {
		const { fromID, toID, response, gameID } = parsed;
		const inviter = MappedPlayers.get(fromID);
		const invitee = MappedPlayers.get(toID);

		if (inviter)
			inviter.socket?.send(JSON.stringify({
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


export async function handleRender(parsed:any, player:Interfaces.playerInterface){
	//Send all players and balls pos/velocity/angle 
	//const renderData = await getRenderData()
	const renderData=null;
	player.socket?.send(JSON.stringify({
		type:'render',
		gameID:player.gameID,
		userID:player.userID,
		data:renderData
	}));
}

async function cleanupPlayerFromGame(player: Interfaces.playerInterface) {
	 const gameID = player.gameID;
	if (!gameID) {
		console.warn(`cleanupPlayerFromGame called with no gameID`);
		return;
	}

	// Remove player from DB and update their state
	await GameManagement.delMemberFromGameRoom(gameID , player.userID);
	player.state = 'init';
	// Notify them (if socket still open)
	if (player.socket?.readyState === WebSocket.OPEN) {
		player.socket?.send(JSON.stringify({
			type: 'removed',
			gameID:player.gameID
		}));
		player.socket?.send(JSON.stringify({
			type:'statusUpdate',
			newState:'init',
			userID: player.userID
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
	console.log(`TRYSTARTGAME IF READY for roomID: ${gameID}\n NUMBER OF PLAYERS IN ROOM : ${playersInGameRoom.length}`);
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
		.filter((p): p is Interfaces.playerInterface => !!p);
		console.log(`starting game in process for user:${playerObjs.length}\n`);
		if (playerObjs.length === maxPlayers) {
			playerObjs.forEach(p => {
				console.log(`starting game in process for user:${p}\n`);
				p.state = 'playing';
				p.socket?.send(JSON.stringify({ type: 'startGame', gameID }));
				p.socket?.send(JSON.stringify({type:'statusUpdate', playerState:p.state}))
			});

			// send first render and start game loop
			 beginGame(gameID, playerObjs);
		}
	}
}


export async function kickFromGameRoom(gameID:number, player?:Interfaces.playerInterface){
	if(!player){
		console.warn('IS PLAYER STILL CONNECTED ??');
		return;
	}
	await GameManagement.delMemberFromGameRoom(gameID, player.userID);
	player.state = 'init';
	player.socket?.send(JSON.stringify({
		type: 'kicked',
		reason: 'too many players in room',
		gameID
	}));
	player.socket?.send(JSON.stringify({
		type:'statusUpdate',
		playerState: player.state
	}))
}

export async function handlePlayerMove(parsed: any, player: Interfaces.playerInterface) {
	const { direction, gameID } = parsed;

	await playerMove(gameID, player.userID, direction)
}

export async function handleLeaveGame(parsed:any, player:Interfaces.playerInterface){
	//Check for winner loser before 
	await cleanupPlayerFromGame(player)
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

