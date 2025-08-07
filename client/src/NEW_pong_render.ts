import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import { rmMemberFromRoom } from './handlers'
import * as BABYLON from '@babylonjs/core';
import { TerrainMaterial } from "@babylonjs/materials/terrain"
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';
import { CSG } from "@babylonjs/core/Meshes/csg";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import * as Generator from './BabylonObj'
import { handleLeaveTournament } from './tournament_rooms';

import "@babylonjs/loaders/glTF";

export class PongRenderer{
	
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.FreeCamera;


	private socket: TypedSocket;

	private paddles: BABYLON.InstancedMesh[] = [];
	 private paddleMap: Record<'left'|'right'|'top'|'bottom', BABYLON.InstancedMesh | undefined> = {
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined
  };
	private balls: BABYLON.Mesh[] = [];
	private frontWalls: BABYLON.InstancedMesh[] = [];
	private sideWalls: BABYLON.InstancedMesh[] = [];


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
	this.setupGame()

}

	async setupGame(){
	// Setup core visuals
	this.createSkybox();        // add background
	this.createFloor();         // Add floor 
	this.setupGUI();            // Text & UI
	this.setupPauseUI();        // Pause screen
	this.setupCamera();         // Free camera
	this.setupLighting();       // Scene lights
	this.createWalls();         // Pong arena walls

	// Create paddles, balls, etc.
	await this.createGameObjects();
	this.paddleMap = {
		left:   this.paddles.find(m => m.name.startsWith("left")),
		right:  this.paddles.find(m => m.name.startsWith("right")),
		top:    this.paddles.find(m => m.name.startsWith("top")),
		bottom: this.paddles.find(m => m.name.startsWith("bottom")),
	}
	console.log(`${this.paddleMap.left} | ${this.paddleMap['left']}`);
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
		const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), this.scene);
		dirLight.position = new BABYLON.Vector3(50, 100, 50);
		dirLight.intensity = 2.0;

	}


private async createWalls(): Promise<void> {
  const baseMesh = await this.loadWallMesh("../assets/", "old_wall_coast02.glb");

  // Arena dimensions
  const width = this.playerCount === 2 ? LIMIT.arenaWidth2p : LIMIT.arenaWidth4p;
  const depth = this.playerCount === 2 ? LIMIT.arenaLength2p : LIMIT.arenaLength4p;

  // Hide the source mesh
  baseMesh.isVisible = false;
  const baseYaw = -Math.PI / 2;

  // Compute uniform tile size from mesh depth (local Z)
  const bb       = baseMesh.getBoundingInfo().boundingBox;
  const tileSize = (bb.maximum.z - bb.minimum.z) * baseMesh.scaling.z;

  const halfW = width  / 2;
  const halfD = depth  / 2;

  // Setup each side
  const sides = [
	{ name: 'top',    origin: new BABYLON.Vector3(-halfW, 0, +halfD), length: width,  axis: 'x', dir: +1, yawOff: Math.PI,        target: this.frontWalls },
	{ name: 'bottom', origin: new BABYLON.Vector3(+halfW, 0, -halfD), length: width,  axis: 'x', dir: -1, yawOff: 0,              target: this.frontWalls },
	{ name: 'left',   origin: new BABYLON.Vector3(-halfW, 0, -halfD), length: depth,  axis: 'z', dir: +1, yawOff: Math.PI/2,    target: this.sideWalls  },
	{ name: 'right',  origin: new BABYLON.Vector3(+halfW, 0, +halfD), length: depth,  axis: 'z', dir: -1, yawOff:-Math.PI/2,    target: this.sideWalls  }
  ];

  for (const side of sides) {
	const fullCount = Math.floor(side.length / tileSize);
	const leftover  = side.length - fullCount * tileSize;
	const halfGap   = leftover / 2;

	// Place full tiles centered with even half-gap at both ends
	for (let i = 0; i < fullCount; i++) {
	  const inst = baseMesh.createInstance(`${side.name}_tile_${i}`);
	  const offset = side.dir * (halfGap + (i + 0.5) * tileSize);
	  inst.position = side.axis === 'x'
		? side.origin.add(new BABYLON.Vector3(offset, 0, 0))
		: side.origin.add(new BABYLON.Vector3(0, 0, offset));
	  inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
		BABYLON.Axis.Y,
		baseYaw + side.yawOff
	  );
	  inst.isVisible = true;
	  side.target.push(inst);
	}

	// OPTIONAL: two end fillers of half-gap
	if (halfGap > 0.01) {
	  for (const end of [0, 1]) {
		const inst = baseMesh.createInstance(`${side.name}_filler_${end}`);
		const gapCenterOffset = side.dir * ((end === 0 ? halfGap / 2 : side.length - halfGap / 2));
		const pos = side.axis === 'x'
		  ? side.origin.add(new BABYLON.Vector3(gapCenterOffset, 0, 0))
		  : side.origin.add(new BABYLON.Vector3(0, 0, gapCenterOffset));
		// scale only along length axis
		const scale = halfGap / tileSize;
		inst.scaling = side.axis === 'x'
		  ? new BABYLON.Vector3(1, 1, scale)
		  : new BABYLON.Vector3(1, 1, scale);
		inst.position = pos;
		inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
		  BABYLON.Axis.Y,
		  baseYaw + side.yawOff
		);
		inst.isVisible = true;
		side.target.push(inst);
	  }
	}
  }
}



private loadWallMesh(path: string, file: string): Promise<BABYLON.Mesh> {
	return new Promise((resolve, reject) => {
		BABYLON.SceneLoader.ImportMesh("", path, file, this.scene, (meshes) => {
			const mesh = meshes.find(m => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0) as BABYLON.Mesh;
			if (!mesh) return reject("No valid wall mesh found.");
			resolve(mesh);
		}, undefined, (_, msg, err) => {
			console.error("Wall load failed:", msg, err);
			reject(msg);
		});
	});
}

	private async createPaddles(): Promise<void> {
		// Load the GLB paddle mesh
		const basePaddle = await this.loadWallMesh("../assets/", "horse_bone.glb");
		basePaddle.isVisible = false;

		// Determine backend target length for this paddle
		const targetLength = LIMIT.paddleSize;

		const targetWidth = LIMIT.paddleWidth;

		// Compute mesh's local-length (assumed along X axis)
		const bb = basePaddle.getBoundingInfo().boundingBox;
		console.log('DEBUG basePaddle boundingBox:', bb);
		console.log('DEBUG basePaddle scaling before:', basePaddle.scaling);
		const sizes = {
			x: (bb.maximum.x - bb.minimum.x) * basePaddle.scaling.x,
			y: (bb.maximum.y - bb.minimum.y) * basePaddle.scaling.y,
			z: (bb.maximum.z - bb.minimum.z) * basePaddle.scaling.z
			};
			console.log('DEBUG measured sizes:', sizes);
		const meshLength = (bb.maximum.x - bb.minimum.x) * basePaddle.scaling.x;
		const meshWidth = (bb.maximum.y - bb.minimum.y) * basePaddle.scaling.y;

		// Compute scale factor to stretch to target length
		const lengthScale = targetLength / meshLength;
		const widthScale = targetWidth / meshWidth;

		// Apply non-uniform scaling: stretch X axis, preserve Y/Z
		basePaddle.scaling.x *= lengthScale;
		basePaddle.scaling.y *= widthScale;

		// Create one instance per side
		let sides: Array<'left'|'right'|'top'|'bottom'> = [];
		if(this.playerCount === 4)
			sides =  ['left','right','top','bottom'];
		else 
			sides = ['left', 'right'];
		for (const side of sides) {
		const paddleName = `${side}_paddle`;
		const inst = basePaddle.createInstance(paddleName);

		// Position by side
		switch (side) {
			case 'left':
			inst.position = new BABYLON.Vector3(-LIMIT.arenaWidth2p/2, 1, 0);
			break;
			case 'right':
			inst.position = new BABYLON.Vector3(+LIMIT.arenaWidth2p/2, 1, 0);
			break;
			case 'top':
			inst.position = new BABYLON.Vector3(0, 1, +LIMIT.arenaLength2p/2);
			inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI/2);
			break;
			case 'bottom':
			inst.position = new BABYLON.Vector3(0, 1, -LIMIT.arenaLength2p/2);
			inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -Math.PI/2);
			break;
		}
		inst.isVisible = true;
		console.log('DEBUG creating paddle for side', side, inst);
		console.log('DEBUG position before setting:', inst.position);
		this.paddles.push(inst);
		}
		return;
	}
	private async createFloor() {
		const terrain = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
		"planetTerrain",
		"../assets/textures/height_map.png",
		{
		width: 200,
		height: 200,
		subdivisions: 100,
		minHeight: -20,
		maxHeight: 80,
		onReady: async () => {
			console.log("Terrain ready");
			await this.spawnUFOs(5);
		}
		},
		this.scene
		) as BABYLON.GroundMesh;


	const terrainMaterial = new TerrainMaterial("terrainMat", this.scene);

	// Set RGB mix map (texture blend controller)
	terrainMaterial.mixTexture = new BABYLON.Texture("../assets/textures/mixmap.png", this.scene);

	// Set diffuse textures
	terrainMaterial.diffuseTexture1 = new BABYLON.Texture("../assets/textures/fire.jpg", this.scene); // red channel
	terrainMaterial.diffuseTexture2 = new BABYLON.Texture("../assets/textures/brick.jpg", this.scene);  // green channel
	terrainMaterial.diffuseTexture3 = new BABYLON.Texture("../assets/textures/fire.jpg", this.scene); // blue channel

	
	 terrainMaterial.bumpTexture2 = new BABYLON.Texture("../assets/textures/wood2.jpg", this.scene); 
	terrainMaterial.bumpTexture3 = new BABYLON.Texture("../assets/textures/marble.jpg", this.scene);

	// Tiling
	terrainMaterial.diffuseTexture1.uScale = 10;
	terrainMaterial.diffuseTexture1.vScale = 10;
	terrainMaterial.diffuseTexture2.uScale = 10;
	terrainMaterial.diffuseTexture2.vScale = 10;
	terrainMaterial.diffuseTexture3.uScale = 10;
	terrainMaterial.diffuseTexture3.vScale = 10;

	terrain.material = terrainMaterial;
	terrain.position.y = 0;
}

	
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


	
private async spawnUFOs(count: number = 5) {
  return new Promise<void>((resolve, reject) => {
	BABYLON.SceneLoader.ImportMesh("", "../assets/", "spaceship.glb", this.scene, (meshes) => {
	  if (meshes.length === 0) {
		reject("No meshes loaded");
		return;
	  }

	  // Create a root node to hold the original UFO model
	  const baseUFORoot = new BABYLON.TransformNode("baseUFORoot", this.scene);
	  meshes.forEach(mesh => {
		if (mesh instanceof BABYLON.Mesh) {
		  mesh.parent = baseUFORoot;
		}
	  });

	  baseUFORoot.setEnabled(false); // Hide original model if false

	  for (let i = 0; i < count; i++) {
		const ufoCloneRoot = new BABYLON.TransformNode("ufo_" + i, this.scene);

		meshes.forEach(mesh => {
		  if (mesh instanceof BABYLON.Mesh) {
			const clonedMesh = mesh.clone(mesh.name + "_clone_" + i);
			if (clonedMesh) {
			  clonedMesh.parent = ufoCloneRoot;
			  clonedMesh.isVisible = true;
			}
		  }
		});

		ufoCloneRoot.setEnabled(true);
		ufoCloneRoot.scaling.scaleInPlace(0.005);

		const x = Math.random() * 100 - 50; // wider spread (was -100 to +100, now -200 to +200)
		const z = Math.random() * 100 - 50;

		const y = 30 + Math.random() * 10; // lower height (was 80–100, now 30–40)
		ufoCloneRoot.position = new BABYLON.Vector3(x, y, z);

		this.scene.registerBeforeRender(() => {
		  ufoCloneRoot.rotation.y += 0.001;
		});
	  }

	  resolve();
	}, undefined, (scene, message, exception) => {
	  console.error("Failed to load UFO:", message, exception);
	  reject(message);
	});
  });
}



	private async createGameObjects(){
		await  this.createPaddles();
		
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
			mesh.position.z = 0;
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