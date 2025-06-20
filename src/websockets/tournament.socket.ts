// import * as Interfaces from '../shared/gameTypes'
// import * as GameManagement from '../db/gameManagement'
// import * as Tournament from '../shared/tournamentTypes'
// import * as Helpers from './game.sockHelpers'
// import { TypedSocket } from '../shared/gameTypes';
// import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer} from './game.socket'
// import { playerMove } from '../services/pong'
// import { PongRoom } from '../services/PongRoom';
// import { tournamentRoutes } from '../routes/tournament.routes';


// export async function handleJoinTournament(player:Interfaces.playerInterface, data:any){

//     //data.userID , data.tournamentID,
//     try{
//         await GameManagement.addMemberToTournament(data.tournamentID, data.userID);
//         Helpers.updatePlayerState(player, 'waitingTournament');
        
//         //addPlayerToTournamentObj()
        
//         //Notify front
//         player.typedSocket.send('joinTournament',{
//             userID:data.userID,
//             tournamentID:data.tournamentID,
//             success:true
//         });
//         player.tournamentID = data.tournamentID
//         //tryStartTournament()
//     }
//     catch{
//         player.typedSocket.send('joinTournament',{
//             userID:data.userID,
//             tournamentID:data.tournamentID,
//             success:false
//         });
//     }
// }


// export async function handleLeaveTournament(player:Interfaces.playerInterface, data:any){
//     //data.isLegit? data.userID data.TournamentID
    
//     //Tournament ends clean
//     if(data.islegit){
//         //kick all players from tournament, update db , send score
//     }

//     //Player leave before end, kick player, erase entries?, recalculateNextRound?
//     else{

//         //clean db entries
//         await GameManagement.delMemberFromTournament(player.tournamentID, player.userID)

//         //remove player from tournamentObj
//         player.tournamentID = -1;
//         //leaveGame if needed
//         if(player.gameID){
//             Helpers.kickFromGameRoom(player.gameID, player, `${player.username} left the match`)
//         }
//         //recalculte tournaments rounds 
//     }
// }

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

