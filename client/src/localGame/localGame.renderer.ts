import { PongRenderer } from '../pong_render';
import { LocalGameEngine, LocalGameState } from './localGame.engine';
import { state } from '../api';
import { showPongMenu } from '../pong_rooms';
import { pongState } from '../pong_socket';
import { cleanupLocalGameConfig } from './localGame.manager';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class LocalGameRenderer
{
	private baseRenderer: PongRenderer;
	private gameEngine: LocalGameEngine;
	private canvas: HTMLCanvasElement;
	private isDisposing: boolean = false;
	private activeUI: GUI.AdvancedDynamicTexture | null = null;
	
	constructor(canvas: HTMLCanvasElement, config: { ballSpeed: number; paddleSpeed: number; winningScore: number })
	{
		this.canvas = canvas;

		const mockSocket = {
			send: () => {},
			on: () => {},
			cleanup: () => {},
			removeAllListeners: () => {}
		} as any;
		
		const usernames = {
			left: 'Player1',
			right: 'Player2',
			top: '',
			bottom: ''
		};
		
		this.baseRenderer = new PongRenderer(
			canvas,
			mockSocket,
			2,
			'Local Match',
			'left',
			usernames
		);
		
		this.gameEngine = new LocalGameEngine(
			config,
			(gameState) => this.updateRenderer(gameState),
			(winner, scores) => this.handleGameEnd(winner, scores)
		);

		this.gameEngine.start();
	}
	
	
	private updateRenderer(gameState: LocalGameState): void
	{
		const renderData = {
			paddles: {
				0: { 
					pos: gameState.paddles.left.pos, 
					side: 'left' as const, 
					score: gameState.paddles.left.score 
				},
				1: { 
					pos: gameState.paddles.right.pos, 
					side: 'right' as const, 
					score: gameState.paddles.right.score 
				}
			},
			balls: {
				0: { 
					x: gameState.ball.x, 
					y: gameState.ball.y 
				}
			},
			elapsed: gameState.elapsedTime || 0,
			isPaused: gameState.isPaused
		};
		
		this.baseRenderer.updateScene(renderData);
	}
	
	private handleGameEnd(winner: 'left' | 'right', scores: { left: number; right: number }): void
	{
		this.showEndGameOverlay(winner, scores);
	}
	
	private showEndGameOverlay(winner: 'left' | 'right', scores: { left: number; right: number }): void
	{
		if (this.activeUI)
		{
			this.activeUI.dispose();
			this.activeUI = null;
		}

		const scene = this.baseRenderer.getScene();
		if (!scene || scene.isDisposed) return;

		const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("EndGameUI", true, scene);
		this.activeUI = ui;
		
		const overlay = new GUI.Rectangle();
		overlay.background = "rgba(0, 0, 0, 0.16)";
		overlay.width = "100%";
		overlay.height = "100%";
		overlay.thickness = 0;
		ui.addControl(overlay);
		
		const mainContainer = new GUI.Rectangle();
		mainContainer.width = "600px";
		mainContainer.height = "400px";
		mainContainer.background = "rgba(30, 30, 30, 0.9)";
		mainContainer.thickness = 2;
		mainContainer.color = "#38bdf8";
		mainContainer.cornerRadius = 10;
		overlay.addControl(mainContainer);
		
		const titleText = new GUI.TextBlock();
		titleText.text = "🤌 Endgame 🤌";
		titleText.color = "#38bdf8";
		titleText.fontSize = "36px";
		titleText.fontWeight = "bold";
		titleText.top = "-120px";
		titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		mainContainer.addControl(titleText);
		
		const winnerText = new GUI.TextBlock();
		const winnerName = winner === 'left' ? 'Player 1' : 'Player 2';
		winnerText.text = `${winnerName} WINS!`;
		winnerText.color = winner === 'left' ? "#22c55e" : "#ef4444";
		winnerText.fontSize = "28px";
		winnerText.fontWeight = "bold";
		winnerText.top = "-60px";
		winnerText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		mainContainer.addControl(winnerText);
		
		const scoreText = new GUI.TextBlock();
		scoreText.text = `Final Score: ${scores.left} - ${scores.right}`;
		scoreText.color = "white";
		scoreText.fontSize = "20px";
		scoreText.top = "-10px";
		scoreText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		mainContainer.addControl(scoreText);
		
		const buttonContainer = new GUI.StackPanel();
		buttonContainer.isVertical = false;
		buttonContainer.spacing = 20;
		buttonContainer.top = "60px";
		mainContainer.addControl(buttonContainer);
		
		const playAgainBtn = GUI.Button.CreateSimpleButton("playAgain", "Play Again");
		playAgainBtn.widthInPixels = 150;
		playAgainBtn.heightInPixels = 50;
		playAgainBtn.color = "white";
		playAgainBtn.background = "#22c55e";
		playAgainBtn.cornerRadius = 5;
		playAgainBtn.onPointerClickObservable.add(() => {
			this.cleanupActiveUI();
			this.restartGame();
		});
		buttonContainer.addControl(playAgainBtn);
		
		const menuBtn = GUI.Button.CreateSimpleButton("menu", "Back to Menu");
		menuBtn.widthInPixels = 150;
		menuBtn.heightInPixels = 50;
		menuBtn.color = "white";
		menuBtn.background = "#ef4444";
		menuBtn.cornerRadius = 5;
		menuBtn.onPointerClickObservable.add(() => {
			this.cleanupActiveUI();
			this.returnToLocalMenu();
		});
		buttonContainer.addControl(menuBtn);
	}

	private cleanupActiveUI(): void {
		if (this.activeUI)
		{
			this.activeUI.dispose();
			this.activeUI = null;
		}
	}

	private restartGame(): void {
		if (this.gameEngine)
		{
			this.gameEngine.dispose();
		}
		
		const config = {
			ballSpeed: state.localGameConfig?.ballSpeed || 50,
			paddleSpeed: state.localGameConfig?.paddleSpeed || 50,
			winningScore: state.localGameConfig?.winningScore || 5
		};
		
		this.gameEngine = new LocalGameEngine(
			config,
			(gameState) => this.updateRenderer(gameState),
			(winner, scores) => this.handleGameEnd(winner, scores)
		);
	}
	
	private returnToLocalMenu(): void {
		if (this.isDisposing) return;
		this.isDisposing = true;
		
		this.cleanupRenderer();
		
		pongState.localMapRenderer = null;
		cleanupLocalGameConfig();
		
		state.localGameConfig = undefined;
		
		localStorage.removeItem('pong_view');
		state.canvasViewState = 'mainMenu';
		showPongMenu();
	}

	private cleanupRenderer(): void {
		this.cleanupActiveUI();

		if (this.gameEngine)
		{
			this.gameEngine.dispose();
		}
		
		if (this.baseRenderer)
		{
			this.baseRenderer.dispose();
		}
	}
	
	public dispose(): void {
		if (this.isDisposing) return;
		this.returnToLocalMenu();
	}
	
	public handleResize(): void
	{
		if (this.baseRenderer && !this.isDisposing)
		{
			this.baseRenderer.handleResize();
		}
	}
} 