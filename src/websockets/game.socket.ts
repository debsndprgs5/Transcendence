import { WebSocketServer, WebSocket, RawData } from 'wss';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import * as GameManagement from '../db/gameManagement';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { players } from '../types/game'
import {getRenderData, beginGame} from '../services/pong_loop'


const MappedPlayers= new Map<number, players>();


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
				oldWs.socket.close(1000, 'New connection established');
			} catch (e) {
				console.warn('Failed to close previous socket:', e);
			}
		}
		//set New player data 
		const player:players = {
			socket:ws,
			userID:userId,
			state: 'init'
		}
		MappedPlayers.set(userId, player);
		player.socket.send(JSON.stringify({
			type:'init',
			success:'true'
		}));
		ws.on('message', async (data:RawData)=> {
			let parsed:any;
			try{
				parsed = JSON.parse(data.toString());
			}
			catch{
				return ws.send(JSON.stringify({error: 'Failed to receive gameSocket'}));
			}
			switch (parsed.type){
				// case 'create':{
				// 	await handleCreate(parsed, player);
				// }
				case 'joinGame':{
					await handleJoin(parsed, player);
				}
				case 'invite': {
					await handleInvite(parsed, player);
					break;
				}
				case'startGame':{
					await beginGame(parsed.roomID);
					break;
				}
				case 'playerMove':{
					await handlePlayerMove(parsed, player);
					break;
				}
				case 'render':{
					await handleRender(parsed, player);
					break;
				}
				case 'endMatch':{
					await handleEndMatch(parsed);
					break;
				}
			}
		});
}

export async function handlePlayerMoove(parsed:any, player:players){
	//serv recive playerX move +5 ? 
	//send back to who's in room with X , opponent +5
	const opponents =  GameManagement.getAllMembersFromGameRoom
	if(parsed.action === 'up')
}

//should not pass trough sockets
// export async function handleCreate(parsed:any, player:players){
// 	try{
// 		const{userID, alias, isPublic, mode, rules, settings} = parsed;
// 		const result= await GameManagement.createGameRoom(mode,rules);
// 		const gameID = (result as any)?.lastID;
// 		if(!gameID)
// 			throw new Error('Failed to get gameID from database');
// 		await GameManagement.addMemberToGameRoom(gameID, userID, alias);
// 		player.state = 'waiting';
// 		player.socket.send(JSON.stringify({
// 			type : 'create',
// 			success: true,
// 			gameID,
// 			mode,
// 			rules,
// 		}));
// 	}
// 	catch(err){
// 		console.error('handleCreate error:', err);
// 		player.socket.send(JSON.stringify({
// 			type: 'create',
// 			success: false
// 		}));
// 	}
// }


//When user create gameRoom front send joinGame for him 
export async function handleJoin(parsed:any, player:players){
const { userID, alias, gameID, maxPlayers } = parsed;

	if (player.state !== 'init') {
		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: false,
			reason: 'You are not ready to play',
		}));
		return;
	}

	try {
		await GameManagement.addMemberToGameRoom(gameID, userID, alias);
		player.state = 'waiting';

		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: true,
			gameID,
			userID,
			alias,
		}));

		await tryStartGameIfReady(gameID, maxPlayers);
	} catch (err) {
		console.error('handleJoin error', err);
		player.socket.send({
			type: 'joinGame',
			success: false,
			reason: 'Join failed',
		});
	}

}

export async function handleInvite(parsed:any, player:players){
	const { action } = parsed;

	if (action === 'send') {
		const { userID, alias, targetID, gameID } = parsed;
		const target = MappedPlayers.get(targetID);

		if (!target) {
			player.socket.send({ type: 'invite', action: 'reply', response: 'offline' });
			return;
		}

		if (target.state !== 'init') {
			player.socket.send({ type: 'invite', action: 'reply', response: 'busy' });
			return;
		}

		player.state = 'waiting';
		target.state = 'invited';

		target.socket.send({
			type: 'invite',
			action: 'receive',
			fromID: userID,
			fromAlias: alias,
			gameID
		});
	}

	if (action === 'reply') {
		const { fromID, toID, response, gameID } = parsed;
		const inviter = MappedPlayers.get(fromID);
		const invitee = MappedPlayers.get(toID);

		if (inviter)
			inviter.socket.send({
				type: 'invite',
				action: 'reply',
				response,
				targetID: toID
			});

		if (response === 'accept') {
			await GameManagement.addMemberToGameRoom(gameID, toID, invitee?.alias ?? '');
			invitee!.state = 'waiting';
			if (inviter) inviter.state = 'waiting';

			await tryStartGameIfReady(gameID, 2);
		} else {
			if (invitee) invitee.state = 'init';
		}
	}
}

export async function startGame(){
	
}




export async function handleRender(gameID:number, player:players){
	//Send all players and balls pos/velocity/angle 
	const renderData = await getRenderData()
	player.socket.send(JSON.stringify({
		type:'render',
		gameID:gameID,
		userID:player.userID,
		data:renderData
	}));
}

//check for mode and looks max players 
//does same logic but up to maxplayers instead 
export async function tryStartGameIfReady(gameID:number, maxPlayers = 2){
	const playersInGameRoom = await GameManagement.getAllMembersFromGameRoom(gameID);

	if (playersInGameRoom.length > maxPlayers) {
		const playerToKick = await GameManagement.getLastAddedToRoom(gameID);
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
			await beginGame(gameID);
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

export async function handleEndMatch(parsed:any){
	if(parsed.action === 'legit'){
		//check score in parsed.data to know who win ?
		//find the winner socket send -> endMatch action->win|lose
		//update db stats with match stats 
	}
	if(parsed.action === 'playerGaveUp'){
		//the id in parse.userID gaveUp
		//send the other socket -> endMatch action->win or opponentGaveUp ?
	}
}

export async function handlePlayerMove(parsed: any, player: players) {
	const { direction, gameID } = parsed;

	// Get all players from the game room
	const allPlayers = await GameManagement.getAllMembersFromGameRoom(gameID);

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




/*
	type: "create"
	userID:
	alias:
	isPublic:bool
	mode:
	rules:JSonstring{paddle_speed: , ball_speed: ,}
	settings: JSONstring{colors: , sound_path: , ...}

	type "invite"
	A invite B |  B recive invite | A get his response
	action send| action recive    | action reply
	UserID	   | response         | response
	TargetID B | TargetID A       | fromID
	gameID	   |                  |

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
	action: legit | playerGaveUp | oppponentGaveUp
	gameID:
	score:
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