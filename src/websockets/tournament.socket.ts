import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import { TypedSocket } from '../shared/gameTypes';
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer, getMembersByTourID, getAllInitPlayers} from './game.socket'
import { playerMove } from '../services/pong'
import { PongRoom } from '../services/PongRoom';
import { tournamentRoutes } from '../routes/tournament.routes';


export async function handleJoinTournament(player:Interfaces.playerInterface, data:any){
		//data.userID , data.tournamentID,
		try{
				await GameManagement.addMemberToTournament(data.tournamentID, data.userID);
				Helpers.updatePlayerState(player, 'waitingTournament');
				const tour = await GameManagement.getTournamentById(data.tournamentID);
				//addPlayerToTournamentObj()
				
				//Notify front
				player.typedSocket.send('joinTournament',{
						userID:data.userID,
			username:player.username,
						tournamentID:data.tournamentID,
			tourName:tour?.name,
						success:true
				});
				player.tournamentID = data.tournamentID
		console.log(`${player.username} just joined tournament ID : ${data.tournamentID}`);
		updateTourPlayerList(player, data.tournamentID, false)
		Helpers.updatePlayerState(player, 'waitingTournament');
				//tryStartTournament()
		}
		catch{
				player.typedSocket.send('joinTournament',{
						userID:data.userID,
						tournamentID:data.tournamentID,
						success:false
				});
		}
	const member = await getMembersByTourID(data.tournamentID);
	if(member!.length < 2){
		await broadcastTourList();
	}
}


export async function updateTourPlayerList(joiner: Interfaces.playerInterface, tourID: number, hasLeft: boolean) {
	const members = await getMembersByTourID(tourID);
	if (!members) return;

	// Construct full member list
	const memberData = members.map(m => ({
		userID: m.userID,
		username: m.username,
	}));

	for (const m of members) {
		m.typedSocket.send('updateTourPlayerList', {
			tournamentID: tourID,
			members: memberData
		});
	}
}


export async function handleLeaveTournament(player: Interfaces.playerInterface, data: any) {
	// Tournament ends cleanly: not user-triggered
	if (data.isLegit) {
		// Placeholder: tournament finished naturally (e.g., someone won)
		// Kick all players, update DB, send score, broadcast final standings, etc.
		// This logic will eventually call handleLeaveTournament for each player
		return;
	}

	// User clicked "Leave Tournament" button manually

	// 1. Clean DB entry
	await GameManagement.delMemberFromTournament(player.tournamentID!, player.userID!);

	// 2. Leave game if currently playing
	if (player.gameID) {
		Helpers.kickFromGameRoom(player.gameID, player, `${player.username!} left the match`);
	}

	// 3. Clear tournament ID from player state
	const leftTourID = player.tournamentID;
	player.tournamentID = -1;
	Helpers.updatePlayerState(player, 'init');

	// 4. Get remaining members
	const members = await getMembersByTourID(leftTourID!);

	// 5. If no player remains, clean
	if (members!.length < 1) {
		console.log(`[TOUR][LEFT]{No members left deleting room}`)
		GameManagement.delTournament(leftTourID!);
		await broadcastTourList();
		// Optional: tournament is now empty, auto-cancel?
		//GameManagement.delTournament(leftTourID)
	}

	// 6. Update all others
	for (const m of members!) {
		m.typedSocket.send('updateTourPlayerList', {
			tournamentID: leftTourID,
			members: members!.map(p => ({ userID: p.userID, username: p.username }))
		});
	}

	console.log(`${player.username} left tournament ID: ${leftTourID}`);
}


export async function broadcastTourList() {
	const tourList = await GameManagement.getAllTournaments();
	const publicList = tourList.map(t => ({
		tourID: t.tournamentID,
		name: t.name,
		createdBy: t.createdBy,
		maxPlayers: t.maxPlayers,
		status: t.status
	}));

	const allPlayers = await  getAllInitPlayers(); // assuming this returns all connected players
	for (const p of allPlayers!) {
		p.typedSocket.send('updateTourList', { list: publicList });
	}
}


//START TOURNAMENT
/* SERVER RECEVIED START FROM OWNER
	send back start to members?
	start tournament loop
	data{
		userID:
		tournamentID: } */
export async function handleStartTournament(data:any) {
	const tour = await GameManagement.getTournamentById(data.touranmentID);
	if(tour!.createdBy !== data.userID){
		console.log(`USER ID mismatch for ${tour!.name}`);
		//Kick all players from tour and delete ?
		return; 
	}
	
	//IF FRONT NEEDS STUFF BEFORE TOURNAMENT START(like update views with some shit)
	const members= await getMembersByTourID(data.tourID);
	for(const m of members!){
		//Sending here depends of front workflow
		m.typedSocket.send('startTournament',{
			userID:data.userID,
			tournamentID:tour?.tournamentID
		});
		//A savoir si on rajoute des etats en front faut les gerer pour le statut aussi
		Helpers.updatePlayerState(m, 'startTournament')//|'playing'?
	}
	//GameManagement.setStateByTourId(data.tourID, 'playing') -> on a pas ca
	//Tournament logic start here
}


//END TOURNAMENT -> BACK ONLY send tournamentLogic or if only on player is left on tournament after leaves 
//START NEXT ROUND -> BACK ONLY send in tournamentLogic


/*En gros , on aura une map <tourID, tourClass>
	dans tourClass y'a players[], que tu chopes: 
		const members= await getMembersByTourID(data.tourID);
	quand tu balances des sockets c'est sur : 
	m.typedSocket.send{type, {data}}
*/

function generateSwissPairings(
	round: number,
	members: { userID: number, points: number, opponents: number[] }[]
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
	for (let i = groups.indexOf(floater.originalGroup) + 1;
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
		giveBye(floater);
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
	group.sort((a, b) => a.buchholz - b.buchholz);
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
  floater: { userID: number; opponents: number[] },
  targetGroup: { userID: number; opponents: number[] }[]
): { userID: number; opponents: number[] } {
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
function computeMedianBuchholz(members: { userID: number, points: number, opponents: number[] }[]) {
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