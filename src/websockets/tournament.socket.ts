import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import { TypedSocket } from '../shared/gameTypes';
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer, getMembersByTourID, getAllInitPlayers} from './game.socket'
import { playerMove } from '../services/pong'
import { PongRoom } from '../services/PongRoom';
import { tournamentRoutes } from '../routes/tournament.routes';
import { Tournament } from '../services/tournament';

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
			console.log(`${player.username} just joined tournament ID : ${data.tournamentID} | ${data.isTourOwner}`);
			updateTourPlayerList(player, data.tournamentID, false);
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

//Add the has started flag -> this leave can only by trigger by clicking on the leave button
export async function handleLeaveTournament(player: Interfaces.playerInterface, data: any) {
	// Tournament ends cleanly: not user-triggered
	// if (data.isLegit) {
	// 	// Placeholder: tournament finished naturally (e.g., someone won)
	// 	// Kick all players, update DB, send score, broadcast final standings, etc.
	// 	// This logic will eventually call handleLeaveTournament for each player
	// 	return;
	// }

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

	// 2. Leave game if currently playing
	// if (player.gameID) {
	// 	Helpers.kickFromGameRoom(player.gameID, player, `${player.username!} left the match`);
	// }
	// 3. Clear tournament ID from player state
	const leftTourID = player.tournamentID;
	player.tournamentID = undefined;
	Helpers.updatePlayerState(player, 'init');
	
	//HERE -> call Tournament -> removeMember(userID)
	const tour = Tournament.MappedTour.get(leftTourID!);
	tour?.removeMemberFromTourID(player.userID!);
	// 4. Get remaining members
	const members = await getMembersByTourID(leftTourID!);

	// 5. If no player remains, clean
	if (members!.length < 1) {
		console.log(`[TOUR][LEFT]{No members left deleting room}`)
		GameManagement.delTournament(leftTourID!);
		await broadcastTourList();
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
		playersCount: t.playersCount,
		status: t.status
	}));

	const allPlayers = await  getAllInitPlayers(); // assuming this returns all connected players
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

	// if (tour.createdBy !== userID) {
	// 	console.log(`USER ID mismatch for tournament "${tour.name}"`);
	// 	return;
	// }

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
	tour.onMatchFinished(data.tourID, data.a_ID, data.b_ID, data.a_score, data.b_score, data.userID);
}

export async function handleReadyNextRound(data:any){
	const tour = Tournament.MappedTour.get(data.tourID)!;
	tour.isReadyForNextRound(data.userID!);
}


