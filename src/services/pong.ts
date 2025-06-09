//import * as gameMgr from '../types/game'
import {
	players,
	pongRoom,
	paddle,
	ball,
	balls,
} from '../types/game'
const MappedGames = new Map<number, pongRoom>();

export async function gameloop(balls:ball[], players:players[], type: 2 | 4){
	for(let ball of balls){
		bounce_arena(ball, arena.width, arena.length);
	}
	for(let ball of balls){
		for(let player of players){
			bounce_player(ball, player.paddle);
		}
	}
	test_score(balls, players, players.length, arena.width, arena.lenght);
	for (let player of players){
		if (player.score == PongRoom.limit){
			//send winner signal
		}
	}
	for (let player of players){
		if (signal_key_down || signal_key_left){
			player.paddle.move_add();
		}
		if (signal_key_up || signal_key_right){
			player.paddle.move_minus();
		}
	}
	//render 
}

export function test_score(balls:ball[], players:[players, players] | [players, players, players, players], type: 2 | 4, width:number, lenght:number){
	let score:number = 0;
	let	reset:boolean = false;

	for(let ball of balls){
		if (ball.x - ball.radius <= 0){
			score++;
			ball.score = 1;
		}
		else if (ball.x + ball.radius >= width){
			score++;
			ball.score = 1;
		}
		if (players.length > 2){
			if (ball.y - ball.radius <= 0){
				score++;
				ball.score = 1;
			}
			else if (ball.y + ball.radius >= length){
				score++;
				ball.score = 1;
			}
		}		
	}
	if (score){
		for (let player of players){
			for(let ball of balls){
				if (ball.score){
					if (player.paddle == ball.last_bounce){
						player.score++
						ball.last_bounce = player[0].paddle;
						score--;
						reset = true;
					}
				}
				if (score == 0)
					break;
			}
			if (score == 0)
				break;
		}
	}
	if (reset){
		for (let player of players){
			player.paddle.return_default();
		}
		for (let ball of balls){
			ball.return_default();
		}
	}
}

export function bounce_arena(ball:ball, width:number, length:number){
	if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= width)
		ball.bounce_x();
	if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= length)
		ball.bounce_y();
}

export function bounce_player(ball:ball, paddle:paddle){
	let close_x:number = ball.x;
	let	close_y:number = ball.y;

	if (ball.x < paddle.x)
		close_x = paddle.x;
	else if (ball.x > paddle.x + paddle.width)
		close_x = paddle.x + paddle.width;
	if (ball.y < paddle.y)
		close_y = paddle.y;
	else if (ball.y > paddle.y + paddle.length)
		close_y = paddle.y + paddle.length;

	let dist_x:number = close_x - ball.x;
	let dist_y:number = close_y - ball.y;
	let dist:number = Math.sqrt((dist_x * dist_x) + dist_y * dist_y);

	if (dist <= ball.radius)
	{
		ball.bounce_x();
		ball.bounce_y();
		ball.last_bounce = paddle;
	}
}

// export async function checkWin(currentGame:Game):Promise< boolean >{
// 	//return a bool 
// 	//called at the end of each 'frame'
// 	//if true stop loop 
// 	//Looks if of the the players in Mapped has a score equal or bigger to limit
// 	//if so return true
// 	return false;
// }

// export async function declareWinner(currentGame:Map<number, gameMgr.players[]>){
// 	//check who fill up the win condtion
// 	//update db 
// 	//kick all from room 
// 	//del room
// 	//send winner to win sockets | loser the lose socket
// 	//update game history/playerstattus
// }



// export async function beginGame(gameID:number, players:gameMgr.players[], tournamentID?:number){
// 	for(const p of players){
// 		p.socket.send(JSON.stringify({
// 			type:'statusUpdate',
// 			state:'playing'
// 		}));
// 	}
// 	//push players and gameRoom in map 
// 	//call the loop
// }


// export async function sendRender(currentGame:Game){

// }

// export async function gameLoop(currentGame:pongRoom){
// 	sendRender(currentGame);
// 	checkCollisions(currentGame);
// 	handleMove(currentGame);
// 	if(checkWin(currentGame) === true){
// 		declareWinner(currentGame)
// 		return;
// 	}

// 	setTimeout(() => {
// 		gameLoop(currentGame);
// 	}, 1000 / 60); // 60 FPS game loop (~16.67ms/frame)
// }