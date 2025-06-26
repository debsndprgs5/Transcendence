import * as G from '../shared/gameTypes'

export class Tournament{
	
	public static MappedTour = new Map<number, Tournament>()
	tourID:number
	players:G.playerInterface[]
	gameIDs?:number[]

	scores?:string
	paddle_speed:number
	ball_speed:number
	limit:number
	win_condition = 'time'
	current_round = 0
	max_round:number

	constructor(players:G.playerInterface[], tourID:number, rules:string){
		this.tourID = tourID,
		this.players = players,	
		const parsedRules = JSON.parse(rules);
		this.paddle_speed = parsedRules.paddle_speed;
		this.ball_speed = parsedRules.ball_speed;
		this.limit  = parsedRules.limit;
		this.max_round = parsedRules.max_round;

		Tournament.MappedTour.set(tourID, this);

		//SETUP MATCH 

		//SEND SOCKET 

		//WAIT NEXT ROUND 

		//END TOURNAMENT

	}

	private setupMatch(){
		const pairs=swissParingAlgo(this.players)
		for(const p of pairs){
			let match_count = 1;
			if(p.length === 1)
				setDirectWin()
			const gameID = await gameMgr.createGameRoom('tournament', 'init', 'duo', this.rules, `${}` ,0, this.tourID)
			p[0].typedSocket.send('startNextRound', gameID, gameName,)
			p[1].typedSocket.send('startNextRound', gameID, gameName,)
			match_count ++,

	}

	private waitNextRound(){
	}

	private updateScore(){
	}
};
}




/** A FAIRE 

			CE SOIR : 
	ATest	20min		ONLINE STATUS -> if ('offline' | undefined) -> offline
											if(online|init) -> online
											else -> in-game
	ATest	20min		DB -> updateStatusForTourID()
						-> add paddle_speed , ball_speed , limit for tournament
						
			25min		FRONT -> typedSocket.on('startNextRound') -> send(joinGame)

			1h			TOUR class -> include swiss pairing -> members to playerInterfaces, scores as JSONstring


			30min		SOCKET -> waitNextRound -> canvasViewState=waitingTournament, updateState, showPongMenu()

						
						




-> Rajouter 
			-> FRONT on('StartNextRound', data) -> send('joinGame', data)
			-> BACK on endMatch -> if tourID -> notify end match and send score to TourClass
			-> TourClass -> on endMatch -> put PlayingPairs in waitingPairs, send scores to any one with match over 
						-> if PlayingPair.length === 0 
								if currentRound == MaxRound
									endTournament
								StartNextRound


			=>bouger logique tournoi dans services 
			-> demarrer la logique tournoi
					constructor -> 
									make pairs 
									send startNextRound for full pairs -> they send back joinGame 
									send endMatch for unfull -> add to waiting pairs
									on a pair who finish -> add to wating pairs -> send waitingNextRound to all waitingPairs
									if playingPairs empty -> exchange with waiting pairs , ++ on currentRound -> loop back

									if currentRound === maxRounds
										send EndTournament, update DB, dispose




			players[]
			
		playingPairs[]	waitingPairs[]


								
								
*/