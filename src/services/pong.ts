import * as Interfaces from '../shared/gameTypes'

/* GAMELOOP

export function gameloop(balls:ball[], players:players[], type: 2 | 4){
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


*/

/*BIG PACEHODLER FOR MATCHES MANAGMENT 
	NOW -> set random winner when match start based on player side

	SOON -> let the game run for 20sec so I can try paddles
*/


export async function declareWinner(
	currentGame: Interfaces.gameRoomInterface,
	players: Interfaces.playerInterface[],
	winnerSide: 'left' | 'right'
) {
	for (const p of players) {
		const isWinner = p.playerSide === winnerSide;

		const endMessage: Interfaces.SocketMessageMap['endMatch'] = {
			type: 'endMatch',
			isWinner: isWinner,
		};

		p.socket.send(JSON.stringify(endMessage));
	}

	// Optional: Save match result to DB, if needed
}


export async function beginMockGame(gameID: number, players: Interfaces.playerInterface[]) {
	if (players.length !== 2) {
		console.error("Only 2-player games are supported for now.");
		return;
	}

	// Shuffle and assign sides
	const shuffled = players.sort(() => Math.random() - 0.5);
	shuffled[0].playerSide = 'left';
	shuffled[1].playerSide = 'right';

	// Inform each player
	for (const p of shuffled) {
		const statusMsg: Interfaces.SocketMessageMap['statusUpdate'] = {
			type: 'statusUpdate',
			userID: p.userID,
			newState: 'playing',
		};

		p.socket.send(JSON.stringify(statusMsg));
	}

	// Randomly pick winner
	const winnerSide = Math.random() < 0.5 ? 'left' : 'right';

	// Fake currentGame for now (if not fully implemented)
	const mockGame: Interfaces.gameRoomInterface = {
		gameID,
		winCondtion: 'score',
		limit: 5,
		mode: 'duo',
	};

	await declareWinner(mockGame, shuffled, winnerSide);
}


// export async function sendRender(currentGame:Interfaces.pongRoom, players:Interfaces.playerInterface[]){
// //BroadCast data to all players related to Currentgame
// }

// export async function handleMove(currentGame:Interfaces.pongRoom){
// 	//The sockets recive the players moving allready can't socket update game directly ?
// }

// export async function gameLoop(currentGame:Interfaces.pongRoom, players:Interfaces.playerInterface[]){
// 	sendRender(currentGame, players);
// 	handleMove(currentGame)
// 	if(await checkWin(currentGame)=== true){
// 		declareWinner(currentGame, players)
// 		return;
// 	}

// 	setTimeout(() => {
// 		gameLoop(currentGame);
// 	}, 1000 / 60); // 60 FPS game loop (~16.67ms/frame)
// }