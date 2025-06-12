import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
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
	private sideWalls:BABYLON.Mesh[]=[];
	private frontWalls:BABYLON.Mesh[]=[];
	
	private guiTexture!: GUI.AdvancedDynamicTexture;
	private timeText!: GUI.TextBlock;
	private scoreText!: GUI.TextBlock;


	private playerCount: number;
	private playerSide: 'left' | 'right' | 'top' | 'bottom';
	//TO ADD (ARRAY{UName:{side:string, socre:number}/....})

	constructor(
	canvas: HTMLCanvasElement,
	typedSocket: TypedSocket,
	playerCount: number,
	playerSide: 'left' | 'right' | 'top' | 'bottom'
	) {
		this.socket = typedSocket;
		this.playerCount = playerCount;
		this.playerSide = playerSide;

		this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
		this.scene = new BABYLON.Scene(this.engine);
		this.setupGUI();
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
		const height = 25;

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
	private setupGUI() {
		this.guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

		// Time display
		this.timeText = new GUI.TextBlock();
		this.timeText.color = "white";
		this.timeText.fontSize = 8;
		this.timeText.top = "-40px";
		this.timeText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		this.timeText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		this.guiTexture.addControl(this.timeText);

		// Score display
		this.scoreText = new GUI.TextBlock();
		this.scoreText.color = "white";
		this.scoreText.fontSize = 12;
		this.scoreText.top = "10px";
		this.scoreText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		this.scoreText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		this.guiTexture.addControl(this.scoreText);
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
	public updateScene(update: {
	  paddles: Record<number,{pos:number; side:'left'|'right'|'top'|'bottom'; score:number}>;
	  balls:   Record<number,{x:number; y:number}>;
	  elapsed:number
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

		this.updateHUD(update.elapsed, scores);
	}
	private startRenderLoop() {
		this.engine.runRenderLoop(() => {
		this.scene.render();
		});
	}

		public handleResize() {
			this.engine.resize();
			window.addEventListener('resize', () => {
			this.engine.resize();
		});
	}

	private initInputListeners() {
	  window.addEventListener('keydown', (e) => {
	    // Determine raw direction from key
	    let dir: 'left' | 'right' | null = null;
	    if (e.key === 'ArrowLeft')  dir = 'left';
	    else if (e.key === 'ArrowRight') dir = 'right';
	    else return;

	    // Swap for left-side player
	    if (this.playerSide === 'left') {
	      dir = dir === 'left' ? 'right' : 'left';
	    }

	    this.sendMove(dir);
	  });

	  window.addEventListener('keyup', (e) => {
	    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

	    // “stop” is the same for both
	    this.sendMove('stop');
	  });
	}

	private sendMove(direction:string){
		if (
			state.playerInterface?.gameID !== undefined &&
			state.userId !== undefined
		) {
			state.typedSocket.send('playerMove', {
			gameID: state.playerInterface.gameID,
			userID: state.userId,
			direction,
			});
		}
	}
	public updateHUD(timeSeconds: number, scores: Record<'left' | 'right' | 'top' | 'bottom', number>) {
	// Format time as MM:SS
	const minutes = Math.floor(timeSeconds / 60).toString().padStart(2, '0');
	const seconds = (timeSeconds % 60).toFixed(0).padStart(2, '0');
	this.timeText.text = `Time: ${minutes}:${seconds}`;

	// Format score
	const scoreStrings = Object.entries(scores).map(([side, score]) => `${side.toUpperCase()}: ${score}`);
	this.scoreText.text = scoreStrings.join("  |  ");
	}

	public dispose() {
			this.engine.dispose();
		}
}