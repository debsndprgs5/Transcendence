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
	hasDisconnected?:boolean,
	state:string // 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'
}

export interface Rooms{
	gameID : number,
	isPublic: boolean,
	players: players[];
	status:string //'waiting'|'playing'|'finished'|'terminated'-> give up don't count for win in stats
}