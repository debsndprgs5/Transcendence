import { showNotification, showUserActionsBubble } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { PongRenderer } from './pong_render';
import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';
import { showPongMenu } from './pong_rooms';
import { TypedSocket } from './shared/gameTypes';
import * as GUI from "@babylonjs/gui";
import * as BABYLON from "@babylonjs/core";


export const pongState = {
	pongRenderer: null as PongRenderer | null,
};

export async function initGameSocket() {
	if (!state.authToken) return;

	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	state.gameSocket = gameSocket;

	const typedSocket = createTypedEventSocket(state.gameSocket);
	state.typedSocket = typedSocket;
	gameSocket.onopen = () => {
		console.log('[GAME] WebSocket connected');
		state.playerInterface ={
			userID:state.userId!,
			socket:state.gameSocket,
			typedSocket:typedSocket,
			state:'online'
		}
		if (state.playerInterface) {
			// Send the 'init' message to backend
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
	typedSocket:TypedSocket, ws:WebSocket){

	typedSocket.on('init' , async(socket:WebSocket, data:Interfaces.SocketMessageMap['init'])=> {
		await handleInit(data, ws);
	});
	typedSocket.on('joinGame', async(socket:WebSocket, data:Interfaces.SocketMessageMap['joinGame'])=>{
		await handleJoinGame(data);
	});
	typedSocket.on('invite', async(socket:WebSocket, data:Interfaces.SocketMessageMap['invite'])=>{
		await handleInvite(data);
	});
	typedSocket.on('startGame',async(socket:WebSocket, data:Interfaces.SocketMessageMap['startGame']) =>{
		await handleStartGame(data);
	});
	typedSocket.on('statusUpdate', async (socket:WebSocket, data:Interfaces.SocketMessageMap['statusUpdate']) => {
		if (state.playerInterface) {
			state.playerInterface.state = data.newState;
		}
	});
	typedSocket.on('giveSide', async (socket:WebSocket, data:Interfaces.SocketMessageMap['giveSide']) => {
		if (state.playerInterface) {
			state.playerInterface.playerSide = data.side;
		}
	});
	typedSocket.on('renderData',async(socket:WebSocket, data:Interfaces.SocketMessageMap['renderData']) =>{
		await handleRenderData(data);
	});
	typedSocket.on('endMatch', async(socket:WebSocket, data:Interfaces.SocketMessageMap['endMatch'])=>{
		await handleEndMatch(data);
	});
	typedSocket.on('kicked', async(socket:WebSocket, data:Interfaces.SocketMessageMap['kicked'])=>{
		await handleKicked(data);
	});
	typedSocket.on('reconnected', async(socket:WebSocket, data:Interfaces.SocketMessageMap['reconnected'])=>{
		await handleReconnection(data);
	});
	
}

export async function handleInit(data:Interfaces.SocketMessageMap['init'], gameSocket:WebSocket){
	
	const Uname = await apiFetch(`/user/by-index/${data.userID}`);
	if (data.success) {
		state.playerInterface = {
			userID: data.userID,
			username: Uname!,
			socket: gameSocket,
			typedSocket:state.typedSocket,
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
		state.typedSocket.send('invite', {
			action: 'reply',
			response: 'accept',
		});
		},
		onCancel: async () => {
		state.typedSocket.send('invite', {
			action: 'reply',
			response: 'decline',
		});
		},
	});
	}
}


function showEndMatchOverlay(
	scene: BABYLON.Scene,
	winner: { username: string; score: number },
	loser:  { username: string; score: number },
	onNext: () => void
) {
	// Create a full‐screen 2D texture for GUI
	const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

	// Semi‐transparent background covering most of the screen
	const overlay = new GUI.Rectangle();
	overlay.width  = "90%";
	overlay.height = "90%";
	overlay.background = "rgba(0,0,0,0.6)";
	overlay.thickness = 0; // no border
	overlay.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	overlay.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	ui.addControl(overlay);

	// Container to hold two halves + center
	const grid = new GUI.Grid();
	grid.addColumnDefinition(0.45); // left 45%
	grid.addColumnDefinition(0.10); // center 10%
	grid.addColumnDefinition(0.45); // right 45%
	grid.height = "100%";
	grid.width  = "100%";
	overlay.addControl(grid);

	// Winner panel (left)
	const winnerRect = new GUI.Rectangle("winRect");
	winnerRect.background = "green";
	winnerRect.thickness  = 0;
	grid.addControl(winnerRect, 0, 0);

	// Loser panel (right)
	const loserRect = new GUI.Rectangle("loseRect");
	loserRect.background = "red";
	loserRect.thickness  = 0;
	grid.addControl(loserRect, 0, 2);

	// Function to create avatar+label inside a panel
	// English comments for clarity
	function addAvatarPanel(parent: GUI.Rectangle, data: { username: string; label: string }) {
	const stack = new GUI.StackPanel();
	stack.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	stack.height = "80%";
	parent.addControl(stack);

	// Avatar image
	const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username)}&background=6d28d9&color=fff&rounded=true`;
	const avatar = new GUI.Image("avatar_" + data.username, url);
	avatar.width  = "50%";
	avatar.height = "50%";
	avatar.paddingBottom = "10px";
	stack.addControl(avatar);

	// Label below avatar
	const label = new GUI.TextBlock();
	label.text       = data.label;
	label.color      = "white";
	label.fontSize   = 24;
	label.height     = "20%";
	label.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	stack.addControl(label);
	}

	addAvatarPanel(winnerRect, { username: winner.username, label: "Win" });
	addAvatarPanel(loserRect,  { username: loser.username,  label: "Lose" });

	// Center stats
	const stats = new GUI.TextBlock("stats");
	stats.text = `Score\n${winner.username}: ${winner.score}\n${loser.username}: ${loser.score}`;
	stats.color = "white";
	stats.fontSize = 20;
	stats.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	stats.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	grid.addControl(stats, 0, 1);

	// "Next" button bottom right
	const nextBtn = GUI.Button.CreateSimpleButton("nextBtn", "Next");
	nextBtn.width  = "100px";
	nextBtn.height = "40px";
	nextBtn.color  = "white";
	nextBtn.background = "gray";
	nextBtn.cornerRadius = 5;
	nextBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
	nextBtn.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
	nextBtn.top    = "-10px";
	nextBtn.left   = "-10px";
	overlay.addControl(nextBtn);

	nextBtn.onPointerUpObservable.add(() => {
	ui.dispose();   // remove all GUI controls
	onNext();       // callback to go back to your menu/view
	});
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

	const count = Object.keys(data.usernames).length
	pongState.pongRenderer = new PongRenderer(canvas, state.typedSocket,
		count, state.playerInterface.playerSide!, data.usernames);
	state.canvasViewState = 'playingGame';
	localStorage.setItem('pong_view', 'playingGame');
	showPongMenu();
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
		elapsed: data.elapsed
	});
}

export async function handleEndMatch(data: Interfaces.SocketMessageMap['endMatch']) {
	const renderer = pongState.pongRenderer;
	if (!renderer) {
		console.warn('[ENDMATCH] No renderer found');
		return;
	}
	const scene = renderer.getScene();

	showEndMatchOverlay(
		scene,
		{ username: data.winnerName, score: data.winnerScore },
		{ username: data.loserName,  score: data.loserScore  },
		() => {
			renderer.dispose();
			pongState.pongRenderer = null;
			state.canvasViewState = 'mainMenu';
			localStorage.setItem('pong_view', 'mainMenu');
		}
	);
	// === Leave the game on the server ===
	if (state.playerInterface?.socket && state.playerInterface.gameID !== undefined) {
		state.typedSocket.send('leaveGame', {
			userID: state.playerInterface!.userID,
			gameID: state.playerInterface!.gameID!,
			islegit: true
		});
	} else {
		console.warn('[ENDMATCH] Could not send leaveGame, missing socket or gameID.');
	}
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

