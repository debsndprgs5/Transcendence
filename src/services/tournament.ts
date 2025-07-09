import { playerInterface } from '../shared/gameTypes'
import * as gameMgr from '../db/gameManagement'
import { getUnameByIndex } from '../db/userManagement'

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

	tourID: number;
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
			console.warn(`[TOURNAMENT][TOURID called twice]`)
			return;
		}
		
		// points and opponents init
		for (const p of players) {
			this.points.set(p.userID, 0);
			this.opponents.set(p.userID, new Set());
		}

		Tournament.MappedTour.set(tourID, this);
	}
	public start() {
		if (this.hasStarted) return;
		this.hasStarted = true;
		this.nextRound();
	}

	private async nextRound() {
		this.current_round++;
		if (this.current_round > this.max_round) {
			return this.endTournament();
		}
		// Generating pairs
		this.playingPairs = this.swissPairingAlgo();
				
		console.log(`[ROUND ${this.current_round}] Total matches this round: ${this.playingPairs.length}`);
		console.log(`[ROUND ${this.current_round}] Round pairing started.`);
		console.log(`[ROUND ${this.current_round}] All participant IDs:`, this.players.map(p => p.userID));
		console.log(`[ROUND ${this.current_round}] Already matched player sets:`, this.opponents);


		const baseRules = JSON.parse(this.rules);
		// Inject the tournament's win_condition
		const extendedRules = {
			...baseRules,
			win_condition: 'time',
		};

		const gameRulesStr = JSON.stringify(extendedRules);
		const gameName = `Tournament : Round ${this.current_round}/${this.max_round}.`;

		for (const [pA, pB] of this.playingPairs) {
			const gameID = await gameMgr.createGameRoom(
				'tournament', 'init', 'duo',
				gameRulesStr, gameName, 0, this.tourID
			);
			await pA.typedSocket.send('startNextRound', { userID: pA.userID, gameID, gameName });
			await pB.typedSocket.send('startNextRound', { userID: pB.userID, gameID, gameName });
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
	scoreB: number,
	userID: number
) {
	const tour = Tournament.MappedTour.get(tourID);
	if (!tour) {
		console.warn(`[MATCH FINISH] No tournament found for tourID=${tourID}`);
		return;
	}

	if (userID !== playerA && userID !== playerB) {
		console.warn(`[MATCH FINISH] Invalid reporter userID=${userID} not in match (${playerA} vs ${playerB})`);
		return;
	}

	// Ensure matchReports map
	if (!tour.matchReports) tour.matchReports = new Map<string, Set<number>>();
	const matchKey = [playerA, playerB].sort((a, b) => a - b).join("-");

	// Log who is reporting what
	console.log(`[MATCH FINISH] Report received from userID=${userID} for match=${matchKey}`);
	console.log(`[MATCH FINISH]   ↳ Raw score: scoreA=${scoreA} scoreB=${scoreB}`);

	// Track reporters
	if (!tour.matchReports.has(matchKey)) {
		tour.matchReports.set(matchKey, new Set());
	}
	const reporters = tour.matchReports.get(matchKey)!;

	if (reporters.has(userID)) {
		console.warn(`[MATCH FINISH] Duplicate report from userID=${userID} for match=${matchKey}`);
		return;
	}
	reporters.add(userID);

	console.log(`[MATCH FINISH]   ↳ Total reporters so far: ${reporters.size}`);

	if (reporters.size < 2) {
		console.log(`[MATCH FINISH]   ↳ Waiting for second player to report`);
		return;
	}

	console.log(`[MATCH FINISH]   ↳ Both players reported, processing result`);

	// Award points
	const winPoints = 10, drawPoints = 5, lossPoints = 0;

	console.log(`[MATCH FINISH]   ↳ Determining outcome...`);
	if (scoreA > scoreB) {
		console.log(`[MATCH FINISH]   ↳ ${playerA} wins over ${playerB}`);
		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + winPoints);
		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + lossPoints);
	} else if (scoreB > scoreA) {
		console.log(`[MATCH FINISH]   ↳ ${playerB} wins over ${playerA}`);
		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + winPoints);
		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + lossPoints);
	} else {
		console.log(`[MATCH FINISH]   ↳ Draw between ${playerA} and ${playerB}`);
		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + drawPoints);
		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + drawPoints);
	}

	// Log current points map
	console.log(`[MATCH FINISH]   ↳ Points after update:`);
	for (const [uid, pts] of tour.points.entries()) {
		console.log(`    - userID=${uid}, points=${pts}`);
	}

	// Cleanup match report
	tour.matchReports.delete(matchKey);

	// Prevent rematch
	tour.opponents.get(playerA)!.add(playerB);
	tour.opponents.get(playerB)!.add(playerA);

	// Move to waitingPairs
	const idx = tour.playingPairs.findIndex(
		([a, b]) =>
			(a.userID === playerA && b.userID === playerB) ||
			(a.userID === playerB && b.userID === playerA)
	);
	if (idx !== -1) {
		tour.waitingPairs.push(tour.playingPairs[idx]);
		tour.playingPairs.splice(idx, 1);
		console.log(`[MATCH FINISH]   ↳ Match ${matchKey} moved to waitingPairs`);
	}

	// Build updated score table
	const scoreUpdates = await Promise.all(
		Array.from(tour.points.entries()).map(async ([playerId, pts]) => {
			const user = await getUnameByIndex(playerId);
			return {
				username: user!.username,
				score: pts
			};
		})
	);
	scoreUpdates.sort((a, b) => b.score - a.score);

	// Notify both players of updated standings
	for (const [pA, pB] of tour.waitingPairs) {
		pA.typedSocket.send('updateTourScore', {
			tourID,
			score: scoreUpdates
		});
		pB.typedSocket.send('updateTourScore', {
			tourID,
			score: scoreUpdates
		});
	}

	if (!this.hasStarted) return;
}

// public async onMatchFinished(
// 	tourID: number,
// 	playerA: number,
// 	playerB: number,
// 	scoreA: number,
// 	scoreB: number,
// 	userID: number
// ) {
// 	if (userID !== playerA && userID !== playerB) {
// 		console.warn(`WTF ?! userID ${userID} is not part of this match a: ${playerA}  b: ${playerB}`);
// 		return;
// 	}

// 	const tour = Tournament.MappedTour.get(tourID)!;

// 	// Ensure a matchReportMap is initialized
// 	if (!tour.matchReports) tour.matchReports = new Map<string, Set<number>>();

// 	// Use a consistent key
// 	const matchKey = [playerA, playerB].sort((a, b) => a - b).join("-");

// 	// Add reporter to the match report tracker
// 	if (!tour.matchReports.has(matchKey)) {
// 		tour.matchReports.set(matchKey, new Set());
// 	}
// 	const reporters = tour.matchReports.get(matchKey)!;
// 	reporters.add(userID);

// 	// Wait until both players have reported
// 	if (reporters.size < 2) {
// 		return; // wait for the other player to confirm
// 	}

// 	// Remove tracker — match is finalized
// 	tour.matchReports.delete(matchKey);

// 	// Award points
// 	const winPoints = 10, drawPoints = 5, lossPoints = 0;

// 	if (scoreA > scoreB) {
// 		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + winPoints);
// 		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + lossPoints);
// 	} else if (scoreB > scoreA) {
// 		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + winPoints);
// 		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + lossPoints);
// 	} else {
// 		// draw
// 		tour.points.set(playerA, (tour.points.get(playerA) ?? 0) + drawPoints);
// 		tour.points.set(playerB, (tour.points.get(playerB) ?? 0) + drawPoints);
// 	}
// 	const scoreUpdates = await Promise.all(
// 	  Array.from(tour.points.entries()).map(async ([playerId, pts]) => {
// 	    const user = await getUnameByIndex(playerId);
// 	    return {
// 	      username: user!.username,
// 	      score: pts
// 	    };
// 	  })
// 	);

// 	scoreUpdates.sort((a, b) => b.score - a.score);

// 	// Prevent rematch
// 	tour.opponents.get(playerA)!.add(playerB);
// 	tour.opponents.get(playerB)!.add(playerA);

// 	// Move to waitingPairs
// 	const idx = tour.playingPairs.findIndex(
// 		([a, b]) =>
// 			(a.userID === playerA && b.userID === playerB) ||
// 			(a.userID === playerB && b.userID === playerA)
// 	);

// 	if (idx !== -1) {
// 		tour.waitingPairs.push(tour.playingPairs[idx]);
// 		tour.playingPairs.splice(idx, 1);
// 	}
// 	for (const [pA, pB] of tour.waitingPairs) {
// 	  // pA.typedSocket and pB.typedSocket both exist on playerInterface
// 	  pA.typedSocket.send('updateTourScore', {
// 	    tourID,
// 	    score: scoreUpdates
// 	  });
// 	  pB.typedSocket.send('updateTourScore', {
// 	    tourID,
// 	    score: scoreUpdates
// 	  });
// 	}

// 	// Restart next round if done
// 	if (!this.hasStarted) return;
// }

public async isReadyForNextRound(userID: number) {
	const tour = Tournament.MappedTour.get(this.tourID)!;

	// Ignore players who aren't in waitingPairs
	const isInWaiting = tour.waitingPairs.some(
		([a, b]) => a.userID === userID || b.userID === userID
	);

	if (!isInWaiting) {
		console.warn(`[isReadyForNextRound] userID ${userID} is not in waitingPairs`);
		return;
	}

	// Add to ready set
	tour.readyPlayers.add(userID);

	// Compute total number of unique players in waitingPairs
	const totalWaitingUsers = new Set<number>();
	for (const [a, b] of tour.waitingPairs) {
		totalWaitingUsers.add(a.userID);
		totalWaitingUsers.add(b.userID);
	}

	// Check if all have reported
	if (tour.readyPlayers.size >= totalWaitingUsers.size) {
		console.log(`[Tournament] All players ready for next round.`);
		tour.readyPlayers.clear();

		// Move to next round
		tour.playingPairs = tour.waitingPairs;
		tour.waitingPairs = [];
		await tour.nextRound();
	}
}



private endTournament() {
	// process final ranking
	const standings = [...this.players]
		.sort((a, b) => this.points.get(b.userID)! - this.points.get(a.userID)!);
	// notify all clients
	for (const p of this.players) {
		p.typedSocket.send('endTournament', {
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

public giveBye(member: Member) {
	const userID = member.userID;
	const player = member.player;

	// 1. Award points for the bye (half a win ? full win ? )
	const BYE_POINTS = 10;
	Tournament.MappedTour.get(player.tournamentID!)?.points.set(userID,
		Tournament.MappedTour.get(player.tournamentID!)?.points.get(userID)! + BYE_POINTS
	);

	// 2. Mark the player as having “played” this round by pushing to waitingPairs
	const tour = Tournament.MappedTour.get(player.tournamentID!)!;
	tour.waitingPairs.push([player, player]); // or some sentinel value if needed

	// 3. Send socket event to inform the player
	player.typedSocket.send('waitingNextRound', {
		round: tour.current_round,
		message: 'You received a bye this round.',
	});
}

}




// function generateSwissPairings(
// 	round: number,
// 	members: Member[]
// 	): { playerA: number, playerB: number }[] {
// 		// compute Median Buchholz for all players
// 	console.log(`Members before shuffles : `)
// 	console.log(members);
// 	if (round === 1) {
// 		// randomize initial pairing
// 		members = shuffle(members);
// 	} else {
// 		computeMedianBuchholz(members);
// 	}
// 	console.log(`members after shuffle : `)
// 	console.log(members);
// 	// sort by points desc, then by buchholz desc
// 	members.sort((a, b) => {
// 		if (b.points !== a.points) {
// 			return b.points - a.points;
// 		}
// 		const mbA = (a as any).buchholz as number;
// 		const mbB = (b as any).buchholz as number;
// 		return mbB - mbA;
// 	});

// 	// group by identical score
// 	const groups = groupBy(members, m => m.points);

// 	const pairs: { playerA: number, playerB: number }[] = [];
// 	const floaters: typeof members = [];

// 	for (const group of groups) {
// 		let pool = [...group];

// 		// if odd, pull one floater to next group
// 		if (pool.length % 2 === 1) {
// 			const floater = selectFloater(pool, []);
// 			floater.originalGroup = group;
// 			floaters.push(floater);
// 			pool = pool.filter(p => p !== floater); // REMOVE the floater from pool
// 		}
// 		// split and pair within group
// 		const half = pool.length / 2;
// 		const top = pool.slice(0, half);
// 		let bottom = pool.slice(half);

// 		for (let i = 0; i < top.length; i++) {
// 			const a = top[i];
// 			let paired = false;

// 			for (let j = 0; j < bottom.length; j++) {
// 				const b = bottom[j];
// 				if (!a.opponents.includes(b.userID)) {
// 					pairs.push({ playerA: a.userID, playerB: b.userID });
// 					bottom.splice(j, 1);
// 					paired = true;
// 					break;
// 				}
// 			}

// 			if (!paired && bottom.length > 0) {
// 				const b = bottom.shift()!;
// 				pairs.push({ playerA: a.userID, playerB: b.userID });
// 			}
// 		}
// 	}
// 	for (const floater of floaters) {
// 	// try to insert into the next-lower score group
// 		let placed = false;
// 		for (let i = groups.indexOf(floater.originalGroup!) + 1;
// 				i < groups.length && !placed;
// 				i++) {
// 			const targetGroup = groups[i];
// 			// if targetGroup now odd, pair floater with one of them
// 			if (targetGroup.length % 2 === 1) {
// 				const opponent = selectOpponentForFloater(floater, targetGroup);
// 				pairs.push({ playerA: floater.userID, playerB: opponent.userID });
// 				targetGroup.splice(targetGroup.indexOf(opponent), 1);
// 				placed = true;
// 			}
// 		}
// 		if (!placed) {
// 			// give a bye
// 			console.warn(`GIVING BYE to ${floater.player.userID!}`)
// 			const tour = Tournament.MappedTour.get(floater.player.tournamentID!) 
// 			tour!.giveBye(floater);
// 		}
// 	}

// 	return pairs;
// }
 

function generateSwissPairings(
	round: number,
	members: Member[]
): { playerA: number, playerB: number }[] {
	console.log(`Members before shuffles : `);
	console.log(members);

	if (round === 1) {
		members = shuffle(members);
	} else {
		computeMedianBuchholz(members);
	}

	console.log(`members after shuffle : `);
	console.log(members);

	members.sort((a, b) => {
		if (b.points !== a.points) return b.points - a.points;
		const mbA = (a as any).buchholz as number;
		const mbB = (b as any).buchholz as number;
		return mbB - mbA;
	});

	// Determine if we should allow rematches
	let allowRematch = false;
	const totalPossiblePairs = (members.length * (members.length - 1)) / 2;
	let playedPairs = new Set<string>();

	for (const m of members) {
		for (const opp of m.opponents) {
			const key = [m.userID, opp].sort().join("-");
			playedPairs.add(key);
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

	for (const group of groups) {
		let pool = [...group];

		if (pool.length % 2 === 1) {
			let floater: Member | null = null;

			if (!allowRematch) {
				floater = selectFloater(pool, []);
			} else {
				// If rematches are allowed, float only if no one can be paired
				for (const candidate of pool) {
					const others = pool.filter(p => p !== candidate);
					const canBePaired = others.some(
						other => !candidate.opponents.includes(other.userID)
					);
					if (!canBePaired) {
						floater = candidate;
						break;
					}
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
				const b = bottom.shift()!;
				pairs.push({ playerA: a.userID, playerB: b.userID });
			}
		}
	}

	const pairedFloaterIds = new Set<number>();

	for (const floater of floaters) {
		// Skip if this floater was used as an opponent earlier
		if (pairedFloaterIds.has(floater.userID)) continue;

		let placed = false;

		// Essayez de l’insérer dans les groupes suivants
		for (let i = groups.indexOf(floater.originalGroup!) + 1;
				 i < groups.length && !placed; i++) {

			const targetGroup = groups[i];

			if (targetGroup.length % 2 === 1) {
				const opponent = selectOpponentForFloater(floater, targetGroup);

				pairs.push({ playerA: floater.userID, playerB: opponent.userID });

				// Remove opponent from its group
				targetGroup.splice(targetGroup.indexOf(opponent), 1);

				// Mark both players as already paired
				pairedFloaterIds.add(floater.userID);
				pairedFloaterIds.add(opponent.userID);

				placed = true;
			}
		}

		if (!placed) {
			console.warn(`GIVING BYE to ${floater.player.userID}`);
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
function selectFloater(
	group: Member[], 
	nextGroup: Member[]
): Member {
	// sort group by tie-break low to high (so weakest first)
	group.sort((a, b) => a.buchholz! - b.buchholz!);
	for (const candidate of group) {
		// 2. check if candidate can play someone new in nextGroup to avoid rematch
		const hasAvailable = nextGroup.some(opp =>
			!candidate.opponents.includes(opp.userID)
		);
		if (hasAvailable) {
			// remove from this group and return as floater
			group.splice(group.indexOf(candidate), 1);
			return candidate;
		}
	}
	// If none fit, pick the weakest
	const fallback = group.shift()!;
	return fallback;
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


