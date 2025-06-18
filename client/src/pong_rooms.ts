import { isAuthenticated, apiFetch, state } from './api';
import { drawCreateGameView, 
		drawWaitingGameView,
		drawJoinGameView,
		drawTournamentView,
		drawWaitingTournamentView } from './pong_views';
import { showNotification } from './notifications';
import { pongState } from './pong_socket';
import { PongRenderer } from './pong_render'
import { TypedSocket } from './shared/gameTypes';
import { resizePongCanvas } from './handlers';

interface PongButton {
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

export const createTournamentFormData = {
	tournamentName: null as string | null,
	ballSpeed: 50,
	paddleSpeed: 50
};

let incrementInterval: number | null = null;
let incrementTimeout: number | null = null;
let lastButtonAction: string | null = null;

export const createGameFormData = {
	roomName: null as string | null,
	ballSpeed: 50,
	paddleSpeed: 50
};

export async function fetchAvailableRooms(): Promise<{ roomID: number; roomName: string }[]> {
	const resp = await apiFetch('/api/pong/list', {
		headers: { Authorization: `Bearer ${state.authToken}` }
	});

	console.log('fetchAvailableRooms – raw response:', resp);

	const rawGames = Array.isArray((resp as any).games) ? (resp as any).games : [];

	return rawGames.map((r: { gameID: number; name: string }) => ({
		roomID: r.gameID,
		roomName: r.name
	}));
}

export async function fetchOpenTournaments(): Promise<{ tournamentID: number; name: string }[]> {
	const resp = await apiFetch('/api/tournament/list', {
		headers: { Authorization: `Bearer ${state.authToken}` }
	});
	return resp.tournaments;
}


// =======================
// PONG MENU
// =======================

export function showPongMenu(): void {
		const canvas       = document.getElementById('pong-canvas')    as HTMLCanvasElement | null;
		const babylonCanvas = document.getElementById('babylon-canvas') as HTMLCanvasElement | null;
		if (!canvas || !babylonCanvas) return;

		// Set up event listeners for menu interactions
		canvas.onclick = handlePongMenuClick;
		canvas.onmousedown = handlePongMenuMouseDown;
		canvas.onmouseup = handlePongMenuMouseUp;
		canvas.onmouseleave = handlePongMenuMouseUp;
		window.addEventListener('mouseup', handlePongMenuMouseUp);

		resizePongCanvas();
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Handle canvas visibility based on game state
		if (state.canvasViewState === 'playingGame') {
			canvas.style.display        = 'none';
			babylonCanvas.style.display = 'block';
		} else {
			babylonCanvas.style.display = 'none';
			canvas.style.display        = 'block';
		}

		// Dispose of pongRenderer if exists but not in 'playingGame' state
		// if (state.canvasViewState !== 'playingGame' && pongState.pongRenderer) {
		// 		pongState.pongRenderer.dispose();
		// 		pongState.pongRenderer = null;
		// }
		console.log('state.canvasViewState = ', state.canvasViewState);

		// Handle different view states
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

				case 'joinGame':
						drawJoinGameView(
								canvas,
								ctx,
								state.availableRooms || []
						);
						break;

				case 'playingGame': 
					canvas.style.display        = 'none';
					babylonCanvas.style.display = 'block';

					const r = babylonCanvas.getBoundingClientRect();
					babylonCanvas.width  = Math.floor(r.width);
					babylonCanvas.height = Math.floor(r.height);

					if (pongState.pongRenderer) {
						pongState.pongRenderer.handleResize();
					}

					else {
					console.log(`HELLO NOOB IF YOU"RE HERE YOU'RE COOKED`)
						if (!state.playerInterface?.typedSocket) {
							console.error('No socket for PongRenderer');
							return;
						}
					state.typedSocket.send('gameRequest', state.playerInterface.userID);
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
	ctx.clearRect(0, 0, width, height);

	// bg gradient
	const gradient = ctx.createLinearGradient(0, 0, width, 0);
	gradient.addColorStop(0, '#2C5364');
	gradient.addColorStop(0.5, '#203A43');
	gradient.addColorStop(1, '#0F2027');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	// title
	ctx.fillStyle = '#4de8b7';
	ctx.font = `${Math.floor(height/10)}px 'Orbitron', sans-serif`;
	ctx.textAlign = 'center';
	ctx.shadowColor = '#ffffff';
	ctx.shadowBlur = 20;
	ctx.fillText("LET'S PLAY", width/2, height/5);
	ctx.fillText('PONG !',   width/2, height/5 + 50);
	ctx.shadowBlur = 0;

	// Prepare labels & pos
	const labels = [
		{ action: 'Create Game', y: height/2 - 40 },
		{ action: 'Join Game',   y: height/2 + 20 },
		{ action: 'Tournament',  y: height/2 + 80 },
		{ action: 'Settings',    y: height/2 + 140 }
	];
	ctx.font = `${Math.floor(height/20)}px 'Orbitron', sans-serif`;

	const btnW = 260, btnH = 50;
	// Save button pos
	canvas._pongMenuBtns = labels.map(btn => {
		const x = width/2 - btnW/2;
		const y = btn.y - btnH/2;

		// Button
		const g2 = ctx.createLinearGradient(x, y, x+btnW, y+btnH);
		g2.addColorStop(0, '#0ea5e9');
		g2.addColorStop(1, '#38bdf8');
		ctx.fillStyle = g2;
		ctx.beginPath();
		;(ctx as any).roundRect(x, y, btnW, btnH, 12);
		ctx.fill();

		// texte
		ctx.fillStyle = 'white';
		ctx.shadowColor = 'black';
		ctx.shadowBlur = 8;
		ctx.fillText(btn.action, width/2, btn.y + 8);
		ctx.shadowBlur = 0;

		return { x, y, w: btnW, h: btnH, action: btn.action };
	});

}



async function handlePongMenuClick(e: MouseEvent): Promise<void> {
	const canvas = e.currentTarget as HTMLCanvasElement;
	const rect   = canvas.getBoundingClientRect();
	const x      = (e.clientX - rect.left) * (canvas.width  / rect.width);
	const y      = (e.clientY - rect.top ) * (canvas.height / rect.height);
	if (state.canvasViewState === 'playingGame')
		return;
	switch (state.canvasViewState) {
		case 'mainMenu': {
			// handle main menu buttons
			const btnMain = canvas._pongMenuBtns?.find((b: PongButton) =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (!btnMain) return;
			switch (btnMain.action) {
				case 'Create Game' :
					state.canvasViewState = 'createGame';
					showPongMenu();
					break;

				case 'Join Game' :
					state.availableRooms = await fetchAvailableRooms();
					state.canvasViewState = 'joinGame';
					showPongMenu();
					break;

				case 'Tournament' :
					state.availableTournaments = await fetchOpenTournaments();
					state.canvasViewState = 'tournament';
					showPongMenu();
					break;

				default :
					alert(`Clicked: ${btnMain.action}`);
			}
			break;
		}

		case 'createGame': {
			// handle create game buttons
			const btnCreate = canvas._createGameButtons?.find((b: PongButton) =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (btnCreate) {
				await handleCreateGameButton(btnCreate.action);
				showPongMenu();
			} else if (
				y > canvas.height * 0.22 && y < canvas.height * 0.28 &&
				x > canvas.width  * 0.2  && x < canvas.width  * 0.9
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
			break;
		}

		case 'waitingGame': {
			// handle the leave room button
			const btnWaiting = (canvas as any)._waitingGameButtons?.find((b: PongButton) =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (!btnWaiting) return;
			if (btnWaiting.action === 'leaveRoom') {
				await handleLeaveGame();
				showPongMenu();
			}
			break;
		}

		case 'joinGame': {
			// handle clicks on "Join Game" view
			const btns = (canvas as any)._joinGameButtons as PongButton[] | undefined;
			if (!btns) return;

			const clickedBtn = btns.find((b: PongButton) =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (!clickedBtn) return;
			if (clickedBtn.action === 'joinRandom') {
				return handleJoinRandom();
			}
			if (clickedBtn.action === 'back') {
				state.canvasViewState = 'mainMenu';
				if(state.playerInterface && state.playerInterface.state !== 'init')
					state.playerInterface.state = 'init';
				showPongMenu();
			} else if (clickedBtn.action.startsWith('join:')) {
				// Extract roomID from action string
				const [, roomIDStr] = clickedBtn.action.split(':');
				const roomID = Number(roomIDStr);

				// get corresponding roomName in state.availableRooms
				const roomInfo = state.availableRooms?.find(r => r.roomID === roomID);
				const roomName = roomInfo ? roomInfo.roomName : 'Unknown Room';

				// Verify that socket exists
				if (!state.playerInterface?.socket) {
					console.error('No gameSocket available');
					showNotification({
						message: 'Cannot join game : Socket unavailable.',
						type: 'error'
					});
					return;
				}
				state.typedSocket.send('joinGame',{
					userID:state.userId,
					gameID:roomID,
					gameName:roomName
				});
				state.playerInterface.gameID = roomID;
				// Get players list via API
				let usernames: string[] = [];
				try {
					const playerslist = await apiFetch(
						`/api/pong/${encodeURIComponent(roomID)}/list`,
						{ headers: { Authorization: `Bearer ${state.authToken}` } }
					);
					// playerslist should be an array of username: string
					usernames = (playerslist as { username: string }[]).map(u => u.username);
				} catch (err) {
					console.error('Error getting players list:', err);
					showNotification({
						message: 'Error getting players list',
						type: 'error'
					});
				}

				// store in localstorage / state like if u created the room
				state.currentGameName   = roomName;
				state.currentPlayers    = usernames;
				//state.canvasViewState   = 'waitingGame';
				console.warn("---------------------------------------------- test 1")

				// localStorage.setItem('pong_view', 'waitingGame');
				localStorage.setItem('pong_room', roomName);
				localStorage.setItem('pong_players', JSON.stringify(usernames));

				showPongMenu();
			}
			break;
		}
		case 'tournament': {
			const btns = (canvas as any)._tournamentButtons as PongButton[] | undefined;
			if (!btns) return;

			const clickedBtn = btns.find(b =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (!clickedBtn) return;

			if (clickedBtn.action === 'editTournamentName') {
				showNotification({
					message: 'Enter tournament name:',
					type: 'prompt',
					placeholder: 'Tournament Name',
					onConfirm: val => {
						createTournamentFormData.tournamentName = val ?? null;
						showPongMenu();
					}
				});
			}
			else if (clickedBtn.action === 'ballSpeedUp') {
				createTournamentFormData.ballSpeed = Math.min(100, createTournamentFormData.ballSpeed + 1);
				showPongMenu();
			}
			else if (clickedBtn.action === 'ballSpeedDown') {
				createTournamentFormData.ballSpeed = Math.max(1, createTournamentFormData.ballSpeed - 1);
				showPongMenu();
			}
			else if (clickedBtn.action === 'paddleSpeedUp') {
				createTournamentFormData.paddleSpeed = Math.min(100, createTournamentFormData.paddleSpeed + 1);
				showPongMenu();
			}
			else if (clickedBtn.action === 'paddleSpeedDown') {
				createTournamentFormData.paddleSpeed = Math.max(1, createTournamentFormData.paddleSpeed - 1);
				showPongMenu();
			}
			else if (clickedBtn.action === 'backToMenu') {
				state.canvasViewState = 'mainMenu';
				showPongMenu();
				break;
			}
			else if (clickedBtn.action === 'createTournament') {
				const name = createTournamentFormData.tournamentName;
				if (!name) {
					showNotification({ message: 'Please enter a name first', type: 'error' });
					return;
				}

				apiFetch(`/api/tournament/${state.userId}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${state.authToken}`
					},
					body: JSON.stringify({
						name,
						maxPlayers: 16,
						status: 'open'
					})
				})
					.then(async resp => {
						showNotification({ message: `Tournament "${name}" created`, type: 'success' });
						let ownerName = `User${state.userId}`;
						try {
							const userResp = await apiFetch(`/api/user/by-index/${state.userId}`, {
								headers: { Authorization: `Bearer ${state.authToken}` }
							});
							ownerName = userResp.username.username;
						} catch {
							// if api breaks we keep userID
						}
						const list = await fetchOpenTournaments();
						state.availableTournaments = list;
						state.currentTournamentPlayers = [ ownerName ];
						const createdEntry = list.find(t => t.name === name)!;
						state.currentTournamentID      = createdEntry.tournamentID;
						state.currentTournamentName    = name;
						state.canvasViewState          = 'waitingTournament';

						localStorage.setItem('tournament_view', 'waitingTournament');
						localStorage.setItem('tournament_name', name);
						localStorage.setItem('tournament_id', String(state.currentTournamentID));
						localStorage.setItem('tournament_players', JSON.stringify([ownerName]));

						showPongMenu();
					})
					.catch(err => {
						console.error('Error creating tournament:', err);
						showNotification({ message: 'Failed to create', type: 'error' });
					});

				return;
			}
			else if (clickedBtn.action.startsWith('join:')) {
				const [, tourIDstr] = clickedBtn.action.split(':');
				const tourID = Number(tourIDstr);

				try {
					// Send POST /join to register to tournament
					await apiFetch(`/api/tournament/${tourID}/join/${state.userId}`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${state.authToken}`
						},
						body: JSON.stringify({})
					});
				} catch (err) {
					console.error('Error joining tournament:', err);
					showNotification({ message: 'Failed to join tournament', type: 'error' });
					return;
				}

				// If succes, get members list by GET /members
				let members: { userID: number; alias: string }[] = [];
				try {
					const resp = await apiFetch(`/api/tournament/${tourID}/members`, {
						headers: { Authorization: `Bearer ${state.authToken}` }
					});
					members = resp.members;
				} catch (err) {
					console.error('Error fetching tournament members:', err);
					showNotification({ message: 'Cannot fetch tournament members', type: 'error' });
					return;
				}

				const usernames: string[] = [];
				for (const m of members) {
					if (m.alias && m.alias.trim() !== '') {
						usernames.push(m.alias);
					} else {
						try {
							const userResp = await apiFetch(`/api/user/by-index/${m.userID}`, {
								headers: { Authorization: `Bearer ${state.authToken}` }
							});
							usernames.push(userResp.username.username);
						} catch {
							usernames.push(`User${m.userID}`);
						}
					}
				}
				state.currentTournamentPlayers = usernames;
				// Update global state
				state.currentTournamentID      = tourID;
				state.currentTournamentName    = state.availableTournaments
					?.find(t => t.tournamentID === tourID)?.name || 'Unknown Tournament';
				state.canvasViewState          = 'waitingTournament';

				// stock in localstorage to persist after refresh
				localStorage.setItem('tournament_view', 'waitingTournament');
				localStorage.setItem('tournament_id', String(tourID));
				localStorage.setItem('tournament_name', state.currentTournamentName);
				localStorage.setItem('tournament_players', JSON.stringify(usernames));

				showPongMenu();
				break;
			}}
		case 'waitingTournament': {
			const btns = (canvas as any)._waitingTournamentButtons as PongButton[] | undefined;
			if (!btns) return;

			const clickedBtn = btns.find((b: PongButton) =>
				x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
			);
			if (!clickedBtn) return;

			if (clickedBtn.action === 'leaveTournament') {
				// Call API to leave tournament
				const tournamentID = state.currentTournamentID;
				try {
					await apiFetch(`/api/tournament/${tournamentID}/leave/${state.userId}`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${state.authToken}`
						},
						body: JSON.stringify({})
					});
				} catch (err) {
					console.error('Error leaving tournament:', err);
					showNotification({ message: 'Error leaving tournament', type: 'error' });
					return;
				}

				// Clean state & localStorage
				state.currentTournamentName    = undefined;
				state.currentTournamentPlayers = undefined;
				state.currentTournamentID      = undefined;
				delete state.currentTournamentID;

				localStorage.removeItem('tournament_view');
				localStorage.removeItem('tournament_name');
				localStorage.removeItem('tournament_players');
				localStorage.removeItem('tournament_id');

				state.canvasViewState = 'mainMenu';
				showPongMenu();
			}
			break;
		}
		default:
			break;
	}
}


async function handleCreateGameButton(action: string): Promise<void> {
	switch (action) {
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
			if(state.playerInterface?.state !== 'init' && state.playerInterface?.state !== 'online'){
				showNotification({
					message:`You can't create a game because you are : ${state.playerInterface?.state}`,
					type:'error'
				});
				return;
			}
			const reply = await apiFetch(`/api/pong/${state.userId}`, {
			method:'POST',
			headers:{
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userID: state.userId,
				name: createGameFormData.roomName ? createGameFormData.roomName : 'New Room',
				ball_speed: createGameFormData.ballSpeed,
				paddle_speed: createGameFormData.paddleSpeed,
			})
			});
			const { gameID, gameName } = reply.room;
			if(!state.playerInterface?.socket){
				console.log('NO SOCKET FOR GAME');
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
			// map playerslist object as a string map
			const usernames = (playerslist as { username: string }[]).map(u => u.username);

			// stock in state
			state.currentGameName   = gameName;
			state.currentPlayers    = usernames;
			state.canvasViewState   = 'waitingGame';
			console.warn("---------------------------------------------- test 2");

			// persist in local storage to survive refresh
			localStorage.setItem('pong_view', 'waitingGame');
			localStorage.setItem('pong_room', gameName);
			localStorage.setItem('pong_players', JSON.stringify(usernames));

			showPongMenu();
			break;
	}
}

async function handleJoinRandom(): Promise<void> {
	// fetch available rooms
	let rooms = await fetchAvailableRooms();

	if (rooms.length === 0) {
		// No available room → create “Random Queue”
		createGameFormData.roomName = 'Random Queue';
		await handleCreateGameButton('confirmGame');
		rooms = await fetchAvailableRooms();
	} else {
		const oldest = rooms.reduce((a, b) => a.roomID < b.roomID ? a : b);

		// join
		state.typedSocket.send('joinGame', {
			userID: state.userId,
			gameID: oldest.roomID,
			gameName: oldest.roomName
		});

		// update waitingGame
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

function handlePongMenuMouseDown(e: MouseEvent): void {
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
		incrementTimeout = window.setTimeout(() => {
			incrementInterval = window.setInterval(() => {
				handleCreateGameButton(btn.action);
			}, 50);
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
	
	const uID= state.userId;
	const gID = state.playerInterface?.gameID;

	try {
		if (!state.playerInterface?.typedSocket) throw new Error('TYPEDsocket unavailable');
		state.typedSocket.send('leaveGame', {
			userID: uID!,
			gameID: gID!,
			islegit: false,
		});

		console.log(`[LEAVE][INFO] User ${uID} sent leaveGame for room ${gID}`);
	} catch (err) {
		console.error('[LEAVE][ERROR] Failed to send leaveGame:', err);
		showNotification({ message: 'Error leaving game', type: 'error' });
		return;
	}

	// cleanup local state & storage
	state.canvasViewState   = 'mainMenu';
	state.currentGameName   = undefined;
	state.currentPlayers    = undefined;
	localStorage.removeItem('pong_view');
	localStorage.removeItem('pong_room');
	localStorage.removeItem('pong_players');
}
