// ui.ts
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { RendererCtx, Side } from './NEW_pong_render';

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
    const res = await fetch(`/users/${encodeURIComponent(username)}/avatar`, { credentials: 'include' });
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



// ---------- UI refs stored per scene ----------
type UIRefs = {
	adt: GUI.AdvancedDynamicTexture;
	topBar: GUI.Rectangle;
	bottomBar: GUI.Rectangle;
	timeText: GUI.TextBlock;
	gameNameText: GUI.TextBlock;
	leaveBtn: GUI.Button;
	chips: Partial<Record<Side, {
		container: GUI.Rectangle;
		avatarHolder: GUI.Rectangle;
		name: GUI.TextBlock;
		score: GUI.TextBlock;
	}>>;
	scoreboard: GUI.TextBlock;
};

const UI = new WeakMap<BABYLON.Scene, UIRefs>();

// ---------- public API ----------
export function setupGUI(ctx: RendererCtx) {
	const adt = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, ctx.scene);
	// Make GUI crisp on HiDPI and when engine uses hardware scaling.
	const dpr = window.devicePixelRatio || 1;
	const hw  = ctx.scene.getEngine().getHardwareScalingLevel(); // often 1/dpr
	adt.renderScale = Math.max(1, Math.round(dpr / hw));


	// Strips
	const top = makeStrip(adt, 'top');
	const bot = makeStrip(adt, 'bottom');

	// TOP: [ LeftChip | spacer* | center* (GameName : Time) | RightChip | Leave(px) ]
	const topGrid = makeGrid([
		{ px: 150 },
		{ star: 1 },
		{ star: 1 },
		{ px: 150 },
		{ px: 80 },
	]);
	top.addControl(topGrid);

	// BOTTOM: [ BottomChip | spacer* | Scoreboard* | spacer* | TopChip ]
	const botGrid = makeGrid([
		{ px: 150 },
		{ star: 1 },
		{ star: 1 },
		{ star: 1 },
		{ px: 150 },
	]);
	bot.addControl(botGrid);

	// Chips
	const chips: UIRefs['chips'] = {};
	const uname = ctx.playersInfo;

	chips.left   = makeChip('left',   uname.left);
	chips.right  = makeChip('right',  uname.right);
	chips.top    = makeChip('top',    uname.top);
	chips.bottom = makeChip('bottom', uname.bottom);

	// Kick off avatar loads (fire-and-forget)
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
	topGrid.addControl(chips.left!.container,  0, 0);
	topGrid.addControl(chips.right!.container, 0, 3);
	botGrid.addControl(chips.bottom!.container, 0, 0);
	botGrid.addControl(chips.top!.container,    0, 4);

	// Center cluster: GameName : Time
	const center = new GUI.StackPanel();
	center.isVertical = false;
	center.spacing = 1;
	center.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	center.verticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

	const gameName = label(ctx.gameName ?? 'Match', 18, '#EAF2FF', '600');
	const sep = label(':', 18, '#EAF2FF', '600');
	const timeTxt = label("0:00's", 18, '#FFFFFF', 'normal');
	[gameName, sep, timeTxt].forEach(t => {
		t.width = 'auto';
		t.resizeToFit = true;
	});
	center.addControl(gameName);
	center.addControl(sep);
	center.addControl(timeTxt);

	topGrid.addControl(center, 0, 2);

	// Leave button
	const leave = GUI.Button.CreateSimpleButton('leave-btn', 'Leave');
	leave.width = '110px';
	leave.height = '38px';
	leave.color = '#fff';
	leave.fontSize = 16;
	leave.cornerRadius = 10;
	leave.thickness = 0;
	leave.background = '#DC4646';
	leave.onPointerUpObservable.add(() => {
		//show a confirm UI + pause the game.
		window.dispatchEvent(new CustomEvent('game:leave-click'));
	});
	topGrid.addControl(leave, 0, 4);

	// Bottom center scoreboard
	const scoreboard = label('', 16, '#E6F0FF');
	scoreboard.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	scoreboard.textVerticalAlignment   = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	botGrid.addControl(scoreboard, 0, 2);

	// Initial 2P / 4P visibility
	const is4 = ctx.playerCount === 4;
	chips.top!.container.isVisible = is4;
	chips.bottom!.container.isVisible = is4;

	// Store refs per scene
	UI.set(ctx.scene, {
		adt,
		topBar: top,
		bottomBar: bot,
		timeText: timeTxt,
		gameNameText: gameName,
		leaveBtn: leave,
		chips,
		scoreboard,
	});
}

export function updateHUD(
	ctx: RendererCtx,
	elapsedSeconds: number,
	scores: Partial<Record<Side, number>>
) {
	const ui = UI.get(ctx.scene);
	if (!ui) return;

	// Time
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
}

