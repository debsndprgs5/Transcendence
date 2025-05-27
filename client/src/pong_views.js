import { createGameFormData } from './pong_rooms.js'


export function drawCreateGameView(canvas, ctx) {

	const width = canvas.width;
	const height = canvas.height;

	ctx.clearRect(0, 0, width, height);

	// Background
	ctx.fillStyle = "#0f172a";
	ctx.fillRect(0, 0, width, height);

	ctx.fillStyle = "white";
	ctx.font = `${Math.floor(height/15)}px Orbitron`;
	ctx.textAlign = "center";
	ctx.fillText("CREATE GAME", width / 2, height * 0.12);

	// Labels
	ctx.font = `${Math.floor(height/28)}px Orbitron`;
	ctx.textAlign = "left";
	const labelX = width * 0.20;
	ctx.fillText("Room name:", labelX, height * 0.25);
	ctx.fillText("Ball speed:", labelX, height * 0.40);
	ctx.fillText("Paddle speed:", labelX, height * 0.55);

	// Current values (inputs simulés)
	const valueX = width * 0.44;
	ctx.textAlign = "left";
	ctx.fillText(createGameFormData.roomName || "________", valueX, height * 0.25);
	ctx.fillText(`${createGameFormData.ballSpeed}`, valueX, height * 0.40);
	ctx.fillText(`${createGameFormData.paddleSpeed}`, valueX, height * 0.55);

	// Buttons (+/-)
	const btnW = width * 0.06, btnH = height * 0.06;
	const plusX = valueX + width * 0.10;
	const minusX = valueX + width * 0.19;
	const yBall = height * 0.40 - btnH/2;
	const yPad = height * 0.55 - btnH/2;

	// Ball speed buttons
	ctx.fillStyle = "#38bdf8";
	ctx.fillRect(plusX, yBall, btnW, btnH); // +
	ctx.fillRect(minusX, yBall, btnW, btnH); // -

	// Paddle speed buttons
	ctx.fillRect(plusX, yPad, btnW, btnH); // +
	ctx.fillRect(minusX, yPad, btnW, btnH); // -

	ctx.fillStyle = "black";
	ctx.font = `${Math.floor(height/28)}px Orbitron`;
	ctx.textAlign = "center";
	ctx.fillText("+", plusX + btnW/2, yBall + btnH*0.70);
	ctx.fillText("-", minusX + btnW/2, yBall + btnH*0.70);
	ctx.fillText("+", plusX + btnW/2, yPad + btnH*0.70);
	ctx.fillText("-", minusX + btnW/2, yPad + btnH*0.70);

	// Submit button
	const confirmW = width * 0.23, confirmH = height * 0.10;
	const confirmX = width / 2 - confirmW/2;
	const confirmY = height * 0.72;
	ctx.fillStyle = "#22c55e";
	ctx.fillRect(confirmX, confirmY, confirmW, confirmH);
	ctx.fillStyle = "black";
	ctx.textAlign = "center";
	ctx.font = `${Math.floor(height/22)}px Orbitron`;
	ctx.fillText("Confirm", width / 2, confirmY + confirmH*0.65);

	// "Back" button
	const backW = width * 0.18, backH = height * 0.08;
	const backX = width * 0.08;
	const backY = height * 0.05;
	ctx.fillStyle = "#f87171"; // rouge clair
	ctx.fillRect(backX, backY, backW, backH);
	ctx.fillStyle = "white";
	ctx.font = `${Math.floor(height/32)}px Orbitron`;
	ctx.textAlign = "center";
	ctx.fillText("← Back", backX + backW/2, backY + backH*0.62);


	canvas._createGameButtons = [
		{ x: plusX, y: yBall, w: btnW, h: btnH, action: "ballSpeedUp" },
		{ x: minusX, y: yBall, w: btnW, h: btnH, action: "ballSpeedDown" },
		{ x: plusX, y: yPad, w: btnW, h: btnH, action: "paddleSpeedUp" },
		{ x: minusX, y: yPad, w: btnW, h: btnH, action: "paddleSpeedDown" },
		{ x: confirmX, y: confirmY, w: confirmW, h: confirmH, action: "confirmGame" },
		{ x: backX, y: backY, w: backW, h: backH, action: "backToMenu" }
	];
}