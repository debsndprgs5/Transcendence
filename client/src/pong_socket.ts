import { showNotification, showUserActionsBubble } from './notifications';
import { isAuthenticated, apiFetch, state } from './api';
import { PongRenderer } from './pong_render';
import {settingsRenderer} from './settings_render';
import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';
import { showPongMenu } from './pong_rooms';
import { TypedSocket } from './shared/gameTypes';
import * as GUI from "@babylonjs/gui";
import * as BABYLON from "@babylonjs/core";
import * as Tournament from './tournament_socket'
import { handleLogout } from './handlers'

export const pongState = 
{
	pongRenderer: null as PongRenderer | null,
	settingsRenderer: null as settingsRenderer|null
};

export async function initGameSocket(): Promise<void> {
	if (!state.authToken) return;

	// CLEANUP before reinitializing
	if (state.typedSocket) {
		console.log('[GAME] Cleaning up previous typed socket...');
		state.typedSocket.cleanup?.();
		state.typedSocket.removeAllListeners?.();
	}

	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	state.gameSocket = gameSocket;

	return new Promise<void>((resolve, reject) => {
		gameSocket.onopen = async () => {
			console.log('[GAME] WebSocket connected');

			const typedSocket = createTypedEventSocket(gameSocket);
			state.typedSocket = typedSocket;

			// Wait for userId to be set (may be async elsewhere)
			while (!state.userId) {
				console.warn('[GAME] Waiting for userId to be available...');
				await new Promise(res => setTimeout(res, 50));
			}

			const oldID = localStorage.getItem('userID');
			const userID = Number(oldID ?? state.userId);

			state.playerInterface = {
				userID,
				socket: gameSocket,
				typedSocket: typedSocket,
				state: 'online',
			};

			// Send reconnect or init
			if (oldID) {
				console.log('[GAME] WebSocket connected — attempting reconnected as', userID);
				typedSocket.send('reconnected', { userID });

				showNotification({
					message: `Reconnected to game socket.`,
					type: 'success',
				});
			} else {
				console.log('[GAME] WebSocket connected — sending init for new user', userID);
				typedSocket.send('init', { userID });
				localStorage.setItem('userID', userID.toString());
			}

			handleEvents(typedSocket, gameSocket);
			resolve(); // RESOLVE once connected and initialized
		};

		gameSocket.onerror = (err) => {
			console.error('[GAME] WebSocket error:', err);
			state.typedSocket?.cleanup?.();
			state.typedSocket = undefined;
			state.gameSocket = null;
			state.playerInterface = undefined;
			reject(err); // reject if connection fails
		};

		gameSocket.onclose = (ev) => {
			try {
				console.warn(`[GAME] WebSocket closed — code=${ev.code}, reason="${ev.reason}"`);
				if (state.gameSocket?.readyState === WebSocket.OPEN)
					state.typedSocket?.send('disconnected', {});
				if (ev.code === 1008) {
				  //Unauthorized or invalid token
				  handleLogout();
				}
			} catch (err) {
				console.warn('Cannot send disconnected message: ', err);
			}

			state.typedSocket?.cleanup?.();
			state.typedSocket = undefined;
			state.gameSocket = null;
			state.playerInterface = undefined;

			console.warn('[GAME] WebSocket closed : ', ev.code, ev.reason);
		};
	});
}


async function handleEvents(
	typedSocket:TypedSocket, ws:WebSocket){

	typedSocket.on('init' , async(socket:WebSocket, data:Interfaces.SocketMessageMap['init'])=> {
		await handleInit(data, ws);
	});
	typedSocket.on('joinGame', async(socket:WebSocket, data:Interfaces.SocketMessageMap['joinGame'])=>{
		await handleJoinGame(data);
	});
	typedSocket.on('joinTournament', async(socket:WebSocket, data:Interfaces.SocketMessageMap['joinTournament'])=>{
		 Tournament.handleJoinTournament(data);
	});
	typedSocket.on('updateTourPlayerList',async(socket:WebSocket, data:Interfaces.SocketMessageMap['updateTourPlayerList'])=>{
		Tournament.handleUpdateTournamentPlayerList(data);
	});
	typedSocket.on('updateTourList',async(socket:WebSocket, data:Interfaces.SocketMessageMap['updateTourList'])=>{
		Tournament.handleUpdateTournamentList(data);
	});
	typedSocket.on('updateTourScore', async(socket:WebSocket, data:Interfaces.SocketMessageMap['updateTourScore'])=>{
		 Tournament.handleUpdateTourScore(data);
	});
	typedSocket.on('endTournament', async(socket:WebSocket, data:Interfaces.SocketMessageMap['endTournament'])=>{
		 Tournament.handleEndTournament(data);
	});
	typedSocket.on('startNextRound', async(socket:WebSocket, data:Interfaces.SocketMessageMap['startNextRound'])=>{
		 Tournament.handleStartNextRound(data);
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
		console.log(`DATA STATE on update : ${data.newState}`);
		state.socket?.send(JSON.stringify({
				type: 'friendStatus',
				action: 'update',
				state: data.newState,
				userID: state.userId,
			}));
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
	  // If it's not you, ignore it
	  if (data.userID !== state.userId) {
	    console.log(`[GAMESOCKET] Ignoring reconnection of user ${data.userID}`);
	    return;
	  }
	  await handleReconnection(socket, typedSocket, data);
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
		const json = await apiFetch(`/users/${encodeURIComponent(data.username)}/avatar`) as { avatar_url?: string };
		url = json.avatar_url ?? "";
	} catch {
		url = "";
	}

	if (!url) {
		const style = /^\d+$/.test(data.username)
		? 'bottts'
		: 'initials';
		url = `https://api.dicebear.com/9.x/${style}/svg`
								    + `?seed=${encodeURIComponent(data.username)}`
									+ `&backgroundType=gradientLinear`
  									+ `&backgroundColor=919bff,133a94`  
  								    + `&size=64`
								    + `&radius=50`
	}

	const avatar = new GUI.Image("avatar_" + data.username, url);
	avatar.width  = "60px";
	avatar.height = "60px";
	stack.addControl(avatar);

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
	state.canvasViewState = 'playingGame';
	localStorage.setItem('pong_view', 'playingGame');
	console.log(`USERSTATE:${state.playerInterface.state}| Uname: ${state.playerInterface.username}`)
	const count = Object.keys(data.usernames).length
	pongState.pongRenderer = new PongRenderer(canvas, state.typedSocket,
		count, data.gameName,state.playerInterface.playerSide!, data.usernames);
	state.playerInterface.gameID = data.gameID;
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
		elapsed: data.elapsed,
		isPaused:data.isPaused
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
			if (state.playerInterface!.tournamentID) {
				renderer.dispose();
				pongState.pongRenderer = null;
				state.playerInterface!.a_ID = data.a_ID
				state.playerInterface!.b_ID = data.b_ID
				state.playerInterface!.a_score = data.a_score
				state.playerInterface!.b_score = data.b_score
				state.playerInterface!.typedSocket.send('matchFinish', {
					tourID:state.playerInterface!.tournamentID!,
					userID:state.userId!,
					a_ID: data.a_ID,
					b_ID: data.b_ID,
					a_score: data.a_score,
					b_score: data.b_score
				});
				state.canvasViewState = 'waitingTournamentRounds';
				localStorage.setItem('pong_view','waitingTournamentRounds');
				showPongMenu();
			}
			else {
				renderer.dispose();
				pongState.pongRenderer = null;
				state.canvasViewState = 'mainMenu';
				localStorage.setItem('pong_view','mainMenu');
				showPongMenu();
			}
		}
	);

	if (state.playerInterface?.socket && state.playerInterface.gameID !== undefined) {
		state.typedSocket.send('leaveGame', {
			userID: state.playerInterface.userID,
			gameID: state.playerInterface.gameID,
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
	if(!state.currentTournamentID){
		state.canvasViewState = 'mainMenu';
		localStorage.setItem('pong_view', 'mainMenu');
		localStorage.setItem('pong_view', 'mainMenu');
	}
	else{
		state.canvasViewState = 'waitingTournamentRounds';
		localStorage.setItem('pong_view','waitingTournamentRounds');
	}
	showPongMenu();
}

export async function handleReconnection(socket:WebSocket, typedSocket:TypedSocket, data: Interfaces.SocketMessageMap['reconnected']) {
	console.log(`[FRONT][GAMESOCKET] Reconnected as user ${data.userID} with state: ${data.state}`);

	// Always recreate playerInterface from server data
	state.gameSocket = socket;
	state.typedSocket = typedSocket;
	state.playerInterface = {
		userID: data.userID,
		username: data.username,
		socket: state.gameSocket!,
		typedSocket: state.typedSocket!,
		state: data.state!,
		gameID: data.gameID ?? undefined,
		tournamentID: data.tournamentID ?? undefined,
	};

	localStorage.setItem('userID', data.userID.toString());

	// CASE 1: Game is active & Renderer exists → Resume it
	if (data.gameID && data.state === 'playing' && pongState.pongRenderer !== null) {
		if (pongState.pongRenderer.getScene()?.isDisposed) {
			console.warn('[RECONNECT] Renderer scene is disposed. Clearing renderer.');
			pongState.pongRenderer = null;
		} else {
			console.log('[RECONNECT] Resuming existing renderer.');
			pongState.pongRenderer.resumeRenderLoop?.();
			state.canvasViewState = 'playingGame';
			return;
		}
	}

	// CASE 2: Game is active & Renderer is missing → Offer to restore it
	if (data.gameID && data.state === 'playing' && pongState.pongRenderer === null) {
		console.log('[RECONNECT] User accepted resume. Sending resumeGame.');

		const playerCount = Number(localStorage.getItem('playerCount'));
		const side = localStorage.getItem('playerSide') as 'left' | 'right' | 'top' | 'bottom';

		let usernamesRaw = localStorage.getItem('usernames');
		let usernames: Record<'left' | 'right' | 'top' | 'bottom', string> = {
			left: '', right: '', top: '', bottom: ''
		};
		try {
			if (usernamesRaw) {
				usernames = JSON.parse(usernamesRaw);
			}
		} catch (e) {
			console.error('[RECONNECT] Failed to parse usernames from localStorage', e);
		}

		const canvas = document.getElementById('babylon-canvas');
		if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
			console.error('Canvas element not found or not a valid canvas.');
			return;
		}
		let oldGameName = localStorage.getItem('gameName');
		if(!oldGameName)
			oldGameName = 'Name was lost during reconnection'
		pongState.pongRenderer = new PongRenderer(canvas, state.typedSocket, playerCount, oldGameName! ,side, usernames);
		state.canvasViewState = 'playingGame';
		showPongMenu();

	return;
	}


	// CASE 3: User is not in a game → Return to main menu or lobby
	if (!data.gameID || data.state !== 'playing') {
		console.log('[RECONNECT] No active game. Returning to main menu.');
		state.canvasViewState = 'mainMenu';

		showNotification({
			message: data.message ?? 'Reconnected successfully.',
			type: 'info',
		});
	}
}
