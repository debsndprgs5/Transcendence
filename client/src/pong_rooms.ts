import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { drawCreateGameView, drawWaitingGameView } from './pong_views';
import { showNotification } from './notifications';

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
	}
}

let incrementInterval: number | null = null;
let incrementTimeout: number | null = null;
let lastButtonAction: string | null = null;

export const createGameFormData = {
	roomName: null as string | null,
	ballSpeed: 50,
	paddleSpeed: 50
};

// =======================
// PONG MENU
// =======================

export function showPongMenu(): void {
	const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;

	canvas.onmousedown = handlePongMenuMouseDown;
	canvas.onmouseup   = handlePongMenuMouseUp;
	canvas.onmouseleave = handlePongMenuMouseUp;
	window.addEventListener('mouseup', handlePongMenuMouseUp);

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	switch (state.canvasViewState) {
		case 'mainMenu':
			drawMainMenu(canvas, ctx);
			break;

		case 'createGame':
			drawCreateGameView(canvas, ctx);
			break;

		case 'waitingGame':
			drawWaitingGameView(canvas, ctx);
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

	canvas.onclick = handlePongMenuClick;
}

function handlePongMenuClick(e: MouseEvent): void {
	const canvas = e.currentTarget as HTMLCanvasElement;
	const rect   = canvas.getBoundingClientRect();
	const x      = (e.clientX - rect.left) * (canvas.width  / rect.width);
	const y      = (e.clientY - rect.top ) * (canvas.height / rect.height);

	if (state.canvasViewState === 'mainMenu') {
		const btn = canvas._pongMenuBtns?.find(b =>
			x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
		);
		if (!btn) return;
		if (btn.action === 'Create Game') {
			state.canvasViewState = 'createGame';
			showPongMenu();
		} else {
			alert(`Clicked: ${btn.action}`);
		}
	} else {
		// =======================
		// CREATE GAME HANDLING
		// =======================
		const btn = canvas._createGameButtons?.find(b =>
			x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
		);
		if (btn) {
			handleCreateGameButton(btn.action);
			showPongMenu();
		} else if (
			// on clique dans la zone "Room name"
			y > canvas.height * 0.22 && y < canvas.height * 0.28 &&
			x > canvas.width * 0.2 && x < canvas.width * 0.9
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
			if(state.playerState !== 'init' && state.playerState !== 'online'){
				showNotification({
					message:`You can't create a game because you are suposed to be playing ${state.playerState}`,
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
				name: createGameFormData.roomName,
				ball_speed: createGameFormData.ballSpeed,
				paddle_speed: createGameFormData.paddleSpeed,
			})
			});
			const { gameID, gameName } = reply.room;
			if(!state.gameSocket){
				console.log('NO SOCKET FOR GAME');
				return;
			}
			state.gameSocket.send(JSON.stringify({
				type:'joinGame',
				gameName,
				userID:state.userId,
				gameID
			}));
			showNotification({
				message: `Creating room: ${createGameFormData.roomName ?? ''}, ball: ${createGameFormData.ballSpeed}, paddle: ${createGameFormData.paddleSpeed}`,
				type: 'success'
			});
			state.playerState = 'waiting';
			break;
	}
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
