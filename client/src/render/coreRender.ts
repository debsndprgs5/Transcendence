// coreRender.ts
import * as BABYLON from '@babylonjs/core';
import { state } from '../api';
import type { RendererCtx, Side } from './NEW_pong_render';
import { updateHUD } from './ui';

export type UpdatePayload = {
  paddles: Record<number, { pos: number; side: Side; score: number }>;
  balls:   Record<number, { x: number; y: number }>;
  elapsed: number;
  isPaused: boolean;
};

export function registerInput(ctx: RendererCtx) {
  const { scene, inputState } = ctx;

  const keydown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a') inputState.left  = true;
    if (k === 'd') inputState.right = true;
    // if (k === 'escape' || k === 'esc') {
    //   // your pause UI flow can go here later
    //   ctx.isPaused = true;
    //   if (state.playerInterface?.gameID && state.userId) {
    //     state.typedSocket.send('pause', { userID: state.userId, gameID: state.playerInterface.gameID });
    //   }
    // }
  };
  const keyup = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a') inputState.left  = false;
    if (k === 'd') inputState.right = false;
  };

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  // drive input each frame
  scene.onBeforeRenderObservable.add(() => {
    processInput(ctx);
  });
}

function sendMove(dir: 'left'|'right'|'stop') {
  if (state.playerInterface?.gameID !== undefined && state.userId !== undefined) {
    state.typedSocket.send('playerMove', {
      gameID: state.playerInterface.gameID,
      userID: state.userId,
      direction: dir,
    });
  }
}

function processInput(ctx: RendererCtx) {
  const { inputState, playerSide } = ctx;

  let dir: 'left'|'right'|'stop' =
    inputState.left === inputState.right ? 'stop'
    : inputState.left ? 'left' : 'right';

  // invert for right/bottom
  if ((playerSide === 'left' || playerSide === 'top') && dir !== 'stop') {
    dir = dir === 'left' ? 'right' : 'left';
  }

  // Always send (server handles 'stop' cheaply)
  sendMove(dir);
  ctx.currentDir = dir;
}

export function startRenderLoop(ctx: RendererCtx) {
  ctx.engine.runRenderLoop(() => {
    if (!ctx.scene) return;
    ctx.scene.render();
  });
}

export function attachResize(ctx: RendererCtx) {
  window.addEventListener('resize', () => ctx.engine.resize());
}

export function processNetworkUpdate(ctx: RendererCtx, update: UpdatePayload) {
  // paddles: move ROOTS so lights & children follow
  Object.values(update.paddles).forEach(({ side, pos }) => {
    const root = ctx.paddleRoots[side];
    if (!root) return;
    if (side === 'left' || side === 'right') {
      root.position.z = pos; // server Y -> our Z for H paddles
    } else {
      root.position.x = pos; // server X -> our X for V paddles
    }
  });

  // ball (with rolling/lighting)
  const firstBall = Object.values(update.balls)[0];
  if (firstBall && ctx.ballObj) applyBallKinetics(ctx, new BABYLON.Vector3(firstBall.x, 0, firstBall.y));

    // scores aggregation
  const scores: Partial<Record<Side, number>> = { left:0, right:0, top:0, bottom:0 };
  Object.values(update.paddles).forEach(({ side, score }) => {
    if (ctx.playerCount === 2 && (side === 'left' || side === 'right')) {
      scores[side] = score;
    } else if (ctx.playerCount === 4) {
      scores[side] = score;
    }
  });

  updateHUD(ctx, update.elapsed, scores);
}

// “smart ball” kinetic feel
function applyBallKinetics(ctx: RendererCtx, nextPosXZ: BABYLON.Vector3) {
  const b = ctx.ballObj; if (!b) return;
  const now = performance.now() * 0.001;
  let dt = now - b.lastTime;
  dt = BABYLON.Scalar.Clamp(dt, 1 / 120, 0.25);

  const p = b.root.position;
  const next = new BABYLON.Vector3(nextPosXZ.x, p.y, nextPosXZ.z);

  const delta = next.subtract(b.lastPos);
  const distance = delta.length();
  const speed = distance / Math.max(dt, 1e-6);

  const moveDir = distance > 1e-6 ? delta.scale(1 / distance) : BABYLON.Vector3.Zero();

  if (distance > 1e-4 && b.radius > 1e-4) {
    const axis = new BABYLON.Vector3(moveDir.z, 0, -moveDir.x);
    if (axis.lengthSquared() > 1e-8) {
      const angle = distance / b.radius;
      const q = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      b.root.rotationQuaternion = q.multiply(b.root.rotationQuaternion!);
    }
  }

  b.root.position.copyFrom(next);

  const t = BABYLON.Scalar.Clamp(speed / 15, 0, 2);
  b.light.intensity = (0.6 + 0.8 * t) * 2;

  const stretch = 1 + 0.06 * t;
  const squash  = 1 / Math.sqrt(stretch);
  const sx = 1 + (stretch - 1) * Math.abs(moveDir.x);
  const sz = 1 + (stretch - 1) * Math.abs(moveDir.z);
  b.root.scaling.set(sx, squash, sz);

  b.lastPos.copyFrom(next);
  b.lastTime = now;
}
