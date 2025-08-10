// ui.ts
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { RendererCtx } from './NEW_pong_render';

export function setupGUI(_ctx: RendererCtx) {
  // TODO: scoreboard, avatars, etc.
  // const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, ctx.scene);
  // save refs in ctx if needed
}

export function setupPauseUI(ctx: RendererCtx) {
  const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('pauseUI', true, ctx.scene);
  const container = new GUI.Rectangle();
  container.width = '100%';
  container.height = '100%';
  container.background = 'rgba(0, 0, 0, 0.5)';
  container.thickness = 0;
  container.isVisible = false;

  ui.addControl(container);
  ctx.pauseUI = { container };
}
