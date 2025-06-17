import { createGameFormData, createTournamentFormData } from './pong_rooms';
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

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0.0, '#2C5364');
  grad.addColorStop(0.5, '#203A43');
  grad.addColorStop(1.0, '#0F2027');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle   = 'white';
  ctx.font        = `${Math.floor(height / 15)}px Orbitron`;
  ctx.textAlign   = 'center';
  ctx.fillText('Join Game', width / 2, height * 0.12);

  // Label rooms
  ctx.fillStyle   = 'white';
  ctx.font        = `${Math.floor(height / 28)}px Orbitron`;
  ctx.textAlign   = 'left';
  const listX     = width * 0.1;
  let currentY    = height * 0.25;
  const lineHeight = height * 0.06;

  ctx.fillText('Available Rooms:', listX, currentY);

  // Prepare clickable areas
  const joinButtons: PongButton[] = [];

  // Draw each room
  rooms.forEach((room, index) => {
    const textY = currentY + lineHeight * (index + 1);
    ctx.fillText(`• ${room.roomName}`, listX, textY);

    const btnX = listX;
    const btnY = textY - lineHeight * 0.75;
    const btnW = width * 0.8;
    const btnH = lineHeight;
    joinButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: `join:${room.roomID}` });
  });

  // Join Random
  const randW = 140;
  const randH = 40;
  const randX = width - randW - 40;
  const randY = height * 0.15;

  // Random join gradient
  const randGrad = ctx.createLinearGradient(randX, randY, randX + randW, randY + randH);
  randGrad.addColorStop(0, '#f97316');
  randGrad.addColorStop(1, '#fb923c');

  ctx.beginPath();
  (ctx as any).roundRect(randX, randY, randW, randH, 6);
  ctx.fillStyle = randGrad;
  ctx.fill();

  // Centered white text
  ctx.fillStyle    = 'white';
  ctx.font         = `${Math.floor(randH * 0.5)}px Orbitron`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Join Random', randX + randW / 2, randY + randH / 2);

  joinButtons.push({ x: randX, y: randY, w: randW, h: randH, action: 'joinRandom' });

  // Leave button
  const leaveW = 100;
  const leaveH = 35;
  const leaveX = width - leaveW - 40;
  const leaveY = height - leaveH - 40;

  ctx.beginPath();
  (ctx as any).roundRect(leaveX, leaveY, leaveW, leaveH, 6);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  ctx.fillStyle    = 'white';
  ctx.font         = `${Math.floor(leaveH * 0.5)}px Orbitron`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Leave', leaveX + leaveW / 2, leaveY + leaveH / 2);

  joinButtons.push({ x: leaveX, y: leaveY, w: leaveW, h: leaveH, action: 'back' });

  // Store for click handler
  canvas._joinGameButtons = joinButtons;
}


export function drawTournamentView(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	tournaments: { tournamentID: number; name: string }[]
): void {
	const width  = canvas.width;
	const height = canvas.height;

	// Background gradient
	ctx.clearRect(0, 0, width, height);
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
	ctx.fillText('TOURNAMENT', width / 2, height * 0.12);

	// Form on the left
	const formX = width * 0.05;
	const labelX = formX;
	const valueX = formX + width * 0.25;
	const yName      = height * 0.25;
	const yBallSpeed = height * 0.40;
	const yPaddle    = height * 0.55;
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'left';

	ctx.fillText('Tournament Name:', labelX, yName);
	ctx.fillText('Ball speed:',       labelX, yBallSpeed);
	ctx.fillText('Paddle speed:',     labelX, yPaddle);

	ctx.fillText(createTournamentFormData.tournamentName || '________', valueX, yName);
	ctx.fillText(`${createTournamentFormData.ballSpeed}`,               valueX, yBallSpeed);
	ctx.fillText(`${createTournamentFormData.paddleSpeed}`,             valueX, yPaddle);

	// Underline “Tournament Name”
	const nameText  = createTournamentFormData.tournamentName || '________';
	const metrics   = ctx.measureText(nameText);
	const underlineY = yName + 4;
	ctx.strokeStyle = 'white';
	ctx.lineWidth   = 2;
	ctx.beginPath();
	ctx.moveTo(valueX, underlineY);
	ctx.lineTo(valueX + metrics.width, underlineY);
	ctx.stroke();

	// +/- buttons for ball/paddle speeds
	const btnW = width  * 0.05;
	const btnH = height * 0.05;
	const plusX  = valueX + width * 0.12;
	const minusX = valueX + width * 0.20;
	const yBallC  = yBallSpeed - btnH / 2;
	const yPadC   = yPaddle    - btnH / 2;

	ctx.fillStyle = '#38bdf8';
	ctx.fillRect(plusX,  yBallC,   btnW, btnH);
	ctx.fillRect(minusX, yBallC,   btnW, btnH);
	ctx.fillRect(plusX,  yPadC,    btnW, btnH);
	ctx.fillRect(minusX, yPadC,    btnW, btnH);

	ctx.fillStyle = 'black';
	ctx.font      = `${Math.floor(height / 30)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('+', plusX  + btnW / 2, yBallC + btnH * 0.7);
	ctx.fillText('-', minusX + btnW / 2, yBallC + btnH * 0.7);
	ctx.fillText('+', plusX  + btnW / 2, yPadC  + btnH * 0.7);
	ctx.fillText('-', minusX + btnW / 2, yPadC  + btnH * 0.7);

	// button “Create Tournament” under form
	const createW = width  * 0.23;
	const createH = height * 0.08;
	const createX = formX;
	const createY = height * 0.65;
	ctx.fillStyle = '#22c55e';
	ctx.fillRect(createX, createY, createW, createH);
	ctx.fillStyle = 'black';
	ctx.font      = `${Math.floor(height / 25)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('Create Tournament', createX + createW/2, createY + createH * 0.65);

	// Open Tournaments on right
	const listX     = width * 0.60;
	const listLabelY = height * 0.25;
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'left';
	ctx.fillText('Open Tournaments:', listX, listLabelY);

	const lineHeight = height * 0.05;
	const joinButtons: PongButton[] = [];

	tournaments.forEach((t, i) => {
		const textY = listLabelY + lineHeight * (i + 1);
		ctx.fillText(`• ${t.name}`, listX, textY);

		const btnX = listX;
		const btnY = textY - lineHeight * 0.75;
		const btnW = width * 0.35;
		const btnH = lineHeight;
		joinButtons.push({
			x: btnX,
			y: btnY,
			w: btnW,
			h: btnH,
			action: `join:${t.tournamentID}`
		});
	});

	// Back button
	const backW = width  * 0.15;
	const backH = height * 0.06;
	const backX = formX;
	const backY = height * 0.05;
	ctx.fillStyle = '#f87171';
	ctx.fillRect(backX, backY, backW, backH);
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 32)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('← Back', backX + backW/2, backY + backH * 0.62);

	// Save button locations
	canvas._tournamentButtons = [
		// Click on “Tournament Name”
		{ x: valueX - 4, y: yName - 28, w: metrics.width + 8, h: 32, action: 'editTournamentName' },
		// +/- ballSpeed
		{ x: plusX,   y: yBallC, w: btnW, h: btnH, action: 'ballSpeedUp'   },
		{ x: minusX,  y: yBallC, w: btnW, h: btnH, action: 'ballSpeedDown' },
		// +/- paddleSpeed
		{ x: plusX,   y: yPadC, w: btnW, h: btnH, action: 'paddleSpeedUp'   },
		{ x: minusX,  y: yPadC, w: btnW, h: btnH, action: 'paddleSpeedDown' },
		// Create
		{ x: createX, y: createY, w: createW, h: createH, action: 'createTournament' },
		// Back
		{ x: backX,   y: backY,   w: backW,  h: backH, action: 'backToMenu' },
		// Join on right
		...joinButtons
	];
}


export function drawWaitingTournamentView(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	tournamentName: string,
	players: string[]
): void {
	const width  = canvas.width;
	const height = canvas.height;

	// Clear entire canvas
	ctx.clearRect(0, 0, width, height);

	// Background gradient (left → right: #2C5364 → #203A43 → #0F2027)
	const grad = ctx.createLinearGradient(0, 0, width, 0);
	grad.addColorStop(0.0, '#2C5364');
	grad.addColorStop(0.5, '#203A43');
	grad.addColorStop(1.0, '#0F2027');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	// Tournament title
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 15)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText(tournamentName, width / 2, height * 0.12);

	// Player list label
	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 28)}px Orbitron`;
	ctx.textAlign = 'left';
	const listX = width * 0.18;
	let currentY = height * 0.25;
	const lineHeight = height * 0.06;
	ctx.fillText('Participants:', listX, currentY);

	// List of players
	players.forEach((player, index) => {
		ctx.fillText(
			`• ${player}`,
			listX,
			currentY + lineHeight * (index + 1)
		);
	});

	// Leave Tournament button
	const btnW = width  * 0.25;
	const btnH = height * 0.08;
	const btnX = width  / 2 - btnW / 2;
	const btnY = height * 0.8;
	ctx.fillStyle = '#f87171';
	ctx.fillRect(btnX, btnY, btnW, btnH);

	ctx.fillStyle = 'white';
	ctx.font      = `${Math.floor(height / 22)}px Orbitron`;
	ctx.textAlign = 'center';
	ctx.fillText('Leave Tournament', width / 2, btnY + btnH * 0.65);

	// store the leave button for click handling
	(canvas as any)._waitingTournamentButtons = [
		{ x: btnX, y: btnY, w: btnW, h: btnH, action: 'leaveTournament' }
	];
}