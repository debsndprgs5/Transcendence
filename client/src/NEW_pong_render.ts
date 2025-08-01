import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import { rmMemberFromRoom } from './handlers'
import * as BABYLON from '@babylonjs/core';
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';
import * as Generator from './BabylonObj'
import { handleLeaveTournament } from './tournament_rooms';

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
	private avatarSquares!: GUI.AdvancedDynamicTexture;
	private avatarCirles!: GUI.AdvancedDynamicTexture;
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
	gameName: string,
	playerSide: 'left' | 'right' | 'top' | 'bottom',
	usernames: Record<'left' | 'right' | 'top' | 'bottom', string>
) {
	this.socket = typedSocket;
	this.playerCount = playerCount;
	this.playerSide = playerSide;
	this.playersInfo = usernames;
	this.isPaused = false;

	// Save initial info to localStorage
	localStorage.setItem('playerCount', playerCount.toString());
	localStorage.setItem('playerSide', playerSide);
	localStorage.setItem('usernames', JSON.stringify(usernames));
	if (gameName !== undefined)
		localStorage.setItem('gameName', gameName);

	// Create core engine/scene
	this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
	this.scene = new BABYLON.Scene(this.engine);

	// Setup core visuals
	this.setupGUI();            // Text & UI
	this.setupPauseUI();        // Pause screen
	this.setupCamera();         // Free camera
	this.setupLighting();       // Scene lights
	this.createWalls();         // Pong arena walls
	this.createFloor();         // Add floor 
	this.createSkybox();        // add background
	this.addTrees();            // procedural trees

	// Create paddles, balls, etc.
	this.createGameObjects();

	//Map paddles to their sides
	this.paddleMap = {
		left:   this.paddles[0],
		right:  this.paddles[1],
		top:    this.paddles[2],
		bottom: this.paddles[3],
	};

	this.setupInitialPositions();  // Move paddles into place
	this.initInputListeners();     // Set up input handling
	this.startRenderLoop();        // Start rendering
	this.handleResize();           // React to window resizes
}

	setupGUI(){
	
	}

	setupPauseUI(){
	
	}

	private setupCamera() {
		this.camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 30, -50), this.scene);
		this.camera.setTarget(BABYLON.Vector3.Zero());
		this.camera.attachControl(this.engine.getRenderingCanvas(), true);
		}

	private setupLighting() {
		const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
		light.intensity = 0.9;
	}

	createWalls(){
	
	}

	private createFloor() {

		const ground = BABYLON.MeshBuilder.CreateGround("ground", {
			width: 80,
			height: 80
		}, this.scene);

		const groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
		const texture = new BABYLON.Texture("https://assets.babylonjs.com/environments/valleygrass.png", this.scene);
		texture.uScale = 8;
		texture.vScale = 8;

		groundMaterial.diffuseTexture = texture;
		ground.material = groundMaterial;
	}
	
	// private createSkybox() {
	// 	const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 700.0 }, this.scene);
	// 	const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", this.scene);
	// 	skyboxMaterial.backFaceCulling = false;
	// 	skyboxMaterial.disableLighting = true;

	// 	const reflectionTex = new BABYLON.CubeTexture("./assets/360Universe.jpeg", this.scene);
	// 	skyboxMaterial.reflectionTexture = reflectionTex;
	// 	skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

	// 	skybox.material = skyboxMaterial;
	// }
	private createSkybox() {
		const dome = new BABYLON.PhotoDome(
			"skyDome",
			"../assets/milkyWay.jpg", // Your 360° image path
			{
				resolution: 64,     // Higher = smoother sphere
				size: 1000          // Controls dome size
			},
			this.scene
		);
	}


	
	addTrees() {
	const treeCount = 100;
	const minRadius = 28; // avoid center (up to arena+margin)
	const maxRadius = 38; // near edge of 80x80 ground

	const trunkMaterial = new BABYLON.StandardMaterial("trunkMat", this.scene);
	trunkMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.26, 0.13);

	const leafMaterial = new BABYLON.StandardMaterial("leafMat", this.scene);
	leafMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.2);

	for (let i = 0; i < treeCount; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = minRadius + Math.random() * (maxRadius - minRadius);
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;

		const usePine = Math.random() > 0.5;
		const tree = usePine
			? Generator.simplePine(
					2 + Math.floor(Math.random() * 3),
					6 + Math.random() * 4,
					trunkMaterial,
					leafMaterial,
					this.scene
			  )
			: Generator.QuickTree(
					this.scene,
					2 + Math.random() * 2,
					3 + Math.random() * 2,
					1 + Math.random() * 1.5,
					trunkMaterial,
					leafMaterial
					
			  );

		tree.position.x = x;
		tree.position.z = z;
		tree.computeWorldMatrix(true); // ensure bounding info is up to date
		const boundingInfo = tree.getBoundingInfo();
		const minY = boundingInfo.boundingBox.minimumWorld.y;

		// move tree upward so base is at y = 0
		tree.position.y = -minY;
			}
}


	createGameObjects(){
	
	}

	setupInitialPositions(){
	
	}

	initInputListeners(){
	
	}

	startRenderLoop() {
		this.engine.runRenderLoop(() => {
			if (!this.scene) return;
			this.scene.render();
		});
	}

	handleResize() {
		window.addEventListener("resize", () => {
			this.engine.resize();
		});
	}

		public getScene(): BABYLON.Scene {
			return this.scene;
		}

		public resumeRenderLoop() {
			console.log('[RESUME] Stopping render loop...');
			this.engine.stopRenderLoop();
			console.log('[RESUME] Starting render loop...');
			this.startRenderLoop();

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
		Object.values(update.paddles).forEach(({ side, pos }) => {
			const mesh = this.paddleMap[side];
			if (!mesh) return;

			if (side === 'left' || side === 'right') {
			mesh.position.z = pos;
			} else {
			mesh.position.x = pos;
			}
		});

		Object.values(update.balls).forEach(({ x, y }) => {
			const m = this.balls[0];
			if (!m) return;
			m.position.x = x;
			m.position.z = y;
		});

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
			//this.updateHUD(update.elapsed, scores);
		}

		public dispose() {
			console.warn(`DISPOSING RENDER`);
			this.engine.stopRenderLoop();
			this.engine.dispose();

			window.removeEventListener('keydown', this.handleKeyDown);
			window.removeEventListener('keyup', this.handleKeyUp);
		}

};