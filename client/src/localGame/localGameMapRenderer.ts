import { state } from '../api';
import { showPongMenu } from '../pong_rooms';
import { pongState } from '../pong_socket';
import { LocalPongRenderer } from './localPongRenderer';

export class LocalGameMapRenderer
{
	private localPongRenderer: LocalPongRenderer;
	private canvas: HTMLCanvasElement;
	private escapeKeyHandler: (e: KeyboardEvent) => void;
	
	constructor(canvas: HTMLCanvasElement)
	{
		this.canvas = canvas;
		
		canvas.focus();
		canvas.tabIndex = 0;
		
		const config = {
			ballSpeed: state.localGameConfig?.ballSpeed || 50,
			paddleSpeed: state.localGameConfig?.paddleSpeed || 50,
			winningScore: state.localGameConfig?.winningScore || 5
		};
		
		this.localPongRenderer = new LocalPongRenderer(canvas, config);
		
		this.escapeKeyHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape' || e.key === 'Esc')
			{
				e.preventDefault();
				this.transitionOut();
			}
		};
		
		window.addEventListener('keydown', this.escapeKeyHandler, true);
	}
	
	public transitionOut(): void
	{
		this.dispose();
	}
	
	public dispose(): void
	{
		this.localPongRenderer.dispose();
		window.removeEventListener('keydown', this.escapeKeyHandler, true);
	}
	
	public handleResize(): void
	{
		this.localPongRenderer.handleResize();
	}
} 