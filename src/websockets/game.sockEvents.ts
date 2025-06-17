import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import { TypedSocket } from '../shared/gameTypes';
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID, delPlayer} from './game.socket'
import { playerMove } from '../services/pong'

// import{stopMockGameLoop, startMockGameLoop, playerMove} from '../services/pong'

//Map of pending invite for timeout and duplicates managment
const PendingInvites = new Map<number, { inviterID: number; timeout: NodeJS.Timeout }>();

//ADD event here if needed for gameSocket
export function handleAllEvents(typedSocket:TypedSocket, player:Interfaces.playerInterface) {
   typedSocket.on('init', async (socket:WebSocket, data:Interfaces.SocketMessageMap['init']) => {
     handleInit(data, player);
   });

  typedSocket.on('joinGame', async (socket:WebSocket, data:Interfaces.SocketMessageMap['joinGame']) => {
    handleJoin(data, player);
  });

  typedSocket.on('invite', async (socket:WebSocket, data:Interfaces.SocketMessageMap['invite']) => {
    handleInvite(data, player);
  });
  
  typedSocket.on('gameRequest',async (socket:WebSocket, data:Interfaces.SocketMessageMap['gameRequest']) => {
    const players = getAllMembersFromGameID(player.userID);
    console.log(`GAME REQUEST FOR USER ${player.userID}| game : ${player.gameID}`);
    if(players)
      await Helpers.beginGame(player.gameID!, players);

  } );
  typedSocket.on('leaveGame', async (socket:WebSocket, data:Interfaces.SocketMessageMap['leaveGame']) => {
    handleLeaveGame(data, player);
  });
  typedSocket.on('playerMove', async (socket:WebSocket, data:Interfaces.SocketMessageMap['playerMove']) => {
    handlePlayerMove(data, player);
  });

  typedSocket.on('reconnected', () => {
    handleReconnect(player);
  });
  typedSocket.on('disconnected', ()=>{
    handleDisconnect(player);
  });
  // if ('on' in typedSocket.socket) {
  // typedSocket.socket.on('close', () => {
  //   const player = getPlayerBySocket(typedSocket.socket as any);
  //   handleDisconnect(player);
  // });
  // }
}



//HANDLERS 

export async function handleInit(
  data: { userID: number },
  player: Interfaces.playerInterface,
) {
  console.log(`HANDLE INIT CALLED : ${data.userID}`);

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


  if (player.state !== 'init') {
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
    console.log(`ADDING [USERID]${userID} in gameRoom : ${gameID}`);

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
  if (!gameID || gameID === -1) {
    console.warn(`handleLeaveGame: player ${player.userID} is not in a game`);
    return;
  }
	if(parsed.islegit === true)
		await Helpers.kickFromGameRoom(gameID, player);
	else
  		await Helpers.kickFromGameRoom(gameID, player, `${player.username} left`);

  // console.log(`Game room ${gameID} deleted after player ${player.userID} left.`);
}

export async function handlePlayerMove(parsed: any, player: Interfaces.playerInterface) {
    const { direction, gameID } = parsed;
    playerMove(gameID, player.userID, direction)
}

//WE NEED TO CHECK WHAT TO DO IN THAT CASE MORE CLEARLY
export async function handleReconnect(player: Interfaces.playerInterface) {
	if (!player.hasDisconnected) {
		console.log(`[GAME] Reconnect failed or not needed for user ${player.userID}`);
		return;
	}

	console.log(`[GAME] Reconnected: user ${player.userID}`);

	player.hasDisconnected = false;

	if ((player as any).disconnectTimeout) {
		clearTimeout((player as any).disconnectTimeout);
		delete (player as any).disconnectTimeout;
	}

	// Optional: notify UI/game state
}

export async function handleDisconnect(player: Interfaces.playerInterface) {
  console.log(`User ${player.userID} disconnected. Waiting 15s for reconnect...`);
  player.hasDisconnected = true;
  interface PlayerWithTimeout extends Interfaces.playerInterface {
    disconnectTimeOut?: NodeJS.Timeout;
  }
  const playerWithTimeout = player as PlayerWithTimeout;

  // Clear any existing timeout to avoid duplicates
  if (player.disconnectTimeOut) {
    clearTimeout(player.disconnectTimeOut);
  }

  // Set a new timeout to kick player after 15s 
  player.disconnectTimeOut = setTimeout(async () => {
    const stillPlayer = getPlayerByUserID(player.userID);
    if (stillPlayer && stillPlayer.hasDisconnected) {
      console.log(`User ${player.userID} timed out. Removing from game.`);
      
      if (player.gameID && player.gameID !== -1) {
        await Helpers.kickFromGameRoom(player.gameID, player, `${player.username ?? 'User'} timed out`);
      }
      delPlayer(stillPlayer.userID);
    }
  }, 15000);
}