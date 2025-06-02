import * as gameMgr from '../types/game'

const MappedGames = new Map<gameMgr.Rooms, gameMgr.players[]>();

export async function beginGameLoop(gameID:number, players:gameMgr.players[]){
	//Adds the game and the players to mappedGames
	//Makes sure no players are in 2 rooms in same time 
	//kick last joined rooms if ever  
}

export async function getWinCondition(gameRoom:gameMgr.Rooms){
	//returns a JSONstring{type:'score'|time, limit:points or second}
	//Looks in settings of game object to find out 
}

export async function checkWinCondtion(gameRoom:gameMgr.Rooms){
	//return a bool 
	//called at the end of each 'frame'
	//if true stop loop 
}

export async function declareWinner(gameRoom:gameMgr.Rooms){
	//check who fill up the win condtion
	//update db 
	//kick all from room 
	//del room
	//send winner to win sockets | loser the lose socket 
}

export async function receivePlayerMove(gameID:number, playerID:number){
	//when socket recieve player moves update the whole game state
}

export async function getRenderData(gameRoom:gameMgr.Rooms){
	//look at the current game and update data string 
	//returns a JSON string 
	//{ p1:pos, oppnonent1:pos, ball_1_posX: , ball_1_posY: , ball_1_speed: , ball_1_vx: , ball_1_vy: ...}
}

export async function gameLogic(gameRoom:gameMgr.Rooms){
	//the function that does the actual loop and calls all the other to run the game
}

// export async function beginGame(gameID:number, players:gameMgr.players[], tournamentID?:number){
// 	const currentGame.gameMgr.Rooms = {
// 		gameID,
// 		tournamentID,
// 		status:'starting'
// 	}
// 	for(const p of players){
// 		p.socket.send(JSON.stringify({
// 			type:'statusUpdate',
// 			state:'playing'
// 		}));
// 	}
// }