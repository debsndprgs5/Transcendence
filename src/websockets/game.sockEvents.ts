import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import * as Tournaments from './tournament.socket'
import { TypedSocket } from '../shared/gameTypes';
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer} from './game.socket'
import { playerMove } from '../services/pong'
import { PongRoom } from '../services/PongRoom';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from '../vault/vaultPlugin';
import { Tournament }  from '../services/tournament';


const jwtSecret = getJwtSecret();

// import{stopMockGameLoop, startMockGameLoop, playerMove} from '../services/pong'

//Map of pending invite for timeout and duplicates managment
const PendingInvites = new Map<number, { inviterID: number; timeout: NodeJS.Timeout }>();

export function handleAllEvents(typedSocket:TypedSocket, player:Interfaces.playerInterface) {
   typedSocket.on('init', async (socket:WebSocket, data:Interfaces.SocketMessageMap['init']) => {
     handleInit(data, player);
   });
  typedSocket.on('getStats', async (socket:WebSocket, data:{ userID?: number }) => {
    if (data.userID) {
      const stats = await GameManagement.getStatsForUser(data.userID);
      typedSocket.send('statsResult', stats);
    }
  });
  typedSocket.on('joinGame', async (socket:WebSocket, data:Interfaces.SocketMessageMap['joinGame']) => {
    handleJoin(data, player);
  });
  typedSocket.on('joinTournament', async (socket:WebSocket, data:Interfaces.SocketMessageMap['joinTournament']) => {
    Tournaments.handleJoinTournament(player, data);
  });
  typedSocket.on('leaveTournament', async (socket:WebSocket, data:Interfaces.SocketMessageMap['leaveTournament']) => {
    Tournaments.handleLeaveTournament(player, data);
  });
  typedSocket.on('startTournament', async (socket:WebSocket, data:Interfaces.SocketMessageMap['startTournament']) => {
    Tournaments.handleStartTournament(data);
  });
  typedSocket.on('matchFinish', async(socket:WebSocket, data:Interfaces.SocketMessageMap['matchFinish']) => {
    Tournaments.handleMatchFinish(data);
  });
  typedSocket.on('readyNextRound', async(socket:WebSocket, data:Interfaces.SocketMessageMap['readyNextRound']) => {
    Tournaments.handleReadyNextRound(data);
  });
  typedSocket.on('invite', async (socket:WebSocket, data:Interfaces.SocketMessageMap['invite']) => {
    handleInvite(data, player);
  });
  
  typedSocket.on('leaveGame', async (socket:WebSocket, data:Interfaces.SocketMessageMap['leaveGame']) => {
    handleLeaveGame(data, player);
  });
  typedSocket.on('playerMove', async (socket:WebSocket, data:Interfaces.SocketMessageMap['playerMove']) => {
    handlePlayerMove(data, player);
  });

  typedSocket.on('reconnected', async (socket:WebSocket, data:Interfaces.SocketMessageMap['reconnected']) => {
    handleReconnect(data, player);
  });
  typedSocket.on('disconnected', ()=>{
    handleDisconnect(player);
  });
  typedSocket.on('healthcheck', async (socket:WebSocket, data:Interfaces.SocketMessageMap['healthcheck']) => { 
    const token = data.token

    if (!token) 
      return socket.close(1008, 'No token');
    

    let payload: JwtPayload;
    try {
      const dynamic_jwt = getJwtSecret()
      payload = jwt.verify(token, dynamic_jwt) as JwtPayload;
    } catch (error){
        return socket.close(1008, 'Invalid token');
    }
    
  });
  
  typedSocket.on('pause', async(socket:WebSocket, data:Interfaces.SocketMessageMap['pause']) => {
    const pongRoom = PongRoom.rooms.get(data.gameID);
    pongRoom?.pause(data.userID);
  });
  
  typedSocket.on('resume', async(socket:WebSocket, data:Interfaces.SocketMessageMap['resume']) => {
    const pongRoom = PongRoom.rooms.get(data.gameID);
    pongRoom?.resume(data.userID);
  });
  
  typedSocket.on('reloadTourRound', async(socket:WebSocket, data:Interfaces.SocketMessageMap['reloadTourRound'])=> {
    Tournaments.reloadTourRound(data);
  })
  
  typedSocket.on('clientReady', async(socket:WebSocket, data:Interfaces.SocketMessageMap['clientReady'])=>{
    const pongRoom = PongRoom.rooms.get(data.gameID);
    pongRoom?.setClientReady(data.userID);
  })
}



//HANDLERS 

export async function handleInit(
  data: { userID: number },
  player: Interfaces.playerInterface,
) {

  const success = data.userID === player.userID;

  player.typedSocket.send('init', {
    userID: player.userID,
    success,
  });
}

export async function handleJoin(
    parsed: any,
    player: Interfaces.playerInterface) {
  const { userID, gameName, gameID } = parsed;

      //DANGEREUX MOVE HERE -> ENTRE 2 match de tournoi on reste en playing
  if (player.state !== 'init' && !player.tournamentID) {
    player.typedSocket.send('joinGame', {
      success: false,
      reason: `you are in ${player.state} mode`,
      userID: player.userID,
      gameID,
      gameName,
    });
    return;
  }

  try {
    await GameManagement.addMemberToGameRoom(gameID, userID);

    // Update player state using centralized helper that sends statusUpdate
    Helpers.updatePlayerState(player, 'waiting');
    player.gameID = gameID;
    // Send joinGame success response
    player.typedSocket.send('joinGame', {
      success: true,
      gameID: player.gameID,
      gameName,
      userID:userID,
    });
    Helpers.updateRoom(gameID);
  } catch (err) {
    console.error('handleJoin error', err);
    player.typedSocket.send('joinGame', {
      success: false,
      reason: 'Join failed',
      userID: userID,
      gameID,
      gameName,
    });
  }

  Helpers.tryStartGameIfReady(gameID);
}

export async function handleInvite(
      parsed: any,
      player: Interfaces.playerInterface,) {
  const { actionRequested, userID, targetID } = parsed;
    // === Safeguard: prevent self-invite ===
  if (actionRequested === 'send' && userID === targetID) {
    player.typedSocket.send('invite', {
      action: 'reply' as const,
      response: 'you cannot invite yourself',
      targetID,
    });
    return;
  }
  if (actionRequested === 'send') {
    const target = getPlayerByUserID(targetID);

    if (!target) {
      player.typedSocket.send('invite', {
        action: 'reply' as const,
        response: 'offline',
        targetID
      });
      return;
    }
    
    // === Save pending invite and set timeout to auto-cancel after 15s ===
    const timeout = setTimeout(() => {
      const entry = PendingInvites.get(targetID);
      if (entry && entry.inviterID === userID) {
        PendingInvites.delete(targetID);
        const inviter = getPlayerByUserID(userID)?.socket;
        if (inviter) {
          inviter.typedSocket.send('invite', {
            action: 'reply' as const,
            response: 'timeout',
            targetID,
          });
        }
        const target = getPlayerByUserID(targetID)?.socket;
        if (target) {
          target.typedSocket.send('invite', {
            action: 'reply' as const,
            response: 'timeout',
            targetID,
          });
        }

        // reset states (to check if not already handled inside helpers)
        Helpers.updatePlayerState(player, 'init');
        Helpers.updatePlayerState(target, 'init');
      }
    }, 15000);

    PendingInvites.set(targetID, { inviterID: userID, timeout });
    await Helpers.processInviteSend(player, target);
  }

  if (actionRequested === 'reply') {
    const { fromID, toID, response } = parsed;
    const inviter = getPlayerByUserID(fromID);
    const invitee = getPlayerByUserID(toID);
        // === Clear timeout and pending entry ===
    const pending = PendingInvites.get(toID);
    if (pending && pending.inviterID === fromID) {
      clearTimeout(pending.timeout);
      PendingInvites.delete(toID);
	}
    await Helpers.processInviteReply(inviter!, invitee!, response);
  }
}

export async function handleLeaveGame(parsed: any, player: Interfaces.playerInterface) {
  const gameID = player.gameID;
  if (!gameID) {
    console.warn(`handleLeaveGame: player ${player.userID} is not in a game`);
    return;
  }
	if(parsed.islegit === true)
		await Helpers.kickFromGameRoom(gameID, player);
	else
  		await Helpers.kickFromGameRoom(gameID, player, `${player.username} left`);

}

export async function handlePlayerMove(parsed: any, player: Interfaces.playerInterface) {
    const { direction, gameID } = parsed;
    playerMove(gameID, player.userID, direction)
}

//WE NEED TO CHECK WHAT TO DO IN THAT CASE MORE CLEARLY
export async function  handleReconnect(parsed:any ,player: Interfaces.playerInterface) {
// CASE 1: Mismatched user — recreate the player interface
	if (parsed.userID !== player.userID) {
		console.warn(`[RECONNECT] Mismatch: received ${parsed.userID}, expected ${player.userID}. Reinitializing...`);

    player.typedSocket.send('init', {
      userID: player.userID,
      username: player.username,
      state: 'init',
      success: true,
    });
    Helpers.updatePlayerState(player, 'init');
		return;
	}
  // CASE 2: Matched user — restore interface and possibly game
  player.hasDisconnected = false;

  if (player.disconnectTimeOut) {
    clearTimeout(player.disconnectTimeOut);
    player.disconnectTimeOut = undefined;
  }
  //Game Restart when render is ready not when socket connect
	let resumed = false;
	if (player.gameID) {
		const room = PongRoom.rooms.get(player.gameID);
		if (room) {
			//room.resume(player.userID);
			resumed = true;
		}
	}
  let hasStarted = false;
  if(player.tournamentID){
    const tour = Tournament.MappedTour.get(player.tournamentID);
    if(tour)
      hasStarted = true;
  }
	// Always send back current player + state info
	player.typedSocket.send('reconnected', {
		userID: player.userID,
		username: player.username,
		state: player.state,
		gameID: player.gameID ?? null,
		tournamentID: player.tournamentID ?? null,
    	isTourOwner:player.isTourOwner ?? false,
    	hasStarted:hasStarted,
		message: resumed ? 'Game will be resumed' : 'No game to resume',
	});
}

export async function handleDisconnect(player: Interfaces.playerInterface) {
  if (!player || player.hasDisconnected) return;

  player.hasDisconnected = true;

 // try { Helpers.updatePlayerState(player, 'offline'); } catch {}

  if (player.gameID) {
    const room = PongRoom.rooms.get(player.gameID);
    if (room) room.pause(player.userID);

    player.disconnectTimeOut = setTimeout(() => {
      const r = PongRoom.rooms.get(player.gameID!);
      if (r) r.stop();
      Helpers.kickFromGameRoom(player.gameID!, player, `${player.username} timed out`);
      delPlayer(player.userID);
    }, 15000);
    return;
  }

  player.disconnectTimeOut = setTimeout(() => {
    delPlayer(player.userID);
  }, 30000);
}
