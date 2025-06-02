import { createGameFormData } from './pong_rooms';
import { state } from './api';

interface PongButton {
	x: number;
	y: number;
	w: number;
	h: number;
	action: string;
}

declare global {
	interface HTMLCanvasElement {
		_createGameButtons?: PongButton[];
		_waitingGameButtons?: PongButton[];
	}
}

/**
 * Draws the "Create Game" view onto the given canvas.
 */
export function drawCreateGameView(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D
): void {
	const width  = canvas.width;
	const height = canvas.height;

	// Clear
	ctx.clearRect(0, 0, width, height);

	// Background
	const grad = ctx.createLinearGradient(0, 0, width, 0);
	grad.addColorStop(0.0, '#2C5364');
	grad.addColorStop(0.5, '#203A43');
	grad.addColorStop(1.0, '#0F2027');

	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	// Title
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 15)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('CREATE GAME', width / 2, height * 0.12);

	// Labels
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'left';
	const labelX = width * 0.2;
	ctx.fillText('Room name:',    labelX, height * 0.25);
	ctx.fillText('Ball speed:',   labelX, height * 0.4);
	ctx.fillText('Paddle speed:', labelX, height * 0.55);

	// Values
	const valueX = width * 0.44;
	ctx.textAlign = 'left';
	ctx.fillText(createGameFormData.roomName || '________', valueX, height * 0.25);
	ctx.fillText(`${createGameFormData.ballSpeed}`,         valueX, height * 0.4);
	ctx.fillText(`${createGameFormData.paddleSpeed}`,       valueX, height * 0.55);

	// Buttons (+/-)
	const btnW   = width  * 0.06;
	const btnH   = height * 0.06;
	const plusX  = valueX + width * 0.1;
	const minusX = valueX + width * 0.19;
	const yBall  = height * 0.4  - btnH / 2;
	const yPad   = height * 0.55 - btnH / 2;

	ctx.fillStyle = '#38bdf8';
	ctx.fillRect(plusX,  yBall, btnW, btnH);
	ctx.fillRect(minusX, yBall, btnW, btnH);
	ctx.fillRect(plusX,  yPad,  btnW, btnH);
	ctx.fillRect(minusX, yPad,  btnW, btnH);

	ctx.fillStyle = 'black';
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('+', plusX  + btnW/2, yBall + btnH*0.7);
	ctx.fillText('-', minusX + btnW/2, yBall + btnH*0.7);
	ctx.fillText('+', plusX  + btnW/2, yPad  + btnH*0.7);
	ctx.fillText('-', minusX + btnW/2, yPad  + btnH*0.7);

	// Confirm button
	const confirmW = width  * 0.23;
	const confirmH = height * 0.10;
	const confirmX = width / 2 - confirmW/2;
	const confirmY = height * 0.72;
	ctx.fillStyle = '#22c55e';
	ctx.fillRect(confirmX, confirmY, confirmW, confirmH);

	ctx.fillStyle = 'black';
	ctx.font      = `${Math.floor(height / 22)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('Confirm', width/2, confirmY + confirmH*0.65);

	// Back button
	const backW = width  * 0.18;
	const backH = height * 0.08;
	const backX = width  * 0.08;
	const backY = height * 0.05;
	ctx.fillStyle = '#f87171';
	ctx.fillRect(backX, backY, backW, backH);

	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 32)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('← Back', backX + backW/2, backY + backH*0.62);

	// Memorize button bounds
	canvas._createGameButtons = [
		{ x: plusX,    y: yBall, w: btnW, h: btnH, action: 'ballSpeedUp'   },
		{ x: minusX,   y: yBall, w: btnW, h: btnH, action: 'ballSpeedDown' },
		{ x: plusX,    y: yPad,  w: btnW, h: btnH, action: 'paddleSpeedUp' },
		{ x: minusX,   y: yPad,  w: btnW, h: btnH, action: 'paddleSpeedDown' },
		{ x: confirmX, y: confirmY, w: confirmW, h: confirmH, action: 'confirmGame' },
		{ x: backX,    y: backY,    w: backW,    h: backH,    action: 'backToMenu' }
	];
}


export function drawWaitingGameView(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	roomName: string,
	players: string[]
): void {
	const width  = canvas.width;
	const height = canvas.height;

	// Clear
	ctx.clearRect(0, 0, width, height);

	// Background gradient (left → right: #2C5364 → #203A43 → #0F2027)
	const grad = ctx.createLinearGradient(0, 0, width, 0);
	grad.addColorStop(0.0, '#2C5364');
	grad.addColorStop(0.5, '#203A43');
	grad.addColorStop(1.0, '#0F2027');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	// Room title
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 15)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText((state.currentGameName ? state.currentGameName : "New room"), width / 2, height * 0.12);

	// Player list label
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'left';
	const listX = width * 0.2;
	let currentY = height * 0.25;
	const lineHeight = height * 0.06;
	ctx.fillText('Players:', listX, currentY);

	// List of players
	players.forEach((player, index) => {
		ctx.fillText(
			`• ${player}`,
			listX,
			currentY + lineHeight * (index + 1)
		);
	});

	// Leave Room button
	const btnW = width  * 0.2;
	const btnH = height * 0.08;
	const btnX = width  / 2 - btnW / 2;
	const btnY = height * 0.8;
	ctx.fillStyle = '#f87171';
	ctx.fillRect(btnX, btnY, btnW, btnH);

	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 22)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('Leave Room', width / 2, btnY + btnH * 0.65);

	// store the leave button for click handling
	(canvas as any)._waitingGameButtons = [
		{ x: btnX, y: btnY, w: btnW, h: btnH, action: 'leaveRoom' }
	];
}

export function drawJoinGameView(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	rooms: { roomID: number; roomName: string }[]
): void {
	const width  = canvas.width;
	const height = canvas.height;

	// Clear the entire canvas
	ctx.clearRect(0, 0, width, height);

	// Background gradient (left → right: #2C5364 → #203A43 → #0F2027)
	const grad = ctx.createLinearGradient(0, 0, width, 0);
	grad.addColorStop(0.0, '#2C5364');
	grad.addColorStop(0.5, '#203A43');
	grad.addColorStop(1.0, '#0F2027');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	// Title: "Join Game"
	ctx.fillStyle   = 'white';
	ctx.font        = `${Math.floor(height / 15)}px Orbitron`;
	ctx.textAlign   = 'center';
	ctx.fillText('Join Game', width / 2, height * 0.12);

	// Label for rooms list
	ctx.fillStyle   = 'white';
	ctx.font        = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign   = 'left';
	const listX     = width * 0.1;
	let currentY    = height * 0.25;
	const lineHeight = height * 0.06;

	ctx.fillText('Available Rooms:', listX, currentY);

	// Prepare an array to store clickable areas for each room
	const joinButtons: { x: number; y: number; w: number; h: number; action: string }[] = [];

	// Draw each room as a bullet + text, and register a button area
	rooms.forEach((room, index) => {
		const textY = currentY + lineHeight * (index + 1);
		// draw the room name with a bullet
		ctx.fillText(`• ${room.roomName}`, listX, textY);

		// define a clickable area around the text
		// We'll assume each line occupies roughly (width * 0.8) in width and lineHeight in height
		const btnX = listX;
		const btnY = textY - lineHeight * 0.75; // adjust so that vertical click is centered on the text
		const btnW = width * 0.8;
		const btnH = lineHeight;
		joinButtons.push({
			x: btnX,
			y: btnY,
			w: btnW,
			h: btnH,
			action: `join:${room.roomID}`
		});
	});

	// Draw a "Back to Menu" button at the bottom
	const btnW = width  * 0.3;
	const btnH = height * 0.08;
	const btnX = width  / 2 - btnW / 2;
	const btnY = height * 0.85;
	ctx.fillStyle = '#f87171';
	ctx.fillRect(btnX, btnY, btnW, btnH);

	ctx.fillStyle  = 'white';
	ctx.font       = `${Math.floor(height / 22)}px Orbitron`;
	ctx.textAlign  = 'center';
	ctx.fillText('Back to Menu', width / 2, btnY + btnH * 0.65);

	// Register the "Back" button
	joinButtons.push({
		x: btnX,
		y: btnY,
		w: btnW,
		h: btnH,
		action: 'back'
	});

	// Store the buttons on the canvas for click handling
	(canvas as any)._joinGameButtons = joinButtons;
}