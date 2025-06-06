//import { WebSocket } from 'ws';

export interface playerInterface<SocketType= any>{
	userID:number,
	username?:string,
	socket:SocketType,
	gameID?:number,
	tournamentID?:number,
	score?:number,
	hasDisconnected?:boolean,
	state:string // 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'
	playerSide?:string,
	playerPos?:number
}

export interface paddleInterface{
	userID:number,
	username:string,
	gameID:number,
	x:number,
	y:number,
	hitbox: [number, number, number, number],
	width:number,
	length:number,
	type: 'H' | 'V',
	speed: number
}

export interface ballInterface{
	gameID:number,
	posX:number,
	posY:number,
	radius:number,
	vector:{x:number, y:number}
}

export interface gameRoomInterface{
	gameID:number,
	winCondtion:string, //'score' || 'time'
	limit:number ,//score limit or seconds limit
	mode:string,//2p 4p ...
	settings?:string,
	created_at?:string
}

export type SocketMessageMap = {
	init: { type: 'init'; success: boolean; userID: number; state: string };
	joinGame: { type: 'joinGame'; success?: boolean; reason?: string; gameID?: number , gameName?:string, userID?:number};
	invite: { type: 'invite'; action: 'reply' | 'receive'; response?: string; userID?: number };
	startGame:{type:'startGame'; userID:number; gameID:number};
	statusUpdate:{type:'statusUpdate'; userID:number; newState:string};
	playerMove:{type:'playerMove'; action:'+'|'-';userID:number; distance:number};
	renderData:{type:'renderData'};
	endMatch:{type:'endMatch'; isWinner:boolean};
	reconnected:{type:'reconnected'; userID:number; state:string; gameID?:number; tournamentID?:number};
	leaveGame:{type:'leaveGame'; userID:number; gameID:number};
};

export type SocketMessage = SocketMessageMap[keyof SocketMessageMap];