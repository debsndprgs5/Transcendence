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
    const wallTh = 0.25
    for (const p of players) {
      const pad = this.paddles.get(p.userID)!.paddleInterface
      const half = (pad.type === 'H' ? pad.length : pad.width) / 2
      switch (p.playerSide) {
        case 'left':   pad.x = -this.WIDTH/2 + wallTh + half; pad.y = 0; break
        case 'right':  pad.x =  this.WIDTH/2 - wallTh - half; pad.y = 0; break
        case 'top':    pad.x = 0; pad.y =  this.HEIGHT/2 - wallTh - half; break
        case 'bottom': pad.x = 0; pad.y = -this.HEIGHT/2 + wallTh + half; break
      }
    }

    // Create ball
    this.balls.push(new ballClass(0, 0, ballSize, game.ballSpeed / 100))

    // Start clock & loop
    this.clock = Date.now()
    PongRoom.rooms.set(this.gameID, this)
    this.loop = setInterval(() => this.frame(), 1000/60)
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
    // Physics
    for (const ball of this.balls) {
      for (const [, pad] of this.paddles) {
        this.bounce_player(ball, pad)
      }
      this.bounceArena(ball)
      this.ballsMove(ball)
    }
    // Win check
    this.checkWinCondition()
    // Broadcast
    this.broadcast()
  }
private bounceArena(ball: ballClass) {
  const W = this.WIDTH / 2;
  const H = this.HEIGHT / 2;
  const R = ball.radius;

  if (this.game.mode === 'duo') {
    // Goals on left/right walls
    if (ball.x - R <= -W) {
      console.log(`[bounceArena] Ball scored left goal at x=${ball.x.toFixed(2)}`);
      this.handleWallScore('left', ball);
      return;
    }
    if (ball.x + R >= W) {
      console.log(`[bounceArena] Ball scored right goal at x=${ball.x.toFixed(2)}`);
      this.handleWallScore('right', ball);
      return;
    }
    // Bounce on top/bottom walls
    if (ball.y + R >= H || ball.y - R <= -H) {
      console.log(`[bounceArena] Ball bounced on horizontal wall at y=${ball.y.toFixed(2)}`);
      console.log(`  Vector before bounce: [${ball.vector[0].toFixed(3)}, ${ball.vector[1].toFixed(3)}]`);
      ball.vector[1] *= -1;
      this.clampBallAngle(ball);
      console.log(`  Vector after bounce+clamp: [${ball.vector[0].toFixed(3)}, ${ball.vector[1].toFixed(3)}]`);
    }
  } else {
    // 4p mode: goals on all four walls
    if (ball.x - R <= -W) {
      console.log(`[bounceArena] Ball scored left goal at x=${ball.x.toFixed(2)}`);
      this.handleWallScore('left', ball);
      return;
    }
    if (ball.x + R >= W) {
      console.log(`[bounceArena] Ball scored right goal at x=${ball.x.toFixed(2)}`);
      this.handleWallScore('right', ball);
      return;
    }
    if (ball.y - R <= -H) {
      console.log(`[bounceArena] Ball scored bottom goal at y=${ball.y.toFixed(2)}`);
      this.handleWallScore('bottom', ball);
      return;
    }
    if (ball.y + R >= H) {
      console.log(`[bounceArena] Ball scored top goal at y=${ball.y.toFixed(2)}`);
      this.handleWallScore('top', ball);
      return;
    }
  }
}

private clampBallAngle(ball: ballClass) {
  const vx = ball.vector[0];
  const vy = ball.vector[1];

  if (vx !== 0) {
    let slope = vy / vx;

    const maxSlope = 2;
    if (slope > maxSlope) slope = maxSlope;
    else if (slope < -maxSlope) slope = -maxSlope;

    const speed = Math.sqrt(vx * vx + vy * vy);
    const signVx = vx > 0 ? 1 : -1;
    const newVx = signVx * Math.sqrt(speed * speed / (1 + slope * slope));
    const newVy = slope * newVx;

    console.log(`[clampBallAngle] Before clamp: vx=${vx.toFixed(3)}, vy=${vy.toFixed(3)}, slope=${(vy/vx).toFixed(3)}`);
    console.log(`               After clamp: vx=${newVx.toFixed(3)}, vy=${newVy.toFixed(3)}, clamped slope=${slope.toFixed(3)}`);

    ball.vector[0] = newVx;
    ball.vector[1] = newVy;
  } else {
    console.log('[clampBallAngle] vx=0, skipping clamp to avoid division by zero');
  }
}

  /** Move ball */
  private ballsMove(b: ballClass) {
    b.x += b.vector[0] * b.speed
    b.y += b.vector[1] * b.speed
  }

  /** Cap angle and invert on paddle hit */
  // private bounce_player(ball: ballClass, paddle: paddleClass) {
  //   const pi = paddle.paddleInterface
  //   const R = ball.radius
  //   // Find closest point
  //   let cx = Math.max(pi.x, Math.min(ball.x, pi.x+pi.width))
  //   let cy = Math.max(pi.y, Math.min(ball.y, pi.y+pi.length))
  //   const dx = cx - ball.x, dy = cy - ball.y
  //   if (dx*dx + dy*dy <= R*R) {
  //     const maxT = Math.tan(60*Math.PI/180)
  //     if (pi.type === 'H') {
  //       ball.vector[0] *= -1
  //       let rel = (ball.y - (pi.y+pi.length/2)) / (pi.length/2)
  //       rel = Math.max(-maxT, Math.min(maxT, rel))
  //       ball.vector[1] = rel
  //     } else {
  //       ball.vector[1] *= -1
  //       let rel = (ball.x - (pi.x+pi.width/2)) / (pi.width/2)
  //       rel = Math.max(-maxT, Math.min(maxT, rel))
  //       ball.vector[0] = rel
  //     }
  //     // normalize
  //     const L = Math.hypot(ball.vector[0], ball.vector[1])
  //     ball.vector[0] /= L; ball.vector[1] /= L
  //     ball.last_bounce = paddle
  //   }
  // }
private bounce_player(ball: ballClass, paddle: paddleClass) {
  const pi = paddle.paddleInterface;
  const R = ball.radius;
  // Find closest point on paddle to ball center
  let cx = Math.max(pi.x, Math.min(ball.x, pi.x + pi.width));
  let cy = Math.max(pi.y, Math.min(ball.y, pi.y + pi.length));
  const dx = cx - ball.x, dy = cy - ball.y;

  if (dx * dx + dy * dy <= R * R) {
    console.log(`[bounce_player] Collision detected with paddle (type=${pi.type})`);
    console.log(`  Ball pos: (${ball.x.toFixed(2)}, ${ball.y.toFixed(2)}), vector before: [${ball.vector[0].toFixed(3)}, ${ball.vector[1].toFixed(3)}]`);

    const maxT = Math.tan(60 * Math.PI / 180);  // ~1.73 max deflection tangent
    const minT = Math.tan(20 * Math.PI / 180);  // ~0.36 min deflection tangent

    if (pi.type === 'H') {
      ball.vector[0] *= -1;
      let rel = (ball.y - (pi.y + pi.length / 2)) / (pi.length / 2);
      rel = Math.max(-maxT, Math.min(maxT, rel));

      if (Math.abs(rel) < minT) {
        rel = rel < 0 ? -minT : minT;
      }
      ball.vector[1] = rel;
    } else {
      ball.vector[1] *= -1;
      let rel = (ball.x - (pi.x + pi.width / 2)) / (pi.width / 2);
      rel = Math.max(-maxT, Math.min(maxT, rel));

      if (Math.abs(rel) < minT) {
        rel = rel < 0 ? -minT : minT;
      }
      ball.vector[0] = rel;
    }

    // Normalize vector to unit length
    const L = Math.hypot(ball.vector[0], ball.vector[1]);
    ball.vector[0] /= L;
    ball.vector[1] /= L;

    console.log(`  Ball vector after bounce: [${ball.vector[0].toFixed(3)}, ${ball.vector[1].toFixed(3)}]`);

    ball.last_bounce = paddle;
  }
}
  /** Award point to last toucher */
  private handleWallScore(sideHit: 'left'|'right'|'top'|'bottom', ball: ballClass) {
    if (ball.last_bounce) {
      const uid = ball.last_bounce.paddleInterface.userID
      this.scoreMap.set(uid, (this.scoreMap.get(uid)||0) + 1)
    }
    // reset
    ball.x = 0; ball.y = 0; ball.last_bounce = undefined
    ball.vector = [1,0]
  }

  /** Send state to clients */
  private broadcast() {
    const elapsed = (Date.now()-this.clock)/1000
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

  private endMatch() {
    clearInterval(this.loop!) ; PongRoom.rooms.delete(this.gameID)
    for (const p of this.players) {
      p.typedSocket.send('endMatch',{ isWinner: this.scoreMap.get(p.userID)! >= this.game.limit })
    }
  }
}
