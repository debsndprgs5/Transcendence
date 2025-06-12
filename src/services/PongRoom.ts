import * as G from '../shared/gameTypes'
import { paddleClass, ballClass } from '../types/game'
import { createTypedEventSocket } from '../shared/gameEventWrapper'
import {
	paddleSize,
	paddleWidth,
	arenaLength2p,
	arenaWidth2p,
	arenaWidth4p,
	arenaLength4p,
	ballSize,
}     from '../shared/gameTypes'

/**
 * A lightweight container for one running Pong match.
 */
export class PongRoom {
	public static rooms = new Map<number, PongRoom>()

	private readonly game: G.gameRoomInterface & { ballSpeed: number; paddleSpeed: number }
	private readonly gameID: number
	private readonly players: G.playerInterface[]
	private readonly paddles = new Map<number, paddleClass>()
	private readonly balls: ballClass[] = []
	private loop?: NodeJS.Timeout

	private readonly WIDTH;
	private readonly HEIGHT;

	constructor(
		game: G.gameRoomInterface & { ballSpeed: number; paddleSpeed: number },
		players: G.playerInterface[]
	) {
		this.game    = game;
		this.gameID  = game.gameID;
		this.players = players;

		if (this.game.mode === 'duo') {
			this.WIDTH  = arenaWidth2p;
			this.HEIGHT = arenaLength2p;
		} else {
			this.WIDTH  = arenaWidth4p;
			this.HEIGHT = arenaLength4p;
		}

		// === Instantiate each paddle ===
		for (const p of players) {
			// Determine orientation from playerSide
			const isH = p.playerSide === 'left' || p.playerSide === 'right';
			const pi: G.paddleInterface = {
				userID:   p.userID,
				username: p.username ?? '',
				gameID:   game.gameID,
				x:        0,
				y:        0,
				// use gameTypes constants consistently
				width:  isH ? paddleWidth : paddleSize,
				length: isH ? paddleSize  : paddleWidth,
				speed:    game.paddleSpeed / 100,
				type:     isH ? 'H' : 'V',
			};
			this.paddles.set(p.userID, new paddleClass(pi));
		}

		// === Position all paddles just inside the walls ===
		const wallT = 0.25;
		for (const player of this.players) {
			const paddle = this.paddles.get(player.userID)!;
			const pi     = paddle.paddleInterface;
			const half   = (pi.type === 'H' ? pi.length : pi.width) / 2;

			switch (player.playerSide) {
				case 'left':
					// X-axis for left/right paddles
					pi.x = - (this.WIDTH  / 2 - wallT - half);
					pi.y =   0;
					break;
				case 'right':
					pi.x =   (this.WIDTH  / 2 - wallT - half);
					pi.y =   0;
					break;
				case 'top':
					// Y-axis for top/bottom paddles
					pi.x =   0;
					pi.y =   (this.HEIGHT / 2 - wallT - half);
					break;
				case 'bottom':
					pi.x =   0;
					pi.y = - (this.HEIGHT / 2 - wallT - half);
					break;
			}
		}

		// create the ball
		this.balls.push(new ballClass(0, 0, ballSize, game.ballSpeed / 100));

		// register & start loop
		PongRoom.rooms.set(this.gameID, this);
		this.loop = setInterval(() => this.frame(), 1000 / 60);
	}

	/* ---------- Public API ---------- */

	/** Called by WS handler on key events */
	move(userID: number, dir: 'left' | 'right' | 'stop') {
		const paddle = this.paddles.get(userID)
		if (!paddle) return
		if (dir === 'left')  paddle.move_minus(this.WIDTH, this.HEIGHT)
		if (dir === 'right') paddle.move_add(this.WIDTH, this.HEIGHT)
	}

	/** Stop the loop and remove this room */
	stop() {
		if (this.loop) clearInterval(this.loop)
		PongRoom.rooms.delete(this.gameID)
	}

	/* ---------- Private ---------- */

	private frame() {
		// 1. Physics
		for (const b of this.balls) {
			for (const p of this.paddles){
				this.bounce_player(b, p[1])
			}
			this.bounceArena(b)
			this.ballsMove(b)
		}
		// 2. Broadcast to all players
		this.broadcast()
	}

	private bounceArena(ball: ballClass) {
	  const W = this.WIDTH/2;
	  const H = this.HEIGHT/2;
	  const R = ball.radius;
	  // angle limits
	  const maxAngle = Math.tan(75 * Math.PI/180);
	  const minAngle = Math.tan(15 * Math.PI/180);

	  // --- left wall ---
	  if (ball.x - R <= -W && ball.vector[0] < 0) {
	    // 1) Push out of the wall
	    ball.x = -W + R + 1e-3;
	    // 2) Invert normal component
	    ball.vector[0] *= -1;

	    // 3) Clamp tangential ratio vy/vx
	    let ratio = ball.vector[1] / ball.vector[0];
	    const s = Math.sign(ratio)||1, a = Math.abs(ratio);
	    ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
	    ball.vector[1] = ball.vector[0] * ratio;

	    // 4) Normalize
	    const len = Math.hypot(ball.vector[0], ball.vector[1]);
	    ball.vector[0] /= len;
	    ball.vector[1] /= len;
	  }

	  // --- right wall ---
	  if (ball.x + R >= W && ball.vector[0] > 0) {
	    ball.x = W - R - 1e-3;
	    ball.vector[0] *= -1;
	    let ratio = ball.vector[1] / ball.vector[0];
	    const s = Math.sign(ratio)||1, a = Math.abs(ratio);
	    ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
	    ball.vector[1] = ball.vector[0] * ratio;
	    const len = Math.hypot(ball.vector[0], ball.vector[1]);
	    ball.vector[0] /= len;
	    ball.vector[1] /= len;
	  }

	  // --- bottom wall ---
	  if (ball.y - R <= -H && ball.vector[1] < 0) {
	    ball.y = -H + R + 1e-3;
	    ball.vector[1] *= -1;
	    let ratio = ball.vector[0] / ball.vector[1];
	    const s = Math.sign(ratio)||1, a = Math.abs(ratio);
	    ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
	    ball.vector[0] = ball.vector[1] * ratio;
	    const len = Math.hypot(ball.vector[0], ball.vector[1]);
	    ball.vector[0] /= len;
	    ball.vector[1] /= len;
	  }

	  // --- top wall ---
	  if (ball.y + R >= H && ball.vector[1] > 0) {
	    ball.y = H - R - 1e-3;
	    ball.vector[1] *= -1;
	    let ratio = ball.vector[0] / ball.vector[1];
	    const s = Math.sign(ratio)||1, a = Math.abs(ratio);
	    ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
	    ball.vector[0] = ball.vector[1] * ratio;
	    const len = Math.hypot(ball.vector[0], ball.vector[1]);
	    ball.vector[0] /= len;
	    ball.vector[1] /= len;
	  }
	}

	private ballsMove(b: ballClass) {
		b.x += b.vector[0] * b.speed
		b.y += b.vector[1] * b.speed
	}

private bounce_player(ball: ballClass, paddle: paddleClass) {
	const maxAngleDeg = 60;
	const maxTangent = Math.tan(maxAngleDeg * Math.PI/180);
	const pi = paddle.paddleInterface;
	// Find closest point on paddle AABB
	let closeX = ball.x;
	let closeY = ball.y;
	if      (ball.x < pi.x)                   closeX = pi.x;
	else if (ball.x > pi.x + pi.width)        closeX = pi.x + pi.width;
	if      (ball.y < pi.y)                   closeY = pi.y;
	else if (ball.y > pi.y + pi.length)       closeY = pi.y + pi.length;

	const dx = closeX - ball.x;
	const dy = closeY - ball.y;
	const dist = Math.hypot(dx, dy);

	if (dist <= ball.radius) {
		// Collision detected
		if (pi.type === 'H') {
			// Left/Right paddle: normal is X-axis
			ball.vector[0] *= -1;  // invert X component

			// compute impact point relative to paddle center
			const paddleCenterY = pi.y + pi.length / 2;
			let relativeY    = (ball.y - paddleCenterY) / (pi.length / 2);
			// set Y component proportional to hit offset
			if (this.players.length === 2) {
				const maxTangent = Math.tan(60 * Math.PI/180);
				relativeY = Math.max(-maxTangent, Math.min(maxTangent, relativeY));
			}
			ball.vector[1] = relativeY;
		} else {
			// Top/Bottom paddle: normal is Y-axis
			ball.vector[1] *= -1;  // invert Y component

			const paddleCenterX = pi.x + pi.width / 2;
			const relativeX    = (ball.x - paddleCenterX) / (pi.width / 2);
			ball.vector[0] = relativeX;
		}

		// normalize direction vector to length 1
		const length = Math.hypot(ball.vector[0], ball.vector[1]);
		if (length > 0) {
			ball.vector[0] /= length;
			ball.vector[1] /= length;
		}

		ball.last_bounce = paddle;
	}
}

	private broadcast() {
		// Build payload
		const paddlesPayload: Record<number, { pos: number; side: G.playerInterface['playerSide'] }> = {}
		this.players.forEach(p => {
			const pad = this.paddles.get(p.userID)!
			const pos = pad.paddleInterface.type === 'H'
				? pad.paddleInterface.y
				: pad.paddleInterface.x;
			paddlesPayload[p.userID] = { pos, side: p.playerSide };
		})
		const ballsPayload: Record<number, { x: number; y: number }> = {}
		this.balls.forEach((b, i) => (ballsPayload[i] = { x: b.x, y: b.y }))

		// Send renderData
		for (const p of this.players) {
			p.typedSocket.send('renderData', {
				paddles: paddlesPayload,
				balls: ballsPayload,
			})
		}
	}
}