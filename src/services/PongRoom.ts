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
    if (ball.x - ball.radius <= -this.WIDTH/2 || ball.x + ball.radius >= this.WIDTH/2)
      ball.vector[0] *= -1
    if (ball.y - ball.radius <= -this.HEIGHT/2 || ball.y + ball.radius >= this.HEIGHT/2)
      ball.vector[1] *= -1
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