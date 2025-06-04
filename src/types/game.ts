import { WebSocket } from 'ws';

export interface gameRooms{
	gameID: number,
	tournamentID?:number,
	mode:string,
	rules:string,
	created_at: string
}

export interface gameMembers{
	gameID: number,
	tournamentID?: number,
	userID: number,
	alias: string
}

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
}

export interface balls{
	gameID:number,
	posX:number,
	posY:number,
	radius:string,
	vector:{x:number, y:number}
}

export interface pongRoom{
	gameID:number,
	players:players[],
	balls:balls[],
	winCondtion:string, //'score' || 'time'
	limit:number //score limit or seconds limit
}

