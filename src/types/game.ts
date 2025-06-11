import { WebSocket } from 'ws';
import {playerInterface,
		paddleInterface,
		ballInterface,
		gameRoomInterface } from '../shared/gameTypes'

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




export class ballClass
{
	x:number;
	y:number;
	radius:number;
	speed:number;
	vector: [number, number];
	score:number;
	last_bounce?:number;//userID

	constructor(x:number, y:number, radius:number, speed:number)
	{
		this.x = x;
		this.y = y;
		this.speed = speed;
		this.radius = radius;
		this.vector = [1, 0];
		this.score = 0;
	}

	return_default(): void{
		this.x = x;
		this.y = y;
		this.speed = speed;
		this.radius = radius;
		this.vector = [1, 0];
		this.score = 0;
	}

	bounce_x(): void{
		this.x *= -1;
	}
	bounce_y(): void{
		this.y *= -1;
	}
	move(): void{
		this.x += this.vector[0] + this.speed;
		this.y += this.vector[1] + this.speed;
	}
}


//Assuming 500/100 map
const MAX_WIDTH=100 //y
const MAX_LENGTH=500 //x
