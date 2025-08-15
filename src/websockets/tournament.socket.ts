import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import { TypedSocket } from '../shared/gameTypes';
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer, getMembersByTourID, getAllInitPlayers} from './game.socket'
import { playerMove } from '../services/pong'
import { PongRoom } from '../services/PongRoom';
import { tournamentRoutes } from '../routes/tournament.routes';
import { Tournament } from '../services/tournament';

//ALIAS MANAGMENT 
// username -> alias
const Aliases = new Map<string, string>();


export function setAliasForUser(username: string, alias: string): void {
  Aliases.set(username, alias);
}

export function getAliasForUser(username: string| undefined): string {
	let ret = 'something';
	if(username === undefined)
		console.log('undefined Uname');
	else{
	 const tmp = Aliases.get(username);
	 if(tmp) ret = tmp;
	}
  if (!ret || ret === undefined)
	return (`NO ALIAS FOUND FOR ${username}`);
  return ret;
}

export function hasAliasForUser(username: string): boolean {
  return Aliases.has(username);
}

export function removeAliasForUser(username: string): boolean {
  return Aliases.delete(username);
}

export async function handleJoinTournament(player:Interfaces.playerInterface, data:any){
		//data.userID , data.tournamentID,
		try{
			await GameManagement.addMemberToTournament(data.tournamentID, data.userID);
			Helpers.updatePlayerState(player, 'waitingTournament');
			const tour = await GameManagement.getTournamentById(data.tournamentID);
			//Notify front
			player.typedSocket.send('joinTournament',{
					userID:data.userID,
					username:player.username,
					tournamentID:data.tournamentID,
					tourName:tour?.name,
					success:true
			});
			player.tournamentID = data.tournamentID;
			player.isTourOwner = data.isTourOwner;
			updateTourPlayerList(player, data.tournamentID, false);
			if(hasAliasForUser(player.username!) === true) removeAliasForUser(player.username!)
			setAliasForUser(player.username!, data.alias);
			Helpers.updatePlayerState(player, 'waitingTournament');	
		}
		catch{
				player.typedSocket.send('joinTournament',{
						userID:data.userID,
						tournamentID:data.tournamentID,
						success:false
				});
		}
	const member = await getMembersByTourID(data.tournamentID);
	if(member!.length > 2){
		await broadcastTourList();
	}
}


export async function updateTourPlayerList(joiner: Interfaces.playerInterface, tourID: number, hasLeft: boolean) {
	const members = await getMembersByTourID(tourID);
	if (!members) return;

	// Construct full member list
	const memberData = members.map(m => ({
		userID: m.userID,
		username: getAliasForUser(m.username)!,
	}));

	for (const m of members) {
		m.typedSocket.send('updateTourPlayerList', {
			tournamentID: tourID,
			members: memberData
		});
	}
}

//Add the has started flag -> this leave can only by trigger by clicking on the leave button
export async function handleLeaveTournament(player: Interfaces.playerInterface, data: any) {
	// Tournament ends cleanly: not user-triggered
	if (data.islegit) {
	const tour = Tournament.MappedTour.get(player.tournamentID!);
	if (tour) {
		
		if (tour.leftPlayers.has(player.userID!)) {
			console.warn(`[TOUR][ALREADY LEFT] Player ${player.username} already left tournament ${player.tournamentID!}`);
			return;
		}
		tour.leftPlayers.add(player.userID!);

		
		Helpers.updatePlayerState(player, 'init');
		
		const members = await GameManagement.getAllTournamentMembers(player.tournamentID!);
		player.tournamentID = undefined;

		if (tour.leftPlayers.size >= members.length) {
			
			for (const m of members) {
				await GameManagement.delMemberFromTournament(tour.tourID, m.userID);
			}
			await GameManagement.delTournament(tour.tourID);
			Tournament.MappedTour.delete(tour.tourID);
		}
	}
	removeAliasForUser(player.username!);
	return;
}
	// User clicked "Leave Tournament" button manually
	if(data.duringGame === false && data.isTourOwner === true){
		const tour = Tournament.MappedTour.get(player.tournamentID!);
		if(!tour){
			const user = await GameManagement.getOlderPlayerForTour(player.userID!, player.tournamentID!);
			if(user){
				const newOwner = getPlayerByUserID(user!.userID);
				//else we will just close tour later on
				if(newOwner)
					newOwner.typedSocket.send('tourOwnerChange', {newOwnerID:user!.userID});
			}
		}
	}
	// 1. Clean DB entry
	await GameManagement.delMemberFromTournament(player.tournamentID!, player.userID!);
	const leftTourID = player.tournamentID;
	const tour = Tournament.MappedTour.get(leftTourID!);
	if(data.duringGame === true) tour?.matchGaveUp(leftTourID!, player.userID!);
	tour?.removeMemberFromTourID(player.userID!);
	player.tournamentID = undefined;
	// 4. Get remaining members
	const members = await getMembersByTourID(leftTourID!);
	removeAliasForUser(player.username!);
	Helpers.updatePlayerState(player, 'init');
	// 5. If no player remains, clean
	if (members!.length < 1) {
		GameManagement.delTournament(leftTourID!);
		await broadcastTourList();
	}

	// 6. Update all others
	for (const m of members!) {
		m.typedSocket.send('updateTourPlayerList', {
			tournamentID: leftTourID,
			members: members!.map(p => ({ userID: p.userID, username: getAliasForUser(p.username!) }))
		});
	}

}


export async function broadcastTourList() {
	const tourList = await GameManagement.getAllTournaments();
	const publicList = tourList.map(t => ({
		tourID: t.tournamentID,
		name: t.name,
		createdBy: t.createdBy,
		playersCount: t.playersCount,
		status: t.status
	}));

	const allPlayers = await  getAllInitPlayers();
	for (const p of allPlayers!) {
		p.typedSocket.send('updateTourList', { list: publicList });
	}
}


export async function handleStartTournament(data: any) {
	const { tournamentID, userID } = data;

	const tour = await GameManagement.getTournamentById(tournamentID);
	if (!tour) {
		console.error(`[TOUR] No tournament with ID ${tournamentID}`);
		return;
	}

	const members = await getMembersByTourID(tournamentID);
	for (const m of members!) {
		m.typedSocket.send('startTournament', {
			userID,
			tournamentID: tour.tournamentID,
			tourName: tour.name
		});
		Helpers.updatePlayerState(m, 'tournamentPlay');
	}

	await GameManagement.setStateforTourID(tournamentID, 'playing');

	const rulesRow = await GameManagement.getRulesForTourID(tournamentID);
	const rules = rulesRow?.[0] ?? { paddle_speed:50, ball_speed:50, limit:10, max_round:4 };

	const tourobj = new Tournament(members!, tournamentID, JSON.stringify(rules));
	tourobj.start();
}

export async function handleMatchFinish(data:any){

	const tour = Tournament.MappedTour.get(data.tourID)!;
	if(!tour)
		return;
	await tour.onMatchFinished(data.tourID, data.a_ID, data.b_ID, data.a_score, data.b_score, data.userID);

	if(tour.current_round === tour.max_round)
		await tour.isReadyForNextRound(data.userID);
	
}

export async function handleReadyNextRound(data:any){
	const tour = Tournament.MappedTour.get(data.tourID)!;
	tour.isReadyForNextRound(data.userID!);
}


export async function reloadTourRound(data:any){

	const tour = Tournament.MappedTour.get(data.tournamentID);
	if (!tour) {
		console.warn(`[reloadTourRound] No tournament found for id ${data.tournamentID}`);
	}
	const score = await tour?.extractScore();
	const player = getPlayerByUserID(data.userID);
	player!.typedSocket.send('updateTourScore', {
		tournamentID:data.tournamentID,
		score:score
	});
}
