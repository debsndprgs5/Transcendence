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
	paddle:paddle
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

export class paddle{
	 x:number;
	 y:number;
	 hitbox: [number, number, number, number];
	 width:number;
	 length:number;
	 type: 'H' | 'V';
	 speed: number;

	constructor(x:number, y:number, width:number, length:number, speed:number, type: 'H' | 'V'){
		this.x = x;
		this.y = y;
		this.width = width;
		this.length = length;
		this.type = type;
		this.speed = speed;
		this.hitbox = [x, x + width, y, y + width];
 	}
	deplacement_plus(): void{
		if (this.type == 'H'){
			this.x += this.speed;
		}
		if (this.type == 'V'){
			this.y += this.speed;
		}
	}
	deplacement_moins(): void{
		if (this.type == 'H'){
			this.x -= this.speed;
		}
		if (this.type == 'V'){
			this.y -= this.speed;
		}
	}
}

export class ball
{

}