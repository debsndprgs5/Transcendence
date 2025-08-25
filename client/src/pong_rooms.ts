import { isAuthenticated, apiFetch, state } from './api';
import { drawCreateGameView, 
		drawWaitingGameView,
		drawJoinGameView,
		drawTournamentView,
		drawWaitingTournamentView,
		drawWaitingRoundsTournamentView,
		drawEndTournamentView } from './pong_views';
import { showNotification } from './notifications';
import { pongState } from './pong_socket';
import { PongRenderer } from './render/pong_render'
import { TypedSocket } from './shared/gameTypes';
import { resizePongCanvas } from './handlers';
import { handleTournamentClick, 
		handleWaitingTournamentClick, 
		handleCreateTournament, 
		handleJoinTournament, 
		handleLeaveTournament, 
		fetchOpenTournaments,
		handleTournamentRoundsClick } from './tournament_rooms';
import { drawLocalGameConfig, initLocalGameConfig, startLocalMatch, isLocalGameInitialized, cleanupLocalGameConfig } from './localGame/localGame.manager';
import { LocalGameView } from './localGame/localGame.view';
import { toUsername } from './pong_socket'

export interface PongButton {
	x: number;
	y: number;
	w: number;
	h: number;
	action: string;
}

declare global {
	interface HTMLCanvasElement {
		_pongMenuBtns?: PongButton[];
		_createGameButtons?: PongButton[];
		_waitingGameButtons?: PongButton[];
		_joinGameButtons?: PongButton[];
		_tournamentButtons?: PongButton[];
	}
}

let incrementInterval: number | null = null;
let incrementTimeout: number | null = null;
let lastButtonAction: string | null = null;

export interface CreateGameFormData {
  roomName:      string | null;
  ballSpeed:     number;
  paddleSpeed:   number;
  mode:          'duo' | 'quatuor';
  winCondition:  'time' | 'score';
  limit:         number;
}

export const createGameFormData: CreateGameFormData = {
  roomName:     null,
  ballSpeed:    50,
  paddleSpeed:  50,
  mode:         'duo',
  winCondition: 'time',
  limit:        60
};

export async function fetchAvailableRooms(): Promise<{ roomID: number; roomName: string }[]> {
	const resp = await apiFetch('/api/pong/list', {
		headers: { Authorization: `Bearer ${state.authToken}` }
	});

	const rawGames = Array.isArray((resp as any).games) ? (resp as any).games : [];

	return rawGames.map((r: { gameID: number; name: string }) => ({
		roomID: r.gameID,
		roomName: r.name
	}));
}

// =======================
// PONG MENU
// =======================

export function showPongMenu(): void {
		const canvas       = document.getElementById('pong-canvas')    as HTMLCanvasElement | null;
		const babylonCanvas = document.getElementById('babylon-canvas') as HTMLCanvasElement | null;
		if (!canvas || !babylonCanvas) return;

		canvas.onclick = handlePongMenuClick;
		canvas.onmousedown = handlePongMenuMouseDown;
		canvas.onmouseup = handlePongMenuMouseUp;
		canvas.onmouseleave = handlePongMenuMouseUp;
		window.addEventListener('mouseup', handlePongMenuMouseUp);
		const savedGameId = localStorage.getItem('pong_game_id');
		if (savedGameId) {
		  if (!state.playerInterface) state.playerInterface = {} as any; // lightweight ensure
		  state.playerInterface!.gameID = Number(savedGameId);
		}
		resizePongCanvas();
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		if (state.canvasViewState !== 'localGameMap' && pongState.localMapRenderer) {
			pongState.localMapRenderer.dispose();
			pongState.localMapRenderer = null;
		}

		if (state.canvasViewState === 'playingGame'
				|| state.canvasViewState === 'localGameMap'
			){
			const wrapper = canvas.parentElement!;
			wrapper.querySelectorAll('.menubtn_button').forEach(el => el.remove());
			
			canvas.style.display        = 'none';
			babylonCanvas.style.display = 'block';
		} else {
			babylonCanvas.style.display = 'none';
			canvas.style.display        = 'block';
		}

		switch (state.canvasViewState) {
				case 'mainMenu':
						drawMainMenu(canvas, ctx);
						break;

				case 'createGame':
						drawCreateGameView(canvas, ctx);
						break;

				case 'waitingGame':
						drawWaitingGameView(
								canvas, ctx,
								state.currentGameName || 'Unknown Room',
								state.currentPlayers || []
						);
						break;

				case 'tournament':
					drawTournamentView(
						canvas,
						ctx,
						state.availableTournaments || []
					);
					break;

				case 'waitingTournament':
					drawWaitingTournamentView(
						canvas,
						ctx,
						state.currentTournamentName || 'Unnamed Tournament',
						state.currentTournamentPlayers || []
					);
					break;
				case 'waitingTournamentRounds':
					drawWaitingRoundsTournamentView(
					  canvas,
					  ctx,
					  state.currentTournamentName || 'Unnamed Tournament',
					  state.currentTournamentPlayers || [],
					  state.currentGameName || 'Unknown game room',
					);
					break;
				case 'endTournament':
					drawEndTournamentView(
						canvas,
						ctx,
						state.currentTournamentName!,
						state.currentTournamentPlayers!
					);
					break;
				case 'joinGame':
						drawJoinGameView(
								canvas,
								ctx,
								state.availableRooms || []
						);
						break;

				case 'playingGame':
					const r = babylonCanvas.getBoundingClientRect();
					babylonCanvas.width  = Math.floor(r.width);
					babylonCanvas.height = Math.floor(r.height);
					// if(pongState.localMapRenderer){
					// 	pongState.localMapRenderer.dispose();
					// 	pongState.localMapRenderer = null;
					// }
					if (!state.playerInterface?.typedSocket) {
						console.error('No socket for PongRenderer');
						return;
					}
				break;

		case 'localGameConfig':
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			drawLocalGameConfig(canvas, ctx);
			
			if (!isLocalGameInitialized) {
				initLocalGameConfig(
					canvas,
					cfg => {
						state.canvasViewState = "runningLocal";
						startLocalMatch(cfg);
					},
					() => {
						state.canvasViewState = "mainMenu";
						showPongMenu();
					}
				);
			}
			break;

		case 'localGameMap':
		{		
			const rect = babylonCanvas.getBoundingClientRect();
			babylonCanvas.width = Math.floor(rect.width);
			babylonCanvas.height = Math.floor(rect.height);
			
			if (!pongState.localMapRenderer)
			{
				pongState.localMapRenderer = new LocalGameView(babylonCanvas);
			}
			else
			{
				pongState.localMapRenderer.handleResize();
			}
		}
			break;
		default:
			drawMainMenu(canvas, ctx);
			break;
	}
}

export function drawMainMenu(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const width = canvas.width;
  const height = canvas.height;
  const wrapper = canvas.parentElement!;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#5AC8FA';
  ctx.font      = `${Math.floor(height/10)}px 'Orbitron', sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur  = 20;
  ctx.fillText("Play",   width/2, height/5);
  ctx.fillText("3D Pong", width/2, height/5 + 50);
  ctx.shadowBlur = 0;


  const space = 60;
  const startY = height / 2 - space;
  const labels = [
	{ action: 'Create Game', y: startY + space * 0 },
	{ action: 'Join Game',   y: startY + space * 1 },
	{ action: 'Tournament',  y: startY + space * 2 },
	{ action: 'Local Game', y: startY + space * 3 },
  ];
  ctx.font = `${Math.floor(height/20)}px 'Orbitron', sans-serif`;

  const btnW = 260, btnH = 50;
  canvas._pongMenuBtns = labels.map(btn => {
	const x = width/2 - btnW/2;
	const y = btn.y   - btnH/2;
	return { x, y, w: btnW, h: btnH, action: btn.action };
  });

  wrapper.querySelectorAll('.menubtn_button').forEach(el => el.remove());

  canvas._pongMenuBtns.forEach(btn => {
	const button = document.createElement('button');
	button.type = 'button';
	button.classList.add('menubtn_button');
	button.style.position = 'absolute';
	button.style.left   = `${btn.x}px`;
	button.style.top    = `${btn.y}px`;
	button.style.width  = `${btn.w}px`;
	button.style.height = `${btn.h}px`;

	button.appendChild(document.createTextNode(btn.action));

	const clip = document.createElement('div');
	clip.classList.add('menubtn_clip');
	['leftTop','rightTop','rightBottom','leftBottom'].forEach(pos => {
	  const corner = document.createElement('div');
	  corner.classList.add('menubtn_corner', `menubtn_${pos}`);
	  clip.appendChild(corner);
	});
	button.appendChild(clip);

	const rightArrow = document.createElement('span');
	rightArrow.classList.add('menubtn_arrow','menubtn_rightArrow');
	button.appendChild(rightArrow);

	const leftArrow = document.createElement('span');
	leftArrow.classList.add('menubtn_arrow','menubtn_leftArrow');
	button.appendChild(leftArrow);

	button.addEventListener('click', e => {
	  e.stopPropagation();
	  const rect = wrapper.getBoundingClientRect();
	  const ev = new MouseEvent('click', {
		clientX: rect.left + btn.x + btn.w/2,
		clientY: rect.top  + btn.y + btn.h/2,
		bubbles: true
	  });
	  canvas.dispatchEvent(ev);
	});

	wrapper.appendChild(button);
  });
}


async function handlePongMenuClick(e: MouseEvent): Promise<void> {
	const canvas = e.currentTarget as HTMLCanvasElement;
	const rect   = canvas.getBoundingClientRect();
	const x      = (e.clientX - rect.left) * (canvas.width  / rect.width);
	const y      = (e.clientY - rect.top) * (canvas.height / rect.height);
	if (state.canvasViewState === 'playingGame') return;

	switch (state.canvasViewState) {
		case 'mainMenu':
			await handleMainMenuClick(canvas, x, y);
			break;
		case 'createGame':
			await handleCreateGameClick(canvas, x, y);
			break;

		case 'waitingGame':
			await handleWaitingGameClick(canvas, x, y);
			break;

		case 'joinGame':
			await handleJoinGameClick(canvas, x, y);
			break;

		case 'tournament':
			await handleTournamentClick(canvas, x, y);
			break;

		case 'waitingTournament':
			await handleWaitingTournamentClick(canvas, x, y);
			break;

		case 'waitingTournamentRounds':
			await handleTournamentRoundsClick(canvas, x, y);
			break;

		case 'endTournament':
			await handleTournamentRoundsClick(canvas, x, y);
			break;
			
		default:
			break;
	}
}

// Handle clicks in the Main Menu view
async function handleMainMenuClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btnMain = canvas._pongMenuBtns?.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!btnMain) return;
	if (state.playerInterface!.state !== 'init')
	{
		state.canvasViewState = 'mainMenu'
		return;
	}

	switch (btnMain.action) {
		case 'Create Game':
			state.localGameConfig = undefined;
			createGameFormData.roomName = null;
			state.canvasViewState = 'createGame';
			showPongMenu();
			break;

		case 'Join Game':
			state.availableRooms = await fetchAvailableRooms();
			state.canvasViewState = 'joinGame';
			showPongMenu();
			break;
		
		case 'Local Game':
			state.canvasViewState = 'localGameConfig';
			showPongMenu();
			break;

		case 'Tournament':
			showNotification({
				message: 'Type a unique alias for tournament',
				type: 'prompt',
				placeholder: `${toUsername(state.playerInterface!.username)}`,
				onConfirm: val => {			
					state.typedSocket.send('aliasCheck', {action: 'Post', alias: val});
				},
				onCancel:() => {
					showNotification({
						message: 'You have to type an alias if you want to participate in a tournament.',
						type: 'error',
					});
					state.canvasViewState = 'mainMenu';
					showPongMenu();
				}
			});
			state.availableTournaments = await fetchOpenTournaments();
			break;
		default:
			alert(`Clicked: ${btnMain.action}`);
	}
}

async function handleCreateGameClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btnCreate = canvas._createGameButtons?.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);

	if (state.playerInterface!.state !== 'init')
	{
		console.warn('No no no | ', state.playerInterface!.state);
		state.canvasViewState = 'mainMenu'
		return;
	}
	if (btnCreate) {
		await handleCreateGameButton(btnCreate.action);
		showPongMenu();
		return;
	}

	const h = canvas.height;
	const w = canvas.width;
	const rowY0 = h * 0.18;
	const fontH = h * 0.03;
	const leftX = w * 0.15;
	const rightX = w * 0.85;

	if (
		y >= rowY0 - fontH && y <= rowY0 + fontH/2 &&
		x >= leftX     && x <= rightX
	) {
		showNotification({
			message: 'Type a name for your room:',
			type: 'prompt',
			placeholder: 'Room Name',
			onConfirm: val => {
				createGameFormData.roomName = val ?? null;
				showPongMenu();
			}
		});
	}
}

async function handleWaitingGameClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btnWaiting = (canvas as any)._waitingGameButtons?.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!btnWaiting) return;

	if (btnWaiting.action === 'leaveRoom') {
		await handleLeaveGame();
		showPongMenu();
	}
}

async function handleJoinGameClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btns = (canvas as any)._joinGameButtons as PongButton[] | undefined;
	if (!btns) return;

	if (state.playerInterface!.state !== 'init')
	{
		state.canvasViewState = 'mainMenu'
		return;
	}
	const clickedBtn = btns.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!clickedBtn) return;

	if (clickedBtn.action === 'joinRandom') {
		return handleJoinRandom();
	}

	if (clickedBtn.action === 'back') {
		state.canvasViewState = 'mainMenu';
		if (state.playerInterface && state.playerInterface.state !== 'init')
			state.playerInterface.state = 'init';
		showPongMenu();
		return;
	}

	if (clickedBtn.action.startsWith('join:')) {
		const [, roomIDStr] = clickedBtn.action.split(':');
		const roomID = Number(roomIDStr);

		const roomInfo = state.availableRooms?.find(r => r.roomID === roomID);
		const roomName = roomInfo ? roomInfo.roomName : 'Unknown Room';

		if (!state.playerInterface?.socket) {
			console.error('No gameSocket available');
			showNotification({ message: 'Cannot join game : Socket unavailable.', type: 'error' });
			return;
		}

		state.typedSocket.send('joinGame',{ userID: state.userId, gameID: roomID, gameName: roomName });
		state.playerInterface.gameID = roomID;
		// Persist game id for reloads
		localStorage.setItem('pong_game_id', String(roomID));
		let usernames: string[] = [];
		try {
			const playerslist = await apiFetch(`/api/pong/${encodeURIComponent(roomID)}/list`, { headers: { Authorization: `Bearer ${state.authToken}` } });
			usernames = (playerslist as { username: string }[]).map(u => u.username);
		} catch (err) {
			console.error('Error getting players list:', err);
			showNotification({ message: 'Error getting players list', type: 'error' });
		}
		state.canvasViewState = 'waitingGame';
		state.currentGameName = roomName;
		state.currentPlayers = usernames;
		localStorage.setItem('pong_room', roomName);
		localStorage.setItem('pong_view', 'waitingGame');
		localStorage.setItem('pong_players', JSON.stringify(usernames));

		showPongMenu();
	}
}

async function handleCreateGameButton(action: string): Promise<void> {
	switch (action) {
		case 'toggleModeDuo':
			createGameFormData.mode = 'duo';
			break;
		case 'toggleModeQuatuor':
			createGameFormData.mode = 'quatuor';
			break;

		case 'toggleWinTime':
			createGameFormData.winCondition = 'time';
			createGameFormData.limit = Math.min(600, Math.max(5, createGameFormData.limit));
			break;
		case 'toggleWinScore':
			createGameFormData.winCondition = 'score';
			createGameFormData.limit = Math.min(20, Math.max(1, createGameFormData.limit));
			break;

		case 'editLimit':
			showNotification({
				message: 'Enter limit:',
				type: 'prompt',
				placeholder: `${createGameFormData.limit}`,
				onConfirm: val => {
					let num = parseInt(val ?? '', 10);
					if (isNaN(num)) { num = createGameFormData.limit; }
					if (createGameFormData.winCondition === 'time') {
						num = Math.min(600, Math.max(5, num));
					} else {
						num = Math.min(20, Math.max(1, num));
					}
					createGameFormData.limit = num;
					showPongMenu();
				}
			});
			return;

		case 'ballSpeedUp':
			createGameFormData.ballSpeed = Math.min(100, createGameFormData.ballSpeed + 1);
			break;
		case 'ballSpeedDown':
			createGameFormData.ballSpeed = Math.max(1, createGameFormData.ballSpeed - 1);
			break;
		case 'paddleSpeedUp':
			createGameFormData.paddleSpeed = Math.min(100, createGameFormData.paddleSpeed + 1);
			break;
		case 'paddleSpeedDown':
			createGameFormData.paddleSpeed = Math.max(1, createGameFormData.paddleSpeed - 1);
			break;

		case 'backToMenu':
			state.canvasViewState = 'mainMenu';
			break;

		case 'confirmGame':
			if (state.playerInterface!.state !== 'init')
			{
				console.warn('No no no | ', state.playerInterface!.state);
				state.canvasViewState = 'mainMenu'
				break;
			}
			const reply = await apiFetch(`/api/pong/${state.userId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userID: state.userId,
					name: createGameFormData.roomName || 'New Room',
					ball_speed: createGameFormData.ballSpeed,
					paddle_speed: createGameFormData.paddleSpeed,
					mode: createGameFormData.mode,
					win_condition: createGameFormData.winCondition,
					limit: createGameFormData.limit,
				})
			});
			const { gameID, gameName } = reply.room;
			if(!state.playerInterface?.socket){
				return;
			}
			state.typedSocket.send('joinGame', {
			userID: state.userId,
			gameID: gameID,
			gameName: createGameFormData.roomName!,
			});
			showNotification({
				message: `Creating room: ${createGameFormData.roomName ?? ''}, ball: ${createGameFormData.ballSpeed}, paddle: ${createGameFormData.paddleSpeed}`,
				type: 'success'
			});
			state.playerInterface.state = 'waitingGame';
			state.playerInterface.gameID= gameID;
			const playerslist = await apiFetch(
					`/api/pong/${encodeURIComponent(gameID)}/list`,
					{ headers: { Authorization: `Bearer ${state.authToken}` } }
			);
			const usernames = (playerslist as { username: string }[]).map(u => u.username);

			state.currentGameName   = gameName;
			state.currentPlayers    = usernames;
			state.playerInterface!.state = 'waitingGame';
			state.canvasViewState = 'waitingGame';
			state.playerInterface.gameID = gameID;
			// Persist game id
			localStorage.setItem('pong_game_id', String(gameID));
			localStorage.setItem('pong_view', 'waitingGame');
			localStorage.setItem('pong_room', gameName);
			localStorage.setItem('pong_players', JSON.stringify(usernames));

			showPongMenu();
			break;
	}
}

async function handleJoinRandom(): Promise<void> {
	let rooms = await fetchAvailableRooms();

	if (rooms.length === 0) {
		createGameFormData.roomName = 'Random Queue';
		await handleCreateGameButton('confirmGame');
		rooms = await fetchAvailableRooms();
	} else {
		const oldest = rooms.reduce((a, b) => a.roomID < b.roomID ? a : b);

		state.typedSocket.send('joinGame', { userID: state.userId, gameID: oldest.roomID, gameName: oldest.roomName });
		state.playerInterface!.gameID = oldest.roomID;
		// Persist game id
		localStorage.setItem('pong_game_id', String(oldest.roomID));

		state.currentGameName  = oldest.roomName;
		const list = await apiFetch(`/api/pong/${oldest.roomID}/list`, {
			headers: { Authorization: `Bearer ${state.authToken}` }
		});
		state.currentPlayers   = (list as any[]).map(u => u.username);
		localStorage.setItem('pong_room',     oldest.roomName);
		localStorage.setItem('pong_players',  JSON.stringify(state.currentPlayers));
	}

	showPongMenu();
}

async function handlePongMenuMouseDown(e: MouseEvent): Promise<void> {
	const canvas = e.currentTarget as HTMLCanvasElement;
	const rect = canvas.getBoundingClientRect();
	const x = (e.clientX - rect.left) * (canvas.width / rect.width);
	const y = (e.clientY - rect.top)  * (canvas.height / rect.height);

	if (state.canvasViewState !== 'createGame') return;

	const btn = canvas._createGameButtons?.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (btn && ['ballSpeedUp','ballSpeedDown','paddleSpeedUp','paddleSpeedDown'].includes(btn.action)) {
		lastButtonAction = btn.action;
		// redraw immediately
		showPongMenu();
		incrementTimeout = window.setTimeout(() => {
		  incrementInterval = window.setInterval(
			// mark this arrow async so we can await inside
			async () => {
			  await handleCreateGameButton(btn.action);
			  showPongMenu();
			},
			50
		  );
		}, 350);
	}
}

function handlePongMenuMouseUp(): void {
	if (incrementTimeout !== null) {
		clearTimeout(incrementTimeout);
		incrementTimeout = null;
	}
	if (incrementInterval !== null) {
		clearInterval(incrementInterval);
		incrementInterval = null;
	}
	lastButtonAction = null;
}
		
async function handleLeaveGame(): Promise<void> {
  const uID = state.userId;
  const gID = state.playerInterface?.gameID ?? Number(localStorage.getItem('pong_game_id') || 'NaN');

  // ---- UI first: never block the user ----
  state.canvasViewState = 'mainMenu';
  state.currentGameName = undefined;
  state.currentPlayers  = undefined;
  localStorage.removeItem('pong_view');
  localStorage.removeItem('pong_room');
  localStorage.removeItem('pong_players');
  localStorage.removeItem('pong_game_id');
  showPongMenu();

  // ---- Network best-effort ----
  try {
    if (!Number.isFinite(gID)) throw new Error('no gameID');
    await waitForGameSocketOpen(800);   //short wait for socket
    if (!state.typedSocket) throw new Error('no typedSocket');
    state.typedSocket.send('leaveGame', { userID: uID!, gameID: gID, islegit: false });
  } catch (err) {
    console.warn('[LEAVE] deferred:', err);
    // queue a deferred leave to send on next connect (optional)
    localStorage.setItem('pending_leave', '1');
    if (Number.isFinite(gID)) localStorage.setItem('pending_leave_gid', String(gID));
  }
}


function waitForGameSocketOpen(timeoutMs = 800): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = state.gameSocket;
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();
    const start = performance.now();
    const tick = () => {
      const ok = state.gameSocket && state.gameSocket.readyState === WebSocket.OPEN;
      if (ok) return resolve();
      if (performance.now() - start > timeoutMs) return reject(new Error('socket timeout'));
      requestAnimationFrame(tick);
    };
    tick();
  });
}