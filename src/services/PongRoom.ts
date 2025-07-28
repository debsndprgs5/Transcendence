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
import { Tournament } from './tournament'
import { getNamePerGameID } from '../db/gameManagement'

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
	private pauseStartTime: number | null = null;
	private totalPausedTime = 0;

	private pauseState = {
        isPaused: false,
        pausedPlayers: new Set<number>(),        // Track all paused players
    };
	private loop?: NodeJS.Timeout

	constructor(
		game: G.gameRoomInterface & { ballSpeed: number; paddleSpeed: number },
		players: G.playerInterface[]
	) {
		console.warn(`[PONGROOM][CONSTRUCTOR]GameID:${game.gameID}`);
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
		this.baseSpeed = game.ballSpeed / 240;

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
				speed:    game.paddleSpeed / 100,
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
//PUBLIC METHODS 

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
	/* Pause the loop */
	pause(userID: number) {
		if (this.pauseState.isPaused) {
			this.pauseState.pausedPlayers.add(userID);
			return;
		}

		this.pauseState = {
			isPaused: true,
			pausedPlayers: new Set([userID]),
		};

		this.pauseStartTime = Date.now(); // Mark pause start time

		if (this.loop) clearInterval(this.loop);
	}

	/*Resume the loop*/ 
	resume(userID: number) {
		this.pauseState.pausedPlayers.delete(userID);

		if (!this.pauseState.isPaused)
			return;

		if (this.pauseState.pausedPlayers.size === 0) {
			this.pauseState.isPaused = false;

			// Accumulate paused duration
			if (this.pauseStartTime !== null) {
				this.totalPausedTime += Date.now() - this.pauseStartTime;
				this.pauseStartTime = null;
			}

			this.loop = setInterval(() => this.frame(), 1000 / 60);
		}
	}

//PRIVATE METHODS 

private frame() {
	if (this.pauseState.isPaused) {
		this.broadcast()
		return; // Skip frame if paused
	}
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
	  const maxStep = b.radius;
	  const n = Math.ceil(remaining / maxStep);
	  const step = remaining / n;
	  for (let i = 0; i < n; i++) {
	    b.x += b.vector[0] * step;
	    b.y += b.vector[1] * step;
	  }
}


	/** Cap angle and invert on paddle hit */
private bounce_player(ball: ballClass, paddle: paddleClass) {
  const pi   = paddle.paddleInterface;
  const R    = ball.radius;
  const left = pi.x - pi.width / 2,
        right  = pi.x + pi.width / 2,
        top    = pi.y - pi.length / 2,
        bottom = pi.y + pi.length / 2;

  const cx = Math.max(left, Math.min(ball.x, right));
  const cy = Math.max(top,  Math.min(ball.y, bottom));
  const dx = cx - ball.x, dy = cy - ball.y;
  if (dx*dx + dy*dy > R*R) return;               // pas de contact

  const maxAngle = 75 * Math.PI / 180;

  if (pi.type === 'H') {                         // raquette gauche / droite
    const rel = (ball.y - pi.y) / (pi.length/2); // centre direct
    const angle = Math.max(-1, Math.min(1, rel)) * maxAngle;

    const dirX = (pi.x < 0) ? 1 : -1;            // gauche => +X, droite => -X
    ball.vector[0] =  dirX * Math.cos(angle);
    ball.vector[1] =  Math.sin(angle);
    ball.x += ball.vector[0] * 0.01;             // sortir du paddle

  } else {                                       // raquette haut / bas
    const rel = (ball.x - pi.x) / (pi.width/2);
    const angle = Math.max(-1, Math.min(1, rel)) * maxAngle;

    const dirY = (pi.y < 0) ? 1 : -1;            // bas => +Y, haut => -Y
    ball.vector[0] =  Math.sin(angle);
    ball.vector[1] =  dirY * Math.cos(angle);
    ball.y += ball.vector[1] * 0.01;
  }

  // normalise
  const n = Math.hypot(ball.vector[0], ball.vector[1]);
  ball.vector[0] /= n; ball.vector[1] /= n;

  // accélère
  ball.speed = Math.min(ball.speed * 1.15, this.baseSpeed * 3);

  ball.last_bounce = paddle;
}
 
private resetBallPosition(sideHit: 'left'|'right'|'top'|'bottom', ball: ballClass) {
  ball.x = ball.y = 0;
  ball.last_bounce = undefined;

  const maxServeDeg = 45;
  const rad = (Math.random() * 2 * maxServeDeg - maxServeDeg) * Math.PI / 180;

  switch (sideHit) {
    case 'left':   ball.vector = [  Math.cos(rad),  Math.sin(rad)]; break; // vers +X
    case 'right':  ball.vector = [ -Math.cos(rad),  Math.sin(rad)]; break;
    case 'top':    ball.vector = [  Math.sin(rad), -Math.cos(rad)]; break;
    case 'bottom': ball.vector = [  Math.sin(rad),  Math.cos(rad)]; break;
  }

  const l = Math.hypot(ball.vector[0], ball.vector[1]);
  ball.vector[0] /= l; ball.vector[1] /= l;

  ball.speed = this.baseSpeed;
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
				//SHOULD NEVER HAPPENDS WITH PROPER BOUNCE ?
				console.log(`ERROR ${scorer.username} mark in his cage: ${sideHit}, ballvector:${ball.vector}`);
			}
		}
		this.resetBallPosition(sideHit, ball);
	}

	/** Send state to clients */
	private broadcast() {
		let rawElapsed = (Date.now() - this.clock - this.totalPausedTime) / 1000;
		if (this.pauseState.isPaused && this.pauseStartTime !== null) {
			rawElapsed -= (Date.now() - this.pauseStartTime) / 1000;
		}

		let elapsed = rawElapsed;

		if (this.game.winCondition === 'time') {
			elapsed = Math.max(0, this.game.limit - rawElapsed);
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
			const isPaused = this.pauseState.isPaused;
			const balls: Record<number,{x:number;y:number}> = {}
			this.balls.forEach((b,i)=> balls[i]={x:b.x,y:b.y})
			for (const p of this.players) {
				p.typedSocket.send('renderData',{ paddles, balls, elapsed, isPaused })
			}
	}

	/** Check and trigger end */
	private checkWinCondition(): boolean {
		const elapsedMs = Date.now() - this.clock - this.totalPausedTime;
		if (this.game.winCondition==='time' && elapsedMs >= this.game.limit*1000) {
			this.endCleanMatch(); return true
		}
		if (this.game.winCondition==='score') {
			for (const sc of this.scoreMap.values()) {
				if (sc >= this.game.limit) { this.endCleanMatch(); return true }
			}
		}
		return false
	}

	private async endCleanMatch() {


		const playermapped = new Map<string, number>();
		for (const [userID, score] of this.scoreMap) {
			const uname = await getUnameByIndex(userID);
			playermapped.set(uname!.username, score);
		}
		const playerScores = Object.fromEntries(playermapped);
		const gameName = await getNamePerGameID(this.gameID);
		for (const p of this.players) {
			const isWinner = (this.scoreMap.get(p.userID)! >= this.game.limit);
			if(p.tournamentID){
				const tour = Tournament.MappedTour.get(p.tournamentID);
				const scoreA = this.scoreMap.get(this.players[0].userID!);
				const scoreB = this.scoreMap.get(this.players[1].userID!)
				p.typedSocket.send('endMatch',{
					isWinner,
					playerScores,
					tourID:p.tournamentID,
					userID:p.userID,
					a_ID:this.players[0].userID,
					b_ID:this.players[1].userID,
					a_score:scoreA,
					b_score:scoreB,
					gameName:gameName!.name
				});
				p.gameID=undefined;
			}
			else{
				p.typedSocket.send('endMatch', {
					isWinner,
					playerScores
				});
			}
		}
		clearInterval(this.loop!);
		PongRoom.rooms.delete(this.gameID);
	}
}