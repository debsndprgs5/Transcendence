import * as LIMIT from '../shared/gameTypes';

export interface LocalGameState
{
	paddles: {
		left: { pos: number; score: number };
		right: { pos: number; score: number };
	};
	ball: { x: number; y: number; vx: number; vy: number; speed: number };
	gameRunning: boolean;
	isPaused: boolean;
	winningScore: number;
	elapsedTime: number;
}

export class LocalGameEngine
{
	private state: LocalGameState;
	private lastTime: number = 0;
	private animationId: number | null = null;
	private onUpdate: (state: LocalGameState) => void;
	private onGameEnd: (winner: 'left' | 'right', scores: { left: number; right: number }) => void;
	
	private gameStartTime: number = 0;
	private pausedTime: number = 0;
	private lastPauseStart: number = 0;
	private baseBallSpeed: number;
	private config: { ballSpeed: number; paddleSpeed: number; winningScore: number };
	
	private inputState = {
		player1Up: false,
		player1Down: false,
		player2Up: false,
		player2Down: false
	};
	
	constructor(
		config: { ballSpeed: number; paddleSpeed: number; winningScore: number },
		onUpdate: (state: LocalGameState) => void,
		onGameEnd: (winner: 'left' | 'right', scores: { left: number; right: number }) => void
	)
	{
		this.onUpdate = onUpdate;
		this.onGameEnd = onGameEnd;
		this.config = config;
		this.baseBallSpeed = config.ballSpeed / 240;
		
		this.state = {
			paddles: {
				left: { pos: 0, score: 0 },
				right: { pos: 0, score: 0 }
			},
			ball: { 
				x: 0, 
				y: 0, 
				vx: Math.random() > 0.5 ? 1 : -1,
				vy: Math.random() * 2 - 1,
				speed: this.baseBallSpeed
			},
			gameRunning: true,
			isPaused: false,
			winningScore: config.winningScore,
					elapsedTime: 0
		};
		
		this.setupInputListeners();
		this.start();
	}
	
	private handleKeyDown = (e: KeyboardEvent) =>
	{
		const gameKeys = ['a', 'D', 'd', 'D', '4', '6', 'p', 'P'];
		
		if (gameKeys.includes(e.key))
		{
			e.preventDefault();
			e.stopPropagation();
		}
		
		switch (e.key)
		{
			case 'a':
			case 'A': this.inputState.player1Up = true; break;
			case 'd':
			case 'D': this.inputState.player1Down = true; break;
			case '4': this.inputState.player2Up = true; break;
			case '6': this.inputState.player2Down = true; break;
			case 'p':
			case 'P': this.togglePause(); break;
		}
	};
	
	private handleKeyUp = (e: KeyboardEvent) =>
	{
		const gameKeys = ['a', 'A', 'd', 'D', '4', '6'];
		
		if (gameKeys.includes(e.key))
		{
			e.preventDefault();
			e.stopPropagation();
		}
		
		switch (e.key)
		{
			case 'a':
			case 'A': this.inputState.player1Up = false; break;
			case 'd':
			case 'D': this.inputState.player1Down = false; break;
			case '4': this.inputState.player2Up = false; break;
			case '6': this.inputState.player2Down = false; break;
		}
	};
	
	private setupInputListeners(): void
	{
		window.addEventListener('keydown', this.handleKeyDown, true);
		window.addEventListener('keyup', this.handleKeyUp, true);
	}
	
	public togglePause(): void
	{
		if (this.state.isPaused)
		{
			this.pausedTime += (performance.now() - this.lastPauseStart) / 1000;
		}
		else
		{
			this.lastPauseStart = performance.now();
		}
		
		this.state.isPaused = !this.state.isPaused;
	}
	
	public start(): void
	{
		this.gameStartTime = performance.now();
		this.lastTime = this.gameStartTime;
		this.gameLoop();
	}
	
	private gameLoop = (): void =>
	{
		if (!this.state.gameRunning) return;
		
		const currentTime = performance.now();
		const deltaTime = (currentTime - this.lastTime) / 1000;
		this.lastTime = currentTime;
		
		if (!this.state.isPaused)
		{
			this.state.elapsedTime = (currentTime - this.gameStartTime) / 1000 - this.pausedTime;
			
			this.updatePaddles(deltaTime);
			this.updateBall(deltaTime);
			this.checkCollisions();
			this.checkScore();
		}
		
		this.onUpdate(this.state);
		
		this.animationId = requestAnimationFrame(this.gameLoop);
	};
	
	private updatePaddles(deltaTime: number): void
	{
		const baseSpeed = this.config.paddleSpeed / 100;
		const speed = baseSpeed * deltaTime * 60;
		const maxPos = (LIMIT.arenaLength2p / 2) - (LIMIT.paddleSize / 2);
		
		this.updatePaddle('left', this.inputState.player1Up, this.inputState.player1Down, speed, maxPos);
		this.updatePaddle('right', this.inputState.player2Up, this.inputState.player2Down, speed, maxPos);
	}
	
	private updatePaddle(side: 'left' | 'right', up: boolean, down: boolean, speed: number, maxPos: number): void
	{
		if (up && !down)
		{
			this.state.paddles[side].pos = Math.min(maxPos, this.state.paddles[side].pos + speed);
		}
		else if (down && !up)
		{
			this.state.paddles[side].pos = Math.max(-maxPos, this.state.paddles[side].pos - speed);
		}
	}
	
	private updateBall(deltaTime: number): void
	{
		const totalDistance = this.state.ball.speed * deltaTime * 60;
		const maxStep = LIMIT.ballSize / 2;
		const steps = Math.ceil(totalDistance / maxStep);
		const stepSize = totalDistance / steps;
		
		for (let i = 0; i < steps; i++)
		{
			this.state.ball.x += this.state.ball.vx * stepSize;
			this.state.ball.y += this.state.ball.vy * stepSize;
		}
		
		const maxY = (LIMIT.arenaLength2p / 2) - (LIMIT.ballSize / 2);
		
		const maxAngleRatio = Math.tan(75 * Math.PI/180);
		const minAngleRatio = Math.tan(15 * Math.PI/180);
		
		if (this.state.ball.y + LIMIT.ballSize/2 >= maxY && this.state.ball.vy > 0)
		{
			this.state.ball.y = maxY - LIMIT.ballSize/2 - 1e-3;
			this.state.ball.vy *= -1;
			this.clampBallAngle(maxAngleRatio, minAngleRatio);
		}
		
		if (this.state.ball.y - LIMIT.ballSize/2 <= -maxY && this.state.ball.vy < 0)
		{
			this.state.ball.y = -maxY + LIMIT.ballSize/2 + 1e-3;
			this.state.ball.vy *= -1;
			this.clampBallAngle(maxAngleRatio, minAngleRatio);
		}
	}
	
	private clampBallAngle(maxAngleRatio: number, minAngleRatio: number): void
	{
		let ratio = this.state.ball.vx / this.state.ball.vy;
		const sign = Math.sign(ratio) || 1;

		ratio = Math.min(maxAngleRatio, Math.max(minAngleRatio, Math.abs(ratio))) * sign;

		this.state.ball.vx = ratio * this.state.ball.vy;

		const len = Math.hypot(this.state.ball.vx, this.state.ball.vy);
		this.state.ball.vx /= len;
		this.state.ball.vy /= len;
	}
	
	private checkCollisions(): void
	{
		this.checkPaddleCollision('left');
		this.checkPaddleCollision('right');
	}
	
	private checkPaddleCollision(side: 'left' | 'right'): void
	{
		const R = LIMIT.ballSize / 2;
		const arenaHalfWidth = LIMIT.arenaWidth2p / 2;
		const wallThickness = 0.25;
		const paddleHalfWidth = LIMIT.paddleWidth / 2;
		
		const isLeft = side === 'left';
		const pi_x = isLeft 
			? -(arenaHalfWidth - wallThickness - paddleHalfWidth)
			: arenaHalfWidth - wallThickness - paddleHalfWidth;
		const pi_y = this.state.paddles[side].pos;
		const pi_width = LIMIT.paddleWidth;
		const pi_length = LIMIT.paddleSize;
		
		
		const left = pi_x - pi_width / 2;
		const right = pi_x + pi_width / 2;
		const top = pi_y - pi_length / 2;
		const bottom = pi_y + pi_length / 2;

		const cx = Math.max(left, Math.min(this.state.ball.x, right));
		const cy = Math.max(top, Math.min(this.state.ball.y, bottom));
		const dx = cx - this.state.ball.x;
		const dy = cy - this.state.ball.y;
		
		if (dx * dx + dy * dy > R * R) return;

		const maxAngle = 75 * Math.PI / 180;

		const rel = (this.state.ball.y - pi_y) / (pi_length / 2);
		const angle = Math.max(-1, Math.min(1, rel)) * maxAngle;

		const dirX = isLeft ? 1 : -1;
		this.state.ball.vx = dirX * Math.cos(angle);
		this.state.ball.vy = Math.sin(angle);
		this.state.ball.x += this.state.ball.vx * 0.01;

		const n = Math.hypot(this.state.ball.vx, this.state.ball.vy);
		this.state.ball.vx /= n;
		this.state.ball.vy /= n;

		this.state.ball.speed = Math.min(this.state.ball.speed * 1.15, this.baseBallSpeed * 3);
	}

	
	private checkScore(): void
	{
		const arenaHalfWidth = LIMIT.arenaWidth2p / 2;
		
		if (this.state.ball.x < -arenaHalfWidth)
		{
			this.state.paddles.right.score++;
			this.resetBall();
			
			if (this.state.paddles.right.score >= this.state.winningScore)
			{
				this.endGame('right');
			}
		}
		else if (this.state.ball.x > arenaHalfWidth)
		{
			this.state.paddles.left.score++;
			this.resetBall();
			
			if (this.state.paddles.left.score >= this.state.winningScore)
			{
				this.endGame('left');
			}
		}
	}
	
	private resetBall(): void
	{
		this.state.ball.x = 0;
		this.state.ball.y = 0;
		
		this.state.ball.speed = this.baseBallSpeed;
		
		const maxServeDeg = 45;
		const rad = (Math.random() * 2 * maxServeDeg - maxServeDeg) * Math.PI / 180;
		
		const dirX = Math.random() > 0.5 ? 1 : -1;
		this.state.ball.vx = dirX * Math.cos(rad);
		this.state.ball.vy = Math.sin(rad);
		
		const l = Math.hypot(this.state.ball.vx, this.state.ball.vy);
		this.state.ball.vx /= l;
		this.state.ball.vy /= l;
	}
	
	private endGame(winner: 'left' | 'right'): void
	{
		this.state.gameRunning = false;
		this.onGameEnd(winner, {
			left: this.state.paddles.left.score,
			right: this.state.paddles.right.score
		});
	}
	
	public dispose(): void
	{
		this.state.gameRunning = false;
		
		if (this.animationId)
		{
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		
		window.removeEventListener('keydown', this.handleKeyDown, true);
		window.removeEventListener('keyup', this.handleKeyUp, true);
	}
	
	public getState(): LocalGameState
	{
		return this.state;
	}
}