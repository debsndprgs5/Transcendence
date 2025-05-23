import { WebSocketServer, WebSocket, RawData } from 'wss';
import fp from 'fastify-plugin';
import { user } from '../types/user';
import * as UserManagement from '../db/userManagement';
import * as GameManagement from '../db/gameManagement';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { players } from '../types/game'


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
				case 'create':{
					await handleCreate(parsed, player);
				}
				case 'join':{
					await handleJoin(parsed, player);
				}
				case 'invite': {
					await handleInvite(parsed, player);
					break;
				}
				case 'waiting':{
					await handleWaiting(parsed, player);
					break;
				}
				case 'playerMoove':{
					await handlePlayerMoove(parsed, player);
					break;
				}
				case 'render':{
					await handleRender(parsed, player);
					break;
				}
				case 'endMatch':{
					await handleEndMatch(parsed, player);
					break;
				}
				case 'giveUp':{
					await handleGiveUp(parsed, player);
					break;
				}
			}
		});
}

export async function handleCreate(parsed:any, player:players){
	try{
		const{userID, alias, isPublic, mode, rules, settings} = parsed;
		const result= await GameManagement.createGameRoom(mode,rules);
		const gameID = (result as any)?.lastID;
		if(!gameID)
			throw new Error('Failed to get gameID from database');
		await GameManagement.addMemberToGameRoom(gameID, userID, alias);
		player.state = 'waiting';
		player.socket.send(JSON.stringify({
			type : 'create',
			success: true,
			gameID,
			mode,
			rules,
		}));
	}
	catch(err){
		console.error('handleCreate error:', err);
		player.socket.send(JSON.stringify({
			type: 'create',
			success: false
		}));
	}
}

export async function handleJoin(parsed:any, player:players){
	try{
		const {userID, alias, gameID} = parsed;
		await GameManagement.addMemberToGameRoom(gameID, userID, alias);
		player.state = 'waiting';
		player.socket.send(JSON.stringify({
			type: 'joinGame',
			success: true,
			gameID,
			userID,
			alias
		}));
		//Game can start here 
	}
	catch(err){
		console.error('handleJoin error', err);
		player.socket.send(JSON.stringify({
			type : 'joinGame',
			success: false
		}));
	}

}

export async function handleInvite(parsed:any, player:players){
	const {action} = parsed;
	if (action == 'send'){
		const {userID, alias, targetID, gameID} = parsed;
		const targPlayer = MappedPlayers.get(targetID);
		if(!targPlayer){
			player.socket.send(JSON.stringify({
				type: 'invite',
				action: 'reply',
				response: 'offline'
			}))
			return;
		}
		else if(targPlayer?.state !== 'init'){
			player.socket.send(JSON.stringify({
				type:'invite',
				action: 'reply',
				response : 'busy'
			}));
			return;
		}
		targPlayer.socket.send(JSON.stringify({
			type:'invite',
			action: 'receive',
			fromID: userID,
			fromAlias: alias,
			gameID
		}));
		player.state = 'waitingInvite';
		targPlayer.state = 'invited';
		return;
	}
	if(action == 'reply'){
		const{fromID, toID, response} = parsed;
		const targPlayer = MappedPlayers.get(toID);
		if(!targPlayer) return;
		targPlayer.socket.send(JSON.stringify({
			type: 'invite',
			action: 'reply',
			response,
			targetID: fromID
		}))
		const fromPlayer = MappedPlayers.get(fromID);
		if(response === 'accept'){
			targPlayer.state = 'waiting';
			if(fromPlayer)
				fromPlayer.state = 'waiting';
			//Game can start here 		
		}
		else{
			targPlayer.state = 'init';
			if(fromPlayer)
				fromPlayer.state = 'init';
		}
	}
}

export async function startGame(){
	
}

export async function handlePlayerMoove(){
	//Player moove up/down
}

export async function handleRender(){
	//Send all players and balls pos/velocity/angle 
}

export async function tryStartGameIfReady(gameID:number){
	const playersInGameRoom = await GameManagement.getAllMembersFromGameRoom(gameID);
	if(playersInGameRoom.length > 2){
		//WE FUCKED UP HERE HEHE
		const playerToKick = await GameManagement.getLastAddedToRoom(gameID);
		if(!playerToKick){
			console.warn('Big error here, db is broken');
			return;
		}
		const excluded = MappedPlayers.get(playerToKick?.userID);
		await kickFromGameRoom(gameID,excluded);
		tryStartGameIfReady(gameID); 
	}
	if(playersInGameRoom.length === 2){
		const p1 = MappedPlayers.get(playersInGameRoom[0].userID);
		const p2 = MappedPlayers.get(playersInGameRoom[1].userID);
		if(p1?.state === 'waiting' && p2?.state === 'waiting'){
			p1.state = 'playing';
			p2.state = 'playing';
			const msg = JSON.stringify({
				type: 'startGame',
				gameID
			});
			p1.socket.send(msg);
			p2.socket.send(msg);
		}
	}
	else 
		console.error('THIS SHOULD NEVER HAPPEND TOO ?');
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