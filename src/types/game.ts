// import { WebSocket } from 'ws';
// import {playerInterface,
// 		paddleInterface,
// 		ballInterface,
// 		gameRoomInterface } from '../shared/gameTypes'

// export interface tournaments{
// 	tournamentID: number,
// 	round: number,
// 	players_data: string
// }

// export interface userData{
// 	gameID:number,
// 	userID:number,
// 	mode:string,
// 	result:string,
// 	score:string,
// 	gameDuration:number,
// 	datas:string,
// 	created_at:string
// }



// export class paddleClass{
// 	 paddleInterface:paddleInterface;

// 	constructor(paddleInterface:paddleInterface){
// 		this.paddleInterface = paddleInterface;
//  	}
// 	move_add(): void{
// 		if (this.paddleInterface.type == 'H' && this.paddleInterface.x < MAX_LENGTH){
// 			this.paddleInterface.x += this.paddleInterface.speed;
// 		}
// 		if (this.paddleInterface.type == 'V' && this.paddleInterface.y < MAX_WIDTH){
// 			this.paddleInterface.y += this.paddleInterface.speed;
// 		}
// 	}
// 	move_minus(): void{
// 		if (this.paddleInterface.type == 'H' && this.paddleInterface.x > 0){
// 			this.paddleInterface.x -= this.paddleInterface.speed;
// 		}
// 		if (this.paddleInterface.type == 'V' && this.paddleInterface.y > 0){
// 			this.paddleInterface.y -= this.paddleInterface.speed;
// 		}
// 	}
// }


// export class ballClass
// {
// 	x:number;
// 	y:number;
// 	radius:number;
// 	speed:number;
// 	vector: [number, number];
// 	score:number;
// 	last_bounce?: paddleClass;

// 	constructor(x:number, y:number, radius:number, speed:number)
// 	{
// 		this.x = x;
// 		this.y = y;
// 		this.speed = speed;
// 		this.radius = radius;
// 		this.vector = [1, 0];
// 		this.score = 0;
// 	}

// 	return_default(): void{
// 		this.x = x;
// 		this.y = y;
// 		this.speed = speed;
// 		this.radius = radius;
// 		this.vector = [1, 0];
// 		this.score = 0;
// 	}

// 	bounce_x(): void{
// 		this.x *= -1;
// 	}
// 	bounce_y(): void{
// 		this.y *= -1;
// 	}
// 	move(): void{
// 		this.x += this.vector[0] + this.speed;
// 		this.y += this.vector[1] + this.speed;
// 	}
// }


// //Assuming 500/100 map
// const MAX_WIDTH=100 //y
// const MAX_LENGTH=500 //x

// export class playerClass{
	
// 	playerInterface:playerInterface// 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'

// 	paddle:paddleClass;

// 	constructor(playerInterface:playerInterface,
// 				paddleInterface:paddleInterface){
// 	this.playerInterface = playerInterface;
// 	this.paddle = paddleInterface;
// 	}
// 	setupFirstPos():void{
// 		if(this.paddle){
// 			if(this.paddle.paddleInterface.type === 'H')
// 				this.paddle.paddleInterface.x = MAX_WIDTH/2
// 			else if(this.paddle.paddleInterface.type === 'V')
// 				this.paddle.paddleInterface.y = MAX_LENGTH/2
// 		}
// 	}
// 	moveUp():void{
		
// 	}
// }


import { paddleInterface, ballInterface } from '../shared/gameTypes'

export class paddleClass {
  constructor(public paddleInterface: paddleInterface) {}
  move_add() {
    if (this.paddleInterface.type === 'H')
      this.paddleInterface.x += this.paddleInterface.speed
    else
      this.paddleInterface.y += this.paddleInterface.speed
  }
  move_minus() {
    if (this.paddleInterface.type === 'H')
      this.paddleInterface.x -= this.paddleInterface.speed
    else
      this.paddleInterface.y -= this.paddleInterface.speed
  }
}

export class ballClass {
  public x: number
  public y: number
  public radius: number
  public speed: number
  public vector: [number, number]
  public last_bounce?: paddleClass
  constructor(x: number, y: number, radius: number, speed: number) {
    this.x = x
    this.y = y
    this.radius = radius
    this.speed = speed
    this.vector = [1, 0]
  }
  bounce_x() { this.vector[0] *= -1 }
  bounce_y() { this.vector[1] *= -1 }
  move() {
    this.x += this.vector[0] * this.speed
    this.y += this.vector[1] * this.speed
  }
}
