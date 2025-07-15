import * as Interfaces from '../shared/gameTypes'
import * as GameManagement from '../db/gameManagement'
import {createTypedEventSocket} from '../shared/gameEventWrapper'
import {getPlayerBySocket, getPlayerByUserID, getAllMembersFromGameID} from './game.socket'
// import{stopMockGameLoop, startMockGameLoop} from '../services/pong'
import { PongRoom } from '../services/PongRoom'
import { Tournament } from '../services/tournament'



//ALL STUFF THAT CAN HAPPENDS ANYWHERE
export function updatePlayerState(
  player: Interfaces.playerInterface,
  newState: Interfaces.playerInterface['state']
) {
  player.state = newState;

  if (player.typedSocket) {
    player.typedSocket.send('statusUpdate', {
      userID: player.userID,
      newState
    });
  }
  else 
    console.warn(`CANNOT SEND STATUS UPDATE no typed socket found`)
}


//ALL STUFF THAT CAN HAPPEND BEFORE A GAME 

//when user A send request to user B
export async function processInviteSend(player: Interfaces.playerInterface, target: Interfaces.playerInterface) {

  if (player.state !== 'init') {
    player.typedSocket.send('invite', {
      action: 'reply',
      response: 'you are busy',
      targetID: target.userID
    });
    return;
  }

  if (target.state !== 'init') {
    target.typedSocket.send('invite', {
      action: 'reply',
      response: 'busy',
      targetID: target.userID
    });
    return;
  }

  // Update states
  updatePlayerState(player, 'waiting');
  updatePlayerState(target, 'invited');

  target.typedSocket.send('invite', {
    action: 'receive',
    fromID: player.userID,
  });
}

//when userB reply to A
export async function processInviteReply(inviter: Interfaces.playerInterface, invitee: Interfaces.playerInterface, response: string) {
  if (!inviter || !invitee) return;

  inviter.typedSocket.send('invite', {
    action: 'reply',
    response,
    targetID: invitee.userID
  });

  if (response === 'accept') {
    // Create game & add players
    const quickRoomID = await createQuickGameAndAddPlayers(inviter.userID, invitee.userID, inviter.username!);

    // Update states for both players
    updatePlayerState(inviter, 'waiting');
    updatePlayerState(invitee, 'waiting');

    tryStartGameIfReady(quickRoomID);

  } else {
    // Reset both players states to init
    updatePlayerState(inviter, 'init');
    updatePlayerState(invitee, 'init');
  }
}

//A and B can play we create the game
export async function createQuickGameAndAddPlayers(inviterID: number, inviteeID: number, inviterUsername: string) {
  const type = 'private';
  const state = 'waiting';
  const mode = 'duo';
  const name = `${inviterUsername}'s party`;
  const rules = JSON.stringify({
    ball_speed: 50,
    paddle_speed: 50,
    win_condition: 'score',
    limit: 10,
  });

  // Create the quick game room
  const quickRoomID = await GameManagement.createGameRoom(type, state, mode, rules, name, inviterID);

  // Add both players to the room
  await GameManagement.addMemberToGameRoom(quickRoomID, inviterID);
  await GameManagement.addMemberToGameRoom(quickRoomID, inviteeID);

  const inviter = getPlayerByUserID(inviterID);
  inviter!.gameID = quickRoomID;
  const invitee = getPlayerByUserID(inviteeID);
  invitee!.gameID = quickRoomID;

  return quickRoomID;
}

export async function beginGame(gameID: number, players: Interfaces.playerInterface[]) {
  const modeRow = await GameManagement.getModePerGameID(gameID);
  const mode = modeRow?.mode || 'duo';
  const expectedCount = mode === 'quator' ? 4 : 2;

  if (players.length !== expectedCount) {
    console.error(`[beginGame] GameID ${gameID} expected ${expectedCount} players for mode '${mode}'`);
    return;
  }
  console.warn('bleep bloop bleep bloopbleep bloop bleep bloopbleep bloop bleep bloopbleep bloop bleep bloopbleep bloop bleep bloop');
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const sides = mode === 'quator'
    ? ['left', 'right', 'top', 'bottom'] as const
    : ['left', 'right'] as const;

  const fullRules = await GameManagement.getModeAndRulesForGameID(gameID);
  const winCondition = fullRules?.rules?.win_condition ?? 'score';
  const limit = fullRules?.rules?.limit ?? 15;
  const ballSpeed = fullRules?.rules?.ball_speed ?? 50;
  const paddleSpeed = fullRules?.rules?.paddle_speed ?? 50;

  GameManagement.setStateforGameID(gameID, 'playing');

  const gameDesc: Interfaces.gameRoomInterface & { ballSpeed: number; paddleSpeed: number } = {
    gameID,
    mode,
    winCondition,
    limit,
    settings: '',
    created_at: new Date().toISOString(),
    ballSpeed,
    paddleSpeed,
  }

  // Build side-to-username map here
  const sideToUsername: Record<'left' | 'right' | 'top' | 'bottom', string> = {} as any;

  shuffled.forEach((player, index) => {
    const side = sides[index];
    player.playerSide = side;
    sideToUsername[side] = player.username!;

    updatePlayerState(player, 'playing');

    // Send side assignment
    const sideMsg: Interfaces.SocketMessageMap['giveSide'] = {
      type: 'giveSide',
      userID: player.userID,
      gameID,
      side,
    };
    player.typedSocket.send('giveSide', sideMsg);
  });
  let gameName = await GameManagement.getNamePerGameID(gameID);
  if(!gameName!.name)
      gameName!.name = `WE COULD PUT "EASTER EGG" HERE`;
  // Send startGame message after sideToUsername is fully built
  shuffled.forEach((player) => {
    const startMsg: Interfaces.SocketMessageMap['startGame'] = {
      type: 'startGame',
      userID: player.userID,
      gameID,
      gameName:gameName!.name,
      win_condition: gameDesc.winCondition,
      limit: gameDesc.limit,
      usernames: sideToUsername,
    };
    player.typedSocket.send('startGame', startMsg);
  });

  const existingGame = PongRoom.rooms.get(gameID)
  if(!existingGame)
    new PongRoom(gameDesc, shuffled);
}


export async function tryStartGameIfReady(gameID: number) {
  // Get mode from DB for this gameID
  const modeRow = await GameManagement.getModePerGameID(gameID);
  if (!modeRow) {
    console.error(`[tryStartGameIfReady] No mode found for gameID ${gameID}`);
    return;
  }

  // Determine maxPlayers based on mode string
  let maxPlayers: number;
  switch (modeRow.mode) {
    case 'duo':
      maxPlayers = 2;
      break;
    case 'quator':
      maxPlayers = 4;
      break;
    default:
      console.warn(`[tryStartGameIfReady] Unknown mode '${modeRow.mode}' for gameID ${gameID}, defaulting to 2`);
      maxPlayers = 2;
      break;
  }

  const playersInGameRoom = getAllMembersFromGameID(gameID) ?? [];
  console.log(playersInGameRoom);

  if (playersInGameRoom.length > maxPlayers) {
    const playerToKick = await GameManagement.getLastAddedToRoom(gameID);
    if (!playerToKick?.userID) return;

    const excluded = getPlayerByUserID(playerToKick.userID);
    if (!excluded) return;
    
    await kickFromGameRoom(gameID, excluded, 'an error has occurred');
    return tryStartGameIfReady(gameID);
  }

  if (playersInGameRoom.length === maxPlayers) {
    const playerObjs = playersInGameRoom
      .map(p => getPlayerByUserID(p.userID))
      .filter((p): p is Interfaces.playerInterface => !!p);

    if (playerObjs.length === maxPlayers) {
      playerObjs.forEach(p => {
        updatePlayerState(p, 'playing');  // Event-driven status update
      });
      console.log(`[TryStartGameIfReady] calling beginGame on gameID ${gameID}`);
      // start the game (send first render and start game loop)
      beginGame(gameID, playerObjs);
    }
  }
}



//ALL STUFF THAT HAPPENDS AFTER THE GAME 
export async function kickFromGameRoom(
  gameID: number,
  triggeringPlayer?: Interfaces.playerInterface | number,
  reason?: string
) {
  let triggering: Interfaces.playerInterface | undefined;
  
  if (typeof triggeringPlayer === 'number') {
    triggering = getPlayerByUserID(triggeringPlayer);
  } else {
    triggering = triggeringPlayer;
  }

  if (!triggering) return;

  const players = getAllMembersFromGameID(gameID);
  if (!players || players.length === 0) {
    console.warn(`[kickFromGameRoom] No players found in room ${gameID}`);
    return;
  }

  // If reason is provided, kick **all** players with reason
  if (reason) {
    for (const p of players) {
      const kickedPlayer = getPlayerByUserID(p.userID);
      if (!kickedPlayer) continue;

      const isTriggeringPlayer = (kickedPlayer.userID === triggering.userID);

      // Remove player from DB room membership
      await GameManagement.delMemberFromGameRoom(gameID, kickedPlayer.userID);

      // Send 'kicked' message with reason
      p.typedSocket.send('kicked', {
        userID: p.userID,
        reason,
        triggeredBySelf: isTriggeringPlayer, // can be used on client to display proper message
      });

      // Reset player state and gameID
      updatePlayerState(p, 'init');
      p.gameID = undefined;

      // if (!isTriggeringPlayer) {
      //   // ✅ Step 1: Check if player is in tournament
      //   if (kickedPlayer.tournamentID !== undefined) {
      //     console.log(`[kickFromGameRoom] Player ${kickedPlayer.userID} was in tournament ${kickedPlayer.tournamentID}`);
      //     const tour = Tournament.MappedTour.get(kickedPlayer.tournamentID);
      //     tour!.matchGaveUp(kickedPlayer.tournamentID, triggering.userID);
      //   }
      // }
    }

    // Cleanup room after all kicked
    await GameManagement.deleteGameRoom(gameID);
    const room = PongRoom.rooms.get(gameID);
    if (room) room.stop();
    return;
  }

  // No reason: kick only the triggeringPlayer
  if (!triggeringPlayer) {
    console.warn('[kickFromGameRoom] No triggeringPlayer and no reason provided - nothing to do');
    return;
  }

  await GameManagement.delMemberFromGameRoom(gameID, triggering.userID);
  updatePlayerState(triggering, 'init');
  triggering.gameID = undefined;

  // Optionally cleanup room
  const remainingPlayers = getAllMembersFromGameID(gameID);
  if (!remainingPlayers || remainingPlayers.length === 0) {
    await GameManagement.deleteGameRoom(gameID);
    const room = PongRoom.rooms.get(gameID);
    if (room) room.stop();
  }
}

