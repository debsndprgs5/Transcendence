import { showNotification, showUserActionsBubble } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { PongRenderer } from './pong_render';
import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';


export const pongState = {
  pongRenderer: null as PongRenderer | null,
};

export async function initGameSocket() {
	if (!state.authToken) return;

	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	state.gameSocket = gameSocket;

	const typedSocket = createTypedEventSocket(state.gameSocket);
	gameSocket.onopen = () => {
		console.log('[GAME] WebSocket connected');

		if (state.playerInterface) {
			state.playerInterface.state = 'online';

			// Send the 'init' message to backend
			const typedSocket = createTypedEventSocket(gameSocket);
			typedSocket.send('init', {
			userID: state.userId!,
			});
		} else {
			console.warn('[GAME] No playerInterface set up');
		}
	};

  gameSocket.onclose = () => {
    console.warn('[GAME] WebSocket closed');
  };

  gameSocket.onerror = (err) => {
    console.error('[GAME] WebSocket error:', err);
  };
	handleEvents(typedSocket, gameSocket);
}

async function handleEvents(
	typedSocket:ReturnType<typeof import('./shared/gameEventWrapper').createTypedEventSocket>, ws:WebSocket){

	typedSocket.on('init' , async(_socket, data:Interfaces.SocketMessageMap['init'])=> {
		await handleInit(data, state.gameSocket!);
	});
	typedSocket.on('joinGame', async(_socket, data:Interfaces.SocketMessageMap['joinGame'])=>{
		await handleJoinGame(data);
	});
	typedSocket.on('invite', async(_socket, data:Interfaces.SocketMessageMap['invite'])=>{
		await handleInvite(data, typedSocket);
	});
	typedSocket.on('startGame',async(_socket, data:Interfaces.SocketMessageMap['startGame']) =>{
		await handleStartGame(data);
	});
	typedSocket.on('statusUpdate', async (_socket, data:Interfaces.SocketMessageMap['statusUpdate']) => {
		if (state.playerInterface) {
			state.playerInterface.state = data.newState;
		}
	});
	typedSocket.on('giveSide', async (_socket, data:Interfaces.SocketMessageMap['giveSide']) => {
		if (state.playerInterface) {
			state.playerInterface.playerSide = data.side;
		}
	});
	typedSocket.on('renderData',async(_socket, data:Interfaces.SocketMessageMap['renderData']) =>{
		await handleRenderData(data);
	});
	typedSocket.on('endMatch', async(_socket, data:Interfaces.SocketMessageMap['endMatch'])=>{
		await handleEndMatch(data);
	});
	typedSocket.on('kicked', async(_socket, data:Interfaces.SocketMessageMap['kicked'])=>{
		await handleKicked(data);
	});
	typedSocket.on('reconnected', async(_socket, data:Interfaces.SocketMessageMap['reconnected'])=>{
		await handleReconnection(data);
	});
	
}

export async function handleInit(data:Interfaces.SocketMessageMap['init'], gameSocket:WebSocket){
		if (data.success) {
		state.playerInterface = {
			userID: data.userID,
  			username: '', //placeholder for now 
			socket: gameSocket,
			state: data.state ?? 'init',
		};

		showNotification({
			message: `Connected to game socket. State: ${data.state}`,
			type: 'success',
		});
	}
}


export async function handleJoinGame(data:Interfaces.SocketMessageMap['joinGame']){
		if(data.success === false)
			showNotification({ message:`Unable to join game because ${data.reason}` , type: 'error' });
		else 
			showNotification({ message:`Game joined with success${data.gameID}` , type: 'success' });
}

export async function handleInvite(
  data: Interfaces.SocketMessageMap['invite'],
  typedSocket: ReturnType<typeof import('./shared/gameEventWrapper').createTypedEventSocket>
) {
  const { action, response, userID } = data;

  if (action === 'reply') {
    if (response !== 'accept') {
      console.log(`The user you tried to invite is ${response}`);
    } else {
      console.log('The user you invited just joined the GameRoom');
    }
  }

  if (action === 'receive') {
    const username = await apiFetch(`user/by-index/${userID}`); // Add await
    showNotification({
      message: `${username} invited you to play. Join?`,
      type: 'confirm',
      onConfirm: async () => {
        typedSocket.send('invite', {
          action: 'reply',
          response: 'accept',
        });
      },
      onCancel: async () => {
        typedSocket.send('invite', {
          action: 'reply',
          response: 'decline',
        });
      },
    });
  }
}

export async function handleStartGame(data: Interfaces.SocketMessageMap['startGame']) {
  if (!pongState.pongRenderer) {
	const canvas = document.getElementById('babylon-canvas');
	if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
	  throw new Error('Canvas element #renderCanvas not found or is not a canvas element');
	}

	if (!state.playerInterface || !state.playerInterface.socket) {
	  throw new Error('playerInterface is not defined');
	}

	pongState.pongRenderer = new PongRenderer(canvas, state.playerInterface.socket, 2, state.playerInterface.playerSide!);
  }
}

export async function handleRenderData(data: Interfaces.SocketMessageMap['renderData']) {
	if (!pongState.pongRenderer) {
		console.warn('PongRenderer not initialized yet.');
		return;
	}

	// Validate paddles/balls structure
	if (!data.paddles || !data.balls) {
		console.error('[renderData] Invalid structure received:', data);
		return;
	}

	// Call the renderer with structured data
	pongState.pongRenderer.updateScene({
		paddles: data.paddles,
		balls: data.balls,
	});
}

export async function handleEndMatch(data: Interfaces.SocketMessageMap['endMatch']) {
	const renderer = pongState.pongRenderer;

	if (renderer) {
		// Gracefully stop the render loop and dispose the scene
		console.log('[ENDMATCH] Disposing PongRenderer and cleaning up.');
		renderer.dispose();
		pongState.pongRenderer = null;
	} else {
		console.warn('[ENDMATCH] No renderer found to dispose.');
	}

	// === Placeholder: Show end game view (win/lose screen) ===
	if (data.isWinner) {
		console.log('🏆 YOU WON!'); // TODO: Show "You Won" view
	} else {
		console.log('💀 YOU LOST.'); // TODO: Show "You Lost" view
	}

	// === Leave the game on the server ===
	if (state.playerInterface?.socket && state.playerInterface.gameID !== undefined) {
		const typedSocket = createTypedEventSocket(state.playerInterface.socket);
		typedSocket.send('leaveGame', {
			userID: state.playerInterface!.userID,
			gameID: state.playerInterface!.gameID!,
			islegit: true
		});
	} else {
		console.warn('[ENDMATCH] Could not send leaveGame, missing socket or gameID.');
	}

	// === Optional: Clear game-related state ===
	// TODO: Reset UI back to main menu or room selection after showing win/lose view
}

export async function handleKicked(data: Interfaces.SocketMessageMap['kicked']) {
  // Show a notification with the kick reason
  showNotification({
    message: `You were removed from the game: ${data.reason}`,
    type: 'error',
  });

  // Dispose of the PongRenderer if it's active
  pongState.pongRenderer?.dispose();
  pongState.pongRenderer = null;

  // Reset game-related state
  if (state.playerInterface) {
    state.playerInterface.gameID = -1;
  }
  // TODO: Update the UI to return the user to the main menu or lobby view
}

export async function handleReconnection(data: Interfaces.SocketMessageMap['reconnected']) {
  console.log(`[FRONT][GAMESOCKET] User ${state.userId} reconnected with state: ${data.state}`);

  if (!state.playerInterface) {
    console.warn('[RECONNECT] No playerInterface found, skipping restore.');
    return;
  }

  state.playerInterface.state = data.state;

  if (data.gameID && pongState.pongRenderer !== null) {
    console.log('[RECONNECT] User was in an active game. Renderer still alive, resume game.');
    
    // TODO: Call a method to ensure rendering loop is resumed if needed
    // e.g., pongState.pongRenderer.resume(); — implement if renderer supports pause/resume

    return;
  }

  if (data.gameID && pongState.pongRenderer === null) {
    console.log('[RECONNECT] User was in a game, but renderer is gone. Restore render manually.');

    // TODO: Optionally reload or reconstruct the scene
    // e.g., re-enter room or show a prompt like:
    showNotification({
      message: 'You were reconnected. Do you want to resume the game?',
      type: 'confirm',
      onConfirm: () => {
        // Re-request game data or join room again
        state.playerInterface?.socket.send(JSON.stringify({
          type: 'resumeGame',
          gameID: data.gameID,
        }));
      },
    });

    return;
  }

  if (!data.gameID) {
    console.log('[RECONNECT] User is not in a game. Returning to lobby.');

    // TODO: Update view to main menu or idle lobby
  }
}