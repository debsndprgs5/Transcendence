import * as G from '../shared/gameTypes'

export class Tournament {
	public static MappedTour = new Map<number, Tournament>();

	tourID: number;
	players: playerInterface[];
	current_round = 0;
	max_round: number;
	
	type Member = {
		player: playerInterface;
		userID: number;
		points: number;
		opponents: number[];
		buchholz?: number;
		originalGroup?: Member[];
	};

	// état interne pour le pairing
	private points = new Map<number, number>();
	private opponents = new Map<number, Set<number>>();
	private playingPairs: [playerInterface, playerInterface][] = [];
	private waitingPairs: [playerInterface, playerInterface][] = [];

	constructor(
		players: playerInterface[],
		tourID: number,
		rules: string
	) {
		this.tourID = tourID;
		this.players = players;
		const parsed = JSON.parse(rules);
		this.max_round = parsed.max_round;

		// points and opponents init
		for (const p of players) {
			this.points.set(p.userID, 0);
			this.opponents.set(p.userID, new Set());
		}

		Tournament.MappedTour.set(tourID, this);
		// start first round
		this.nextRound();
	}

	private async nextRound() {
	  this.current_round++;
	  if (this.current_round > this.max_round) {
	    return this.endTournament();
	  }

	  // Generating pairs
	  this.playingPairs = this.swissPairingAlgo();

	  // Start Matches
	  for (const [pA, pB] of this.playingPairs) {
	    const gameID = await gameMgr.createGameRoom(
	      'tournament', 'init', 'duo',
	      this.rules, /*…*/, 0, this.tourID
	    );
	    pA.typedSocket.send('startNextRound', { gameID, opponent: pB.userID });
	    pB.typedSocket.send('startNextRound', { gameID, opponent: pA.userID });
	  }
	}

	private swissPairingAlgo(): [playerInterface, playerInterface][] {
		// init members
		const members: Member[] = this.players.map(p => ({
			player: p,
			userID: p.userID,
			points: this.points.get(p.userID)!,
			opponents: Array.from(this.opponents.get(p.userID)!),
		}));

		const rawPairs = generateSwissPairings(this.current_round, members);

		// Transform it into an array of playerInterface
		return rawPairs.map(({ playerA, playerB }) => {
			const mA = members.find(m => m.userID === playerA)!;
			const mB = members.find(m => m.userID === playerB)!;
			return [mA.player, mB.player];
		});
	}

	public async onMatchFinished(
		tourID: number,
		playerA: number,
		playerB: number,
		scoreA: number,
		scoreB: number
	) {
		const tour = Tournament.MappedTour.get(tourID)!;
		// update points
		const winPoints = 10, lossPoints = 0;
		if (scoreA > scoreB) {
			tour.points.set(playerA, tour.points.get(playerA)! + winPoints);
		} else {
			tour.points.set(playerB, tour.points.get(playerB)! + winPoints);
		}
		// register match in opponents to avoid rematch
		tour.opponents.get(playerA)!.add(playerB);
		tour.opponents.get(playerB)!.add(playerA);

		// remove pair from playingPairs and put in waitingPairs
		const idx = tour.playingPairs.findIndex(
			([a,b]) =>
				(a.userID === playerA && b.userID === playerB) ||
				(a.userID === playerB && b.userID === playerA)
		);
		if (idx !== -1) {
			tour.waitingPairs.push(tour.playingPairs[idx]);
			tour.playingPairs.splice(idx, 1);
		}

		// When all pairs are done, restart
		if (tour.playingPairs.length === 0) {
			// swap waiting -> playing for next loop
			tour.playingPairs = tour.waitingPairs;
			tour.waitingPairs = [];
			// next round
			tour.nextRound();
		}
	}


private endTournament() {
	// process final ranking
	const standings = [...this.players]
		.sort((a, b) => this.points.get(b.userID)! - this.points.get(a.userID)!);
	// notify all clients
	for (const p of this.players) {
		p.typedSocket.send('tournamentFinished', {
			tourID: this.tourID,
			standings: standings.map(pl => ({
				userID: pl.userID,
				username: pl.username!,
				score: this.points.get(pl.userID)!
			}))
		});
	}
	Tournament.MappedTour.delete(this.tourID);
}
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