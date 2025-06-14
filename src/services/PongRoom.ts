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
} from '../shared/gameTypes'
import { getUnameByIndex } from '../db/userManagement'

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
	private readonly scoreMap = new Map<number, number>()
	private readonly WIDTH: number
	private readonly HEIGHT: number
	private readonly clock: number
	private readonly baseSpeed: number
	private loop?: NodeJS.Timeout

	constructor(
		game: G.gameRoomInterface & { ballSpeed: number; paddleSpeed: number },
		players: G.playerInterface[]
	) {
		this.game    = game
		this.gameID  = game.gameID
		this.players = players

		// Size initialization
		if (game.mode === 'duo') {
			this.WIDTH  = arenaWidth2p
			this.HEIGHT = arenaLength2p
		} else {
			this.WIDTH  = arenaWidth4p
			this.HEIGHT = arenaLength4p
		}
		this.baseSpeed = game.ballSpeed / 120;

		// Instantiate paddles & scores
		for (const p of players) {
			const isH = p.playerSide === 'left' || p.playerSide === 'right'
			const pi: G.paddleInterface = {
				userID:   p.userID,
				username: p.username ?? '',
				gameID:   game.gameID,
				x:        0,
				y:        0,
				width:    isH ? paddleWidth : paddleSize,
				length:   isH ? paddleSize  : paddleWidth,
				speed:    game.paddleSpeed /50,
				type:     isH ? 'H' : 'V',
			}
			this.paddles.set(p.userID, new paddleClass(pi))
			this.scoreMap.set(p.userID, 0)
		}

		// Position paddles just inside walls
    const wallTh = 0.25;
    for (const p of players) {
      const pad = this.paddles.get(p.userID)!.paddleInterface;
      const halfW = pad.width  / 2;
      const halfL = pad.length / 2;
      switch (p.playerSide) {
        case 'left':   pad.x = -this.WIDTH/2 + wallTh + halfW; pad.y = 0; break;
        case 'right':  pad.x =  this.WIDTH/2 - wallTh - halfW; pad.y = 0; break;
        case 'top':    pad.x = 0; pad.y =  this.HEIGHT/2 - wallTh - halfL; break;
        case 'bottom': pad.x = 0; pad.y = -this.HEIGHT/2 + wallTh + halfL; break;
      }
    }


		// Create ball
		this.balls.push(new ballClass(0, 0, ballSize, this.baseSpeed));

		// Start clock & loop
		this.clock = Date.now();
		PongRoom.rooms.set(this.gameID, this);
		this.loop = setInterval(() => this.frame(), 1000/60);
	}

	/** Handle paddle movement input */
	move(userID: number, dir: 'left'|'right'|'stop') {
		const pad = this.paddles.get(userID)
		if (!pad) return
		if (dir === 'left')  pad.move_minus(this.WIDTH, this.HEIGHT)
		if (dir === 'right') pad.move_add(this.WIDTH, this.HEIGHT)
	}

	/** Stop and clean up */
	stop() {
		if (this.loop) clearInterval(this.loop)
		PongRoom.rooms.delete(this.gameID)
	}

private frame() {
		for (const ball of this.balls) {
			this.ballsMove(ball);
			for (const [, pad] of this.paddles) {
				this.bounce_player(ball, pad);
			}
			this.bounceArena(ball);
		}
		// Win check
		this.checkWinCondition()
		// Broadcast
		this.broadcast()
	}


	/** Bounce or score on arena walls, with angle caps */
private bounceArena(ball: ballClass) {
		const W      = this.WIDTH/2;
		const H      = this.HEIGHT/2;
		const R      = ball.radius;
		const maxA   = Math.tan(75 * Math.PI/180);
		const minA   = Math.tan(15 * Math.PI/180);

		if (this.game.mode === 'duo') {
			// goals
			if (ball.x - R <= -W) { this.handleWallScore('left', ball); return; }
			if (ball.x + R >=  W) { this.handleWallScore('right', ball); return; }

			// bounce on top wall
			if (ball.y + R >= H && ball.vector[1] > 0) {
				// push ball out the wall
				ball.y = H - R - 1e-3;
				// invert (Y)
				ball.vector[1] *= -1;

				// angle clamp
				//    ratio = vx/vy
				let ratio = ball.vector[0] / ball.vector[1];
				const sign = Math.sign(ratio) || 1;

				ratio = Math.min(maxA, Math.max(minA, Math.abs(ratio))) * sign;

				// recalc vx from vy
				ball.vector[0] = ratio * ball.vector[1];

				// 4) renorm to ||v||=1
				const len = Math.hypot(ball.vector[0], ball.vector[1]);
				ball.vector[0] /= len;
				ball.vector[1] /= len;
			}

			// bounce on bottom wall
			if (ball.y - R <= -H && ball.vector[1] < 0) {
				ball.y = -H + R + 1e-3;
				ball.vector[1] *= -1;

				let ratio = ball.vector[0] / ball.vector[1];
				const sign = Math.sign(ratio) || 1;
				ratio = Math.min(maxA, Math.max(minA, Math.abs(ratio))) * sign;
				ball.vector[0] = ratio * ball.vector[1];
				const len = Math.hypot(ball.vector[0], ball.vector[1]);
				ball.vector[0] /= len;
				ball.vector[1] /= len;
			}
		}
		else {
			// 4p: score on all walls
			if (ball.x - R <= -W) { this.handleWallScore('left', ball); return }
			if (ball.x + R >=  W) { this.handleWallScore('right', ball); return }
			if (ball.y - R <= -H) { this.handleWallScore('bottom', ball); return }
			if (ball.y + R >=  H) { this.handleWallScore('top', ball); return }
		}
	}


	/** Move ball */
private ballsMove(b: ballClass) {
	  let remaining = b.speed;
	  const maxStep = b.radius;        // distance max sans rater un paddle
	  const n = Math.ceil(remaining / maxStep);
	  const step = remaining / n;
	  for (let i = 0; i < n; i++) {
	    b.x += b.vector[0] * step;
	    b.y += b.vector[1] * step;
	  }
}


	/** Cap angle and invert on paddle hit */
	private bounce_player(ball: ballClass, paddle: paddleClass) {
		const pi = paddle.paddleInterface;
		const R  = ball.radius;

		// Detect cercle/rectangle collisions
		const left   = pi.x - pi.width / 2;
		const right  = pi.x + pi.width / 2;
		const top    = pi.y - pi.length / 2;
		const bottom = pi.y + pi.length / 2;
		const cx = Math.max(left,  Math.min(ball.x, right));
		const cy = Math.max(top,   Math.min(ball.y, bottom));
		const dx = cx - ball.x, dy = cy - ball.y;
		if (dx*dx + dy*dy > R*R) return; // no collision

		// 2) Compute maximum bounce angle (in radians)
		const maxBounceAngle = 75 * Math.PI / 180;

		if (pi.type === 'H') {
			// Vertical paddle (left/right) → bounce horizontal

			// Compute relative intersection [-1 .. +1]
			// English comment: find how far from paddle center the ball hit
			const paddleCenterY = pi.y + pi.length/2;
			let rel = (ball.y - paddleCenterY) / (pi.length/2);
			rel = Math.max(-1, Math.min(1, rel)); // clamp

			// English comment: map to angle within [-maxBounceAngle, +maxBounceAngle]
			const bounceAngle = rel * maxBounceAngle;

			// English comment: incoming direction of X to decide sign flip
			const dirX = Math.sign(ball.vector[0]) || 1;

			// English comment: new vector components
			ball.vector[0] = -dirX * Math.cos(bounceAngle);
			ball.vector[1] = Math.sin(bounceAngle);
			ball.x += ball.vector[0] * 0.01;
			ball.y += ball.vector[1] * 0.01;

		} else {
			// Horizontal paddle (top/bottom) → bounce vertical

			const paddleCenterX = pi.x + pi.width/2;
			let rel = (ball.x - paddleCenterX) / (pi.width/2);
			rel = Math.max(-1, Math.min(1, rel));

			const bounceAngle = rel * maxBounceAngle;
			const dirY = Math.sign(ball.vector[1]) || 1;

			ball.vector[0] = Math.sin(bounceAngle);
			ball.vector[1] = -dirY * Math.cos(bounceAngle);
			ball.x += ball.vector[0] * 0.01;
			ball.y += ball.vector[1] * 0.01;
		}
		ball.speed = Math.min(ball.speed * 1.05, this.baseSpeed * 2.5); // x2.5 max

		// 3) Normalize to unit length
		const norm = Math.hypot(ball.vector[0], ball.vector[1]);
		ball.vector[0] /= norm;
		ball.vector[1] /= norm;

		// 4) Save last bounce for le scoring
		ball.last_bounce = paddle;
	}
 
	private resetBallPosition(sideHit: 'left'|'right'|'top'|'bottom',ball: ballClass) {
		// Reset ball on center
		ball.x = 0
		ball.y = 0
		ball.last_bounce = undefined
		// Send ball on random angle
		const maxServeDeg = 45; 
		const rad = (Math.random() * 2*maxServeDeg - maxServeDeg) * Math.PI/180;
		const dir = sideHit === 'left' ? +1 : -1; // always serving to opposite player
		ball.vector = [dir * Math.cos(rad), Math.sin(rad)];
		// normalise to keep ||v||=1
		const len = Math.hypot(ball.vector[0], ball.vector[1]);
		ball.vector[0] /= len; ball.vector[1] /= len;
		ball.speed = this.game.ballSpeed / 60;

	}

	private  handleWallScore(sideHit: 'left'|'right'|'top'|'bottom', ball: ballClass) {

		if(ball.last_bounce){
			const scorerID = ball.last_bounce.paddleInterface.userID;
			const scorer = this.players.find(p=> p.userID === scorerID);
			if(!scorer)return; //SCORER MAY HAVE LEAVE GAME ? MAYBE STOP GAME HERE
			if(scorer.playerSide !== sideHit){
				this.scoreMap.set(
					scorer.userID,
					(this.scoreMap.get(scorer.userID) || 0) + 1)
			}
			else{
				//SHOULD NEVER HAPPENDS WITH PROPER BOUNCE
				console.log(`ERROR ${scorer.username} mark in his cage: ${sideHit}, ballvector:${ball.vector}`);
			}
		}
		this.resetBallPosition(sideHit, ball);
	}

	/** Send state to clients */
	private broadcast() {
		let elapsed = (Date.now()-this.clock)/1000
		if (this.game.winCondition === 'time') {
			elapsed = Math.max(0, this.game.limit - elapsed);
		}
		const paddles: Record<number,{pos:number;side:G.playerInterface['playerSide'];score:number}> = {}
		for (const p of this.players) {
			const pad = this.paddles.get(p.userID)!.paddleInterface
			paddles[p.userID] = {
				pos: pad.type==='H' ? pad.y : pad.x,
				side: p.playerSide,
				score: this.scoreMap.get(p.userID)!,
			}
		}
		const balls: Record<number,{x:number;y:number}> = {}
		this.balls.forEach((b,i)=> balls[i]={x:b.x,y:b.y})
		for (const p of this.players) {
			p.typedSocket.send('renderData',{ paddles, balls, elapsed })
		}
	}

	/** Check and trigger end */
	private checkWinCondition(): boolean {
		const elapsedMs = Date.now()-this.clock
		if (this.game.winCondition==='time' && elapsedMs >= this.game.limit*1000) {
			this.endMatch(); return true
		}
		if (this.game.winCondition==='score') {
			for (const sc of this.scoreMap.values()) {
				if (sc >= this.game.limit) { this.endMatch(); return true }
			}
		}
		return false
	}

	private async endMatch() {
		clearInterval(this.loop!);
		PongRoom.rooms.delete(this.gameID);

		const playermapped = new Map<string, number>();
		for (const [userID, score] of this.scoreMap) {
			const uname = await getUnameByIndex(userID);
			playermapped.set(uname!.username, score);
		}
		const playerScores = Object.fromEntries(playermapped);

		for (const p of this.players) {
			const isWinner = (this.scoreMap.get(p.userID)! >= this.game.limit);
			p.typedSocket.send('endMatch', {
				isWinner,
				playerScores
			});
		}
	}
}
