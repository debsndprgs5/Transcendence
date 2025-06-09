import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import * as Helpers from './game.sockHelpers'
import {TypedEventSocket, createTypedEventSocket} from '../shared/gameEventWrapper'
import {getPlayerBySocket, getPlayerById, getAllMembersFromGameID, delPlayer} from './game.socket'
import{stopMockGameLoop, startMockGameLoop, playerMove} from '../services/pong'



//ADD event here if needed for gameSocket
export function handleAllEvents(
  typedSocket: ReturnType<typeof import('../shared/gameEventWrapper').createTypedEventSocket>
) {
  // Register handlers using typedSocket.on(eventName, handler)
  typedSocket.on('init', async (ws, data) => {
    const player = getPlayerBySocket(ws); // implement a helper to find player by ws or pass player if you have it
    handleInit(data, player);
  });

  typedSocket.on('joinGame', async (ws, data) => {
    const player = getPlayerBySocket(ws);
    handleJoin(data, player);
  });

  typedSocket.on('invite', async (ws, data) => {
    const player = getPlayerBySocket(ws);
    handleInvite(data, player);
  });

  typedSocket.on('leaveGame', (ws, data) => {
    const player = getPlayerBySocket(ws);
    handleLeaveGame(data, player);
  });

  typedSocket.on('playerMove', async (ws, data) => {
    const player = getPlayerBySocket(ws);
    handlePlayerMove(data, player);
  });

  typedSocket.on('reconnected', (ws) => {
    const player = getPlayerBySocket(ws);
    handleDisconnect(player);
  });

  typedSocket.socket.on('close', () => {
    const player = getPlayerBySocket(typedSocket.socket);
    handleDisconnect(player);
  });
}


//HANDLERS 

export async function handleInit(
  data: { userID: number },
  player: Interfaces.playerInterface
) {
  console.log(`HANDLE INIT CALLED : ${data.userID}`);

  const success = data.userID === player.userID;

  const socket = player.socket as TypedEventSocket;

  socket.send('init', {
    userID: player.userID,
    state: 'init',
    success,
  });
}

export async function handleJoin(parsed: any, player: Interfaces.playerInterface) {
  const { userID, gameName, gameID } = parsed;
  const typedSocket = createTypedEventSocket(player.socket);

  if (player.state !== 'init') {
    typedSocket.send('joinGame', {
      success: false,
      reason: `you are in ${player.state} mode`,
      type: 'joinGame',
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
    typedSocket.send('joinGame', {
      success: true,
      state: player.state,
      gameID: player.gameID,
      gameName,
      userID: player.userID,
      type: 'joinGame',
    });
  } catch (err) {
    console.error('handleJoin error', err);
    typedSocket.send('joinGame', {
      success: false,
      reason: 'Join failed',
      type: 'joinGame',
      userID: player.userID,
      gameID,
      gameName,
    });
  }

  Helpers.tryStartGameIfReady(gameID);
}

export async function handleInvite(parsed: any, player: Interfaces.playerInterface) {
  const { actionRequested, userID, targetID } = parsed;

  if (actionRequested === 'send') {
    const target = getPlayerById(targetID);
    const typedSocket = createTypedEventSocket(player.socket);

    if (!target) {
      typedSocket.send('invite', {
        type: 'invite',
        action: 'reply',
        response: 'offline',
        targetID
      });
      return;
    }

    await Helpers.processInviteSend(player, target);
  }

  if (actionRequested === 'reply') {
    const { fromID, toID, response } = parsed;
    const inviter = getPlayerById(fromID);
    const invitee = getPlayerById(toID);

    await Helpers.processInviteReply(inviter, invitee, response);
  }
}
export async function handleLeaveGame(parsed: any, player: Interfaces.playerInterface) {
  const gameID = player.gameID;
  if (!gameID || gameID === -1) {
    console.warn(`handleLeaveGame: player ${player.userID} is not in a game`);
    return;
  }

  await Helpers.kickFromGameRoom(gameID, player, `${player.username} left`);

  console.log(`Game room ${gameID} deleted after player ${player.userID} left.`);
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

  // Clear any existing timeout to avoid duplicates
  if (player.disconnectTimeOut) {
    clearTimeout(player.disconnectTimeOut);
  }

  // Set a new timeout to kick player after 15s
  player.disconnectTimeOut = setTimeout(async () => {
    const stillPlayer = getPlayerById(player.userID);
    if (stillPlayer && stillPlayer.hasDisconnected) {
      console.log(`User ${player.userID} timed out. Removing from game.`);
      
      if (player.gameID && player.gameID !== -1) {
        await Helpers.kickFromGameRoom(player.gameID, player, `${player.username ?? 'User'} timed out`);
      }
      delPlayer(stillPlayer.userID);
    }
  }, 15000);
}