import * as G from '../shared/gameTypes'
import { paddleClass, ballClass } from '../types/game'
import { createTypedEventSocket } from '../shared/gameEventWrapper'

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

  private readonly WIDTH :number 
  private readonly HEIGHT:number

  constructor(
    game: G.gameRoomInterface & { ballSpeed: number; paddleSpeed: number },
    players: G.playerInterface[]
  ) {
    this.game    = game
    this.gameID  = game.gameID
    this.players = players
	if(this.game.mode === 'duo'){
		this.WIDTH=18
		this.HEIGHT=10
	}
	else {
		this.WIDTH=12
		this.HEIGHT=12
	}
    // instantiate a paddleClass for each player, fulfilling paddleInterface
    for (const p of players) {
      const pi: G.paddleInterface = {
        userID:   p.userID,
        username: p.username ?? '',
        gameID:   game.gameID,
        x:        0,
        y:        0,
        hitbox:   [0, 0, 0.5, 2],      // [x, y, width, length]
        width:    0.5,
        length:   2,
        speed:    game.paddleSpeed,
		type: (p.playerSide === 'left' || p.playerSide === 'right') ? 'H'
			: (p.playerSide === 'top' || p.playerSide === 'bottom') ? 'V'
			:'H'
      }
      this.paddles.set(p.userID, new paddleClass(pi))
    }

    // create the ball
    this.balls.push(new ballClass(0, 0, 0.7, game.ballSpeed / 100))

    // register & start loop
    PongRoom.rooms.set(this.gameID, this)
    this.loop = setInterval(() => this.frame(), 1000 / 60)
  }

  /* ---------- Public API ---------- */

  /** Called by WS handler on key events */
  move(userID: number, dir: 'left' | 'right' | 'stop') {
    const paddle = this.paddles.get(userID)
    if (!paddle) return
    if (dir === 'left')  paddle.move_minus()
    if (dir === 'right') paddle.move_add()
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
      this.bounceArena(b)
      this.ballsMove(b)
    }
    // 2. Broadcast to all players
    this.broadcast()
  }

  private bounceArena(ball: ballClass) {
    if (ball.x - ball.radius <= -this.WIDTH || ball.x + ball.radius >= this.WIDTH)
      ball.vector[0] *= -1
    if (ball.y - ball.radius <= -this.HEIGHT || ball.y + ball.radius >= this.HEIGHT)
      ball.vector[1] *= -1
  }

  private ballsMove(b: ballClass) {
    b.x += b.vector[0] * b.speed
    b.y += b.vector[1] * b.speed
  }

  private broadcast() {
    // Build payload
    const paddlesPayload: Record<number, { pos: number; side: G.playerInterface['playerSide'] }> = {}
    this.players.forEach(p => {
      const pad = this.paddles.get(p.userID)!
      const pos = pad.paddleInterface.type === 'H' ? pad.paddleInterface.x : pad.paddleInterface.y
      paddlesPayload[p.userID] = { pos, side: p.playerSide }
    })
    const ballsPayload: Record<number, { x: number; y: number }> = {}
    this.balls.forEach((b, i) => (ballsPayload[i] = { x: b.x, y: b.y }))

    // Send renderData
    for (const p of this.players) {
      p.typedSocket.send('renderData', {
        type: 'renderData',
        paddles: paddlesPayload,
        balls: ballsPayload,
      })
    }
  }
}