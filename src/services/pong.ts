// import * as gameMgr from '../types/game'

// const MappedGames = new Map<number, gameMgr.players[]>();

// interface Game{
// 	mapped:Map<number, gameMgr.players[]>,
// 	settings:string,
// 	balls:string,//{ball1{px,py, vx, vy}, ball2{px,py,vx,vy}...}
// 	playersPos:string,//{p1{pos}, p2{pos}...}
// 	winCondition:string,
// 	limit:number,
// }





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

// export async function gameLoop(currentGame:Game){
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