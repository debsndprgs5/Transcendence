export const localGameFormData = {
  ballSpeed:    50,
  paddleSpeed:  50,
  winningScore: 5
};

/** Draw the menu every frame while canvasView === "localGameConfig" */
export function drawLocalGameView(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const w = canvas.width;
  const h = canvas.height;
  const wrapper = canvas.parentElement!;

  // Clean any DOM leftovers
  wrapper.querySelectorAll(".menubtn_button").forEach(el => el.remove());

  // Clear the canvas
  ctx.clearRect(0, 0, w, h);

  //------------------ Title -----------------------------------
  ctx.fillStyle = "white";
  ctx.font      = `${Math.floor(h / 15)}px Orbitron`;
  ctx.textAlign = "center";
  ctx.fillText("LOCAL GAME", w / 2, h * 0.08);

  //------------------ Layout helpers --------------------------
  const labelX = w * 0.18;
  const valueX = w * 0.48;
  const rowY   = (i: number) => h * (0.22 + i * 0.10);

  ctx.fillStyle = "white";
  ctx.font      = `${Math.floor(h / 28)}px Orbitron`;
  ctx.textAlign = "left";

  //------------------ Row 0: Ball Speed -----------------------
  ctx.fillText("Ball speed:", labelX, rowY(0));
  ctx.fillText(String(localGameFormData.ballSpeed), valueX, rowY(0));

  //------------------ Row 1: Paddle Speed ---------------------
  ctx.fillText("Paddle speed:", labelX, rowY(1));
  ctx.fillText(String(localGameFormData.paddleSpeed), valueX, rowY(1));

  //------------------ Row 2: Winning Score --------------------
  ctx.fillText("Winning score:", labelX, rowY(2));
  ctx.fillText(String(localGameFormData.winningScore), valueX, rowY(2));

  //------------------ +/- buttons -----------------------------
  const btnW   = w * 0.06;
  const btnH   = h * 0.06;
  const plusX  = valueX + w * 0.10;
  const minusX = valueX + w * 0.18;

  const yBall  = rowY(0) - btnH / 2;
  const yPad   = rowY(1) - btnH / 2;
  const yScore = rowY(2) - btnH / 2;

  ctx.fillStyle = "#38bdf8";
  [yBall, yPad, yScore].forEach(y => {
    ctx.fillRect(plusX,  y, btnW, btnH);   // +
    ctx.fillRect(minusX, y, btnW, btnH);   // -
  });

  ctx.fillStyle = "black";
  ctx.font      = `${Math.floor(h / 28)}px Orbitron`;
  ctx.textAlign = "center";
  ctx.fillText("+", plusX  + btnW / 2, yBall  + btnH * 0.7);
  ctx.fillText("-", minusX + btnW / 2, yBall  + btnH * 0.7);
  ctx.fillText("+", plusX  + btnW / 2, yPad   + btnH * 0.7);
  ctx.fillText("-", minusX + btnW / 2, yPad   + btnH * 0.7);
  ctx.fillText("+", plusX  + btnW / 2, yScore + btnH * 0.7);
  ctx.fillText("-", minusX + btnW / 2, yScore + btnH * 0.7);

  //------------------ Confirm & Back buttons ------------------
  const confirmW = w * 0.23;
  const confirmH = h * 0.10;
  const confirmX = w / 2 - confirmW / 2;
  const confirmY = h * 0.85 - confirmH;

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(confirmX, confirmY, confirmW, confirmH);

  ctx.fillStyle = "black";
  ctx.font      = `${Math.floor(h / 22)}px Orbitron`;
  ctx.fillText("Start", w / 2, confirmY + confirmH * 0.65);

  const backW = w * 0.18;
  const backH = h * 0.08;
  const backX = w * 0.05;
  const backY = h * 0.05;

  ctx.fillStyle = "#f87171";
  ctx.fillRect(backX, backY, backW, backH);

  ctx.fillStyle = "white";
  ctx.font      = `${Math.floor(h / 32)}px Orbitron`;
  ctx.fillText("← Back", backX + backW / 2, backY + backH * 0.62);

  //------------------ Store clickable areas -------------------
  (canvas as any)._localGameButtons = [
    // ball
    { x: plusX,  y: yBall,  w: btnW, h: btnH, action: "ballSpeedUp" },
    { x: minusX, y: yBall,  w: btnW, h: btnH, action: "ballSpeedDown" },
    // paddle
    { x: plusX,  y: yPad,   w: btnW, h: btnH, action: "paddleSpeedUp" },
    { x: minusX, y: yPad,   w: btnW, h: btnH, action: "paddleSpeedDown" },
    // score
    { x: plusX,  y: yScore, w: btnW, h: btnH, action: "scoreUp" },
    { x: minusX, y: yScore, w: btnW, h: btnH, action: "scoreDown" },
    // confirm & back
    { x: confirmX, y: confirmY, w: confirmW, h: confirmH, action: "startLocalGame" },
    { x: backX,    y: backY,    w: backW,    h: backH,    action: "backToMenu" }
  ];
}

/** One‑time set‑up: attach listeners exactly once */
export function initLocalGameView(
  canvas: HTMLCanvasElement,
  onStart: (cfg: typeof localGameFormData) => void,
  onBack: () => void
): void {
  const rect   = () => canvas.getBoundingClientRect();
  const within = (mx: number, my: number, b: any) =>
    mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;

  const toLocal = (e: MouseEvent) => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener("mousedown", e => {
    const pos = toLocal(e);
    const btns = (canvas as any)._localGameButtons as any[] | undefined;
    if (!btns) return;

    for (const b of btns) {
      if (!within(pos.x, pos.y, b)) continue;

      switch (b.action) {
        case "ballSpeedUp":    localGameFormData.ballSpeed    += 1; break;
        case "ballSpeedDown":  localGameFormData.ballSpeed    -= 1; break;
        case "paddleSpeedUp":  localGameFormData.paddleSpeed  += 1; break;
        case "paddleSpeedDown":localGameFormData.paddleSpeed  -= 1; break;
        case "scoreUp":        localGameFormData.winningScore += 1; break;
        case "scoreDown":      localGameFormData.winningScore -= 1; break;
        case "startLocalGame": onStart({ ...localGameFormData });   break;
        case "backToMenu":     onBack();                            break;
      }

      // Clamp values
      localGameFormData.ballSpeed    = Math.max(10, Math.min(100, localGameFormData.ballSpeed));
      localGameFormData.paddleSpeed  = Math.max(10, Math.min(100, localGameFormData.paddleSpeed));
      localGameFormData.winningScore = Math.max(1,  Math.min(15,  localGameFormData.winningScore));

      e.preventDefault();
      return;
    }
  });
}