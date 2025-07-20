import * as LIMIT from '../shared/gameTypes';

export interface LocalGameState
{
	paddles: {
		left: { pos: number; score: number };
		right: { pos: number; score: number };
	};
	ball: { x: number; y: number; vx: number; vy: number };
	gameRunning: boolean;
	isPaused: boolean;
	winningScore: number;
	ballSpeed: number;
	paddleSpeed: number;
	elapsedTime: number;
}

export class LocalPongEngine
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
	private speedMultiplier: number = 1.0;
	
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
		
		this.baseBallSpeed = (config.ballSpeed / 50) * 0.25;
		
		this.state = {
			paddles: {
				left: { pos: 0, score: 0 },
				right: { pos: 0, score: 0 }
			},
			ball: { 
				x: 0, 
				y: 0, 
				vx: this.baseBallSpeed * (Math.random() > 0.5 ? 1 : -1),
				vy: this.baseBallSpeed * 0.6 * (Math.random() - 0.5)
			},
			gameRunning: true,
			isPaused: false,
			winningScore: config.winningScore,
			ballSpeed: config.ballSpeed,
			paddleSpeed: config.paddleSpeed,
			elapsedTime: 0
		};
		
		this.setupInputListeners();
		this.start();
	}
	
	private setupInputListeners(): void
	{
		const handleKeyDown = (e: KeyboardEvent) =>
		{
			const gameKeys = ['q', 'Q', 'd', 'D', 'ArrowLeft', 'ArrowRight'];
			if (gameKeys.includes(e.key))
			{
				e.preventDefault();
				e.stopPropagation();
			}
			
			switch (e.key)
			{
				case 'q':
				case 'Q': this.inputState.player1Up = true; break;
				case 'd':
				case 'D': this.inputState.player1Down = true; break;
				case 'ArrowLeft': this.inputState.player2Up = true; break;
				case 'ArrowRight': this.inputState.player2Down = true; break;
			}
		};
		
		const handleKeyUp = (e: KeyboardEvent) =>
		{
			const gameKeys = ['q', 'Q', 'd', 'D', 'ArrowLeft', 'ArrowRight'];
			if (gameKeys.includes(e.key))
			{
				e.preventDefault();
				e.stopPropagation();
			}
			
			switch (e.key)
			{
				case 'q':
				case 'Q': this.inputState.player1Up = false; break;
				case 'd':
				case 'D': this.inputState.player1Down = false; break;
				case 'ArrowLeft': this.inputState.player2Up = false; break;
				case 'ArrowRight': this.inputState.player2Down = false; break;
			}
		};
		
		window.addEventListener('keydown', handleKeyDown, true);
		window.addEventListener('keyup', handleKeyUp, true);
		
		(this as any).handleKeyDown = handleKeyDown;
		(this as any).handleKeyUp = handleKeyUp;
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
		const speed = (this.state.paddleSpeed / 50) * 15 * deltaTime;
		const maxPos = (LIMIT.arenaLength2p / 2) - (LIMIT.paddleSize / 2);
		
		if (this.inputState.player1Up && !this.inputState.player1Down)
		{
			this.state.paddles.left.pos = Math.min(maxPos, this.state.paddles.left.pos + speed);
		}
		else if (this.inputState.player1Down && !this.inputState.player1Up)
		{
			this.state.paddles.left.pos = Math.max(-maxPos, this.state.paddles.left.pos - speed);
		}
		
		if (this.inputState.player2Up && !this.inputState.player2Down)
		{
			this.state.paddles.right.pos = Math.min(maxPos, this.state.paddles.right.pos + speed);
		}
		else if (this.inputState.player2Down && !this.inputState.player2Up)
		{
			this.state.paddles.right.pos = Math.max(-maxPos, this.state.paddles.right.pos - speed);
		}
	}
	
	private updateBall(deltaTime: number): void
	{
		this.state.ball.x += this.state.ball.vx * deltaTime * 60;
		this.state.ball.y += this.state.ball.vy * deltaTime * 60;
		
		const maxY = (LIMIT.arenaLength2p / 2) - (LIMIT.ballSize / 2);
		if (this.state.ball.y > maxY || this.state.ball.y < -maxY)
		{
			this.state.ball.vy = -this.state.ball.vy;
			this.state.ball.y = Math.max(-maxY, Math.min(maxY, this.state.ball.y));
		}
	}
	
	private checkCollisions(): void
	{
		const ballRadius = LIMIT.ballSize / 2;
		const paddleHalfWidth = LIMIT.paddleWidth / 2;
		const paddleHalfSize = LIMIT.paddleSize / 2;
		const arenaHalfWidth = LIMIT.arenaWidth2p / 2;
		
		const leftPaddleX = -(arenaHalfWidth - 0.25 - paddleHalfWidth);
		if (this.state.ball.x - ballRadius <= leftPaddleX + paddleHalfWidth &&
			this.state.ball.x > leftPaddleX &&
			this.state.ball.y >= this.state.paddles.left.pos - paddleHalfSize &&
			this.state.ball.y <= this.state.paddles.left.pos + paddleHalfSize &&
			this.state.ball.vx < 0)
		{
			this.handlePaddleBounce('left');
		}
		
		const rightPaddleX = arenaHalfWidth - 0.25 - paddleHalfWidth;
		if (this.state.ball.x + ballRadius >= rightPaddleX - paddleHalfWidth &&
			this.state.ball.x < rightPaddleX &&
			this.state.ball.y >= this.state.paddles.right.pos - paddleHalfSize &&
			this.state.ball.y <= this.state.paddles.right.pos + paddleHalfSize &&
			this.state.ball.vx > 0)
		{
			this.handlePaddleBounce('right');
		}
	}
	
	private handlePaddleBounce(side: 'left' | 'right'): void
	{
		const paddlePos = this.state.paddles[side].pos;
		const paddleHalfSize = LIMIT.paddleSize / 2;
		const arenaHalfWidth = LIMIT.arenaWidth2p / 2;
		const paddleHalfWidth = LIMIT.paddleWidth / 2;
		const ballRadius = LIMIT.ballSize / 2;
		
		const hitPos = (this.state.ball.y - paddlePos) / paddleHalfSize;
		const bounceAngle = hitPos * Math.PI / 3;
		
		this.speedMultiplier = Math.min(2.0, this.speedMultiplier + 0.05);
		const newSpeed = this.baseBallSpeed * this.speedMultiplier;
		
		if (side === 'left')
		{
			this.state.ball.vx = newSpeed * Math.cos(bounceAngle);
			this.state.ball.vy = newSpeed * Math.sin(bounceAngle);
			
			const leftPaddleX = -(arenaHalfWidth - 0.25 - paddleHalfWidth);
			this.state.ball.x = leftPaddleX + paddleHalfWidth + ballRadius;
		}
		else
		{
			this.state.ball.vx = -newSpeed * Math.cos(bounceAngle);
			this.state.ball.vy = newSpeed * Math.sin(bounceAngle);
			
			const rightPaddleX = arenaHalfWidth - 0.25 - paddleHalfWidth;
			this.state.ball.x = rightPaddleX - paddleHalfWidth - ballRadius;
		}
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
		
		this.speedMultiplier = 1.0;
		
		const maxAngle = Math.PI / 6;
		const angle = (Math.random() - 0.5) * maxAngle;
		
		this.state.ball.vx = this.baseBallSpeed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
		this.state.ball.vy = this.baseBallSpeed * Math.sin(angle);
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
		}
		
		if ((this as any).handleKeyDown)
		{
			window.removeEventListener('keydown', (this as any).handleKeyDown, true);
			window.removeEventListener('keyup', (this as any).handleKeyUp, true);
		}
	}
	
	public getState(): LocalGameState
	{
		return this.state;
	}
}