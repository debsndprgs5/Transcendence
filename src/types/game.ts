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



export class paddleClass{
	 paddleInterface:paddleInterface;

	constructor(paddleInterface:paddleInterface){
		this.paddleInterface = paddleInterface;
 	}
	deplacement_plus(): void{
		if (this.paddleInterface.type == 'H'){
			this.paddleInterface.x += this.paddleInterface.speed;
		}
		if (this.paddleInterface.type == 'V'){
			this.paddleInterface.y += this.paddleInterface.speed;
		}
	}
	deplacement_moins(): void{
		if (this.paddleInterface.type == 'H'){
			this.paddleInterface.x -= this.paddleInterface.speed;
		}
		if (this.paddleInterface.type == 'V'){
			this.paddleInterface.y -= this.paddleInterface.speed;
		}
	}
}

export class ball
{

}



//Assuming 500/100 map
const MAX_WIDTH=100 //y
const MAX_LENGTH=500 //x

export class playerClass{
	
	playerInterface:playerInterface// 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'

	paddle?:paddleClass;

	constructor(playerInterface:playerInterface,
				paddleInterface:paddleInterface){
	this.playerInterface = playerInterface;
	}
	setupFirstPos():void{
		if(this.paddle){
			if(this.paddle.paddleInterface.type === 'H')
				this.paddle.paddleInterface.x = MAX_WIDTH/2
			else if(this.paddle.paddleInterface.type === 'V')
				this.paddle.paddleInterface.y = MAX_LENGTH/2
		}
	}
	moveUp():void{
		
	}
}