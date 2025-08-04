import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap} from './shared/gameTypes';
import { rmMemberFromRoom } from './handlers'
import * as BABYLON from '@babylonjs/core';
import { TerrainMaterial } from "@babylonjs/materials/terrain"
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';
import * as Generator from './BabylonObj'
import { handleLeaveTournament } from './tournament_rooms';

import "@babylonjs/loaders/glTF";

export class PongRenderer{
	
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.FreeCamera;


	private socket: TypedSocket;

	private paddles: BABYLON.Mesh[] = [];
	private paddleMap: Record<'left'|'right'|'top'|'bottom', BABYLON.Mesh | undefined>;
	private balls: BABYLON.Mesh[] = [];
	private frontWalls: (BABYLON.InstancedMesh)[] = [];
	private sideWalls: (BABYLON.InstancedMesh)[] = [];


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
	this.createSkybox();        // add background
	this.createFloor();         // Add floor 
	this.setupGUI();            // Text & UI
	this.setupPauseUI();        // Pause screen
	this.setupCamera();         // Free camera
	this.setupLighting();       // Scene lights
	this.createWalls();         // Pong arena walls
	

//	this.createBottomLayers()
	//this.addTrees();            // procedural trees

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
		const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), this.scene);
		dirLight.position = new BABYLON.Vector3(50, 100, 50);
		dirLight.intensity = 2.0;

	}

	private async createWalls() {
  const width2P = LIMIT.arenaWidth2p;
  const depth2P = LIMIT.arenaLength2p;
  const width4P = LIMIT.arenaWidth4p;
  const depth4P = LIMIT.arenaWidth4p;

  const width = this.playerCount === 2 ? width2P : width4P;
  const depth = this.playerCount === 2 ? depth2P : depth4P;

  return new Promise<void>((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh("", "../assets/", "old_wall_coast02.glb", this.scene, (meshes) => {
      if (meshes.length === 0) {
        reject("Wall mesh failed to load");
        return;
      }

      // Find the main wall mesh to instance (assumes one mesh as base)
      const baseWallMesh = meshes.find(
		m => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0
		) as BABYLON.Mesh;
      if (!baseWallMesh) {
        reject("No suitable mesh found in wall model");
        return;
      }
	  baseWallMesh.rotation.x = -Math.PI / 2;
	  baseWallMesh.refreshBoundingInfo();
	  baseWallMesh.showBoundingBox = true;
      baseWallMesh.isVisible = true; // Hide original

	  // Compute segment length (assuming the model is a horizontal block)
const bb = baseWallMesh.getBoundingInfo().boundingBox;
const size = bb.maximum.subtract(bb.minimum);

const segmentLength = Math.max(
  Math.abs(size.x * baseWallMesh.scaling.x),
  Math.abs(size.z * baseWallMesh.scaling.z)
);

const segmentDepth = Math.min(
  Math.abs(size.x * baseWallMesh.scaling.x),
  Math.abs(size.z * baseWallMesh.scaling.z)
);
    //  // Compute segment length from bounding box and scale
    //   const bb = baseWallMesh.getBoundingInfo().boundingBox;
    //   const segmentLength = (bb.maximum.x - bb.minimum.x) * baseWallMesh.scaling.x;
    //   const segmentDepth = (bb.maximum.z - bb.minimum.z) * baseWallMesh.scaling.z;

      const wallOffset = segmentDepth / 2;
	  console.log("Mesh:", baseWallMesh.name);
		console.log("Vertices:", baseWallMesh.getTotalVertices());
		console.log("Scaling:", baseWallMesh.scaling);
		console.log("Bounding box X size:", bb.maximum.x - bb.minimum.x);
		console.log("SegmentLength:", segmentLength);
		console.log("SegementDepth:", segmentDepth);
//       // Helper function to create instances along an axis
	const tileWallInstances = (
	prefix: string,
	count: number,
	basePos: BABYLON.Vector3,
	axis: "x" | "z",
	rotationY: number,
	targetArray: (BABYLON.InstancedMesh)[]
) => {
	for (let i = 0; i < count; i++) {
		const instance = baseWallMesh.createInstance(`${prefix}_instance_${i}`);
		const offset = i * segmentLength;

		instance.position = basePos.add(
			axis === "x"
				? new BABYLON.Vector3(offset, 0, 0)    // tiles laid along X (top/bottom)
				: new BABYLON.Vector3(0, 0, offset)    // tiles laid along Z (sides)
		);

		instance.rotation.y = rotationY;
		instance.isVisible = true;
		targetArray.push(instance);
	}
};


//       // Number of tiles needed to cover each side
      const topCount = Math.ceil(width / segmentLength);
      const bottomCount = topCount;
	
      const leftCount = Math.ceil(depth / segmentLength);
      const rightCount = leftCount;

	console.warn(`LEFT COUNT:${leftCount}, TOP:${topCount} SegmentLength:${segmentLength}`);

     // Create instances for each wall side
	// TOP wall — at +Z, spans X axis, faces inward (no rotation needed)
tileWallInstances("top", topCount,
	new BABYLON.Vector3(-width / 2, 0, depth / 2 + wallOffset),
	"x", 0, this.frontWalls);

// BOTTOM wall — at -Z, spans X axis, faces inward (rotated 180°)
tileWallInstances("bottom", bottomCount,
	new BABYLON.Vector3(-width / 2, 0, -depth / 2 - wallOffset),
	"x", Math.PI, this.frontWalls);

// LEFT wall — at -X, spans Z axis, faces inward (rotated -90°)
tileWallInstances("left", leftCount,
	new BABYLON.Vector3(-width / 2 - wallOffset, 0, -depth / 2),
	"z", -Math.PI / 2, this.sideWalls);

// RIGHT wall — at +X, spans Z axis, faces inward (rotated +90°)
tileWallInstances("right", rightCount,
	new BABYLON.Vector3(width / 2 + wallOffset, 0, -depth / 2),
	"z", Math.PI / 2, this.sideWalls);


      resolve();
    }, undefined, (scene, msg, exception) => {
      console.error("Failed to load wall model:", msg, exception);
      reject(msg);
    });
  });
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