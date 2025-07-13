import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import { rmMemberFromRoom } from './handlers'
import * as BABYLON from '@babylonjs/core';
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';

export class PongRenderer{

	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.FreeCamera;

	private socket: TypedSocket;

	private paddles: BABYLON.Mesh[] = [];
	private paddleMap: Record<'left'|'right'|'top'|'bottom', BABYLON.Mesh | undefined>;
	private balls: BABYLON.Mesh[] = [];
	private sideWalls: BABYLON.Mesh[] = [];
	private frontWalls: BABYLON.Mesh[] = [];

	private guiTexture!: GUI.AdvancedDynamicTexture;
	private timeText!: GUI.TextBlock;
	private scoreText!: GUI.TextBlock;
	private avatarSquares!: GUI.AdvancedDynamicTexture; // Avatar near the name
	private avatarCirles!: GUI.AdvancedDynamicTexture;  // Small avatars linked to paddles
	private playerCount: number;
	private playerSide: 'left' | 'right' | 'top' | 'bottom';
	private playersInfo: Record<'left' | 'right' | 'top' | 'bottom', string> = {
		left: '',
		right: '',
		top: '',
		bottom: ''
	};

	private isPaused: boolean;
	private pauseUI!: {
		container: GUI.Rectangle;
		icon: GUI.TextBlock;
		message: GUI.TextBlock;
	};
	private scoreTextBlocks: Partial<Record<'left' | 'right' | 'top' | 'bottom', GUI.TextBlock>> = {};
	private inputState = { left: false, right: false };
	private currentDir: 'left' | 'right' | 'stop' = 'stop';

	private handleKeyDown!: (e: KeyboardEvent) => void;
	private handleKeyUp!: (e: KeyboardEvent) => void;

	constructor(
	canvas: HTMLCanvasElement,
	typedSocket: TypedSocket,
	playerCount: number,
	gameName:string,
	playerSide: 'left' | 'right' | 'top' | 'bottom',
	usernames: Record<'left' | 'right' | 'top' | 'bottom', string>
	) {
		this.socket = typedSocket;
		this.playerCount = playerCount;
		this.playerSide = playerSide;
		this.playersInfo=usernames;
		this.isPaused = false;

		localStorage.setItem('playerCount', playerCount.toString());
		localStorage.setItem('playerSide', playerSide);
		localStorage.setItem('usernames', JSON.stringify(usernames));
		if(gameName !== undefined)
			localStorage.setItem('gameName', gameName);
		
		this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
		this.scene = new BABYLON.Scene(this.engine);
		this.setupGUI();
		this.setupPauseUI();
		this.setupCamera();
		this.setupLighting();
		this.createWalls();
		this.createGameObjects();
		this.paddleMap = {
			left:   this.paddles[0],
			right:  this.paddles[1],
			top:    this.paddles[2],
			bottom: this.paddles[3],
		};
		this.setupInitialPositions();
		this.initInputListeners();
		this.startRenderLoop();
		this.handleResize();
	}

	private setupCamera() {
		const distance = 30;
		const height = 30;

		let camPos: BABYLON.Vector3;

		switch (this.playerSide) {
			case 'left':
				camPos = new BABYLON.Vector3(-distance, height, 0);
				break;
			case 'right':
				camPos = new BABYLON.Vector3(distance, height, 0);
						break;
			case 'top':
				camPos = new BABYLON.Vector3(0, height, distance);
				break;
			case 'bottom':
				camPos = new BABYLON.Vector3(0, height, -distance);
				break;
			default:
				camPos = new BABYLON.Vector3(0, height, -distance); // fallback
		}

		this.camera = new BABYLON.FreeCamera("camera", camPos, this.scene);
		this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
	}
	private async setupGUI() {
		this.guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);

		// Time at top center
		this.timeText = new GUI.TextBlock();
		this.timeText.color = "white";
		this.timeText.fontSize = 14;
		this.timeText.top = "10px";
		this.timeText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		this.timeText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		this.guiTexture.addControl(this.timeText);

		if (this.playerCount === 2) {
			// LEFT name
			const leftName = new GUI.TextBlock();
			leftName.text = this.playersInfo.left;
			leftName.color = "white";
			leftName.fontSize = 12;
			leftName.top = "5px";
			leftName.left = "20px";
			leftName.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			leftName.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(leftName);

			// RIGHT name
			const rightName = new GUI.TextBlock();
			rightName.text = this.playersInfo.right;
			rightName.color = "white";
			rightName.fontSize = 12;
			rightName.top = "5px";
			rightName.left = "-20px";
			rightName.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			rightName.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(rightName);

			// LEFT score under left name
			const leftScore = new GUI.TextBlock();
			leftScore.color = "white";
			leftScore.fontSize = 14;
			leftScore.top = "65px";
			leftScore.left = "20px";
			leftScore.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			leftScore.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(leftScore);
			this.scoreTextBlocks.left = leftScore;

			// RIGHT score under right name
			const rightScore = new GUI.TextBlock();
			rightScore.color = "white";
			rightScore.fontSize = 14;
			rightScore.top = "65px";
			rightScore.left = "-20px";
			rightScore.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			rightScore.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(rightScore);
			this.scoreTextBlocks.right = rightScore;

			// LEFT AVATAR
			const leftUsername = this.playersInfo.left;
			let leftAvatarurl: string;
			try {
				const json = await apiFetch(`/users/${encodeURIComponent(leftUsername)}/avatar`) as { avatar_url?: string };
				leftAvatarurl = json.avatar_url ?? "";
			} catch {
				leftAvatarurl = "";
			}

			if (!leftAvatarurl) {
				const lstyle = /^\d+$/.test(leftUsername)
				? 'bottts'
				: 'initials';

				leftAvatarurl = `https://api.dicebear.com/9.x/${lstyle}/svg`
								    + `?seed=${encodeURIComponent(leftUsername)}`
									+ `&backgroundType=gradientLinear`
  									+ `&backgroundColor=919bff,133a94`  
  								    + `&size=64`
								    + `&radius=50`
			}

			const leftAvatarImage = new GUI.Image("leftAvatar", leftAvatarurl);
			leftAvatarImage.width = "40px";
			leftAvatarImage.height = "40px";
			leftAvatarImage.left = "20px";
			leftAvatarImage.top = "25px";
			leftAvatarImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			leftAvatarImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(leftAvatarImage);

			// RIGHT AVATAR
			const rightUsername = this.playersInfo.right;
			let rightAvatarurl: string;
			try {
				const json = await apiFetch(`/users/${encodeURIComponent(rightUsername)}/avatar`) as { avatar_url?: string };
				rightAvatarurl = json.avatar_url ?? "";
			} catch {
				rightAvatarurl = "";
			}

			if (!rightAvatarurl) {
				const rstyle = /^\d+$/.test(rightUsername)
				? 'bottts'
				: 'initials';

				rightAvatarurl = `https://api.dicebear.com/9.x/${rstyle}/svg`
								    + `?seed=${encodeURIComponent(rightUsername)}`
									+ `&backgroundType=gradientLinear`
  									+ `&backgroundColor=919bff,133a94`  
  								    + `&size=64`
								    + `&radius=50`
			}

			const rightAvatarImage = new GUI.Image("rightAvatar", rightAvatarurl);
			rightAvatarImage.width = "40px";
			rightAvatarImage.height = "40px";
			rightAvatarImage.left = "-20px";
			rightAvatarImage.top = "25px";
			rightAvatarImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			rightAvatarImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(rightAvatarImage);
			}
}

	private setupPauseUI() {
		this.pauseUI = {
			container: new GUI.Rectangle(),
			icon: new GUI.TextBlock(),
			message: new GUI.TextBlock()
		};

		const { container, icon, message } = this.pauseUI;

		// Container: semi-transparent overlay covering full screen
		container.width = "100%";
		container.height = "100%";
		container.background = "rgba(0, 0, 0, 0.5)";
		container.thickness = 0;
		container.isVisible = false;

		// Icon: large pause symbol "||"
		icon.text = "||";
		icon.color = "white";
		icon.fontSize = "160px";
		icon.fontWeight = "bold";
		icon.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		icon.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

		// Message: small text under the pause icon
		message.text = "Waiting for connection...";
		message.color = "white";
		message.fontSize = "24px";
		message.top = "100px"; // below the pause icon
		message.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		message.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

		container.addControl(icon);
		container.addControl(message);
		this.guiTexture.addControl(container);
	}
	private setupLighting() {
			new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
	}
	private createWalls() {
		const width2P = LIMIT.arenaWidth2p; // -8 to 8
		const depth2P = LIMIT.arenaLength2p; // -5 to 5
		const width4P = LIMIT.arenaWidth4p; // -6 to 6
		const depth4P = LIMIT.arenaWidth4p; // -6 to 6

		const wallHeight = 0.3;
		const wallDepth = 0.5;
		const wallLength = 0.25;

		const width = this.playerCount === 2 ? width2P : width4P;
		const depth = this.playerCount === 2 ? depth2P : depth4P;

		// Front/back walls
		const topWall = BABYLON.MeshBuilder.CreateBox("topWall", {
			width,
			height: wallHeight,
			depth: wallDepth,
		}, this.scene);
		topWall.position.z = depth / 2 + wallDepth / 2;
		this.frontWalls.push(topWall);

		const bottomWall = topWall.clone("bottomWall");
		bottomWall.position.z = -depth / 2 - wallDepth / 2;
		this.frontWalls.push(bottomWall);

		// Side walls
		const sideWall = BABYLON.MeshBuilder.CreateBox("sideWall", {
			width: wallLength,
			height: wallHeight,
			depth,
		}, this.scene);
		sideWall.position.x = -width / 2 - wallLength / 2;
		this.sideWalls.push(sideWall);

		const rightWall = sideWall.clone("rightWall");
		rightWall.position.x = width / 2 + wallLength / 2;
		this.sideWalls.push(rightWall);
	}

	private createGameObjects() {
		const paddleSize2P = { height: 1, width: LIMIT.paddleWidth, depth: LIMIT.paddleSize }; // Original paddle size
		const paddleSize4P = { height: 1, width: LIMIT.paddleSize, depth: LIMIT.paddleWidth }; // Rotated for top/bottom

		for (let i = 0; i < this.playerCount; i++) {
			const isVertical = i === 0 || i === 1;
			const paddle = BABYLON.MeshBuilder.CreateBox(`paddle${i}`, isVertical ? paddleSize2P : paddleSize4P, this.scene);
			const mat = new BABYLON.StandardMaterial(`mat${i}`, this.scene);
			mat.diffuseColor = BABYLON.Color3.Random();
			paddle.material = mat;
			this.paddles.push(paddle);
		}

		const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter:LIMIT.ballSize }, this.scene);
		this.balls.push(ball);
	}

	private setupInitialPositions() {
	  // wall thicknesses: along X use wallLength, along Z use wallDepth
	  const wallLength = 0.25;
	  const wallDepth  = 0.5;

	  if (this.playerCount === 2) {
	    // 2-player mode: paddles on left/right, move along Z
	    const halfW2    = LIMIT.arenaWidth2p  / 2;    // half arena width
	    const padHalfX  = LIMIT.paddleWidth    / 2;   // half paddle width

	    // LEFT paddle (index 0)
	    this.paddles[0].position.set(
	      - (halfW2 - wallLength - padHalfX), // X just inside left wall
	       0,                                  // Y
	       0                                   // Z center
	    );

	    // RIGHT paddle (index 1)
	    this.paddles[1].position.set(
	       (halfW2 - wallLength - padHalfX),   // X just inside right wall
	       0,
	       0
	    );
	  } else {
	    // 4-player mode: left/right on X, top/bottom on Z
	    const halfW4   = LIMIT.arenaWidth4p   / 2;
	    const halfL4   = LIMIT.arenaLength4p  / 2;
	    const padHalfX = LIMIT.paddleWidth    / 2;
	    const padHalfZ = LIMIT.paddleSize     / 2;

	    // LEFT paddle (index 0)
	    this.paddles[0].position.set(
	      - (halfW4 - wallLength - padHalfX), 
	       0,
	       0
	    );

	    // RIGHT paddle (index 1)
	    this.paddles[1].position.set(
	       (halfW4 - wallLength - padHalfX),
	       0,
	       0
	    );

	    // TOP paddle (index 2)
	    this.paddles[2].position.set(
	      0,
	      0,
	      (halfL4 - wallDepth - padHalfZ)
	    );

	    // BOTTOM paddle (index 3)
	    this.paddles[3].position.set(
	      0,
	      0,
	     - (halfL4 - wallDepth - padHalfZ)
	    );
	  }

	  // Ball always starts at center
	  if (this.balls[0]) {
	    this.balls[0].position.set(0, 0, 0);
	  }
	}
	public getScene(): BABYLON.Scene {
		return this.scene;
	}

	public resumeRenderLoop() {
		console.log('[RESUME] Stopping render loop...');
		this.engine.stopRenderLoop();
		console.log('[RESUME] Starting render loop...');
		this.startRenderLoop(); // Reuse full original loop logic

		this.isPaused = false;
		if (this.pauseUI?.container) {
			this.pauseUI.container.isVisible = false;
		}
		console.log('[RENDERER] Resumed render loop.');
	}

	public updateScene(update: {
	  paddles: Record<number,{pos:number; side:'left'|'right'|'top'|'bottom'; score:number}>;
	  balls:   Record<number,{x:number; y:number}>;
	  elapsed:number;
	  isPaused:boolean
	}) {
	  // update paddles
	  Object.values(update.paddles).forEach(({ side, pos }) => {
	    const mesh = this.paddleMap[side];
	    if (!mesh) return;

	    if (side === 'left' || side === 'right') {
	      // ← H-paddles slide on X
	      mesh.position.z = pos;
	    } else {
	      // ← V-paddles slide on Z
	      mesh.position.x = pos;
	    }
	  });

	  // update balls (inchangé)
	  Object.values(update.balls).forEach(({ x, y }) => {
	    const m = this.balls[0];
	    if (!m) return;
	    m.position.x = x;
	    m.position.z = y;
	  });
	  //Update UI
	  // Extract scores by side
		const scores: Record<'left' | 'right' | 'top' | 'bottom', number> = {
			left: 0,
			right: 0,
			top: 0,
			bottom: 0,
		};
		Object.values(update.paddles).forEach(({ side, score }) => {
			if(this.playerCount === 2 &&(side === 'left' || side === 'right'))
				scores[side] = score;
			else if(this.playerCount === 4)
				scores[side] = score;
		});
		this.isPaused = update.isPaused
		this.updateHUD(update.elapsed, scores);
	}
	private startRenderLoop() {
		this.engine.runRenderLoop(() => {
		this.scene.render();
		this.pauseUI.container.isVisible = this.isPaused;
		this.processInput();
		});
	}

	private processInput() {
	  // Determine raw direction
	  let dir: 'left'|'right'|'stop' = 'stop';
	  if (this.inputState.left && this.inputState.right) dir = 'stop';
	  else if (this.inputState.left)  dir = 'left';
	  else if (this.inputState.right) dir = 'right';

	  // Swap for left view
	  if (this.playerSide === 'left' && dir !== 'stop') {
	    dir = dir === 'left' ? 'right' : 'left';
	  }

	  if (dir !== 'stop') {
	    this.sendMove(dir);
	  } else if (this.currentDir !== 'stop') {
	    this.sendMove('stop');
	  }

	  this.currentDir = dir;
	}

		public handleResize() {
			this.engine.resize();
			window.addEventListener('resize', () => {
			this.engine.resize();
		});
	}

private initInputListeners() {
	this.handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'ArrowLeft') this.inputState.left = true;
		if (e.key === 'ArrowRight') this.inputState.right = true;

		if (e.key.startsWith('Arrow')) e.preventDefault();

		// Handle Escape key logic here too
		if (e.key === 'Escape' || e.key === 'Esc') {
			const player = state.playerInterface;
			if (player && player.state === 'playing') {
				if (this.isPaused) return; // prevent spam

				this.isPaused = true;

				state.typedSocket.send('pause', {
					userID: state.userId,
					gameID: player.gameID
				});

				showNotification({
					type: 'confirm',
					message: 'Do you really want to leave the game?',
					onConfirm: async () => {
						state.typedSocket.send('leaveGame', {
							userID: state.userId!,
							gameID: player.gameID,
							isLegit: false,
						});
						if (state.currentTournamentID){
							const tourID = state.currentTournamentID;
							state.currentTournamentID = -1;
							state.typedSocket.send('leaveTournament', {
								userID: state.userId!,
								tournamentID: tourID,
								islegit: false,
							});
						const { chatID } = await apiFetch(`/api/tournaments/chat/${state.currentTournamentID}`);
						await rmMemberFromRoom(chatID, state.userId!);
						}
					},
					onCancel: () => {
						state.typedSocket.send('resume', {
							userID: state.userId,
							gameID: player.gameID
						});
						this.isPaused = false;
					},
				});
			}
		}
	};

	this.handleKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'ArrowLeft') this.inputState.left = false;
		if (e.key === 'ArrowRight') this.inputState.right = false;
	};

	window.addEventListener('keydown', this.handleKeyDown);
	window.addEventListener('keyup', this.handleKeyUp);
}

  private sendMove(direction: 'left' | 'right' | 'stop') {
    if (state.playerInterface?.gameID !== undefined && state.userId !== undefined) {
      state.typedSocket.send('playerMove', {
        gameID: state.playerInterface.gameID,
        userID: state.userId,
        direction,
      });
    }
  }

	private updateHUD(elapsed: number, scores: Record<'left' | 'right' | 'top' | 'bottom', number>) {
		const gameName = localStorage.getItem('gameName');
		this.timeText.text = `${gameName}: ${elapsed.toFixed(1)}s`;

		if (this.playerCount === 2) {
			if (this.scoreTextBlocks.left) {
				this.scoreTextBlocks.left.text = `${scores.left}`;
			}
			if (this.scoreTextBlocks.right) {
				this.scoreTextBlocks.right.text = `${scores.right}`;
			}
		}
	}

	public dispose() {
		console.warn(`DISPOSING RENDER`);
		this.engine.stopRenderLoop();
		this.engine.dispose();

		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
	}

}