
import { showNotification, showUserActionsBubble } from './notifications.js';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import type { SocketMessageMap } from './shared/gameTypes';
//import { WebSocket } from 'ws';
import { PongRenderer } from './pong_render.js';

export const pongState = {
  pongRenderer: null as PongRenderer | null,
};
export async function initGameSocket() {
	if (!state.authToken) return;

	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	state.socket = gameSocket;

	gameSocket.onopen = () => {
		console.log('[GAME] WebSocket connected')
		if(state.playerInterface)
			state.playerInterface.state='online';
		else
			console.log(`NO PLAYER INFERFACE SETUP`);
	};

	gameSocket.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			handleSocketMessage(data, gameSocket);
		} catch (err) {
			console.error('[GAME] WebSocket message parse error:', err);
		}
	};

	gameSocket.onclose = () => {
		console.warn('[GAME] WebSocket closed');
	};

	gameSocket.onerror = (err) => {
		console.error('[GAME] WebSocket error:', err);
	};
}


function handleSocketMessage(data: any, gameSocket:WebSocket) {
	// if(!state.playerInterface){
	// 	console.log(`NO PLAYER INTERFACE FOR STATE`);
	// 	return;
	// }
	switch (data.type) {
		case 'init':
			handleInit(data, gameSocket);
			break;
		case 'joinGame':
			handleJoinGame(data);
			break;
		case 'invite':
			handleInvite(data);
			break;
		case 'startGame':
			handleStartGame(data);
			break;
		case 'statusUpdate':
			if(state.playerInterface)
				state.playerInterface.state = data.newState;
			break;
		case 'giveSide':
			if(state.playerInterface)
				state.playerInterface.playerSide = data.side;
			break;
		case 'playerMove':
			handlePlayerMove(data);
			break;
		case 'renderData':
			handleRenderData(data);
			break;
		case 'endMatch':
			handleEndMatch(data);
			break;
		case 'reconnected':
			handleReconnection(data);
			break;
		default:
			console.warn('Unknown message type:', data);
	}
}

export async function handleInit(data:SocketMessageMap['init'], gameSocket:WebSocket){
		if (data.success) {
		state.playerInterface = {
			userID: data.userID,
			socket: gameSocket,
			state: data.state,
		};

		showNotification({
			message: `Connected to game socket. State: ${data.state}`,
			type: 'success',
		});
	}
}


export async function handleJoinGame(data:SocketMessageMap['joinGame']){
		if(data.success === false)
			showNotification({ message:`Unable to join game because ${data.reason}` , type: 'error' });
		else 
			showNotification({ message:`Game joined with success${data.gameID}` , type: 'success' });
}

 export async function handleInvite(data:SocketMessageMap['invite']){
	const {action , response, userID} = data;
	if(action === 'reply'){
		if(response !== 'accept')
			console.log(`The user you tried to invite is ${response}`);
		else 
			console.log('The user you invited just joined the GameRoom');
	}
	if(action == 'receive'){

		const username = apiFetch(`user/by-index/${userID}`)
			showNotification({
						message: `${username} invited you to play, join ?`,
						type: 'confirm',
						onConfirm: async () => {
							const response = 'accept'
							if(state.playerInterface?.socket){
								const msg:SocketMessageMap['invite'] = {
									type:'invite',
									action: 'reply',
									response
								}
								state.playerInterface.socket.send(JSON.stringify(msg));
							}
						},
						onCancel:async() => {
							const response = 'decline'
							if(state.playerInterface?.socket){
								const msg:SocketMessageMap['invite'] = {
									type:'invite',
									action: 'reply',
									response
								}
								state.playerInterface.socket.send(JSON.stringify(msg));
							}
						}

			});
	}
}

export async function handleStartGame(data: SocketMessageMap['startGame']) {
  if (!pongState.pongRenderer) {
    const canvas = document.getElementById('babylon-canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Canvas element #renderCanvas not found or is not a canvas element');
    }

    if (!state.playerInterface) {
      throw new Error('playerInterface is not defined');
    }

    pongState.pongRenderer = new PongRenderer(canvas, state.playerInterface.socket);
  }
}

export async function handlePlayerMove(data:SocketMessageMap['playerMove']){
	//Does the front should receveid those on the of render every tick ? 
}

export async function handleRenderData(data:SocketMessageMap['renderData']){
	if (!pongState.pongRenderer) {
		console.warn('PongRenderer not initialized yet.');
		return;
	  }
	
	  pongState.pongRenderer.updatePositions({
		paddle1Y: data.paddle1Y,
		paddle2Y: data.paddle2Y,
		ballX: data.ballX,
		ballY: data.ballY,
	  });
}

export async function handleEndMatch(data:SocketMessageMap['endMatch']){
	if(data.isWinner)
		console.log('YOU WON');//Needs to call a winning view
	else 
		console.log('YOU LOST');//Needs to call losing view 
	//post the routes for data ?NONONO only back update state after a match
}

export async function handleReconnection(data:SocketMessageMap['reconnected']){
	//based on data.state log the correct views back 
	console.log(`[FRONT][GAMESOCKET]user ${state.userId}: just reconneted`);
	//What logic should we have for reconnected?
	if(state.playerInterface){
		state.playerInterface.state=data.state;
		if(data.gameID ){
			//Returns to renderGame?
			//PACEHODLER TO EXIT ROOM
			showNotification({
			message:'Do you want to leave room ?',
			type:'confirm',
			onConfirm: () => {
				state.playerInterface?.socket?.send(JSON.stringify({
					type:'leaveGame',
					userID:state.userId,
					gameID:data.gameID
				}));
			}});
		}
	}
}













