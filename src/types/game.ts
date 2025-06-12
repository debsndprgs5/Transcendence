
import { paddleInterface, ballInterface } from '../shared/gameTypes'
import {
  paddleSize,
  paddleWidth,
  arenaLength2p,
  arenaWidth2p,
  arenaWidth4p,
  arenaLength4p,
  ballSize,
}	 from '../shared/gameTypes'

export class paddleClass {
  constructor(public paddleInterface: paddleInterface) {}

  /** Move paddle “forward” (right or down depending on orientation) */
  move_add(arenaWidth: number, arenaHeight: number) {
    const half = this.paddleInterface.length / 2;
    const limitX = arenaWidth / 2;
    const limitY = arenaHeight / 2;

    if (this.paddleInterface.type === 'H') {
      // Move along Y-axis for left/right paddles
      this.paddleInterface.y += this.paddleInterface.speed;
      // Clamp within vertical bounds
      this.paddleInterface.y = Math.max(
        -limitY + half,
        Math.min(limitY - half, this.paddleInterface.y)
      );
    } else {
      // Move along X-axis for top/bottom paddles
      this.paddleInterface.x += this.paddleInterface.speed;
      // Clamp within horizontal bounds
      this.paddleInterface.x = Math.max(
        -limitX + half,
        Math.min(limitX - half, this.paddleInterface.x)
      );
    }
  }

  /** Move paddle “backward” (left or up depending on orientation) */
  move_minus(arenaWidth: number, arenaHeight: number) {
    const half = this.paddleInterface.length / 2;
    const limitX = arenaWidth / 2;
    const limitY = arenaHeight / 2;

    if (this.paddleInterface.type === 'H') {
      // Move along Y-axis for left/right paddles
      this.paddleInterface.y -= this.paddleInterface.speed;
      // Clamp within vertical bounds
      this.paddleInterface.y = Math.max(
        -limitY + half,
        Math.min(limitY - half, this.paddleInterface.y)
      );
    } else {
      // Move along X-axis for top/bottom paddles
      this.paddleInterface.x -= this.paddleInterface.speed;
      // Clamp within horizontal bounds
      this.paddleInterface.x = Math.max(
        -limitX + half,
        Math.min(limitX - half, this.paddleInterface.x)
      );
    }
  }
}

export class ballClass {
  public x: number
  public y: number
  public radius: number
  public speed: number
  public vector: [number, number]
  public last_bounce?: paddleClass
  constructor(x: number, y: number, radius: number, speed: number) {
	this.x = x
	this.y = y
	this.radius = radius
	this.speed = speed
	this.vector = [1, 0]
  }
  bounce_x() { this.vector[0] *= -1 }
  bounce_y() { this.vector[1] *= -1 }
  move() {
	this.x += this.vector[0] * this.speed
	this.y += this.vector[1] * this.speed
  }
}
