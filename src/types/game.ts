import { WebSocket } from 'ws';

export interface tournaments{
	tournamentID: number,
	round: number,
	players_data: string
}

export interface userData{
	gameID:number,
	userID:number,
	mode:string,
	result:string,
	score:string,
	gameDuration:number,
	datas:string,
	created_at:string
}

export interface players{
	userID:number,
	socket:WebSocket,
	gameID?:number,
	tournamentID?:number,
	score?:number,
	hasDisconnected?:boolean,
	state:string // 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'
	playerSide?:string,
	playerPos?:number
}

export interface balls{
	gameID:number,
	posX:number,
	posY:number,
	radius:number,
	vector:{x:number, y:number}
}

export interface pongRoom{
	gameID:number,
	players:players[],
	balls:balls[],
	winCondtion:string, //'score' || 'time'
	limit:number ,//score limit or seconds limit
	mode:string,
	settings?:string,
	created_at?:string
}

