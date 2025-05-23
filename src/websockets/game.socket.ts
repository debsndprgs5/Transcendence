import { WebSocketServer, WebSocket, RawData } from 'wss';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';


const MappedPlayers= new Map<number, WebSocket>();

dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
}); // get env

const jwtSecret = process.env.JWT_SECRET!;
if (!jwtSecret) {
	throw new Error("JWT_SECRET environment variable is not defined");
}
export async function initGameSocket(ws:WebSocket, request:any){
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
		const oldWs = MappedPlayers.get(userId);
		if (oldWs) {
			try {
				oldWs.close(1000, 'New connection established');
			} catch (e) {
				console.warn('Failed to close previous socket:', e);
			}
		}
		// Set the new socket as the only one
		MappedPlayers.set(userId, ws);
		//Waiting for Players to connect and or accept invite ?
		ws.on('message', async (data:RawData)=> {
			let parsed:any;
			try{
				parsed = JSON.parse(data.toString());
			}
			catch{
				return ws.send(JSON.stringify({error: 'Failed to receive gameSocket'}));
			}
			switch (parsed.type){
				case 'invite': {
					await handleInvite();
					break;
				}
				case 'giveUp':{
					await handleGiveUp();
					break;
				}
				case 'waiting':{
					await handleWaiting();
					break;
				}
				case 'endMatch':{
					await handleEndMatch();
					break;
				}
				case 'render':{
					await handleRender();
					break;
				}
				case 'playerMoove':{
					await handlePlayerMoove();
					break;
				}
			}
		});
}

export function handleGameConnect(ws:WebSocket){
	//once 2 players are found , create a game room if none is given for arg

}

export async function startGame(){
	//All players are ready -> we launch game 
}

export async function handlePlayerMoove(){
	//Player moove up/down
}

export async function handleRender(){
	//Send all players and balls pos/velocity/angle 
}

export async function handleInvite(){
}


/*
		front send Invite(A invite B) > back check if B can play > if so send invite B > wait for B reply > send back to front B reply to A
	type "Invite"
	action 'send' | 'reply'
	userID: A
	targetID: B 
	response: 'accept'|'decline'| 'impossible'-> not conected or playing

		front send A give this up -> back check what to do > reply to others sockets affected (End Match/start next TournamentTurn ...)
	type "Giveup"
	mode: 'game'| 'tournament'
	gameID:
	TournamentID?:
	userID:

			front send usrID and willing mode > back adds to playerSocket > Match found > reply to front ready with roomID
	type "Waiting"
	action 'waiting' | 'ready'
	mode:
	userID:
	gameID?:

		front send data -> back update db > send winner -> front render win or lose 
	type "End match"
	mode:
	gameID:
	winner:yes|no
	data {JSON {for stats later}}
			
		front ask render > back gives back data to render / if render tournament we show all current and comming brackets/matches and byes
		here front could send JSON data for stats an update db every tick ? 
	type: "Render"
	mode:
	userID:
	gameID:
	data:{user_pos: , oponnent_pos: , ball_px: , ball_py: , ball_vel: , ball_angle ...}
		
		front tell back player move 
	type: "PlayerMoove"
	action: 'up'|'down'
	intensity?
	roomID:
	userID or alias 


*/