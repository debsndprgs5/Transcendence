import * as gameMgr from '../types/game'
import {
	players,
	balls,
	pongRoom
} from '../types/game'
const MappedGames = new Map<number, pongRoom>();




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