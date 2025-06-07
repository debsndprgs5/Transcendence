import * as Interfaces from '../shared/gameTypes'

/*BIG PACEHODLER FOR MATCHES MANAGMENT 
	NOW -> set random winner when match start based on player side

	SOON -> let the game run for 20sec so I can try paddles
*/

const MappedGames = new Map<number, { game: Interfaces.gameRoomInterface; players: Interfaces.playerInterface[] }>();

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

	// Assign player sides randomly
	const shuffled = players.sort(() => Math.random() - 0.5);
	shuffled[0].playerSide = 'left';
	shuffled[1].playerSide = 'right';

	// Notify players they're in 'playing' state
	for (const p of shuffled) {
		const statusMsg: Interfaces.SocketMessageMap['statusUpdate'] = {
			type: 'statusUpdate',
			userID: p.userID,
			newState: 'playing',
		};
		p.socket.send(JSON.stringify(statusMsg));
		const sideMsg: Interfaces.SocketMessageMap['giveSide'] = {
			type:'giveSide',
			userID:p.userID!,
			gameID:p.gameID!,
			side:p.playerSide!
		};
		p.socket.send(JSON.stringify(sideMsg));
	}

	// Create and store game instance
	const mockGame: Interfaces.gameRoomInterface = {
		gameID,
		winCondtion: 'score',
		limit: 5,
		mode: 'duo',
	};
	MappedGames.set(gameID, { game: mockGame, players: shuffled });
	await mockGameLoop(gameID);
}

export async function mockGameLoop(gameID: number) {
	const gameEntry = MappedGames.get(gameID);
	if (!gameEntry) {
		console.error(`Game ${gameID} not found in map.`);
		return;
	}

	const { game, players } = gameEntry;
	const startTime = Date.now();

	function loopFrame() {
		const elapsed = Date.now() - startTime;

		// === 1. Send renderData to all players (placeholder content) ===
		for (const p of players) {
			const renderMsg: Interfaces.SocketMessageMap['renderData'] = {
				type: 'renderData',
				paddle1Y:players[0].playerPos!,
				paddle2Y:players[1].playerPos!,
				ballX:0,
				ballY:0
				// TODO: include actual positions later
			};
			p.socket.send(JSON.stringify(renderMsg));
		}

		// === 2. Stop after 30 seconds ===
		if (elapsed >= 30_000) {
			const winnerSide = Math.random() < 0.5 ? 'left' : 'right';
			declareWinner(game, players, winnerSide);
			return;
		}

		// === 3. Next frame ===
		setTimeout(loopFrame, 1000 / 60);
	}

	loopFrame();
}

export async function playerMove(gameID: number, userID: number, direction: 'right' | 'left') {
	const gameEntry = MappedGames.get(gameID);
	if (!gameEntry) {
		console.warn(`No game found with ID: ${gameID}`);
		return;
	}

	const player = gameEntry.players.find(p => p.userID === userID);
	if (!player) {
		console.warn(`No player with userID ${userID} in game ${gameID}`);
		return;
	}

	// === Initialize playerPos if not set ===
	if (player.playerPos === undefined) {
		player.playerPos = 0;
	}

	const SPEED_UNIT = 0.8; // BabylonJS-style units per frame
	const movement = SPEED_UNIT * 1; //Needs to adds paddleSpeed here 

	// === Update playerPos ===
	if (direction === 'right') {
		player.playerPos += movement;
	} else if (direction === 'left') {
		player.playerPos -= movement;
	}

	// === Clamp position ===
	player.playerPos = Math.max(-5, Math.min(5, player.playerPos));
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