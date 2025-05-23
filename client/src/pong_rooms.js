// =======================
// PONG MENU
// =======================
import { isAuthenticated, apiFetch, initWebSocket, state } from './api.js';
import { drawCreateGameView } from './pong_views.js';
import { showNotification } from './notifications.js';

export const createGameFormData = {
	roomName: "",
	ballSpeed: 50,
	paddleSpeed: 50
};

export function showPongMenu() {
	const canvas = document.getElementById('pong-canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');

	if (state.canvasViewState === "mainMenu") {
		drawMainMenu(canvas, ctx);
	} else if (state.canvasViewState === "createGame") {
		drawCreateGameView(canvas, ctx);
	}
}


export function drawMainMenu(canvas, ctx) {
	const width = canvas.width;
	const height = canvas.height;
	ctx.clearRect(0, 0, width, height);

	// Radial Gradient for backgroud
	const gradient = ctx.createRadialGradient(
		width / 2, height / 2, width / 5,
		width / 2, height / 2, width / 1.2
	);
	gradient.addColorStop(0, "#1e1b4b"); // indigo-950
	gradient.addColorStop(1, "#0f172a"); // slate-900
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	// Shadow
	ctx.fillStyle = "#4de8b7"; // Cyan
	ctx.font = `${Math.floor(height / 10)}px 'Orbitron', sans-serif`;
	ctx.textAlign = "center";
	ctx.shadowColor = "#a1f3d9"; // Light Cyan
	ctx.shadowBlur = 20;
	ctx.fillText("LET'S PLAY", width / 2, height / 5);
	ctx.fillText("PONG", width / 2, height / 5 + 50);
	ctx.shadowBlur = 0;

	// Glowy buttons
	const btns = [
		{ label: "Create Game",   y: height / 2 - 60 },
		{ label: "Join Game",     y: height / 2 },
		{ label: "Tournament",    y: height / 2 + 60 },
		{ label: "Settings",      y: height / 2 + 120 }
	];

	ctx.font = `${Math.floor(height / 20)}px 'Orbitron', sans-serif`;

	const btnWidth = 260;
	const btnHeight = 50;

	btns.forEach(btn => {
		// Bg buttons
		const x = width / 2 - btnWidth / 2;
		const y = btn.y - btnHeight / 2;

		// Gradient buttons
		const btnGradient = ctx.createLinearGradient(x, y, x + btnWidth, y + btnHeight);
		btnGradient.addColorStop(0, "#0ea5e9"); // sky-500
		btnGradient.addColorStop(1, "#38bdf8"); // sky-400
		ctx.fillStyle = btnGradient;

		ctx.beginPath();
		ctx.roundRect(x, y, btnWidth, btnHeight, 12);
		ctx.fill();

		// text
		ctx.fillStyle = "white";
		ctx.shadowColor = "black";
		ctx.shadowBlur = 8;
		ctx.fillText(btn.label, width / 2, btn.y + 8);
		ctx.shadowBlur = 0;
	});

	// Memorize button positions
	canvas._pongMenuBtns = btns.map(btn => ({
		x: width / 2 - btnWidth / 2,
		y: btn.y - btnHeight / 2,
		w: btnWidth,
		h: btnHeight,
		action: btn.label
	}));
	canvas.onclick = handlePongMenuClick;
}


// Handling click on the game canvas
function handlePongMenuClick(e) {
	const canvas = document.getElementById('pong-canvas');
	const rect = canvas.getBoundingClientRect();
	const x = (e.clientX - rect.left) * (canvas.width / rect.width);
	const y = (e.clientY - rect.top) * (canvas.height / rect.height);

	if (state.canvasViewState === "mainMenu") {
		const btn = canvas._pongMenuBtns?.find(b =>
			x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
		);
		if (btn) {
			if (btn.action === "Create Game") {
				state.canvasViewState = "createGame";
				showPongMenu();
			} else {
				alert(`Clicked: ${btn.action}`);
			}
		}
	} else if (state.canvasViewState === "createGame") {
		const btn = canvas._createGameButtons?.find(b =>
			x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
		);
		if (btn) {
			switch (btn.action) {
				case "ballSpeedUp": createGameFormData.ballSpeed = Math.min(100, createGameFormData.ballSpeed + 1); break;
				case "ballSpeedDown": createGameFormData.ballSpeed = Math.max(1, createGameFormData.ballSpeed - 1); break;
				case "paddleSpeedUp": createGameFormData.paddleSpeed = Math.min(100, createGameFormData.paddleSpeed + 1); break;
				case "paddleSpeedDown": createGameFormData.paddleSpeed = Math.max(1, createGameFormData.paddleSpeed - 1); break;
				case "confirmGame":
					showNotification({ message: `Creating room: ${createGameFormData.roomName}, ball: ${createGameFormData.ballSpeed}, paddle: ${createGameFormData.paddleSpeed}`, type: 'success' });
					break;
			}
			showPongMenu(); // redraw
		} else if (y > 100 && y < 140 && x > 200 && x < 500) {
			showNotification({
						message: 'Type a name for your room:',
						type: 'prompt',
						placeholder: 'Username',
						onConfirm: async (val) => {
							if (val) createGameFormData.roomName = val;
			}});
			showPongMenu();
		}
	}
}