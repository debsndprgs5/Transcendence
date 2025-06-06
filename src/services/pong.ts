import * as Interfaces from '../shared/gameTypes'

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