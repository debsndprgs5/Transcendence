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
const PendingInvites = new Map<number, { inviterID: number; timeout: NodeJS.Timeout }>(); // key: targetID
const PendingByInviter = new Map<number, { targetID: number; timeout: NodeJS.Timeout }>(); // key: inviterID

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
  data: Interfaces.SocketMessageMap['invite'],
  player: Interfaces.playerInterface,
) {
  // === Safeguard: prevent self-invite ===
  if (data.action === 'send' && data.userID === data.targetID) {
    player.typedSocket.send('invite', {
      action: 'reply' as const,
      response: 'you cannot invite yourself',
      targetID: data.targetID,
    });
    return;
  }

  if (data.action === 'send') {
    const inviterID = data.userID!;
    const targetID  = data.targetID!;

    // hard-stop if inviter already has a pending invite to anyone
    const existingByInviter = PendingByInviter.get(inviterID);
    if (existingByInviter) {
      player.typedSocket.send('invite', {
        action: 'reply' as const,
        response: 'already_pending',
        targetID: existingByInviter.targetID,
      });
      return;
    }

    // resolve target player now (can be undefined/offline)
    const targetPlayer = getPlayerByUserID(targetID);
    if (!targetPlayer) {
      // notify inviter that target is offline and do not create any pending entry
      player.typedSocket.send('invite', {
        action: 'reply' as const,
        response: 'offline',
        targetID,
      });
      return;
    }

    // (optional) dedup — avoid stacking multiple invites to same target
    const existing = PendingInvites.get(targetID);
    if (existing && existing.inviterID === inviterID) {
      // already pending from same inviter -> refresh timer (drop old one)
      clearTimeout(existing.timeout);
      PendingInvites.delete(targetID);
    }

    // save pending invite and schedule auto-timeout
    const timeout = setTimeout(() => {
      try {
        const entryT = PendingInvites.get(targetID);
        if (entryT && entryT.inviterID === inviterID) PendingInvites.delete(targetID);

        const entryI = PendingByInviter.get(inviterID);
        if (entryI && entryI.targetID === targetID) PendingByInviter.delete(inviterID);

        const inviterPlayer = getPlayerByUserID(inviterID);
        const tgtPlayer     = getPlayerByUserID(targetID);

        // tell both clients to close their UIs and consider it expired
        inviterPlayer?.typedSocket.send('invite', { action: 'expired', inviterID, targetID });
        tgtPlayer?.typedSocket.send('invite',     { action: 'expired', inviterID, targetID });

        if (inviterPlayer) Helpers.updatePlayerState(inviterPlayer, 'init');
        if (tgtPlayer)     Helpers.updatePlayerState(tgtPlayer,     'init');
      } catch (e) {
        console.error('[INVITE timeout] error:', e);
      }
    }, 15000);

    PendingInvites.set(targetID,   { inviterID, timeout });
    PendingByInviter.set(inviterID, { targetID, timeout });

    // send the "receive" event to the invitee (now guaranteed non-undefined)
    await Helpers.processInviteSend(player, targetPlayer);
    return;
  }

  if (data.action === 'reply') {

    const inviteeID = data.fromID!;
    const inviterID = data.toID!;
    const resp = data.response!;

    // must still be pending (both maps agree)
    const stillPending =
      PendingInvites.get(inviteeID)?.inviterID === inviterID &&
      PendingByInviter.get(inviterID)?.targetID === inviteeID;

    if (!stillPending) {
      // it's already expired or cancelled → tell both to close UI
      const inviterPlayer = getPlayerByUserID(inviterID);
      const inviteePlayer = getPlayerByUserID(inviteeID);

      inviterPlayer?.typedSocket.send('invite', { action: 'expired', inviterID, targetID: inviteeID });
      inviteePlayer?.typedSocket.send('invite', { action: 'expired', inviterID, targetID: inviteeID });

      if (inviterPlayer) Helpers.updatePlayerState(inviterPlayer, 'init');
      if (inviteePlayer) Helpers.updatePlayerState(inviteePlayer, 'init');
      return;
    }

    // clear both pending entries
    const pendingT = PendingInvites.get(inviteeID);
    if (pendingT) { clearTimeout(pendingT.timeout); PendingInvites.delete(inviteeID); }
    const pendingI = PendingByInviter.get(inviterID);
    if (pendingI) { clearTimeout(pendingI.timeout); PendingByInviter.delete(inviterID); }

    const invitee = getPlayerByUserID(inviteeID)!;
    const inviter = getPlayerByUserID(inviterID)!;

    await Helpers.processInviteReply(inviter, invitee, resp);
    return;
  }
  if (data.action === 'cancel') {
    const inviterID = data.fromID!;
    const targetID  = data.toID!;

    const entryT = PendingInvites.get(targetID);
    const entryI = PendingByInviter.get(inviterID);

    if (entryT && entryT.inviterID === inviterID) {
      clearTimeout(entryT.timeout);
      PendingInvites.delete(targetID);
    }
    if (entryI && entryI.targetID === targetID) {
      clearTimeout(entryI.timeout);
      PendingByInviter.delete(inviterID);
    }

    const inviterPlayer = getPlayerByUserID(inviterID);
    const tgtPlayer     = getPlayerByUserID(targetID);

    inviterPlayer?.typedSocket.send('invite', { action: 'cancelled', inviterID, targetID });
    tgtPlayer?.typedSocket.send('invite',     { action: 'cancelled', inviterID, targetID });

    if (inviterPlayer) Helpers.updatePlayerState(inviterPlayer, 'init');
    if (tgtPlayer)     Helpers.updatePlayerState(tgtPlayer,     'init');
    return;
  }
}

export async function handleLeaveGame(parsed: any, player: Interfaces.playerInterface) {
  const gameID = player.gameID;
  if (!gameID) {
    console.warn(`handleLeaveGame: player ${player.userID} is not in a game`);
    return;
  }
  const room = PongRoom.rooms.get(gameID)
	if(parsed.islegit === true || !room)
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
