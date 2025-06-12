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
  private scoreMap = new Map<number, number>() //userID to score ?
  private readonly WIDTH;
  private readonly HEIGHT;
  private readonly clock:number;


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
		score:0
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
		this.clock = Date.now();
		this.loop = setInterval(() => this.frame(), 1000 / 60);
  
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
	//2.Detect win
	this.checkWinCondition();
    // 3. Broadcast to all players
    this.broadcast()
  }

private bounceArena(ball: ballClass) {
	const halfWidth = this.WIDTH / 2;
	const halfHeight = this.HEIGHT / 2;
	const W = this.WIDTH / 2;
	const H = this.HEIGHT / 2;
	const R = ball.radius;
	// angle limits
	const maxAngle = Math.tan(75 * Math.PI / 180);
	const minAngle = Math.tan(15 * Math.PI / 180);

	if (this.game.mode === 'quatuor') {
		// 4p mode: No bouncing on walls, scoring on any wall hit

		// Left wall (x <= -halfWidth)
		if (ball.x - ball.radius <= -halfWidth) {
			// Left wall hit → Right player scores
			this.handleWallScore('left', ball);
			return; // skip further movement, ball reset inside handleWallScore
		}
		// Right wall (x >= halfWidth)
		if (ball.x + ball.radius >= halfWidth) {
			this.handleWallScore('right', ball);
			return;
		}
		// Top wall (y >= halfHeight)
		if (ball.y + ball.radius >= halfHeight) {
			this.handleWallScore('top', ball);
			return;
		}
		// Bottom wall (y <= -halfHeight)
		if (ball.y - ball.radius <= -halfHeight) {
			this.handleWallScore('bottom', ball);
			return;
		}

	} else if (this.game.mode === 'duo') {
		// 2p mode: bounce top/bottom, score on left/right goals

		// Left wall (goal)
		if (ball.x - ball.radius <= -halfWidth) {
			this.handleWallScore('left', ball);
			return;
		}
		// Right wall (goal)
		if (ball.x + ball.radius >= halfWidth) {
			this.handleWallScore('right', ball);
			return;
		}

		// Top wall bounce
		if (ball.y + ball.radius >= halfHeight) {
			// Ball hits the top wall
			if (ball.x - R <= -W && ball.vector[0] < 0) {
				// 1) Push out of the wall
				ball.x = -W + R + 1e-3;
				// 2) Invert normal component (X velocity)
				ball.vector[0] *= -1;

				// 3) Clamp tangential ratio vy/vx (adjust Y velocity based on X velocity)
				let ratio = ball.vector[1] / ball.vector[0];
				const s = Math.sign(ratio) || 1, a = Math.abs(ratio);
				ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
				ball.vector[1] = ball.vector[0] * ratio;

				// 4) Normalize the velocity
				const len = Math.hypot(ball.vector[0], ball.vector[1]);
				ball.vector[0] /= len;
				ball.vector[1] /= len;
			}
		}

		// Bottom wall bounce
		if (ball.y - ball.radius <= -halfHeight) {
			// Ball hits the bottom wall
			if (ball.x - R <= -W && ball.vector[0] < 0) {
				// 1) Push out of the wall
				ball.x = -W + R + 1e-3;
				// 2) Invert normal component (X velocity)
				ball.vector[0] *= -1;

				// 3) Clamp tangential ratio vy/vx (adjust Y velocity based on X velocity)
				let ratio = ball.vector[1] / ball.vector[0];
				const s = Math.sign(ratio) || 1, a = Math.abs(ratio);
				ratio = Math.min(maxAngle, Math.max(minAngle, a)) * s;
				ball.vector[1] = ball.vector[0] * ratio;

				// 4) Normalize the velocity
				const len = Math.hypot(ball.vector[0], ball.vector[1]);
				ball.vector[0] /= len;
				ball.vector[1] /= len;
			}
		}
	}
}

	private handleWallScore(sideHit: 'left' | 'right' | 'top' | 'bottom', ball: ballClass) {
		// Check last paddle to touch the ball
		if (ball.last_bounce) {
			const lastUserID = ball.last_bounce.paddleInterface.userID;
			const currentScore = this.scoreMap.get(lastUserID) ?? 0;
			this.scoreMap.set(lastUserID, currentScore + 1);
		} else {
			// No last bounce: the player(s) on the sideHit lose 1 point
			for (const p of this.players) {
			if (p.playerSide === sideHit) {
				const currentScore = this.scoreMap.get(p.userID) ?? 0;
				this.scoreMap.set(p.userID, currentScore - 1);
			}
			}
		}
		// Reset ball to center and clear last bounce reference
		ball.x = 0;
		ball.y = 0;
		ball.last_bounce = undefined;
		ball.speed = this.game.ballSpeed / 100;
	}

  private broadcast() {
    // Build payload
    const paddlesPayload: Record<number, { pos: number; side: G.playerInterface['playerSide']; score:number; }> = {}
    this.players.forEach(p => {
      const pad = this.paddles.get(p.userID)!
      const pos = pad.paddleInterface.type === 'H'
        ? pad.paddleInterface.y
        : pad.paddleInterface.x;
      paddlesPayload[p.userID] = { pos, side: p.playerSide, score:pad.paddleInterface.score };
    })
    const ballsPayload: Record<number, { x: number; y: number; }> = {}
    this.balls.forEach((b, i) => (ballsPayload[i] = { x: b.x, y: b.y }))
	let time = Date.now()-this.clock
	time = time/1000;
     // Send renderData
    for (const p of this.players) {
      p.typedSocket.send('renderData', {
        paddles: paddlesPayload,
        balls: ballsPayload,
		elapsed:time
      })
    }
  }
	private checkWinCondition(): boolean {
	const elapsed = Date.now() - this.clock;

	if (this.game.winCondition === 'time') {
	if (elapsed > this.game.limit * 1000) {
		this.setTimeWinner();
		this.stop();
		return true;
	}
	} else if (this.game.winCondition === 'score') {
	const winners: number[] = [];

	for (const [userID, score] of this.scoreMap.entries()) {
		if (score >= this.game.limit) {
		winners.push(userID);
		}
	}

	if (winners.length > 1) {
		this.handleTie(winners);
		this.stop();
		return true;
	} else if (winners.length === 1) {
		// One winner
		this.handleWinner(winners[0]);
		this.stop();
		return true;
	}
	}

	return false; // no win condition met
	}
	
	private setTimeWinner() {
		const winners: number[] = [];
		let maxScore = -Infinity; // start very low to catch all scores

		for (const [userID, score] of this.scoreMap.entries()) {
			if (score === maxScore) {
			winners.push(userID);
			} else if (score > maxScore) {
			maxScore = score;
			winners.length = 0; // clear winners array
			winners.push(userID);
			}
		}

		if (winners.length > 1) {
			this.handleTie(winners);
		} else if (winners.length === 1) {
			this.handleWinner(winners[0]);
		} else {
			// No scores? fallback - maybe no winner
			console.log('No winner found for time limit');
		}
	}

	private handleTie(winnersID: number[]) {
		for (const p of this.players) {
			const status = winnersID.includes(p.userID) ? 'tie' : 'no';
			p.typedSocket.send('endMatch', { result: status });
		}
	}

	private handleWinner(winnerID: number) {
		for (const p of this.players) {
			const status = p.userID === winnerID ? 'yes' : 'no';
			p.typedSocket.send('endMatch', { result: status });
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
}