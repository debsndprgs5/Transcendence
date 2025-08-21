// ui.ts
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { RendererCtx, Side } from './pong_render';
import { state } from '../api';
import { showNotification } from '../notifications';
import { handleLeaveTournament } from '../tournament_rooms';

// ---------- layout constants ----------
const STRIP_HEIGHT = 72;   // px
const STRIP_ALPHA  = 0.62; // translucency (scene visible behind)
const STRIP_RADIUS = 14;

// ---------- helpers ----------
const rgba = (a: number) => `rgba(0,0,0,${a})`;
const avatarCache = new Map<string, string>();
type GridDef = { px?: number; star?: number };


async function resolveAvatarURL(username: string): Promise<string> {
  if (avatarCache.has(username)) return avatarCache.get(username)!;

  // Try backend
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/avatar`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json() as { avatar_url?: string };
      if (json?.avatar_url) {
        avatarCache.set(username, json.avatar_url);
        return json.avatar_url;
      }
    }
  } catch {
    /* ignore; fall through to Dicebear */
  }

  // Fallback: Dicebear (same logic you used before)
  const style = /^\d+$/.test(username) ? 'bottts' : 'initials';
  const url =
    `https://api.dicebear.com/9.x/${style}/svg` +
    `?seed=${encodeURIComponent(username)}` +
    `&backgroundType=gradientLinear` +
    `&backgroundColor=919bff,133a94` +
    `&size=64` +
    `&radius=50`;

  avatarCache.set(username, url);
  return url;
}

// Round “avatar holder” that clips its child image to a circle
function makeAvatarHolder(size = 34): GUI.Rectangle {
  const r = new GUI.Rectangle();
  r.width = `${size}px`;
  r.height = `${size}px`;
  r.thickness = 0;
  r.cornerRadius = size / 2;
  r.clipChildren = true;
  r.background = 'transparent';
  return r;
}

async function setAvatarInto(holder: GUI.Rectangle, username: string) {
  const url = await resolveAvatarURL(username);
  holder.clearControls();
  const img = new GUI.Image(`avatar-${username}`, url);
  img.stretch = GUI.Image.STRETCH_UNIFORM; // fill the circle
  img.width = "100%";
  img.height = "100%";
  holder.addControl(img);
}

function makeGrid(
  cols: GridDef[],
  rows: GridDef[] = [{ star: 1 }]
) {
  const grid = new GUI.Grid();
  cols.forEach(c => grid.addColumnDefinition(c.px ?? (c.star ?? 1), !!c.px));
  rows.forEach(r => grid.addRowDefinition(r.px ?? (r.star ?? 1), !!r.px));
  grid.width = "100%";
  grid.height = "100%";
  return grid;
}

function makeStrip(adt: GUI.AdvancedDynamicTexture, align: 'top' | 'bottom') {
  const rect = new GUI.Rectangle(`strip-${align}`);
  rect.width = "96%";
  rect.height = `${STRIP_HEIGHT}px`;
  rect.thickness = 0;
  rect.background = rgba(STRIP_ALPHA);
  rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  rect.verticalAlignment = align === 'top'
    ? GUI.Control.VERTICAL_ALIGNMENT_TOP
    : GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  rect.cornerRadius = STRIP_RADIUS;
  rect.zIndex = 100;
  adt.addControl(rect);
  return rect;
}



function label(text: string, size = 16, color = '#fff', weight: string = 'normal', hpx?: number) {
  const t = new GUI.TextBlock();
  t.text = text;
  t.color = color;
  t.fontSize = size;
  t.fontWeight = weight;
  t.height = `${hpx ?? Math.round(size * 1.6)}px`;
  t.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  t.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  t.resizeToFit = false;
  t.textWrapping = GUI.TextWrapping.Clip;
  return t;
}


function makeChip(side: Side, username: string) {
  const container = new GUI.Rectangle(`chip-${side}`);
  container.height = '48px';
  container.width  = '100%';
  container.thickness = 0;
  container.background = 'rgba(255,255,255,0.06)';
  container.cornerRadius = 12;
  container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  container.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

  const grid = makeGrid([{ px: 48 }, { star: 1 }]);
  grid.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  grid.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  container.addControl(grid);

  // avatar holder (clips child to a circle)
  const avatarHolder = makeAvatarHolder(34);
  grid.addControl(avatarHolder, 0, 0);

  const stack = new GUI.StackPanel();
  stack.isVertical = true;
  stack.paddingLeft = '10px';
  stack.width = '100%';
  grid.addControl(stack, 0, 1);

  const name  = label(username || side.toUpperCase(), 20, '#FFFFFF', '600', 24);
  const score = label('Score: 0', 14, '#CFE6FF', 'normal', 18);
  name.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  score.alpha = 0.95;

  stack.addControl(name);
  stack.addControl(score);

  return { container, avatarHolder, name, score };
}

// ---------- public API ----------
export function setupGUI(ctx: RendererCtx) {
  const adt = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, ctx.scene);

  // Lock GUI layout to a virtual canvas height.
  // adt.idealHeight = 720;
  // adt.renderAtIdealSize = true;
  


  // Strips
  const top = makeStrip(adt, 'top');
  const bot = makeStrip(adt, 'bottom');

  top.isHitTestVisible = false;
  bot.isHitTestVisible = false;

  // TOP: [ LeftChip | spacer* | center* (GameName : Time) | RightChip | Leave(px) ]
  const topGrid = makeGrid([
    { px: 150 },
    { px: 10 },
    { star: 1 },
    { px: 150 },
    { px: 80 },
  ]);
  top.addControl(topGrid);

  // BOTTOM: [ BottomChip | spacer* | Scoreboard* | spacer* | TopChip ]
  const botGrid = makeGrid([
    { px: 150 },
    { px: 10 },
    { star: 1 },
    { px: 10 },
    { px: 150 },
  ]);
  bot.addControl(botGrid);

  // Chips
  const chips: Partial<Record<Side, ReturnType<typeof makeChip>>> = {};
  const uname = ctx.playersInfo;

  chips.left   = makeChip('left',   uname.left);
  chips.right  = makeChip('right',  uname.right);
  chips.top    = makeChip('top',    uname.top);
  chips.bottom = makeChip('bottom', uname.bottom);

  // Load avatars (fire-and-forget)
  (async () => {
    const map: Array<[Side, string | undefined]> = [
      ['left',   uname.left],
      ['right',  uname.right],
      ['top',    uname.top],
      ['bottom', uname.bottom],
    ];
    for (const [side, u] of map) {
      if (!u) continue;
      const chip = chips[side];
      if (!chip) continue;
      setAvatarInto(chip.avatarHolder, u);
    }
  })();

  // Place chips
  topGrid.addControl(chips.left!.container,   0, 0);
  topGrid.addControl(chips.right!.container,  0, 3);
  botGrid.addControl(chips.bottom!.container, 0, 0);
  botGrid.addControl(chips.top!.container,    0, 4);

  // Center cluster: GameName : Time
  const center = new GUI.StackPanel();
  center.isVertical = false;
  center.spacing = 1;
  center.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  center.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

  const gameName = label(ctx.gameName ?? 'Match', 18, '#EAF2FF', '600');
  const sep      = label(':', 18, '#EAF2FF', '600');
  const timeTxt  = label("0:00's", 18, '#FFFFFF', 'normal');

  // [gameName, sep, timeTxt].forEach(t => {
  //   t.width = 'auto';
  //   t.resizeToFit = true;
  // });

  center.addControl(gameName);
  center.addControl(sep);
  center.addControl(timeTxt);
  topGrid.addControl(center, 0, 2);

  // Leave button
  const leave = GUI.Button.CreateSimpleButton('leave-btn', 'Leave');
  leave.width = '80px';              // matches topGrid { px: 80 }
  leave.height = '38px';
  leave.color = '#fff';
  leave.fontSize = 16;
  leave.cornerRadius = 10;
  leave.thickness = 0;
  leave.background = '#DC4646';

  leave.isPointerBlocker = true;
  leave.zIndex = 1000;           // above siblings in the strip
  leave.hoverCursor = 'pointer'; // useful sanity check

  //DEBUG
  leave.onPointerEnterObservable.add(() => console.debug('[UI] leave: enter'));
  leave.onPointerDownObservable.add(() => console.debug('[UI] leave: down'));
  leave.onPointerUpObservable.add(() => console.debug('[UI] leave: up'));
  
  leave.onPointerUpObservable.add(() => {
    const player = state.playerInterface;
		//Local game: no server player => tell the host to leave
		if (ctx.isLocal === true) {
			window.dispatchEvent(new CustomEvent('pong:local-leave'));
			return;
		}

    if (ctx.isPaused){ 
      console.warn('[PAUSE] cliked pause on a paused game');
      return;
    }
    ctx.isPaused = true;

    state.typedSocket.send('pause', {
      userID: state.userId,
      gameID: player!.gameID
    });

    showNotification({
      type: 'confirm',
      message: 'Do you really want to leave the game?',
      onConfirm: async () => {
        state.typedSocket.send('leaveGame', {
          userID: state.userId!,
          gameID: player!.gameID,
          isLegit: false,
        });

        if (state.playerInterface!.tournamentID) {
          const tourID = state.playerInterface!.tournamentID;
          state.typedSocket.send('leaveTournament', {
            userID: state.userId!,
            tournamentID: tourID,
            islegit: false,
            duringGame: true
          });
          handleLeaveTournament(false, true);
        }
      },
      onCancel: () => {
        state.typedSocket.send('resume', {
          userID: state.userId,
          gameID: player!.gameID
        });
        ctx.isPaused = false;
      },
    });
    
  });
  topGrid.addControl(leave, 0, 4);


  // Bottom center scoreboard (we’ll fill it from updateHUD)
  const scoreboard = label('', 16, '#E6F0FF');
  scoreboard.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  scoreboard.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  botGrid.addControl(scoreboard, 0, 2);

  // 2P / 4P visibility
  const is4 = ctx.playerCount === 4;
  chips.top!.container.isVisible    = is4;
  chips.bottom!.container.isVisible = is4;

  // Store refs on ctx 
  ctx.ui = {
    adt,
    topBar: top,
    bottomBar: bot,
    timeText: timeTxt,
    gameNameText: gameName,
    leaveBtn: leave,
    chips: {
      left:   chips.left!,
      right:  chips.right!,
      top:    chips.top!,
      bottom: chips.bottom!,
    },
    scoreboard,
  };
}

export function setupPauseUI(ctx: RendererCtx) {
  if (!ctx.ui) return; // make sure setupGUI ran first

  const banner = new GUI.Rectangle("pauseBanner");
  banner.width = "360px";
  banner.height = "72px";
  banner.thickness = 0;
  banner.cornerRadius = 14;
  banner.background = "rgba(0,0,0,0.70)";
  banner.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  banner.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  banner.zIndex = 900;
  banner.isVisible = false; // start hidden

  const txt = new GUI.TextBlock();
  txt.text = "Game is paused";
  txt.color = "#FFFFFF";
  txt.fontSize = 24;
  txt.fontWeight = "700";
  txt.height = "36px"; // px to avoid StackPanel warnings
  banner.addControl(txt);

  ctx.ui.adt.addControl(banner);
  // stash a ref so we can toggle it later
  (ctx.ui as any).pauseBanner = banner;
}

export function setupWaitingUI(ctx: RendererCtx) {
  if (!ctx.ui) return; // ensure setupGUI ran

  const banner = new GUI.Rectangle("waitingBanner");
  banner.width = "360px";
  banner.height = "72px";
  banner.thickness = 0;
  banner.cornerRadius = 14;
  banner.background = "rgba(0,0,0,0.70)";
  banner.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  banner.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  banner.zIndex = 900;
  banner.isVisible = false;

  const txt = new GUI.TextBlock();
  txt.text = "Game hasn't started yet";
  txt.color = "#FFFFFF";
  txt.fontSize = 22;
  txt.fontWeight = "700";
  txt.height = "36px";
  banner.addControl(txt);

  ctx.ui.adt.addControl(banner);
  // store a ref (add to your MY_UI type if you want it typed)
  (ctx.ui as any).waitingBanner = banner;
}

export function updateWaitingUI(ctx: RendererCtx, waiting: boolean) {
  const b = (ctx.ui as any)?.waitingBanner as GUI.Rectangle | undefined;
  if (b) b.isVisible = waiting;
}

export function updatePauseUI(ctx: RendererCtx) {

  
  const banner = (ctx.ui as any)?.pauseBanner as GUI.Rectangle | undefined;
  if (banner){
    banner.isVisible = ctx.isPaused;
  }
}


export function updateHUD(
  ctx: RendererCtx,
  elapsedSeconds: number,
  scores: Partial<Record<Side, number>>
) {
  const ui = ctx.ui;
  if (!ui) return;

  ui.timeText.text = `${elapsedSeconds.toFixed(1)} 's`;

  // Per-chip scores
  (['left','right','top','bottom'] as Side[]).forEach(side => {
    const chip = ui.chips[side];
    if (!chip) return;
    const val = scores[side] ?? 0;
    chip.score.text = `Score: ${val}`;
  });

  // Leaderboard: show only the top scorer.
  // If tie, show first 2 chars of each tied username + score.
  const sides: Side[] = ctx.playerCount === 2
    ? ['left', 'right']
    : ['left', 'right', 'top', 'bottom'];

  const candidates = sides.map(side => ({
    side,
    uname: (ctx.playersInfo?.[side] ?? side.toUpperCase()),
    score: scores[side] ?? 0,
  }));

  const maxScore = Math.max(...candidates.map(c => c.score));
  const winners = candidates.filter(c => c.score === maxScore);

  let text: string;
  if (winners.length <= 1) {
    const w = winners[0] ?? candidates[0];
    text = `First :${w.uname} has ${w.score} points`;
  } else {
    text = `TIE: ${winners[0].score} points for :`
    text += winners
        .map(w => `${(w.uname || '')}`)
      .join(' & ');
  }

  ui.scoreboard.text = text;
  updatePauseUI(ctx);
}

