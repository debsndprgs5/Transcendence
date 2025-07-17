import { WebSocket, WebSocketServer } from 'ws';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import { updatePlayerState } from './game.sockHelpers';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
//import {setPongRoom} from '../utils/pongUtils'
import * as Interfaces from '../shared/gameTypes'
import {createTypedEventSocket} from '../shared/gameEventWrapper'
import { playerMove } from '../services/pong'
import { TypedSocket } from '../shared/gameTypes';
import {handleAllEvents, handleDisconnect} from './game.sockEvents'
import { PongRoom } from '../services/PongRoom';
import { getJwtSecret } from '../vault/vaultPlugin';

export const MappedPlayers = new Map<number, Interfaces.playerInterface<WebSocket>>();

const jwtSecret = getJwtSecret();


export async function initGameSocket(ws: WebSocket, request: any) {
	const result = await verifyAndExtractUser(ws, request).catch(e => {
		console.error('[verifyAndExtractUser ERROR]', e);
		return null;
	});
	if (!result) return;

	const userID = result.userId;
	const oldPlayer = MappedPlayers.get(userID);

	// Always create a fresh typed socket for the new WebSocket instance
	const typedSocket = createTypedEventSocket(ws);

	if (oldPlayer) {
    oldPlayer.typedSocket?.cleanup?.(); // <- this should remove all old listeners
    oldPlayer.socket?.removeAllListeners?.(); 
		//  Reuse existing player object on reconnect
		oldPlayer.socket = ws;
		oldPlayer.typedSocket = typedSocket;
		oldPlayer.hasDisconnected = false;

		// Clear disconnect timeout if still active
		if (oldPlayer.disconnectTimeOut) {
			clearTimeout(oldPlayer.disconnectTimeOut);
			oldPlayer.disconnectTimeOut = undefined;
		}

		// Register event handlers again on the new socket
		handleAllEvents(typedSocket, oldPlayer);
		ws.on('close', () => handleDisconnect(oldPlayer));

		// Notify client of reconnection
    oldPlayer.typedSocket.send('reconnected', {
			userID: oldPlayer.userID,
			username: oldPlayer.username,
			state: oldPlayer.state,
			gameID: oldPlayer.gameID ?? null,
			tournamentID: oldPlayer.tournamentID ?? null,
			message: oldPlayer.state === 'playing' ? 'Reconnected' : 'No game to resume',
		});
    updatePlayerState(oldPlayer, oldPlayer.state);
    if (oldPlayer.gameID) {
      const room = PongRoom.rooms.get(oldPlayer.gameID);
        if (room) {
          room.resume(oldPlayer.userID);
        }
    }
	} else {
		//  First-time connection — create new player
		const user = await UserManagement.getUnameByIndex(userID);

		const player = {
			socket: ws,
			typedSocket,
			userID,
			state: 'init',
			username: user!.username,
			hasDisconnected: false,
		};

		MappedPlayers.set(userID, player);
		handleAllEvents(typedSocket, player);
		ws.on('close', () => handleDisconnect(player));

		typedSocket.send('init', {
			userID,
			state: 'init',
			success: true
		});
    updatePlayerState(player, player.state);
	}
}



export default fp(async (fastify) => {
  const wss = new WebSocketServer({ noServer: true });

  fastify.server.on('upgrade', (request, socket, head) => {
    const { url } = request;
    if (url?.startsWith('/gameSocket')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', initGameSocket);
});

//HELPERS 

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
    const dynamicJwt = getJwtSecret()
    try {
        const payload = jwt.verify(token, dynamicJwt) as JwtPayload;
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

export function getPlayerBySocket(ws: WebSocket): Interfaces.playerInterface<WebSocket> {
  for (const player of MappedPlayers.values()) {
    if (player.socket === ws) return player as Interfaces.playerInterface<WebSocket>;
  }
  throw new Error('Player not found for socket');
}

export function getPlayerByUserID(userID: number): Interfaces.playerInterface | undefined {
  return MappedPlayers.get(userID);
}

export function getPlayerState(userID:number): string | undefined{
  const player = getPlayerByUserID(userID);
  if(!player || player.state === 'offline')
    return('offline')
  if(player.state !== 'init')
    return('in-game')
  if(player.state === 'init')
    return ('online')
  return ('error')
}

export function getAllMembersFromGameID(gameID:number): Interfaces.playerInterface[]|undefined{
    
    const currentPlayers: Interfaces.playerInterface[] = [];

    for (const player of MappedPlayers.values()) {
        if (player.gameID === gameID) {
        currentPlayers.push(player);
        }
    }
    return currentPlayers;
}

export function delPlayer(userID: number) {
  const player = MappedPlayers.get(userID);
  if (!player) return;
  // Close socket if still open
  if (player.socket && player.socket.readyState === WebSocket.OPEN) {
    player.socket.close();
  }
  MappedPlayers.delete(userID);
}

export async function getMembersByTourID(tourID:number):Promise<Interfaces.playerInterface[]|undefined>{
	const members:Interfaces.playerInterface[] = [];
	for(const p of MappedPlayers.values()){
		if(p.tournamentID === tourID)
			members.push(p);
	}
	return members;
}

export async function getAllInitPlayers():Promise<Interfaces.playerInterface[]|undefined>{
	const players:Interfaces.playerInterface[] = [];
	for(const p of MappedPlayers.values()){
		if(p.state === 'init' || p.state === 'online')
			players.push(p);
	}
	return players;
}