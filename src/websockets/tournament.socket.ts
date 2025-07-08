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

	// 5. If only 1 player remains (or none), optional cleanup here
	if (members!.length <= 1) {
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


// export async function startFirstRound(players:Interfaces.players[], tournamentID:number){

//     const tournamentData = await GameManagement.getTournamentById(tournamentID)

//     if(!tournamentData){
//         //kick players
//         return;
//     }
//     const tournament:Tournament.tournamentInterface = {
//         tournamentID: tournamentData.tournamentID,
//         name: tournamentData.name,
//         maxPlayers: tournamentData.maxPlayers,
//         maxRounds: tournamentData.maxRounds,
//         currentRound:0
//     }

// }


// export async function startNextRound(players:Interfaces.players[]){


// }

