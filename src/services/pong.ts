/*BIG PACEHODLER FOR MATCHES MANAGMENT 
	SOON -> let the game run for 20sec so I can try paddles
*/
import * as Interfaces from '../shared/gameTypes'
import { createTypedEventSocket } from '../shared/gameEventWrapper'


const MappedGames = new Map<
  number,
  {
    game: Interfaces.gameRoomInterface & { parsedSettings?: any };
    players: Interfaces.playerInterface[];
    loopTimeout?: NodeJS.Timeout;
    startTime: number;
  }
>();

export async function declareWinner(
  currentGame: Interfaces.gameRoomInterface,
  players: Interfaces.playerInterface[],
  winnerSides: ('left' | 'right' | 'top' | 'bottom')[]
) {
  for (const p of players) {
    const isWinner = winnerSides.includes(p.playerSide!);
    const endMessage: Interfaces.SocketMessageMap['endMatch'] = {
      type: 'endMatch',
      isWinner,
    };

    // Use your typed socket send helper here
    const typedSocket = createTypedEventSocket(p.socket);
    typedSocket.send('endMatch', endMessage);
  }
  // Optional: save to DB here
}


export async function startMockGameLoop(
  gameID: number,
  players: Interfaces.playerInterface[],
  rules: {
    winCondtion: 'score' | 'time';
    limit: number;
    ballSpeed: number;
    paddleSpeed: number;
  }
) {
  const startTime = Date.now();

  // Initialize player positions
  players.forEach(p => {
    if (p.playerPos === undefined) p.playerPos = 0;
  });
   // === Create a new game object ===
    // === Create a new game object ===
  const gameEntry = {
    game: {
       gameID,            // gameID to match the game's unique ID
      winCondtion: rules.winCondtion, // winCondtion is either 'score' or 'time'
      limit: rules.limit,            // The score or time limit
      mode: players.length === 2 ? 'duo' : 'quatuor', // Mode based on the number of players (defaulting to '2p' or '4p')
      ballSpeed: rules.ballSpeed,    // ballSpeed from rules
      paddleSpeed: rules.paddleSpeed, // paddleSpeed from rules
      settings: '',  // Add an empty string or a custom setting if needed
      created_at: new Date().toISOString(), // Create timestamp for the game start
    },
    players,
    loopTimeout: undefined, // Make sure to set this to undefined initially
    startTime, // Include startTime for elapsed time calculations
  };

  // === Add the game to the MappedGames map ===
  MappedGames.set(gameID, gameEntry);
  function loopFrame() {
    const elapsed = (Date.now() - startTime) / 1000;

    // === Build nested renderData structure ===
    const paddles: Record<number, { pos: number; side: 'left' | 'right' | 'top' | 'bottom' }> = {};
    const balls: Record<number, { x: number; y: number }> = {}; // No ball yet

    for (const p of players) {
      paddles[p.userID] = {
        pos: p.playerPos!,
        side: p.playerSide!,
      };
    }

    // Dummy ball placeholder (just to maintain structure)
    balls[0] = { x: 0, y: 0 };

    // === Send to all players ===
    for (const p of players) {
      const renderMsg: Interfaces.SocketMessageMap['renderData'] = {
        type: 'renderData',
        paddles,
        balls,
      };

      p.typedSocket.send('renderData', renderMsg);
    }

    // === Game end conditions ===

    if (rules.winCondtion === 'time' && elapsed >= rules.limit) {
      const winnerSide =
        players.length === 4
          ? (['left', 'right', 'top', 'bottom'] as const)[Math.floor(Math.random() * 4)]
          : (['left', 'right'] as const)[Math.floor(Math.random() * 2)];

      declareWinner(MappedGames.get(gameID)!.game, players, [winnerSide]);
      return;
    }

    // === DEBUG: score win condition ends after 30s
    if (rules.winCondtion === 'score' && elapsed >= 30) {
      console.log('[DEBUG] Ending game after 30s with winCond = score');

    const winnerSide =
      players.length === 4
        ? (['left', 'right', 'top', 'bottom'] as const)[Math.floor(Math.random() * 4)]
        : (['left', 'right'] as const)[Math.floor(Math.random() * 2)];

      declareWinner(MappedGames.get(gameID)!.game, players, [winnerSide]);
      return;
    }

    setTimeout(loopFrame, 1000 / 60);
  }

  loopFrame();
}

export async function playerMove(
  gameID: number,
  userID: number,
  direction: 'right' | 'left' | 'stop'
) {
  const gameEntry = MappedGames.get(gameID);
  if (!gameEntry) {
    console.warn(`No game found with ID: ${gameID}`);
    return;
  }

  const player = gameEntry.players.find(p => p.userID === userID);
  if (!player) {
    console.warn(`No player with userID ${userID} in game ${gameID}`);
    return;
  }

  if (player.playerSide === undefined) {
    console.warn(`Player ${userID} has no assigned side`);
    return;
  }

  // === Init playerPos if undefined ===
  if (player.playerPos === undefined) {
    player.playerPos = 0;
  }

  // === Get paddleSpeed from settings ===
  const settings = (gameEntry.game as any).parsedSettings || {};
  const paddleSpeedSetting = Number(settings.paddle_speed) || 50;
  const BASE_SPEED = 0.8;
  const speedMultiplier = Math.max(1, Math.min(100, paddleSpeedSetting)) / 50;
  const movement = BASE_SPEED * speedMultiplier;

  // === Determine map boundary based on mode ===
  const mode = gameEntry.game.mode || (gameEntry.players.length === 4 ? 'quator' : 'duo');
  const MAP_LIMIT = mode === 'quator' ? 6 : 5;
  const halfPaddle = 1.5;

  // === Move based on player side ===
  if (player.playerSide === 'left' || player.playerSide === 'right') {
    if (direction === 'right') {
      player.playerPos += movement;
    } else if (direction === 'left') {
      player.playerPos -= movement;
    }
    console.log(`POSTION UPDATED FOR PLAYER${userID} `);
    // Clamp X-axis
    player.playerPos = Math.max(-MAP_LIMIT + halfPaddle, Math.min(MAP_LIMIT - halfPaddle, player.playerPos));
  }

  else if (player.playerSide === 'top' || player.playerSide === 'bottom') {
    if (direction === 'right') {
      player.playerPos += movement;
    } else if (direction === 'left') {
      player.playerPos -= movement;
    }

    // Clamp Y-axis
    player.playerPos = Math.max(-MAP_LIMIT + halfPaddle, Math.min(MAP_LIMIT - halfPaddle, player.playerPos));
  }

  // 'stop' does nothing for now
}

export function stopMockGameLoop(gameID: number) {
  const gameEntry = MappedGames.get(gameID);
  if (!gameEntry) {
    console.warn(`[stopMockGameLoop] No game found with ID: ${gameID}`);
    return;
  }

  // Just clear the loop interval if it exists
  if (gameEntry.loopTimeout) {
    clearInterval(gameEntry.loopTimeout);
  }

  // Remove the game from memory
  MappedGames.delete(gameID);
  console.log(`[stopMockGameLoop] Game loop for ${gameID} has been stopped`);
}
