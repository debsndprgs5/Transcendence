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
		if (state.playerInterface) {
			state.playerInterface!.typedSocket.send('reconnected',{
				userID:state.userId!,
				gameID:state.playerInterface!.gameID!,
				tournamentID:state.playerInterface!.tournamentID!
				});
			showNotification({
			message: `RECONNTED TO GAME SOCKETS. State: ${state.playerInterface.state}`,
			type: 'success',
		});
		} else {
			state.playerInterface ={
			userID:state.userId!,
			socket:state.gameSocket,
			typedSocket:typedSocket,
			state:'online'
			}
			typedSocket.send('init', {
			userID: state.userId!,
			});
		}
	};

	gameSocket.onclose = () => {
		state.playerInterface!.typedSocket.send('disconnected',{})
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


async function showEndMatchOverlay(
	scene: BABYLON.Scene,
	winner: { username: string; score: number },
	loser:  { username: string; score: number },
	onNext: () => void
) {
	const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

	// semi-transparent backdrop
	const overlay = new GUI.Rectangle();
	overlay.background          = "rgba(0,0,0,0.6)";
	overlay.width               = "90%";
	overlay.height              = "90%";
	overlay.thickness           = 0;
	overlay.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	overlay.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	overlay.isPointerBlocker    = true;
	ui.addControl(overlay);

	// 3-column grid
	const grid = new GUI.Grid();
	grid.addColumnDefinition(0.35);
	grid.addColumnDefinition(0.30);
	grid.addColumnDefinition(0.35);
	grid.width  = "100%";
	grid.height = "100%";
	overlay.addControl(grid);

	// --- LEFT PANEL (WIN) ---
	const winPanel = new GUI.Rectangle();
	winPanel.background = "green";
	winPanel.thickness  = 0;
	grid.addControl(winPanel, 0, 0);

	// Synchronous “WIN” label
	const winLabel = new GUI.TextBlock();
	winLabel.text                    = "WIN";
	winLabel.color                   = "white";
	winLabel.fontSize                = 24;
	winLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	winLabel.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_TOP;
	winLabel.paddingTop              = "10px";
	winPanel.addControl(winLabel);

	// Avatar
	addAvatarPanel(winPanel, { username: winner.username, label: "" });

	// --- CENTER STATS ---
	const stats = new GUI.TextBlock();
	stats.text                    = `Score\n${winner.username}: ${winner.score}\n${loser.username}: ${loser.score}`;
	stats.color                   = "white";
	stats.fontSize                = 20;
	stats.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	stats.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	grid.addControl(stats, 0, 1);

	// --- RIGHT PANEL (LOSE) ---
	const losePanel = new GUI.Rectangle();
	losePanel.background = "red";
	losePanel.thickness  = 0;
	grid.addControl(losePanel, 0, 2);

	// Synchronous “LOSE” label
	const loseLabel = new GUI.TextBlock();
	loseLabel.text                    = "LOSE";
	loseLabel.color                   = "white";
	loseLabel.fontSize                = 24;
	loseLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	loseLabel.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_TOP;
	loseLabel.paddingTop              = "10px";
	losePanel.addControl(loseLabel);

	// Avatar
	addAvatarPanel(losePanel, { username: loser.username, label: "" });

	// --- Next Button ---
	const nextBtn = GUI.Button.CreateSimpleButton("next", "Next");
	nextBtn.width               = "80px";
	nextBtn.height              = "32px";
	nextBtn.cornerRadius        = 4;
	nextBtn.color               = "white";
	nextBtn.background          = "gray";
	nextBtn.isPointerBlocker    = true;
	nextBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
	nextBtn.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
	nextBtn.paddingRight        = "20px";
	nextBtn.paddingBottom       = "20px";
	ui.addControl(nextBtn);
	nextBtn.onPointerUpObservable.add(() => {
		ui.dispose();
		onNext();
	});
}

// ta fonction async pour charger correctement l’avatar
export async function addAvatarPanel(
  parent: GUI.Rectangle,
  data: { username: string; label: string }
) {
	const stack = new GUI.StackPanel();
	stack.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	stack.paddingTop          = "20px";
	parent.addControl(stack);
	let url: string;
	try {
		const json = await apiFetch(
			`/users/${encodeURIComponent(data.username)}/avatar`
		) as { avatar_url?: string };
		url = json.avatar_url ?? "";
	} catch {
		url = "";
	}
	if (!url)
		url = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username)}&background=6d28d9&color=fff&rounded=true`;
	try {
		const res  = await fetch(url);
		const blob = await res.blob();
		const blobUrl = URL.createObjectURL(blob);
		const avatar = new GUI.Image("avatar_" + data.username, blobUrl);
	delete (avatar as any).source?.crossOrigin;
	avatar.source = url;
		avatar.width  = "60px";
		avatar.height = "60px";
		stack.addControl(avatar);
	} catch (e) {
		console.error("Impossible de charger l’avatar", e);
	}

	const label = new GUI.TextBlock();
	label.text       = data.label;
	label.color      = "white";
	label.fontSize   = 20;
	label.paddingTop = "6px";
	stack.addControl(label);
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
	state.playerInterface.gameID = data.gameID;
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

export async function handleEndMatch(
	data: Interfaces.SocketMessageMap['endMatch']
) {
	const renderer = pongState.pongRenderer;
	if (!renderer) {
		console.warn('[ENDMATCH] No renderer found');
		return;
	}
	const scene = renderer.getScene();

	const entries = Object.entries(data.playerScores) as [string, number][];
	if (entries.length < 2) {
		console.error('[ENDMATCH] Invalid playerScores:', data.playerScores);
		return;
	}
	entries.sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

	const [winnerName, winnerScore] = entries[0];
	const [loserName,  loserScore ] = entries[1];

	showEndMatchOverlay(
		scene,
		{ username: winnerName, score: winnerScore },
		{ username: loserName,  score: loserScore  },
		() => {
			renderer.dispose();
			pongState.pongRenderer = null;
			state.canvasViewState = 'mainMenu';
			localStorage.setItem('pong_view','mainMenu');
			showPongMenu();
		}
	);

	if (state.playerInterface?.socket && state.playerInterface.gameID !== undefined) {
		state.typedSocket.send('leaveGame', {
			userID:  state.playerInterface.userID,
			gameID:  state.playerInterface.gameID,
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
	state.canvasViewState = 'mainMenu';
	localStorage.setItem('pong_view', 'mainMenu');
	localStorage.setItem('pong_view', 'mainMenu');
	showPongMenu();
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

