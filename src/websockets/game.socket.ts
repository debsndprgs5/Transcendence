import { WebSocket, WebSocketServer } from 'ws';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';

import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
//import {setPongRoom} from '../utils/pongUtils'
import * as Interfaces from '../shared/gameTypes'
import {createTypedEventSocket} from '../shared/gameEventWrapper'
import { playerMove } from '../services/pong'
import {handleAllEvents} from './game.sockEvents'

interface PlayerWithTimeout extends Interfaces.playerInterface {
  disconnectTimeout?: NodeJS.Timeout;
}

export const MappedPlayers = new Map<number, PlayerWithTimeout>();

dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
}); // get env

const jwtSecret = process.env.JWT_SECRET!;
if (!jwtSecret) {
	throw new Error("JWT_SECRET environment variable is not defined");
}

export async function initGameSocket(ws: WebSocket, request: any) {
  const result = await verifyAndExtractUser(ws, request).catch(e => {
    console.error('[verifyAndExtractUser ERROR]', e);
    return null;
  });
  if (!result) return;

  const { userId } = result;
  const existingPlayer = MappedPlayers.get(userId);

  if (existingPlayer?.hasDisconnected && existingPlayer?.socket) {
    // reconnect logic
    existingPlayer.hasDisconnected = false;
    existingPlayer.socket = ws;
    if ((existingPlayer as any).disconnectTimeout)
      clearTimeout((existingPlayer as any).disconnectTimeout);

    const typedSocket = createTypedEventSocket(ws);
    typedSocket.send('reconnected', { userID: userId, state: existingPlayer.state, gameID: existingPlayer.gameID });

    // Register all event handlers at once
    handleAllEvents(typedSocket);

    return;
  }

  if (existingPlayer?.socket) {
    try {
      existingPlayer.socket.close(1000, '[GAME]: New connection established');
    } catch {}
  }

  const user = await UserManagement.getUnameByIndex(userId);
  const player: Interfaces.playerInterface<WebSocket> = {
    socket: ws,
    userID: userId,
    state: 'init',
    username: user!.username,
    hasDisconnected: false,
  };

  MappedPlayers.set(userId, player);

  const typedSocket = createTypedEventSocket(ws);

  // Register all event handlers in one call
  handleAllEvents(typedSocket);

  // Send initial init confirmation
  typedSocket.send('init', { userID: player.userID, state: player.state, success: true });
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

export function getPlayerBySocket(ws: WebSocket): Interfaces.playerInterface<WebSocket> {
  for (const player of MappedPlayers.values()) {
    if (player.socket === ws) return player as Interfaces.playerInterface<WebSocket>;
  }
  throw new Error('Player not found for socket');
}


export function getPlayerByUserID(userID: number): Interfaces.playerInterface | undefined {
  return MappedPlayers.get(userID);
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