import {
	players,
	balls,
	pongRoom
} from '../types/game'
import * as GameManagement from '../db/gameManagement';


//Assuming 500/100 map
const MAXHEIGTH=100
const MAXLENGTH=500

export async function  setPongRoom(roomID:number, players:players[]):Promise<pongRoom>{
	
	const newGame:pongRoom = {
		gameID:roomID,
		players: await setPlayers(roomID, players),
		balls: await setBalls (roomID),
		winCondtion : 'score',//await setWinCondtition(roomID),
		limit:10, //await setLimits(roomID),
		mode:'1v1', //await setMode(roomID),
	//	settings: null,//await getSettings(roomID),
		created_at:new Date().toISOString()
	}
	return newGame;
}


export async function setPlayers(roomID: number, players: players[]): Promise<players[]> {
	let isLeft = true;

	for (const p of players) {
		p.state = 'playing';
		p.gameID = roomID;
		p.score = 0;
		p.playerPos = MAXHEIGTH/2; // center of their side
		p.playerSide = isLeft ? 'left' : 'right';
		isLeft = !isLeft;
	}

	return players;
}

export async function setBalls(roomID:number): Promise<balls[]>{
	//Should check in DB for rules and mode trough gameID and set ball to start 
	//eg 1v1:1ball, 4players:2 to 4 ?
	
	const balls:balls[] = [];
	balls.push({
		gameID:roomID,
		posX:MAXLENGTH/2,
		posY:MAXHEIGTH/2,
		radius:0, //First angle on the ball ?
		vector:{x:0,y:0}
	});
	return balls;
}