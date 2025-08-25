import { playerInterface } from '../shared/gameTypes'
import * as gameMgr from '../db/gameManagement'
import { getUnameByIndex } from '../db/userManagement'
import { sendSystemMessage , sendPrivateSystemMessage} from '../websockets/chat.socket'
import { getPlayerByUserID } from '../websockets/game.socket';
import { getAliasForUser } from '../websockets/tournament.socket'

type Member = {
	player: playerInterface;
	userID: number;
	points: number;
	opponents: number[];
	buchholz?: number;
	originalGroup?: Member[];
};

export class Tournament {
	public static MappedTour = new Map<number, Tournament>();
	public leftPlayers: Set<number> = new Set();

	tourID: number;
	chatID = 0;
	players: playerInterface[];
	current_round = 0;
	max_round: number;
	rules:string;
	

	// internal state for pairing
	private points = new Map<number, number>();
	private opponents = new Map<number, Set<number>>();
	private playingPairs: [playerInterface, playerInterface][] = [];
	private waitingPairs: [playerInterface, playerInterface][] = [];
	private hasStarted = false;
	private matchReports = new Map<string, Set<number>>();
	private readyPlayers = new Set<number>();
	// Track bye usage
	private byeCount = new Map<number, number>();
	private lastByeRound = new Map<number, number>();
	constructor(
		players: playerInterface[],
		tourID: number,
		rules: string
	  ) {
		const sameTour = Tournament.MappedTour.get(tourID);
		
		this.tourID = tourID;
		this.players = players;
		const parsed = JSON.parse(rules);
		this.max_round = 5;
		this.rules=rules;
		if(sameTour){
		
			return;
		}
		
		// points and opponents init
			for (const p of players) {
			  this.points.set(p.userID, 0);
			  this.opponents.set(p.userID, new Set());
			  // init bye tracking
			  this.byeCount.set(p.userID, 0);
			  this.lastByeRound.set(p.userID, -1);
			}
			Tournament.MappedTour.set(tourID, this);
		}

	public start() {
		if (this.hasStarted) return;
		this.hasStarted = true;
		this.nextRound();
	}
	private totalMatchesCount: number = 0;
	private endedMatchesCount: number = 0;

	private async nextRound() {
		this.current_round++;
		if (this.current_round > this.max_round) {
		  return this.endTournament();
		}
		if (this.players.length <= 1) 
		  return this.endTournament();
		

		// Réinitialisation des compteurs
		this.readyPlayers.clear();
		this.waitingPairs = [];
		this.playingPairs = this.swissPairingAlgo();

		// 2) On initialise totalMatchesCount au nombre de paires (incluant les byes)
		this.totalMatchesCount = this.playingPairs.length;
		this.endedMatchesCount = 0;

		// 3) Traitement immédiat des byes
		const realPairs: [playerInterface, playerInterface][] = [];
		const BYE_POINTS = 5;
		for (const [pA, pB] of this.playingPairs) {
		  if (pA.userID === pB.userID) {
			// – award bye points
			this.points.set(pA.userID, (this.points.get(pA.userID) ?? 0) + BYE_POINTS);
			// – on considère le bye comme un “match terminé”
			this.waitingPairs.push([pA, pB]);
			this.endedMatchesCount++;
		  } else {
			realPairs.push([pA, pB]);
		  }
		}
		this.playingPairs = realPairs;

		// 4) Création des parties pour les vrais duels
		const chat = await gameMgr.getChatIDbyTourID(this.tourID);
		this.chatID = chat!.chatID;
		sendSystemMessage(this.chatID, `Round ${this.current_round}/${this.max_round}: is about to start`);

		const baseRules = JSON.parse(this.rules);
		const extendedRules = { ...baseRules, win_condition: 'time' };
		const gameRulesStr = JSON.stringify(extendedRules);
		const gameName = `Tournament : Round ${this.current_round}/${this.max_round}.`;

		for (const [pA, pB] of this.playingPairs) {
		  const gameID = await gameMgr.createGameRoom(
			'tournament','init','duo',
			gameRulesStr, gameName, 0, this.tourID
		  );
		  await pA.typedSocket.send('startNextRound', { userID: pA.userID, gameID:gameID, gameName:gameName });
		  sendPrivateSystemMessage(this.chatID, pA.userID, `You play against ${getAliasForUser(pB.username!)}`);
		  await pB.typedSocket.send('startNextRound', { userID: pB.userID, gameID:gameID, gameName:gameName });
		  sendPrivateSystemMessage(this.chatID, pB.userID, `You play against ${getAliasForUser(pA.username!)}`);
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
	
public async matchGaveUp(tourID: number, quitterID: number) {
	const tour = Tournament.MappedTour.get(tourID);
	if (!tour) {

		return;
	}

	// Find the current match of the quitter
	const pairIdx = tour.playingPairs.findIndex(
		([a, b]) => a.userID === quitterID || b.userID === quitterID
	);

	if (pairIdx === -1) {
		console.warn(`[GAVE UP] No current match found for userID=${quitterID}`);
		return;
	}

	const [playerA, playerB] = tour.playingPairs[pairIdx];
	const opponent = playerA.userID === quitterID ? playerB : playerA;
	const quitter  = playerA.userID === quitterID ? playerA : playerB;

	// Award points to the opponent (like a draw)
	const drawPoints = 5;
	tour.points.set(opponent.userID, (tour.points.get(opponent.userID) ?? 0) + drawPoints);

	// Prevent future rematch
	tour.opponents.get(opponent.userID)?.add(quitterID);

	// Remove match from playingPairs
	tour.playingPairs.splice(pairIdx, 1);

	// Push only the remaining player into waitingPairs
	tour.waitingPairs.push([opponent, opponent]); // interpreted as "bye for one"

	// Remove quitter from tournament completely
	tour.removeMemberFromTourID(quitterID);

	sendPrivateSystemMessage(this.chatID, opponent.userID, `Your opponent ${getAliasForUser(quitter.username!)}`);
}

public removeMemberFromTourID(userID: number): boolean {
	const tour = Tournament.MappedTour.get(this.tourID);
	if (!tour) {
		return false;
	}

	// 1. Remove from players list
	const idx = tour.players.findIndex(p => p.userID === userID);
	if (idx === -1) {
		console.warn(`[REMOVE] userID=${userID} not found in tournament`);
		return false;
	}
	const removedPlayer = tour.players.splice(idx, 1)[0];

	// 2. Remove their metadata
	tour.points.delete(userID);
	tour.opponents.delete(userID);
	tour.readyPlayers.delete(userID);

	// 3. Remove from current playingPairs and waitingPairs
	const cleanPairList = (list: [playerInterface, playerInterface][]) => {
		return list.filter(([a, b]) => a.userID !== userID && b.userID !== userID);
	};
	tour.playingPairs = cleanPairList(tour.playingPairs);
	tour.waitingPairs = cleanPairList(tour.waitingPairs);

	// 4. Remove them from matchReports (if any)
	for (const [key, reporters] of tour.matchReports.entries()) {
		reporters.delete(userID);
		if (reporters.size === 0) {
			tour.matchReports.delete(key);
		}
	}

	const player = getPlayerByUserID(userID);
	player!.tournamentID = undefined;
	return true;
}

public async onMatchFinished(
  tourID: number,
  playerA: number,
  playerB: number,
  scoreA: number,
  scoreB: number,
  userID: number
) {
  // Retrieve the tournament instance
  const tour = Tournament.MappedTour.get(tourID);
  if (!tour) {
	console.warn(`[MATCH FINISH] No tournament found for tourID=${tourID}`);
	return;
  }

  // Validate reporter is one of the players
  if (userID !== playerA && userID !== playerB) {
	console.warn(`[MATCH FINISH] Invalid reporter userID=${userID} not in match (${playerA} vs ${playerB})`);
	return;
  }

  // Ensure both players still in the tournament
  if (!tour.players.find(p => p.userID === playerA) || !tour.players.find(p => p.userID === playerB)) {
	console.warn(`[MATCH FINISH] One of the players has left the tournament: playerA=${playerA}, playerB=${playerB}`);
	return;
  }

  // Initialize matchReports map if needed
  if (!tour.matchReports) {
	tour.matchReports = new Map<string, Set<number>>();
  }
  const matchKey = [playerA, playerB].sort((a, b) => a - b).join("-");

  // Track reports from each player
  if (!tour.matchReports.has(matchKey)) {
	tour.matchReports.set(matchKey, new Set());
  }
  const reporters = tour.matchReports.get(matchKey)!;
  if (reporters.has(userID)) {
	console.warn(`[MATCH FINISH] Duplicate report from userID=${userID} for match=${matchKey}`);
	return;
  }
  reporters.add(userID);

  // Wait for both players to report
  if (reporters.size < 2) 
	return;
  

  // Both reports received → determine outcome
  const WIN_POINTS = 10, DRAW_POINTS = 5, LOSS_POINTS = 0;
  let msgA: string, msgB: string;

  if (scoreA > scoreB) {
	// Player A wins
	tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + WIN_POINTS);
	tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + LOSS_POINTS);
	msgA = `You won, congrats!`;
	msgB = `You lost, better luck next time.`;
  } else if (scoreB > scoreA) {
	// Player B wins
	tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + WIN_POINTS);
	tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + LOSS_POINTS);
	msgA = `You lost, better luck next time.`;
	msgB = `You won, congrats!`;
  } else {
	// Draw
	tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + DRAW_POINTS);
	tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + DRAW_POINTS);
	msgA = msgB = `Draw! Well played both.`;
  }

  // Notify both players of result
  sendPrivateSystemMessage(tour.chatID, playerA, msgA);
  sendPrivateSystemMessage(tour.chatID, playerB, msgB);

  // Cleanup matchReports for this match
  tour.matchReports.delete(matchKey);

  // Prevent future rematch
  tour.opponents.get(playerA)!.add(playerB);
  tour.opponents.get(playerB)!.add(playerA);

  // Move this match from playingPairs to waitingPairs
  const idx = tour.playingPairs.findIndex(
	([a, b]) =>
	  (a.userID === playerA && b.userID === playerB) ||
	  (a.userID === playerB && b.userID === playerA)
  );
  if (idx !== -1) {
	tour.waitingPairs.push(tour.playingPairs[idx]);
	tour.playingPairs.splice(idx, 1);
  }
	const score = await tour.extractScore();
	for(const[a,b] of tour.waitingPairs){
		a.typedSocket.send('updateTourScore', {tournamentID:tour.tourID, score:score});
		if(a != b)
			b.typedSocket.send('updateTourScore', {tournamentID:tour.tourID, score:score});
	}
}

public async isReadyForNextRound(userID: number) {
	const tour = Tournament.MappedTour.get(this.tourID)!;

	if (tour.readyPlayers.has(userID)) 
		return; // ignore repeated ready signal
	
	// Add to ready set
	tour.readyPlayers.add(userID);

	const totalWaitingUsers = new Set<number>();
	for (const [a, b] of tour.waitingPairs) {
		totalWaitingUsers.add(a.userID);
		if (a.userID !== b.userID) {
			totalWaitingUsers.add(b.userID);
		}
	}

	if (tour.readyPlayers.size >= totalWaitingUsers.size && this.playingPairs.length < 1) {

		// Clear ready state before starting next round
		tour.readyPlayers.clear();

		// Move to next round
		tour.playingPairs = tour.waitingPairs;
		tour.waitingPairs = [];
		await tour.nextRound();
	}
}

public async extractScore(){
		const scoreUpdates = await Promise.all(
		Array.from(this.points.entries()).map(async ([playerId, pts]) => {
			const user = await getUnameByIndex(playerId);
			return {
				username:  getAliasForUser(user!.username!)!,
				score: pts
			};
		})
	);
	scoreUpdates.sort((a, b) => b.score - a.score);
	return scoreUpdates;
}

private async endTournament() {
	const tour =  await gameMgr.getTournamentById(this.tourID)
	// process final ranking
	const standings = [...this.players]
		.sort((a, b) => this.points.get(b.userID)! - this.points.get(a.userID)!);
	// notify all clients
	for (const p of this.players) {
		p.typedSocket.send('endTournament', {
			tourID: this.tourID,
			tourName: tour!.name,
			standings: standings.map(pl => ({
				username: getAliasForUser(pl.username!)!,
				score: this.points.get(pl.userID)!
			}))
		});
	}
	const chat = await gameMgr.getChatIDbyTourID(this.tourID);
	sendSystemMessage(chat!.chatID , `Tournament is over now, who's the boss ? `)
	//Tournament.MappedTour.delete(this.tourID);

}

  public getByeCount(userID: number): number {
    return this.byeCount.get(userID) ?? 0;
  }
  public getLastByeRound(userID: number): number {
    return this.lastByeRound.get(userID) ?? -1;
  }

  public async giveBye(member: Member) {
    const userID = member.userID;
    const player = member.player;

    // 1) Award points for the bye
    const BYE_POINTS = 5;
    const tour = Tournament.MappedTour.get(player.tournamentID!)!;
    tour.points.set(userID, (tour.points.get(userID) ?? 0) + BYE_POINTS);

    // 2) Mark as "played" this round
    tour.waitingPairs.push([player, player]);

    // 3) Update bye tracking
    tour.byeCount.set(userID, tour.getByeCount(userID) + 1);
    tour.lastByeRound.set(userID, tour.current_round);

    // 4) Notify (optional)
    const scoreUpdates = await tour.extractScore();
    player.typedSocket.send('updateTourScore', {
      tourID: tour.tourID,
      score: scoreUpdates!,
    });
    sendPrivateSystemMessage(this.chatID, userID, 'You received a bye this round');
  }
}


function generateSwissPairings(
  round: number,
  members: Member[]
): { playerA: number, playerB: number }[] {

  if (round === 1) {
    members = shuffle(members);
  } else {
    computeMedianBuchholz(members);
  }

  members.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const mbA = (a as any).buchholz as number;
    const mbB = (b as any).buchholz as number;
    return mbB - mbA;
  });

  let allowRematch = false;
  const totalPossiblePairs = (members.length * (members.length - 1)) / 2;
  const playedPairs = new Set<string>();
  for (const m of members) {
    for (const opp of m.opponents) {
      playedPairs.add([m.userID, opp].sort().join("-"));
    }
  }

  const tour = Tournament.MappedTour.get(members[0].player.tournamentID!)!;
  if (playedPairs.size >= totalPossiblePairs && round <= tour.max_round) {
    allowRematch = true;
    console.warn(`[Pairing] All unique matchups exhausted — allowing rematches`);
  }

  const groups = groupBy(members, m => m.points);
  const pairs: { playerA: number, playerB: number }[] = [];
  const floaters: typeof members = [];

  // iterate with index to access the *next group*
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const nextGroup = groups[gi + 1] ?? [];
    let pool = [...group];

    if (pool.length % 2 === 1) {
      let floater: Member | null = null;

      if (!allowRematch) {
        floater = selectFloater(pool, nextGroup);
      } else {
        // If rematches allowed, float only if truly no pairing exists
        for (const candidate of pool) {
          const others = pool.filter(p => p !== candidate);
          const canBePaired = others.some(other => !candidate.opponents.includes(other.userID));
          if (!canBePaired) { floater = candidate; break; }
        }
      }

      if (floater) {
        floater.originalGroup = group;
        floaters.push(floater);
        pool = pool.filter(p => p !== floater);
      }
    }

    const half = pool.length / 2;
    const top = pool.slice(0, half);
    let bottom = pool.slice(half);

    for (let i = 0; i < top.length; i++) {
      const a = top[i];
      let paired = false;

      for (let j = 0; j < bottom.length; j++) {
        const b = bottom[j];
        if (allowRematch || !a.opponents.includes(b.userID)) {
          pairs.push({ playerA: a.userID, playerB: b.userID });
          bottom.splice(j, 1);
          paired = true;
          break;
        }
      }
      if (!paired && bottom.length > 0) {
        // fallback: force a pair (may be rematch) to keep the round feasible
        const b = bottom.shift()!;
        pairs.push({ playerA: a.userID, playerB: b.userID });
      }
    }
  }

  const pairedFloaterIds = new Set<number>();

  for (const floater of floaters) {
    if (pairedFloaterIds.has(floater.userID)) continue;

    let placed = false;

    for (let i = groups.indexOf(floater.originalGroup!) + 1; i < groups.length && !placed; i++) {
      const targetGroup = groups[i];
      if (targetGroup.length % 2 === 1) {
        const opponent = selectOpponentForFloater(floater, targetGroup);
        pairs.push({ playerA: floater.userID, playerB: opponent.userID });
        targetGroup.splice(targetGroup.indexOf(opponent), 1);

        pairedFloaterIds.add(floater.userID);
        pairedFloaterIds.add(opponent.userID);
        placed = true;
      }
    }

    if (!placed) {
      tour.giveBye(floater);
    }
  }
  return pairs;
}



// shuffle an array in-place using Fisher-Yates algorithm
function shuffle<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		// pick a random index from 0 to i
		const j = Math.floor(Math.random() * (i + 1));
		// swap elements at indices i and j
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// group an array of items into buckets according to a key function
function groupBy<T, K extends string | number>(
	array: T[],
	keyFn: (item: T) => K
): T[][] {
	const map = new Map<K, T[]>();
	
	for (const item of array) {
		const key = keyFn(item);
		const bucket = map.get(key);
		if (bucket) {
			bucket.push(item);
		} else {
			map.set(key, [item]);
		}
	}
	
	// Return groups in insertion order
	return Array.from(map.values());
}


// Select a floater in a odd group
function selectFloater(group: Member[], nextGroup: Member[]): Member {
  const tour = Tournament.MappedTour.get(group[0].player.tournamentID!)!;

  // 1) Sort by fairness first: byeCount ASC, then lastByeRound ASC (older bye first),
  //    then Buchholz ASC (weaker first).
  group.sort((a, b) => {
    const aByes = tour.getByeCount(a.userID);
    const bByes = tour.getByeCount(b.userID);
    if (aByes !== bByes) return aByes - bByes;

    const aLast = tour.getLastByeRound(a.userID);
    const bLast = tour.getLastByeRound(b.userID);
    if (aLast !== bLast) return aLast - bLast;

    const aMb = (a as any).buchholz ?? 0;
    const bMb = (b as any).buchholz ?? 0;
    return aMb - bMb;
  });

  // 2) Prefer a floater who *can* meet someone new in nextGroup (if any)
  for (const candidate of group) {
    const hasAvailable = nextGroup.some(opp => !candidate.opponents.includes(opp.userID));
    if (hasAvailable) {
      group.splice(group.indexOf(candidate), 1);
      return candidate;
    }
  }

  // 3) Fallback: take the first after sorting by fairness
  return group.shift()!;
}


function selectOpponentForFloater(
	floater: Member,
	targetGroup: Member[]
): Member {
	// try to find someone the floater hasn't played yet
	for (const candidate of targetGroup) {
		if (!floater.opponents.includes(candidate.userID)) {
			return candidate;
		}
	}

	// if all candidates are rematches, just pick the one with the lowest pairing priority
	return targetGroup[0];
}


// Compute median Buchholz tiebreaker algorythm
function computeMedianBuchholz(members:Member[]) {
	// build a map userID -> points
	const ptsMap = new Map<number, number>(
		members.map(m => [m.userID, m.points])
	);

	// for each member, collect opponent scores, drop min & max if >2, sum the rest
	members.forEach(m => {
		const oppScores = m.opponents
			.map(oppId => ptsMap.get(oppId) ?? 0)
			.sort((a, b) => a - b);
		let mb: number;
		if (oppScores.length > 2) {
			// drop lowest and highest
			mb = oppScores.slice(1, -1).reduce((acc, v) => acc + v, 0);
		} else {
			// if 2 or fewer adversaires, sum all
			mb = oppScores.reduce((acc, v) => acc + v, 0);
		}
		// attach to member
		(m as any).buchholz = mb;
	});
}


