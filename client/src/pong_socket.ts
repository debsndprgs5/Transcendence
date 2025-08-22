import { showNotification, showUserActionsBubble, dismissNotification } from './notifications';
import { isAuthenticated, apiFetch, state } from './api';
import { PongRenderer } from './render/pong_render';
// import {settingsRenderer} from './settings_render';
import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';
import { showPongMenu } from './pong_rooms';
import { TypedSocket } from './shared/gameTypes';
import * as GUI from "@babylonjs/gui";
import * as BABYLON from "@babylonjs/core";
import * as Tournament from './tournament_socket'
import { handleLogout } from './handlers'
import { LocalGameView } from './localGame/localGame.view';
import { Side} from './render/pong_render'

export const pongState = 
{
	pongRenderer: null as PongRenderer | null,
	localMapRenderer: null as any | null
};

export { state };

export async function initGameSocket(): Promise<void> {
	if (!state.authToken) return;

	// CLEANUP before reinitializing
	if (state.typedSocket) {
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
				typedSocket.send('reconnected', { userID });

				showNotification({
					message: `Reconnected to game socket.`,
					type: 'success',
				});
			} else {
				typedSocket.send('init', { userID });
				localStorage.setItem('userID', userID.toString());
			}
			const pend = localStorage.getItem('pending_leave');
			const pendG = localStorage.getItem('pending_leave_gid');
			if (pend && pendG) {
			  try {
			    typedSocket.send('leaveGame', { userID, gameID: Number(pendG), islegit: false });
			  } finally {
			    localStorage.removeItem('pending_leave');
			    localStorage.removeItem('pending_leave_gid');
			  }
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
				if(state.playerInterface && state.playerInterface.gameID)
					state.playerInterface.typedSocket.send('pause', {
					userID: state.userId,
					gameID: state.playerInterface.gameID
					});
				//console.warn(`[GAME] WebSocket closed — code=${ev.code}, reason="${ev.reason}"`);
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
	typedSocket.on('tourOwnerChange', async(socket:WebSocket, data:Interfaces.SocketMessageMap['tourOwnerChange'])=>{
	if(data.newOwnerID === state.userId!){
	state.playerInterface!.isTourOwner = true;
	//state.canvasViewState='waitingTournament';
	//showPongMenu();
	}
	})
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
	state.socket?.send(JSON.stringify({
	type: 'friendStatus',
	action: 'update',
	state: data.newState,
	userID: state.userId,
	}));
	});
	typedSocket.on('giveSide', async (socket:WebSocket, data:Interfaces.SocketMessageMap['giveSide']) => {
	if (pongState.pongRenderer) {
		await pongState.pongRenderer.setSide(data.side);
	}
	state.playerInterface!.playerSide = data.side;
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
	    return;
	  }
	  await handleReconnection(socket, typedSocket, data);
	});
	typedSocket.on('statsResult', (_socket: WebSocket, data: any) => {
	if (typeof (window as any).updateStatsDisplay === 'function') {
	(window as any).updateStatsDisplay(data);
	}
	});
	typedSocket.on('serverReady',async(socket:WebSocket, data:Interfaces.SocketMessageMap['serverReady'])=>{
	if(pongState.pongRenderer)
	pongState.pongRenderer.setWaiting(false);
	});
	typedSocket.on('updateGameList',async(socket:WebSocket, data:Interfaces.SocketMessageMap['updateGameList'])=>{
		await handleGameList(data);
	});
	typedSocket.on('updateGameRooms',async(socket:WebSocket, data:Interfaces.SocketMessageMap['updateGameRooms'])=>{
		await handleGameRooms(data);
	});

	typedSocket.on('aliasCheck',async(socket:WebSocket, data:Interfaces.SocketMessageMap['aliasCheck'])=>{
		await Tournament.handleAlias(data);
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


export function toUsername(val: any): string {
  if (typeof val === 'string') return val.trim();

  if (val && typeof val === 'object' && typeof val.username === 'string') {
    return val.username.trim();
  }
  if (val && typeof val === 'object' && val.username && typeof val.username.username === 'string') {
    return val.username.username.trim();
  }
  if (val && typeof val === 'object' && typeof val.name === 'string') {
    return val.name.trim();
  }
  try { return String(val).trim(); } catch { return 'Unknown User'; }
}

export async function handleInvite(data: Interfaces.SocketMessageMap['invite']) {
  // Replies received by the inviter
  if (data.action === 'reply') {
    // clear local lock if any
    if ((state as any).inviteLock) (state as any).inviteLock = null;

    const anyData = data as any;
    const waitKey =
      anyData.targetID ??
      ((data.toID === state.userId) ? data.fromID : data.toID) ??
      (state as any).inviteLock?.targetId;

    if (waitKey != null) {
      dismissNotification(`invite-wait-${waitKey}`);
    }

    const resp = data.response;
    if (resp === 'accept') {
      showNotification({ message: 'Invitation accepted ✅', type: 'success', duration: 2000 });
    } else if (resp === 'decline') {
      showNotification({ message: 'Invitation declined ❌', type: 'error', duration: 2500 });
    } else if (resp === 'timeout') {
      showNotification({ message: 'Invitation timed out ⏲️', type: 'warning', duration: 2500 });
    } else if (resp === 'offline') {
      showNotification({ message: 'Player is offline ⚠️', type: 'warning', duration: 2500 });
    } else if (resp === 'busy') {
      showNotification({ message: 'Player is busy ⚠️', type: 'warning', duration: 2500 });
    } else if (resp === 'you cannot invite yourself') {
      showNotification({ message: 'You cannot invite yourself ⚠️', type: 'warning', duration: 2500 });
    } else if (resp === 'already_pending') {
      showNotification({ message: 'Invitation already pending ⏲️', type: 'info', duration: 2500 });
    }
    return
  }

  // Invitee receives a prompt
  if (data.action === 'receive') {
    const inviterID = data.fromID;
    if (!inviterID || Number.isNaN(inviterID)) return;

    const promptId = `invite-prompt-from-${inviterID}`;
    const raw_user = await apiFetch(`/user/by-index/${inviterID}`); // likely returns a string
    const uname = toUsername(raw_user);

    showNotification({
      id: promptId,
      message: `${uname} invited you to play. Join?`,
      type: 'confirm',
      onConfirm: async () => {
        state.typedSocket.send('invite', { action: 'reply', response: 'accept', fromID: state.userId, toID: inviterID });
      },
      onCancel: async () => {
        state.typedSocket.send('invite', { action: 'reply', response: 'decline', fromID: state.userId, toID: inviterID });
      },
    });
    return;
  }

  // Invitation expired
  if (data.action === 'expired') {
    const inviterID = data.inviterID;
    const targetID  = data.targetID;

    if (targetID) {
      if ((state as any).inviteLock) (state as any).inviteLock = null;
      dismissNotification(`invite-wait-${targetID}`);
    }
    if (inviterID) dismissNotification(`invite-prompt-from-${inviterID}`);

    showNotification({ message: 'Invite request expired…', type: 'warning', duration: 2500 });
    return;
  }

  // Invitation cancelled
  if (data.action === 'cancelled') {
    const inviterID = data.inviterID;
    const targetID  = data.targetID;

    if (targetID) {
      if ((state as any).inviteLock) (state as any).inviteLock = null;
      dismissNotification(`invite-wait-${targetID}`);
    }
    if (inviterID) dismissNotification(`invite-prompt-from-${inviterID}`);

    showNotification({ message: 'Invite request was cancelled', type: 'info', duration: 2200 });
    return;
  }
}


function showEndMatchOverlay(
  scene: BABYLON.Scene,
  winner: { username: string; score: number },
  loser:  { username: string; score: number },
  onNext?: () => void
): Promise<void> {
  return new Promise<void>(async (resolve) => {
    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI:end", true, scene);

    const overlay = new GUI.Rectangle();
    overlay.background = "rgba(0,0,0,0.6)";
    overlay.width = "90%";
    overlay.height = "90%";
    overlay.thickness = 0;
    overlay.isPointerBlocker = true;
    ui.addControl(overlay);

    const grid = new GUI.Grid();
    grid.addColumnDefinition(0.35);
    grid.addColumnDefinition(0.30);
    grid.addColumnDefinition(0.35);
    grid.width = "100%";
    grid.height = "100%";
    overlay.addControl(grid);

    const winPanel = new GUI.Rectangle(); winPanel.thickness = 0; winPanel.background = "green";
    const losePanel = new GUI.Rectangle(); losePanel.thickness = 0; losePanel.background = "red";
    grid.addControl(winPanel, 0, 0);
    grid.addControl(losePanel, 0, 2);

    // wait for avatars to be created *before* we ever dispose the engine
    await Promise.all([
      addAvatarPanel(winPanel,  { username: winner.username, label: "" }),
      addAvatarPanel(losePanel, { username: loser.username,  label: "" }),
    ]);

    const stats = new GUI.TextBlock();
    stats.text = `Score\n${winner.username}: ${winner.score}\n${loser.username}: ${loser.score}`;
    stats.color = "white";
    grid.addControl(stats, 0, 1);
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
      try { ui.dispose(); } catch {}
      try { onNext?.(); } catch {}
      resolve();               // <-- unblock caller here
    });

   
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
	const count = Object.keys(data.usernames).length
	const side:Side = data.side;
	pongState.pongRenderer = new PongRenderer(canvas, state.typedSocket,
		count, data.gameName,side, data.usernames, false, state.playerInterface!.tournamentID? true: false);
	state.playerInterface.gameID = data.gameID;
	showNotification({ message: 'Game is loading please wait', type: 'success' });
	await pongState.pongRenderer.loadGame();
	state.playerInterface!.typedSocket.send('clientReady', {gameID:data.gameID, userID:state.userId});
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
	if(!scene){
		console.warn(`[ENDMATCH], Render found but no scene for it`, renderer);
	}

	const entries = Object.entries(data.playerScores) as [string, number][];
	if (entries.length < 2) {
		console.error('[ENDMATCH] Invalid playerScores:', data.playerScores);
		return;
	}
	entries.sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

	const [winnerName, winnerScore] = entries[0];
	const [loserName,  loserScore ] = entries[1];
	// renderer.dispose();
	// pongState.pongRenderer = null;
	if (state.playerInterface!.tournamentID) {
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
				state.currentGameName = data.gameName;
				state.canvasViewState = 'waitingTournamentRounds';
				localStorage.setItem('pong_view','waitingTournamentRounds');
				showPongMenu();
	}
	else {
		renderer.removeUI(); // <- free the in-game HUD layer
		await showEndMatchOverlay(
		scene,
		{ username: winnerName, score: winnerScore },
		{ username: loserName,  score: loserScore },
		() => {
			state.canvasViewState = 'mainMenu';
			localStorage.setItem('pong_view','mainMenu');
			showPongMenu();
		}
		);
	}

  // send leaveGame
	if (state.playerInterface?.socket && state.playerInterface.gameID !== undefined) {
		state.typedSocket.send('leaveGame', {
		userID: state.playerInterface.userID,
		gameID: state.playerInterface.gameID,
		islegit: true
		});
	}

	// only now kill the engine
	renderer.dispose();
	pongState.pongRenderer = null;
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
	state.playerInterface.gameID = undefined;
	}
	if(!state.playerInterface!.tournamentID || data.triggeredBySelf == true){
		state.playerInterface!.tournamentID = undefined;
		state.canvasViewState = 'mainMenu';
		localStorage.setItem('pong_view', 'mainMenu');
	}
	else{
		state.playerInterface!.typedSocket.send('reloadTourRound', {
			tournamentID:state.playerInterface!.tournamentID,
			userID:state.userId!
		});
	}
	showPongMenu();
}

export async function handleReconnection(
  socket: WebSocket,
  typedSocket: TypedSocket,
  data: Interfaces.SocketMessageMap['reconnected']
){

  // Recreate client-side interface from server data
  state.gameSocket = socket;
  state.typedSocket = typedSocket;
  state.userId = data.userID;
  state.playerInterface = {
    userID: data.userID,
    username: data.username,
    socket,
    typedSocket,
    state: data.state!,
    gameID: data.gameID ?? undefined,
    tournamentID: data.tournamentID ?? undefined,
    isTourOwner: data.isTourOwner ?? false,
  };

  localStorage.setItem('userID', String(data.userID));

  // Persist/clear gameID locally (used for refresh/leave fallback)
  if (data.gameID) localStorage.setItem('pong_game_id', String(data.gameID));
  else localStorage.removeItem('pong_game_id');

  // If server says game already started but we aren't "playing" yet ⇒ show waiting lobby
  if (data.gameID && data.hasStarted === true) {
    state.canvasViewState = 'waitingGame';
  }

  // ── CASE 1: Game is active & renderer exists → resume immediately
  if (data.gameID && data.state === 'playing' && pongState.pongRenderer !== null) {
    if (pongState.pongRenderer.getScene()?.isDisposed) {
      pongState.pongRenderer = null; // disposed, we will rebuild below if needed
    } else {
      // Renderer is intact: just resume
      pongState.pongRenderer.resumeRenderLoop?.();
	  state.playerInterface.typedSocket.send('resume', {gameID:data.gameID, userID:data.userID});
      state.canvasViewState = 'playingGame';
      showPongMenu();
      return;
    }
  }

  // ── CASE 2: Game is active & renderer missing → rebuild from localStorage snapshot
  if (data.gameID && data.state === 'playing' && pongState.pongRenderer === null) {
    const playerCount = Number(localStorage.getItem('playerCount'));
    const side = (localStorage.getItem('playerSide') as 'left' | 'right' | 'top' | 'bottom') || 'left';

    let usernames: Record<'left' | 'right' | 'top' | 'bottom', string> = { left: '', right: '', top: '', bottom: '' };
    try {
      const raw = localStorage.getItem('usernames');
      if (raw) usernames = JSON.parse(raw);
    } catch (e) {
      console.error('[RECONNECT] Failed to parse usernames from localStorage', e);
    }

    const canvas = document.getElementById('babylon-canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error('Canvas element not found or not a valid canvas.');
      // fallback to lobby if we cannot restore renderer
      state.canvasViewState = 'waitingGame';
      showPongMenu();
      return;
    }

    let oldGameName = localStorage.getItem('gameName') || 'Name was lost during reconnection';

    pongState.pongRenderer = new PongRenderer(canvas, state.typedSocket, playerCount, oldGameName, side, usernames);
    showNotification({ message: 'Game is loading please wait', type: 'success' });
	await pongState.pongRenderer.loadGame();
	pongState.pongRenderer.setWaiting(false);
	state.playerInterface!.typedSocket.send('resume',{gameID:data.gameID, userID:state.userId})

	state.canvasViewState = 'playingGame';
    showPongMenu();
    return;
  }

  // ── CASE 3: Tournament reconnection while not playing a match
  if (data.tournamentID) {
    if (data.hasStarted === true) {
      state.playerInterface!.typedSocket.send('reloadTourRound', {
        tournamentID: state.playerInterface!.tournamentID!,
        userID: state.userId!,
      });
      // View will be updated on next server push
    } else {
      state.canvasViewState = 'waitingTournament';
      showPongMenu();
    }
    return;
  }

  // ── CASE 4: Game lobby (waiting): we have a gameID but state is not 'playing'
  if (data.gameID && data.state !== 'playing') {
    // hydrate lobby UI (players + room name) so Leave/Join are usable after refresh
    try {
      const players = await apiFetch(`/api/pong/${encodeURIComponent(data.gameID)}/list`, {
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
      state.currentPlayers = (players as { username: string }[]).map(p => p.username);
      localStorage.setItem('pong_players', JSON.stringify(state.currentPlayers));
    } catch (e) {
      console.warn('[RECONNECT] players list fetch failed', e);
    }
    state.canvasViewState = 'waitingGame';
    localStorage.setItem('pong_view', 'waitingGame');
    showPongMenu();
    return;
  }

  // ── DEFAULT: Not in any game nor tournament → back to main menu
  state.canvasViewState = 'mainMenu';
  localStorage.setItem('pong_view', 'mainMenu');
  showPongMenu();

  showNotification({
    message: data.message ?? 'Reconnected successfully.',
    type: 'info',
  });
}

async function handleGameList(data: Interfaces.SocketMessageMap['updateGameList']){
	if(state.canvasViewState === 'waitingGame' && data.gameID === state.playerInterface!.gameID){
		state.currentPlayers = data.list;
		showPongMenu();
	}
}

async function handleGameRooms(data: Interfaces.SocketMessageMap['updateGameRooms']){
		state.availableRooms = data.list;
		showPongMenu();
}


export function fetchAccountStats(userID: number) {
  if (!state?.typedSocket) return;
  state.typedSocket.send('getStats', { userID });
}
