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
// 		//Find pairs of players for fisrt round
// 	}

// 	private waitNextRound(){
// 	}

// 	private updateScore(){
// 	}
// };