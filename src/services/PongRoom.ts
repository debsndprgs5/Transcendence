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
				ball.vector[1] *= -1;
			}
			// Bottom wall bounce
			if (ball.y - ball.radius <= -halfHeight) {
				ball.vector[1] *= -1;
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
	

  private ballsMove(b: ballClass) {
    b.x += b.vector[0] * b.speed
    b.y += b.vector[1] * b.speed
  }

  private bounce_player(ball:ballClass, paddle:paddleClass){
  	let close_x:number = ball.x;
  	let	close_y:number = ball.y;

  	if (ball.x < paddle.paddleInterface.x)
  		close_x = paddle.paddleInterface.x;
  	else if (ball.x > paddle.paddleInterface.x + paddle.paddleInterface.width)
  		close_x = paddle.paddleInterface.x + paddle.paddleInterface.width;
  	if (ball.y < paddle.paddleInterface.y)
  		close_y = paddle.paddleInterface.y;
  	else if (ball.y > paddle.paddleInterface.y + paddle.paddleInterface.length)
  		close_y = paddle.paddleInterface.y + paddle.paddleInterface.length;

  	let dist_x:number = close_x - ball.x;
  	let dist_y:number = close_y - ball.y;
  	let dist:number = Math.sqrt((dist_x * dist_x) + dist_y * dist_y);

  	if (dist <= ball.radius)
  	{
      console.log(`bounce happened by ${paddle.paddleInterface.username}: paddle_coord: ${paddle.paddleInterface.x}, ${paddle.paddleInterface.y} | ball_coord: ${ball.x}, ${ball.y}`);
  		ball.bounce_x();
  		ball.bounce_y();
  		ball.last_bounce = paddle;
  	}
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

}