import { playerInterface } from '../shared/gameTypes'
import * as gameMgr from '../db/gameManagement'

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
		this.rules=rules;

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
				this.rules, 'Tournament : Round ${this.current_round}/${this.max_round}.', 0, this.tourID
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
		//send updated score to all waiting players ? 


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
	const BYE_POINTS = 5;
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




function generateSwissPairings(
	round: number,
	members: Member[]
	): { playerA: number, playerB: number }[] {
		// compute Median Buchholz for all players
	if (round === 1) {
		// randomize initial pairing
		members = shuffle(members);
	} else {
		computeMedianBuchholz(members);
	}

	// sort by points desc, then by buchholz desc
	members.sort((a, b) => {
		if (b.points !== a.points) {
			return b.points - a.points;
		}
		const mbA = (a as any).buchholz as number;
		const mbB = (b as any).buchholz as number;
		return mbB - mbA;
	});

	// group by identical score
	const groups = groupBy(members, m => m.points);

	const pairs: { playerA: number, playerB: number }[] = [];
	const floaters: typeof members = [];

	for (const group of groups) {
		let pool = [...group];

		// if odd, pull one floater to next group
		if (pool.length % 2 === 1) {
			const floater = selectFloater(group, []);;
			floaters.push(floater);
		}

		// split and pair within group
		const half = pool.length / 2;
		const top = pool.slice(0, half);
		const bottom = pool.slice(half);
		for (let i = 0; i < half; i++) {
			pairs.push({ playerA: top[i].userID, playerB: bottom[i].userID });
		}
	}

	for (const floater of floaters) {
	// try to insert into the next-lower score group
	let placed = false;
	for (let i = groups.indexOf(floater.originalGroup!) + 1;
			 i < groups.length && !placed;
			 i++) {
		const targetGroup = groups[i];
		// if targetGroup now odd, pair floater with one of them
		if (targetGroup.length % 2 === 1) {
			const opponent = selectOpponentForFloater(floater, targetGroup);
			pairs.push({ playerA: floater.userID, playerB: opponent.userID });
			targetGroup.splice(targetGroup.indexOf(opponent), 1);
			placed = true;
		}
	}
	
	if (!placed) {
		// give a bye
		const tour = Tournament.MappedTour.get(floater.player.tournamentID!) 
		tour!.giveBye(floater);
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


