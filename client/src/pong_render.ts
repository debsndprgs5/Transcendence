import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import * as BABYLON from '@babylonjs/core';
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';

export class PongRenderer{

	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.Camera; 

	private socket: TypedSocket;

	private paddles: BABYLON.Mesh[] = [];
	private paddleMap: Record<'left'|'right'|'top'|'bottom', BABYLON.Mesh | undefined>;
	private balls: BABYLON.Mesh[] = [];
	private sideWalls:BABYLON.Mesh[]=[];
	private frontWalls:BABYLON.Mesh[]=[];
	
	private guiTexture!: GUI.AdvancedDynamicTexture;
	private timeText!: GUI.TextBlock;
	private scoreText!: GUI.TextBlock;
	private avatarSquares!:GUI.AdvancedDynamicTexture;//Avatar near the name
	private avatarCirles!:GUI.AdvancedDynamicTexture;//Small avatars links to paddles


	private playerCount: number;
	private playerSide: 'left' | 'right' | 'top' | 'bottom';
	private playersInfo: Record<'left' | 'right' | 'top' | 'bottom', string> = {
	left: '',
	right: '',
	top: '',
	bottom: ''
	};
	private scoreTextBlocks: Partial<Record<'left' | 'right' | 'top' | 'bottom', GUI.TextBlock>> = {};

	constructor(
	canvas: HTMLCanvasElement,
	typedSocket: TypedSocket,
	playerCount: number,
	playerSide: 'left' | 'right' | 'top' | 'bottom',
	usernames: Record<'left' | 'right' | 'top' | 'bottom', string>
	) {
		this.socket = typedSocket;
		this.playerCount = playerCount;
		this.playerSide = playerSide;
		this.playersInfo=usernames;

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
  // Center of your map, you can adjust the Y (height) if needed
  const target = new BABYLON.Vector3(0, -3, 0);

  // Adjust these values for feel
  const radius = 40;          //OG 30 distance from target — closer means "closer to game"
  const beta = Math.PI / 3;   // OG 3vertical angle (60° down from top, adjust for "looking down")
  const alpha = -Math.PI / 2; //OG 2 horizontal angle (90° to left, tweak per playerSide)

  let alphaAdjusted = alpha;

  // Rotate alpha depending on playerSide, so camera faces from different sides
  switch(this.playerSide) {
    case 'left':
      alphaAdjusted = Math.PI;       // looking from left side (180°)
      break;
    case 'right':
      alphaAdjusted = 0;             // from right side (0°)
      break;
    case 'top':
      alphaAdjusted = -Math.PI / 2; // from top (-90°)
      break;
    case 'bottom':
      alphaAdjusted = Math.PI / 2;  // from bottom (90°)
      break;
    default:
      alphaAdjusted = -Math.PI / 2; // fallback to top side
  }

  this.camera = new BABYLON.ArcRotateCamera("arcCam", alphaAdjusted, beta, radius, target, this.scene);

  // Disable user controls (fixed camera)
  this.camera.inputs.clear();

}
	private async setupGUI() {
		this.guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

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

			//LEFT AVATAR
			const leftUsername = this.playersInfo.left;
			let leftAvatarurl: string;
			try {
				const json = await apiFetch(
					`/users/${encodeURIComponent(leftUsername)}/avatar`
				) as { avatar_url?: string };
				leftAvatarurl = json.avatar_url ?? "";
			} catch {
				leftAvatarurl = `https://ui-avatars.com/api/?name=${encodeURIComponent(leftUsername)}&background=6d28d9&color=fff&rounded=true`;
			}
			const leftAvatarResponse = await fetch(leftAvatarurl);
			const leftBlob = await leftAvatarResponse.blob();
			const leftBlobUrl = URL.createObjectURL(leftBlob);

			const leftAvatarImage = new GUI.Image("leftAvatar", leftBlobUrl);
			leftAvatarImage.width = "40px";
			leftAvatarImage.height = "40px";
			leftAvatarImage.left = "20px";
			leftAvatarImage.top = "25px"; // between name (5px) and score (45px)
			leftAvatarImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			leftAvatarImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(leftAvatarImage);
			
			//RIGTH AVATAR
			const rightUsername = this.playersInfo.right;
			let rightAvatarurl: string;
			try {
				const json = await apiFetch(
					`/users/${encodeURIComponent(rightUsername)}/avatar`
				) as { avatar_url?: string };
				rightAvatarurl = json.avatar_url ?? "";
			} catch {
				rightAvatarurl = `https://ui-avatars.com/api/?name=${encodeURIComponent(rightUsername)}&background=6d28d9&color=fff&rounded=true`;
			}
			const rightAvatarResponse = await fetch(rightAvatarurl);
			const rightBlob = await rightAvatarResponse.blob();
			const rightBlobUrl = URL.createObjectURL(rightBlob);

			const rightAvatarImage = new GUI.Image("rightAvatar", rightBlobUrl);
			rightAvatarImage.width = "40px";
			rightAvatarImage.height = "40px";
			rightAvatarImage.left = "-20px";
			rightAvatarImage.top = "25px";
			rightAvatarImage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			rightAvatarImage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
			this.guiTexture.addControl(rightAvatarImage);
					
			}
}
	private setupLighting() {
			const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
			light.intensity = 0.05
		}
	// private createWalls() {
	// 	const width2P = LIMIT.arenaWidth2p; // -8 to 8
	// 	const depth2P = LIMIT.arenaLength2p; // -5 to 5
	// 	const width4P = LIMIT.arenaWidth4p; // -6 to 6
	// 	const depth4P = LIMIT.arenaWidth4p; // -6 to 6

	// 	const wallHeight = 0.3;
	// 	const wallDepth = 0.5;
	// 	const wallLength = 0.25;

	// 	const width = this.playerCount === 2 ? width2P : width4P;
	// 	const depth = this.playerCount === 2 ? depth2P : depth4P;

	// 	// Front/back walls
	// 	const topWall = BABYLON.MeshBuilder.CreateBox("topWall", {
	// 		width,
	// 		height: wallHeight,
	// 		depth: wallDepth,
	// 	}, this.scene);
	// 	topWall.position.z = depth / 2 + wallDepth / 2;
	// 	this.frontWalls.push(topWall);

	// 	const bottomWall = topWall.clone("bottomWall");
	// 	bottomWall.position.z = -depth / 2 - wallDepth / 2;
	// 	this.frontWalls.push(bottomWall);

	// 	// Side walls
	// 	const sideWall = BABYLON.MeshBuilder.CreateBox("sideWall", {
	// 		width: wallLength,
	// 		height: wallHeight,
	// 		depth,
	// 	}, this.scene);
	// 	sideWall.position.x = -width / 2 - wallLength / 2;
	// 	this.sideWalls.push(sideWall);

	// 	const rightWall = sideWall.clone("rightWall");
	// 	rightWall.position.x = width / 2 + wallLength / 2;
	// 	this.sideWalls.push(rightWall);
	// }
private createWalls() {
	const width2P = LIMIT.arenaWidth2p;
	const depth2P = LIMIT.arenaLength2p;
	const width4P = LIMIT.arenaWidth4p;
	const depth4P = LIMIT.arenaWidth4p;

	const wallHeight = 0.5; // increased thickness
	const wallDepth = 0.6;
	const wallLength = 0.4;

	const width = this.playerCount === 2 ? width2P : width4P;
	const depth = this.playerCount === 2 ? depth2P : depth4P;

	const glow = this.scene.getGlowLayerByName("glowPaddlesBalls") ||
		new BABYLON.GlowLayer("glowPaddlesBalls", this.scene);

	const createTronWall = (
	name: string,
	opts: { width?: number; height?: number; depth?: number },
	pos: BABYLON.Vector3
	) =>{
		const wall = BABYLON.MeshBuilder.CreateBox(name, opts, this.scene);
		wall.position = pos;

		const mat = new BABYLON.StandardMaterial(`${name}Mat`, this.scene);
		mat.diffuseColor = BABYLON.Color3.Black();
		mat.emissiveColor = new BABYLON.Color3(0.5, 0.42, 0); // Tron goldish
		mat.specularColor = BABYLON.Color3.Black(); // No shiny highlight
		wall.material = mat;

		glow.addIncludedOnlyMesh(wall);
		return wall;
	};

	// Front/back walls
	const topWall = createTronWall("topWall", {
		width,
		height: wallHeight,
		depth: wallDepth
	}, new BABYLON.Vector3(0, 0, depth / 2 + wallDepth / 2));
	this.frontWalls.push(topWall);

	// Clone + fix material + glow
	const bottomWall = topWall.clone("bottomWall");
	bottomWall.position.z = -depth / 2 - wallDepth / 2;
	// Apply same material
	bottomWall.material = topWall.material;
	// Re-include in glow layer
	glow.addIncludedOnlyMesh(bottomWall);
	this.frontWalls.push(bottomWall);

	// Side walls
	const sideWall = createTronWall("leftWall", {
		width: wallLength,
		height: wallHeight,
		depth,
	}, new BABYLON.Vector3(-width / 2 - wallLength / 2, 0, 0));
	this.sideWalls.push(sideWall);

	// Clone + fix material + glow
	const rightWall = sideWall.clone("rightWall");
	rightWall.position.x = width / 2 + wallLength / 2;
	rightWall.material = sideWall.material;
	glow.addIncludedOnlyMesh(rightWall);
	this.sideWalls.push(rightWall);
}

	// private createGameObjects() {
	// 	const paddleSize2P = { height: 1, width: LIMIT.paddleWidth, depth: LIMIT.paddleSize }; // Original paddle size
	// 	const paddleSize4P = { height: 1, width: LIMIT.paddleSize, depth: LIMIT.paddleWidth }; // Rotated for top/bottom

	// 	for (let i = 0; i < this.playerCount; i++) {
	// 		const isVertical = i === 0 || i === 1;
	// 		const paddle = BABYLON.MeshBuilder.CreateBox(`paddle${i}`, isVertical ? paddleSize2P : paddleSize4P, this.scene);
	// 		const mat = new BABYLON.StandardMaterial(`mat${i}`, this.scene);
	// 		mat.diffuseColor = BABYLON.Color3.Random();
	// 		paddle.material = mat;
	// 		this.paddles.push(paddle);
	// 	}

	// 	const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter:LIMIT.ballSize }, this.scene);
	// 	this.balls.push(ball);
	// }
	private createGameObjects() {
	const paddleSize2P = { height: 1, width: LIMIT.paddleWidth, depth: LIMIT.paddleSize };
	const paddleSize4P = { height: 1, width: LIMIT.paddleSize, depth: LIMIT.paddleWidth };

	const sideOrder: ('left' | 'right' | 'top' | 'bottom')[] =
		this.playerCount === 2 ? ['left', 'right'] : ['left', 'right', 'top', 'bottom'];

	const glow = this.scene.getGlowLayerByName("glowPaddlesBalls") ||
		new BABYLON.GlowLayer("glowPaddlesBalls", this.scene);

	for (let i = 0; i < this.playerCount; i++) {
		const side = sideOrder[i];
		const isVertical = side === 'left' || side === 'right';
		const paddle = BABYLON.MeshBuilder.CreateBox(
			`paddle_${side}`,
			isVertical ? paddleSize2P : paddleSize4P,
			this.scene
		);

		const mat = new BABYLON.StandardMaterial(`paddleMat_${side}`, this.scene);
		mat.diffuseColor = BABYLON.Color3.Black();
		mat.specularColor = BABYLON.Color3.Black(); // flat look

		if (side === this.playerSide) {
			mat.emissiveColor = new BABYLON.Color3(0.0, 0.4, 0.4); // cyan
		} else {
			mat.emissiveColor = new BABYLON.Color3(0.6, 0.18, 0.0); // brigth orange
		}
		paddle.material = mat;
		glow.addIncludedOnlyMesh(paddle);

		this.paddles.push(paddle);
	}

	// Ball with golden glow and trail
	const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: LIMIT.ballSize }, this.scene);
	const ballMat = new BABYLON.StandardMaterial("ballMat", this.scene);
	ballMat.diffuseColor = BABYLON.Color3.Black();
	ballMat.emissiveColor = new BABYLON.Color3(1.0, 0.0, 0.6); // pink -ish
	ballMat.specularColor = BABYLON.Color3.Black(); // no gloss
	ball.material = ballMat;
	glow.addIncludedOnlyMesh(ball);
	this.balls.push(ball);

	// ✨ Particle trail
	const particleSystem = new BABYLON.ParticleSystem("ballTrail", 100, this.scene);
	particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs.com/assets/Flare.png", this.scene);
	particleSystem.emitter = ball;
	particleSystem.minEmitBox = new BABYLON.Vector3(0, 0, 0);
	particleSystem.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
	particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0, 1.0); // gold
	particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 0.8);
	particleSystem.minSize = 0.1;
	particleSystem.maxSize = 0.2;
	particleSystem.minLifeTime = 0.1;
	particleSystem.maxLifeTime = 0.3;
	particleSystem.emitRate = 240;
	particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
	particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
	particleSystem.direction1 = new BABYLON.Vector3(-1, 0, -1);
	particleSystem.direction2 = new BABYLON.Vector3(1, 0, 1);
	particleSystem.minAngularSpeed = 0;
	particleSystem.maxAngularSpeed = Math.PI;
	particleSystem.minEmitPower = 0.5;
	particleSystem.maxEmitPower = 1.0;
	particleSystem.updateSpeed = 0.02;
	particleSystem.start();
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
	//   window.addEventListener('keydown', (e)=>{
	// 	if(e.key === 'Escape' || e.key === 'Esc'){
	// 		if(state.playerInterface!.state === 'playing')
	// 			state.typedSocket.send('leaveGame',{
	// 				userID:state.userId!,
	// 				gameID:state.playerInterface!.gameID,
	// 				isLegit:false});
	// 	}
	//  });
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
	private updateHUD(elapsed: number, scores: Record<'left' | 'right' | 'top' | 'bottom', number>) {
		this.timeText.text = `${state.currentGameName}: ${elapsed.toFixed(1)}s`;

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
			this.engine.dispose();
		}
}