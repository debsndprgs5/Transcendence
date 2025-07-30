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

export function showBallPositionsHeatmap() {
  const holder = document.getElementById('heatmap-holder');
  if (holder) holder.innerHTML = '<span class="text-indigo-600">[Ball Positions heatmap placeholder]</span>';
}

export function showWallBouncesHeatmap() {
  const holder = document.getElementById('heatmap-holder');
  if (holder) holder.innerHTML = '<span class="text-indigo-600">[Wall Bounces heatmap placeholder]</span>';
}

export function showPaddleBouncesHeatmap() {
  const holder = document.getElementById('heatmap-holder');
  if (holder) holder.innerHTML = '<span class="text-indigo-600">[Paddle Bounces heatmap placeholder]</span>';
}

export function showGoalsHeatmap(data: Array<{ x: number, y: number, value: number }>) {
  const holder = document.getElementById('heatmap-holder');
  if (!holder) return;
  data = fakeGoalsHeatmapData;      // a changer
  if (!Array.isArray(data) || data.length === 0) {
    holder.innerHTML = '<span class="text-gray-400">No goal data available.</span>';
    return;
  }
  const fieldW = 32, fieldH = 18;
  const canvasW = 480, canvasH = 270;
  holder.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = '100%';
  canvas.style.maxWidth = '600px';
  canvas.style.height = 'auto';
  canvas.className = 'rounded shadow border bg-gray-100';
  holder.appendChild(canvas);

  const toCanvas = (x: number, y: number) => [
    (x / fieldW) * canvasW,
    (y / fieldH) * canvasH
  ];

  const points: [number, number, number][] = data.map(d => {
    const [cx, cy] = toCanvas(d.x, d.y);
    return [cx, cy, d.value] as [number, number, number];
  });

  const heat = simpleheat(canvas);
  heat.data(points);
  heat.radius(18, 16); // rayon, blur
  heat.max(Math.max(...data.map(d => d.value)));
  heat.draw(0.7);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.globalAlpha = 0.6; // transparence du décor
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (0.1/fieldW)*canvasW,
      (0.1/fieldH)*canvasH,
      ((fieldW-0.2)/fieldW)*canvasW,
      ((fieldH-0.2)/fieldH)*canvasH
    );
    // Paddles
    const paddleW = 1.5, paddleH = 4.2;
    ctx.fillStyle = '#666';
    // Gauche
    ctx.fillRect(
      (1.2/fieldW)*canvasW,
      ((fieldH/2-paddleH/2)/fieldH)*canvasH,
      (paddleW/fieldW)*canvasW,
      (paddleH/fieldH)*canvasH
    );
    // Droite
    ctx.fillRect(
      ((fieldW-1.2-paddleW)/fieldW)*canvasW,
      ((fieldH/2-paddleH/2)/fieldH)*canvasH,
      (paddleW/fieldW)*canvasW,
      (paddleH/fieldH)*canvasH
    );
    ctx.restore();
  }
}
