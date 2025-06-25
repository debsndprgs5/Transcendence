// import * as G from '../shared/gameTypes'

// export class Tournament{
	
// 	public static MappedTour = new Map<number, Tournament>()
// 	tourID:number
// 	players:G.playerInterface[]
// 	gameIDs?:number[]

// 	scores?:string
// 	paddle_speed:number
// 	ball_speed:number
// 	limit:number
// 	win_condition = 'time'
// 	current_round = 0
// 	max_round:number

// 	constructor(players:G.playerInterface[], tourID:number, rules:string){
// 		this.tourID = tourID,
// 		this.players = players,	
// 		const parsedRules = JSON.parse(rules);
// 		this.paddle_speed = parsedRules.paddle_speed;
// 		this.ball_speed = parsedRules.ball_speed;
// 		this.limit  = parsedRules.limit;
// 		this.max_round = parsedRules.max_round;

// 		Tournament.MappedTour.set(tourID, this);

// 		//SETUP MATCH 

// 		//SEND SOCKET 

// 		//WAIT NEXT ROUND 

// 		//END TOURNAMENT

// 	}

// 	private setupMatch(){
// 		const pairs=swissParingAlgo(this.players)
//		for(const p of pairs){
//			const match_count = 1;
//			if(p.length === 1)
//				setDirectWin()
//			const gameID = await gameMgr.createGameRoom('tournament', 'init', 'duo', this.rules, `${}` ,0, this.tourID)
//			p[0].typedSocket.send('startNextRound', gameID, gameName,)
//			p[1].typedSocket.send('startNextRound', gameID, gameName,)
//			match_count ++,
//
// 	}

// 	private waitNextRound(){
// 	}

// 	private updateScore(){
// 	}
// };




/** A FAIRE -> Rajouter a la db tournoi les regles des matchs 
			-> enlever maxPlayers et juste laisser playerCount
			-> pouvoir updateTourStatus
			-> FRONT on('StartNextRound', data) -> send('joinGame', data)
			-> BACK on endMatch -> if tourID -> notify end match and send score to TourClass
			-> TourClass -> on endMatch -> put PlayingPairs in waitingPairs, send scores to any one with match over 
						-> if PlayingPair.length === 0 
								if currentRound == MaxRound
									endTournament
								StartNextRound

			players[]
			playingPairs[]
			waitingPairs[]
								
								
*/