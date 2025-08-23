// import * as Interfaces from '../shared/gameTypes'
// import { createTypedEventSocket } from '../shared/gameEventWrapper'
// import {
// 	paddleClass,
// 	playerClass,
// 	ballClass,
// } from '../types/game'

// const MappedGames = new Map<
//   number,
//   {
//     game: Interfaces.gameRoomInterface & { parsedSettings?: any };
//     players: Interfaces.playerInterface[];
//     loopTimeout?: NodeJS.Timeout;
//     startTime: number;
//   }
// >();

// /* GAMELOOP (with some obvious placeholder here and there) */

// export async function gameloop(balls:ballClass[], players:playerClass[], type: 2 | 4){
// 	for(let ball of balls){
// 		bounce_arena(ball, arena.width, arena.length);
// 	}
// 	for(let ball of balls){
// 		for(let player of players){
// 			bounce_player(ball, player.paddle);
// 		}
// 	}
// 	test_score(balls, players as [playerClass, playerClass] | [playerClass, playerClass, playerClass, playerClass], players.length as 2 | 4
// 		, arena.width, arena.lenght);
// 	for (let player of players){
// 		if (player.score == PongRoom.limit){//////////////////////////////////////////////replacePONGROOM with whatever
// 			//send winner signal
// 		}
// 	}
// 	/*for (let player of players){					//////////////////////////////////////Flag for deletion
// 		if (signal_key_down || signal_key_left){
// 			player.paddle.paddleInterface.move_add();
// 		}
// 		if (signal_key_up || signal_key_right){
// 			player.paddle.paddleInterface.move_minus();
// 		}
// 	}*/
// 	createTypedEventSocket('renderData', {players, balls});
// }

// ///////////////////////////////////////////////////UNSURE IF THIS ONE STAYS IT MIGHT BUT NOT IN ITS CURRENT STATE
// export function test_score(balls:ballClass[], players:[playerClass, playerClass] | [playerClass, playerClass, playerClass, playerClass], type: 2 | 4, width:number, lenght:number){
// 	let score:number = 0;
// 	let	reset:boolean = false;

// 	for(let ball of balls){
// 		if (ball.x - ball.radius <= 0){
// 			score++;
// 			ball.score = 1;
// 		}
// 		else if (ball.x + ball.radius >= width){
// 			score++;
// 			ball.score = 1;
// 		}
// 		if (players.length > 2){
// 			if (ball.y - ball.radius <= 0){
// 				score++;
// 				ball.score = 1;
// 			}
// 			else if (ball.y + ball.radius >= length){
// 				score++;
// 				ball.score = 1;
// 			}
// 		}		
// 	}
// 	if (score){
// 		for (let player of players){
// 			for(let ball of balls){
// 				if (ball.score){
// 					if (player.paddle == ball.last_bounce){
// 						player.score++
// 						ball.last_bounce = player.paddle;
// 						score--;
// 						reset = true;
// 					}
// 				}
// 				if (score == 0)
// 					break;
// 			}
// 			if (score == 0)
// 				break;
// 		}
// 	}
// 	if (reset){
// 		for (let player of players){
// 			player.paddle.paddleInterface.return_default();
// 		}
// 		for (let ball of balls){
// 			ball.return_default();
// 		}
// 	}
// }

// export function stopGameLoop(gameID: number) {
//   const room = PongRoom.rooms.get(gameID)
//   if (room) room.stop()
// }

// export function bounce_arena(ball:ballClass, width:number, length:number){
// 	if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= width)
// 		ball.bounce_x();
// 	if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= length)
// 		ball.bounce_y();
// }

// export function bounce_player(ball:ballClass, paddle:paddleClass){
// 	let close_x:number = ball.x;
// 	let	close_y:number = ball.y;

// 	if (ball.x < paddle.paddleInterface.x)
// 		close_x = paddle.paddleInterface.x;
// 	else if (ball.x > paddle.paddleInterface.x + paddle.paddleInterface.width)
// 		close_x = paddle.paddleInterface.x + paddle.paddleInterface.width;
// 	if (ball.y < paddle.paddleInterface.y)
// 		close_y = paddle.paddleInterface.y;
// 	else if (ball.y > paddle.paddleInterface.y + paddle.paddleInterface.length)
// 		close_y = paddle.paddleInterface.y + paddle.paddleInterface.length;

// 	let dist_x:number = close_x - ball.x;
// 	let dist_y:number = close_y - ball.y;
// 	let dist:number = Math.sqrt((dist_x * dist_x) + dist_y * dist_y);

// 	if (dist <= ball.radius)
// 	{
// 		ball.bounce_x();
// 		ball.bounce_y();
// 		ball.last_bounce = paddle;
// 	}
// }


// /*BIG PACEHODLER FOR MATCHES MANAGMENT 
// 	NOW -> set random winner when match start based on player side

// 	SOON -> let the game run for 20sec so I can try paddles
// */

// ////////////////////////////////////////////////////////////////////PLACEHOLDER flag for deletion
// export async function declareWinner(
// 	currentGame: Interfaces.gameRoomInterface,
// 	players: Interfaces.playerInterface[],
// 	winnerSide: 'left' | 'right'
// ) {
// 	for (const p of players) {
// 		const isWinner = p.playerSide === winnerSide;

// 		const endMessage: Interfaces.SocketMessageMap['endMatch'] = {
// 			type: 'endMatch',
// 			isWinner: isWinner,
// 		};

// 		p.socket.send(JSON.stringify(endMessage));
// 	}

// 	// Optional: Save match result to DB, if needed
// }

// ////////////////////////////////////////////////////////////////////PLACEHOLDER flag for deletion
// export async function beginMockGame(gameID: number, players: Interfaces.playerInterface[]) {
// 	if (players.length !== 2) {
// 		console.error("Only 2-player games are supported for now.");
// 		return;
// 	}

// 	// Shuffle and assign sides
// 	const shuffled = players.sort(() => Math.random() - 0.5);
// 	shuffled[0].playerSide = 'left';
// 	shuffled[1].playerSide = 'right';

// 	// Inform each player
// 	for (const p of shuffled) {
// 		const statusMsg: Interfaces.SocketMessageMap['statusUpdate'] = {
// 			type: 'statusUpdate',
// 			userID: p.userID,
// 			newState: 'playing',
// 		};

// 		p.socket.send(JSON.stringify(statusMsg));
// 	}

// 	// Randomly pick winner
// 	const winnerSide = Math.random() < 0.5 ? 'left' : 'right';

// 	// Fake currentGame for now (if not fully implemented)
// 	const mockGame: Interfaces.gameRoomInterface = {
// 		gameID,
// 		winCondtion: 'score',
// 		limit: 5,
// 		mode: 'duo',
// 	};

// 	await declareWinner(mockGame, shuffled, winnerSide);
// }


// // export async function sendRender(currentGame:Interfaces.pongRoom, players:Interfaces.playerInterface[]){
// // //BroadCast data to all players related to Currentgame
// // }

// // export async function handleMove(currentGame:Interfaces.pongRoom){
// // 	//The sockets recive the players moving allready can't socket update game directly ?
// // }

// // export async function gameLoop(currentGame:Interfaces.pongRoom, players:Interfaces.playerInterface[]){
// // 	sendRender(currentGame, players);
// // 	handleMove(currentGame)
// // 	if(await checkWin(currentGame)=== true){
// // 		declareWinner(currentGame, players)
// // 		return;
// // 	}

// // 	setTimeout(() => {
// // 		gameLoop(currentGame);
// // 	}, 1000 / 60); // 60 FPS game loop (~16.67ms/frame)
// // }
// BIG PACEHODLER FOR MATCHES MANAGMENT 
// 	SOON -> let the game run for 20sec so I can try paddles


// ///////////////////////////////////////////START OF THE "NeedHelpForViewBranch"////////////////////////////////


// ////////////////////////////////////////////////////////////////////PLACEHOLDER (i think) flag for deletion
// export async function declareWinner(
//   currentGame: Interfaces.gameRoomInterface,
//   players: Interfaces.playerInterface[],
//   winnerSides: ('left' | 'right' | 'top' | 'bottom')[]
// ) {
//   for (const p of players) {
//     const isWinner = winnerSides.includes(p.playerSide!);
//     const endMessage: Interfaces.SocketMessageMap['endMatch'] = {
//       type: 'endMatch',
//       isWinner,
//     };

//     // Use your typed socket send helper here
//     const typedSocket = createTypedEventSocket(p.socket);
//     typedSocket.send('endMatch', endMessage);
//   }
//   // Optional: save to DB here
// }


// ////////////////////////////////////////////////////////////////////PLACEHOLDER(i think) flag for deletion
// export async function startMockGameLoop(
//   gameID: number,
//   players: Interfaces.playerInterface[],
//   rules: {
//     winCondtion: 'score' | 'time';
//     limit: number;
//     ballSpeed: number;
//     paddleSpeed: number;
//   }
// ) {
//   const startTime = Date.now();

//   // Initialize player positions
//   players.forEach(p => {
//     if (p.playerPos === undefined) p.playerPos = 0;
//   });
//    // === Create a new game object ===
//     // === Create a new game object ===
//   const gameEntry = {
//     game: {
//        gameID,            // gameID to match the game's unique ID
//       winCondtion: rules.winCondtion, // winCondtion is either 'score' or 'time'
//       limit: rules.limit,            // The score or time limit
//       mode: players.length === 2 ? 'duo' : 'quatuor', // Mode based on the number of players (defaulting to '2p' or '4p')
//       ballSpeed: rules.ballSpeed,    // ballSpeed from rules
//       paddleSpeed: rules.paddleSpeed, // paddleSpeed from rules
//       settings: '',  // Add an empty string or a custom setting if needed
//       created_at: new Date().toISOString(), // Create timestamp for the game start
//     },
//     players,
//     loopTimeout: undefined, // Make sure to set this to undefined initially
//     startTime, // Include startTime for elapsed time calculations
//   };

//   // === Add the game to the MappedGames map ===
//   MappedGames.set(gameID, gameEntry);
//   function loopFrame() {
//     const elapsed = (Date.now() - startTime) / 1000;

//     // === Build nested renderData structure ===
//     const paddles: Record<number, { pos: number; side: 'left' | 'right' | 'top' | 'bottom' }> = {};
//     const balls: Record<number, { x: number; y: number }> = {}; // No ball yet

//     for (const p of players) {
//       paddles[p.userID] = {
//         pos: p.playerPos!,
//         side: p.playerSide!,
//       };
//     }

//     // Dummy ball placeholder (just to maintain structure)
//     balls[0] = { x: 0, y: 0 };
//    // balls[1] = { x: 1, y: 1 };
//     //balls[2] = { x: 2, y: 2 };

//     // === Send to all players ===
//     for (const p of players) {
//       const renderMsg: Interfaces.SocketMessageMap['renderData'] = {
//         type: 'renderData',
//         paddles,
//         balls,
//       };

//       p.typedSocket.send('renderData', renderMsg);
//     }

//     // === Game end conditions ===

//     if (rules.winCondtion === 'time' && elapsed >= rules.limit) {
//       const winnerSide =
//         players.length === 4
//           ? (['left', 'right', 'top', 'bottom'] as const)[Math.floor(Math.random() * 4)]
//           : (['left', 'right'] as const)[Math.floor(Math.random() * 2)];

//       declareWinner(MappedGames.get(gameID)!.game, players, [winnerSide]);
//       return;
//     }

//     // === DEBUG: score win condition ends after 30s
//     if (rules.winCondtion === 'score' && elapsed >= 30) {
//       console.log('[DEBUG] Ending game after 30s with winCond = score');

//     const winnerSide =
//       players.length === 4
//         ? (['left', 'right', 'top', 'bottom'] as const)[Math.floor(Math.random() * 4)]
//         : (['left', 'right'] as const)[Math.floor(Math.random() * 2)];

//       declareWinner(MappedGames.get(gameID)!.game, players, [winnerSide]);
//       return;
//     }

//     setTimeout(loopFrame, 1000 / 60);
//   }

//   loopFrame();
// }
// //That's one big function


// ////////////////////////////////////////////////////////////////////Might not stays as it is
// export async function playerMove(
//   gameID: number,
//   userID: number,
//   direction: 'right' | 'left' | 'stop'
// ) {
//   const gameEntry = MappedGames.get(gameID);
//   if (!gameEntry) {
//     console.warn(`No game found with ID: ${gameID}`);
//     return;
//   }

//   const player = gameEntry.players.find(p => p.userID === userID);
//   if (!player) {
//     console.warn(`No player with userID ${userID} in game ${gameID}`);
//     return;
//   }

//   if (player.playerSide === undefined) {
//     console.warn(`Player ${userID} has no assigned side`);
//     return;
//   }

//   // === Init playerPos if undefined ===
//   if (player.playerPos === undefined) {
//     player.playerPos = 0;
//   }

//   // === Get paddleSpeed from settings ===
//   const settings = (gameEntry.game as any).parsedSettings || {};
//   const paddleSpeedSetting = Number(settings.paddle_speed) || 50;
//   const BASE_SPEED = 0.8;
//   const speedMultiplier = Math.max(1, Math.min(100, paddleSpeedSetting)) / 50;
//   const movement = BASE_SPEED * speedMultiplier;

//   // === Determine map boundary based on mode ===
//   const mode = gameEntry.game.mode || (gameEntry.players.length === 4 ? 'quator' : 'duo');
//   const MAP_LIMIT = mode === 'quator' ? 6 : 5;
//   const halfPaddle = 1.5;

//   // === Move based on player side ===
//   if (player.playerSide === 'left' || player.playerSide === 'right') {
//     if (direction === 'right') {
//       player.playerPos += movement;
//     } else if (direction === 'left') {
//       player.playerPos -= movement;
//     }
//     console.log(`POSTION UPDATED FOR PLAYER${userID} `);
//     // Clamp X-axis
//     player.playerPos = Math.max(-MAP_LIMIT + halfPaddle, Math.min(MAP_LIMIT - halfPaddle, player.playerPos));
//   }

//   else if (player.playerSide === 'top' || player.playerSide === 'bottom') {
//     if (direction === 'right') {
//       player.playerPos += movement;
//     } else if (direction === 'left') {
//       player.playerPos -= movement;
//     }

//     // Clamp Y-axis
//     player.playerPos = Math.max(-MAP_LIMIT + halfPaddle, Math.min(MAP_LIMIT - halfPaddle, player.playerPos));
//   }
//   console.log(`[playerMove] gameID=${gameID} userID=${userID} pos=${player?.playerPos}`);


//   // 'stop' does nothing for now
// }


import { PongRoom } from './PongRoom'

export function playerMove(
  gameID: number,
  userID: number,
  dir: 'left' | 'right' | 'stop'
) {
  const room = PongRoom.rooms.get(gameID)
  if (room) room.move(userID, dir)
}

export function stopGameLoop(gameID: number) {
  const room = PongRoom.rooms.get(gameID)
  if (room) room.stop()
}