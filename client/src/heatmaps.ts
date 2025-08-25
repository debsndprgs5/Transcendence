import simpleheat from 'simpleheat';
const fakeGoalsHeatmapData = [
    { x: 4, y: 9, value: 1 },
    { x: 4, y: 10, value: 1 },
    { x: 4, y: 11, value: 1 },
    { x: 4, y: 12, value: 1 },
    { x: 4, y: 13, value: 1 },
    { x: 4, y: 14, value: 1 },
    { x: 4, y: 15, value: 1 },
    { x: 2, y: 9, value: 1 },
    { x: 2, y: 9, value: 1 },
    { x: 2, y: 9, value: 1 },
    { x: 2, y: 9, value: 1 },
    { x: 2, y: 9, value: 1 },
    // { x: 2, y: 8.5, value: 2 },
    // { x: 2, y: 8, value: 3 },
    // { x: 2, y: 7.5, value: 4 },
    // { x: 2, y: 7, value: 5 },
    // { x: 2, y: 6.5, value: 6 },
    // { x: 2, y: 6, value: 7 },
    // { x: 2, y: 5.5, value: 8 },
    // { x: 2, y: 5, value: 9 },
    // { x: 2, y: 4.5, value: 10 },
    // { x: 2, y: 4, value: 11 },
    // { x: 2, y: 3.5, value: 12 },
    // { x: 2, y: 3, value: 13 },
    // { x: 2, y: 2.5, value: 14 },
    // { x: 2, y: 2, value: 15 },
    // { x: 2, y: 1.5, value: 16 },
    // { x: 2, y: 1, value: 17 },
    // { x: 2, y: 0.5, value: 18 },
    { x: 4, y: 8, value: 19 },
];

export function showWallBouncesHeatmap(data?: Array<{ x: number; y: number; value: number }>) {
  // If caller passes data use it, otherwise show empty placeholder
  showHeatmap(data ?? [], 'wall');
}

export function showPaddleBouncesHeatmap(data?: Array<{ x: number; y: number; value: number }>) {
  showHeatmap(data ?? [], 'paddle');
}

export function showGoalsHeatmap(data?: Array<{ x: number, y: number, value: number }>) {
  showHeatmap(data ?? [], 'goals');
}

let _canvas: HTMLCanvasElement | null = null;
let _heat: any = null;
const FIELD_W = 32, FIELD_H = 18;
const CANVAS_W = 480, CANVAS_H = 270;

function ensureCanvas(): HTMLCanvasElement | null {
  // if (_canvas)
  // {
  //   console.log('Reusing existing canvas element');
  //   return _canvas;
  // }
  const holder = document.getElementById('heatmap-holder');
  if (!holder)
  {
    console.error('No heatmap-holder element found in DOM');
    return null;
  }
  holder.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = '100%';
  canvas.style.maxWidth = '600px';
  canvas.style.height = 'auto';
  canvas.className = 'rounded shadow border bg-gray-100';
  holder.appendChild(canvas);
  _canvas = canvas;
  try {
    _heat = simpleheat(canvas as any);
  } catch (e) {
    // ignore; will recreate on render
    console.log('simpleheat failed to initialize', e);
    _heat = null;
  }
  return _canvas;
}

export function showHeatmap(data: Array<{ x: number; y: number; value: number }>, type: string = 'generic') {
  const canvas = ensureCanvas();
  const holder = document.getElementById('heatmap-holder');
  if (!holder || !canvas)
  {
    console.error('No heatmap-holder element found in DOM');
    return;
  }

  if (!Array.isArray(data) || data.length === 0) {
    holder.innerHTML = '<span class="text-gray-400">No data available for this heatmap.</span>';
    // keep canvas element removed so next non-empty call recreates it
    _canvas = null;
    _heat = null;
    return;
  }

  // compute canvas points from field coords
  const toCanvas = (x: number, y: number) => [
    (x / FIELD_W) * CANVAS_W,
    (y / FIELD_H) * CANVAS_H
  ];

  const points: [number, number, number][] = data.map(d => {
    const [cx, cy] = toCanvas(d.x, d.y);
    return [cx, cy, d.value] as [number, number, number];
  });

  if (!_heat) {
    try {
      _heat = simpleheat(canvas as any);
    } catch (e) {
      console.error('simpleheat failed to initialize', e);
      return;
    }
  }

  _heat.data(points);
  _heat.radius(16, 15);
  _heat.max(Math.max(...data.map(d => d.value)));
  _heat.draw(0.7);

  // draw decorations over the heatmap (borders, paddles)
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (0.1 / FIELD_W) * CANVAS_W,
      (0.1 / FIELD_H) * CANVAS_H,
      ((FIELD_W - 0.2) / FIELD_W) * CANVAS_W,
      ((FIELD_H - 0.2) / FIELD_H) * CANVAS_H
    );
    const paddleW = 1.5, paddleH = 4.2;
    ctx.fillStyle = '#666';
    // left
    ctx.fillRect(
      (1.2 / FIELD_W) * CANVAS_W,
      ((FIELD_H / 2 - paddleH / 2) / FIELD_H) * CANVAS_H,
      (paddleW / FIELD_W) * CANVAS_W,
      (paddleH / FIELD_H) * CANVAS_H
    );
    // right
    ctx.fillRect(
      ((FIELD_W - 1.2 - paddleW) / FIELD_W) * CANVAS_W,
      ((FIELD_H / 2 - paddleH / 2) / FIELD_H) * CANVAS_H,
      (paddleW / FIELD_W) * CANVAS_W,
      (paddleH / FIELD_H) * CANVAS_H
    );
    ctx.restore();
  }
}

export function gameToHeatmap2p(
  gameX: number,
  gameZ: number,
  fieldW = 32,
  fieldH = 18
): { x: number; y: number } {
  const arenaW = 32;
  const arenaL = 18;
  const wallLength = 0.25; // side wall thickness along X
  const wallDepth = 0.5;   // front/back wall thickness along Z

  // interior bounds (space usable for ball centers)
  const minX = -arenaW / 2 + wallLength; // -15.75
  const maxX = arenaW / 2 - wallLength;  //  15.75
  const minZ = -arenaL / 2 + wallDepth;  // -8.5
  const maxZ = arenaL / 2 - wallDepth;   //  8.5

  // clamp to interior
  const cx = Math.max(minX, Math.min(maxX, gameX));
  const cz = Math.max(minZ, Math.min(maxZ, gameZ));

  // normalized [0..1]
  const nx = (cx - minX) / (maxX - minX);
  const nz = (cz - minZ) / (maxZ - minZ);

  // map to heatmap field coordinates
  const hx = nx * fieldW;
  const hy = nz * fieldH;
  return { x: hx, y: hy };
}

