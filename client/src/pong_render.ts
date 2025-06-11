import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import * as BABYLON from 'babylonjs';
import * as LIMIT from './shared/gameTypes';

export class PongRenderer{

	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.FreeCamera;

	private socket: TypedSocket;
	
	private paddles: BABYLON.Mesh[] = [];
	private balls: BABYLON.Mesh[] = [];
	private sideWalls:BABYLON.Mesh[]=[];
	private frontWalls:BABYLON.Mesh[]=[];

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

		this.setupCamera();
		this.setupLighting();
		this.createWalls();
		this.createGameObjects();
		this.setupInitialPositions();
		this.initInputListeners();
		this.startRenderLoop();
		this.handleResize();
		this.socket.on(
		     'renderData',
		     (update: SocketMessageMap['renderData']) => {
		       this.updateScene(update);
		     }
		   );
	}

	private setupCamera() {
		const distance = 40;
		const height = 30;

		let camPos: BABYLON.Vector3;

		switch (this.playerSide) {
			case 'left':
				camPos = new BABYLON.Vector3(distance, height, 0);
				break;
			case 'right':
				camPos = new BABYLON.Vector3(-distance, height, 0);
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
		if (this.playerCount === 2) {
			this.paddles[0].position.set(-(LIMIT.arenaWidth2p/2), 0, 0); // left
			this.paddles[1].position.set((LIMIT.arenaLength2p/2), 0, 0); // right
		} else {
			this.paddles[0].position.set(-(LIMIT.arenaWidth4p/2), 0, 0); // left
			this.paddles[1].position.set((LIMIT.arenaWidth4p/2), 0, 0);  // right
			this.paddles[2].position.set(0, 0, (LIMIT.arenaWidth4p/2));  // top
			this.paddles[3].position.set(0, 0, -(LIMIT.arenaWidth4p/2)); // bottom
		}

		this.balls[0].position.set(0, 0, 0);
	}
	public updateScene(update: {
	  paddles: Record<number, { pos: number; side: 'left' | 'right' | 'top' | 'bottom' }>;
	  balls:   Record<number, { x: number; y: number }>;
	}) {
	  const sideOrder: ('left'|'right'|'top'|'bottom')[] = ['left','right','top','bottom'];
	  Object.values(update.paddles).forEach(paddleData => {
	    const meshIndex = sideOrder.indexOf(paddleData.side);
	    if (meshIndex < 0 || !this.paddles[meshIndex]) return;
	    const paddleMesh = this.paddles[meshIndex];
	    if (paddleData.side === 'left' || paddleData.side === 'right') {
	      paddleMesh.position.z = paddleData.pos;
	    } else {
	      paddleMesh.position.x = paddleData.pos;
	    }
	  });

	  Object.values(update.balls).forEach(ballData => {
	    const ballMesh = this.balls[0];
	    if (!ballMesh) return;
	    ballMesh.position.x = ballData.x;
	    ballMesh.position.z = ballData.y;
	  });
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
		// if (e.repeat) return; // ignore repeats
      console.log(state.userId, state.playerInterface?.playerSide, e.key);
			if (e.key === 'ArrowLeft') this.sendMove('left');
			else if (e.key === 'ArrowRight') this.sendMove('right');
		});

		window.addEventListener('keyup', (e) => {
      console.log(state.userId, state.playerInterface?.playerSide, e.key);
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.sendMove('stop');
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


	public dispose() {
    	this.engine.dispose();
  	}
}