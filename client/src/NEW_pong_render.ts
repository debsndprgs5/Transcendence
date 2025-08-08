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

	private paddles: BABYLON.Mesh[] = [];
	 private paddleMap: Record<'left'|'right'|'top'|'bottom', BABYLON.Mesh| undefined> = {
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined
  };
	private balls: BABYLON.Mesh[] = [];
	private frontWalls:  BABYLON.InstancedMesh[] = [];
	private sideWalls: BABYLON.InstancedMesh[] = [];
	private ufos: { root: BABYLON.TransformNode; vel: BABYLON.Vector3 }[] = [];
	private glow!: BABYLON.GlowLayer;


	private guiTexture!: GUI.AdvancedDynamicTexture;
	private timeText!: GUI.TextBlock;
	private scoreText!: GUI.TextBlock;
	private avatarSquares!: GUI.AdvancedDynamicTexture;
	private avatarCirles!: GUI.AdvancedDynamicTexture;
	private ballObj?: {
		root: BABYLON.TransformNode;
		radius: number;
		lastPos: BABYLON.Vector3;
		lastTime: number;
		light: BABYLON.PointLight;
	};
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
	this.glow = new BABYLON.GlowLayer("glow", this.scene, { blurKernelSize: 16 });
	this.glow.intensity = 0.35; 
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
	console.log(`${this.paddleMap.left} | ${this.paddleMap['right']}`);
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
  const hemi = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
  hemi.intensity = 0.35; // lower ambient

  const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), this.scene);
  dirLight.position = new BABYLON.Vector3(50, 100, 50);
  dirLight.intensity = 0.8; // not overpowering

  this.scene.environmentIntensity = 0.55; // if using PBR env
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


	// Move the bottom of a node to a world Y (respects children & rotations)
	private moveBottomToY(node: BABYLON.TransformNode | BABYLON.AbstractMesh, y: number) {
		// compute current bounds
		node.computeWorldMatrix(true);
		const before = node.getHierarchyBoundingVectors(true);
		const dy = y - before.min.y;

		// translate up by the delta
		node.position.y += dy;

		// force a fresh bounding recompute now
		node.computeWorldMatrix(true);
		if (node instanceof BABYLON.AbstractMesh) {
			node.refreshBoundingInfo(true);   // <- important
		}
		// optional: log to verify
		const after = node.getHierarchyBoundingVectors(true);
		console.debug(`[moveBottomToY] ${node.name}: minY ${before.min.y.toFixed(3)} -> ${after.min.y.toFixed(3)}, posY=${node.position.y.toFixed(3)}`);
	}
// Build a hidden container Mesh holding every imported mesh from a GLB
private loadModelAsContainer(path: string, file: string): Promise<BABYLON.Mesh> {
  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh("", path, file, this.scene,
      (meshes) => {
        const container = new BABYLON.Mesh(`${file}_container`, this.scene);
        container.setEnabled(false);
        meshes.forEach(m => {
          if (m instanceof BABYLON.Mesh) {
            m.setEnabled(false);
            m.parent = container;
          } else {
            m.setEnabled(false);
          }
        });
        resolve(container);
      },
      undefined,
      (_, msg, err) => reject(msg)
    );
  });
}

// Deep-clone a DISABLED template root (Mesh or TransformNode).
// Returns an *enabled* root that carries the template's scaling/rotation/pos.
private cloneHierarchy(template: BABYLON.TransformNode, name: string): BABYLON.TransformNode {
  const root = new BABYLON.TransformNode(name, this.scene);
  root.setEnabled(true);

  // inherit transform from the template root so size/orientation match
  root.position.copyFrom(template.position);
  root.scaling.copyFrom(template.scaling);
  root.rotationQuaternion = template.rotationQuaternion?.clone() ?? null;

  // clone every child mesh under the new enabled root
  template.getChildMeshes().forEach((m) => {
    const c = m.clone(`${name}_${m.name}`, root) as BABYLON.Mesh;
    c.setEnabled(true);
    c.isVisible = true;
    if (m.material) {
      c.material = (m.material.clone?.(`${m.material.name}_${name}`) as BABYLON.Material) ?? m.material;
    }
  });

  root.computeWorldMatrix(true);
  root.getChildMeshes().forEach(cm => cm.refreshBoundingInfo(true));
  return root;
}


	private loadWallMesh(path: string, file: string): Promise<BABYLON.Mesh> {
	return new Promise((resolve, reject) => {
		BABYLON.SceneLoader.ImportMesh("", path, file, this.scene, (meshes) => {
		// Disable everything that came in
		meshes.forEach(m => m.setEnabled(false));

		// Pick a primary mesh with geometry (largest vertex count is safest)
		const mesh = meshes
			.filter((m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0)
			.sort((a,b) => b.getTotalVertices() - a.getTotalVertices())[0];

		if (!mesh) return reject("No valid mesh found in GLB.");
		resolve(mesh);
		}, undefined, (_, msg, err) => {
		console.error("GLB load failed:", msg, err);
		reject(msg);
		});
	});
	}


private async createBall(): Promise<void> {
  const base = await this.loadModelAsContainer("../assets/", "organic_ball.glb");

  // Scale template so clone has correct diameter
  const { min, max } = base.getHierarchyBoundingVectors(true);
  const curDia = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
  base.scaling.scaleInPlace(LIMIT.ballSize / Math.max(0.001, curDia));

  // Clone FULL hierarchy as an enabled instance
  const ballRoot = this.cloneHierarchy(base, "ball");
  // Ensure we have a quaternion so we can accumulate rotations
  ballRoot.rotationQuaternion = ballRoot.rotationQuaternion ?? BABYLON.Quaternion.Identity();
  this.moveBottomToY(ballRoot, 2);

  // Subtle emissive so GlowLayer can catch it (not too strong)
  const glow = new BABYLON.Color3(0.7, 0.9, 1.0);
  ballRoot.getChildMeshes().forEach(m => {
    const src = (m.material as BABYLON.Material) ?? new BABYLON.PBRMaterial("ball_pbr", this.scene);
    const mat = src.clone?.(`${src.name}_ball`) as BABYLON.Material || src;
    if (mat instanceof BABYLON.PBRMaterial) { mat.emissiveColor = glow; mat.emissiveIntensity = 0.6; }
    else if (mat instanceof BABYLON.StandardMaterial) { mat.emissiveColor = glow; }
    m.material = mat;
  });

  // A small light tied to the ball (we’ll modulate intensity with speed)
  const light = new BABYLON.PointLight("ballLight", BABYLON.Vector3.Zero(), this.scene);
  light.parent = ballRoot;
  light.range = 10;
  light.intensity = 0.9;

  // Compute radius for rolling math
  const b2 = ballRoot.getHierarchyBoundingVectors(true);
  const radius = Math.max(b2.max.x - b2.min.x, b2.max.y - b2.min.y, b2.max.z - b2.min.z) * 0.5;

  // Save smart-ball state
  this.ballObj = {
    root: ballRoot,
    radius,
    lastPos: ballRoot.position.clone(),
    lastTime: performance.now() * 0.001,
    light
  };

  // If you still need compatibility with this.balls[], keep a dummy reference
  const anyChild = ballRoot.getChildMeshes()[0] as BABYLON.Mesh | undefined;
  if (anyChild) this.balls.push(anyChild);
}

private applyBallKinetics(nextPosXZ: BABYLON.Vector3): void {
  if (!this.ballObj) return;

  const now = performance.now() * 0.001;
  let dt = now - this.ballObj.lastTime;
  dt = BABYLON.Scalar.Clamp(dt, 1 / 120, 0.25);

  // Build next position (keep current Y)
  const p = this.ballObj.root.position;
  const next = new BABYLON.Vector3(nextPosXZ.x, p.y, nextPosXZ.z);

  // Motion delta & speed
  const delta = next.subtract(this.ballObj.lastPos);
  const distance = delta.length();
  const speed = distance / Math.max(dt, 1e-6);

  // Safe movement direction (always defined)
  const moveDir = distance > 1e-6 ? delta.scale(1 / distance) : BABYLON.Vector3.Zero();

  // Spin like a rolling ball on XZ: axis ⟂ to motion in XZ
  if (distance > 1e-4 && this.ballObj.radius > 1e-4) {
    const axis = new BABYLON.Vector3(moveDir.z, 0, -moveDir.x);
    if (axis.lengthSquared() > 1e-8) {
      const angle = distance / this.ballObj.radius; // radians
      const q = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      this.ballObj.root.rotationQuaternion =
        q.multiply(this.ballObj.root.rotationQuaternion!);
    }
  }

  // Apply position
  this.ballObj.root.position.copyFrom(next);

  // Light reacts to speed
  const t = BABYLON.Scalar.Clamp(speed / 15, 0, 1);
  this.ballObj.light.intensity = 0.6 + 0.8 * t;

  // Subtle squash & stretch (comment out if you don’t want it)
  const stretch = 1 + 0.06 * t;
  const squash  = 1 / Math.sqrt(stretch);
  const sx = 1 + (stretch - 1) * Math.abs(moveDir.x);
  const sz = 1 + (stretch - 1) * Math.abs(moveDir.z);
  this.ballObj.root.scaling.set(sx, squash, sz);

  // Persist
  this.ballObj.lastPos.copyFrom(next);
  this.ballObj.lastTime = now;
}



private async createPaddles(): Promise<void> {
  const template = await this.loadModelAsContainer("../assets/", "sci-fi_box.glb");

  // Scale template once so all clones inherit the right size
  {
    const b = template.getHierarchyBoundingVectors(true);
    const curLenX = Math.max(0.001, b.max.x - b.min.x);
    const curThkY = Math.max(0.001, b.max.y - b.min.y);
    const curDepZ = Math.max(0.001, b.max.z - b.min.z);

    const thicknessFactor = 1.5;
    const depthFactor     = 1.5;

    const targetLenX = LIMIT.paddleSize;
    const targetThkY = LIMIT.paddleWidth * thicknessFactor;
    const targetDepZ = curDepZ * depthFactor;

    template.scaling.x *= targetLenX / curLenX;
    template.scaling.y *= targetThkY / curThkY;
    template.scaling.z *= targetDepZ / curDepZ;
  }

  const sides: Array<'left'|'right'|'top'|'bottom'> =
    (this.playerCount === 4) ? ['left','right','top','bottom'] : ['left','right'];

  for (const side of sides) {
    const root = this.cloneHierarchy(template, `${side}_paddle`);
    root.rotationQuaternion = null;

    switch (side) {
      case 'left':
        root.rotation = new BABYLON.Vector3(0,  Math.PI / 2, 0);
        root.position = new BABYLON.Vector3(-((this.playerCount===2?LIMIT.arenaWidth2p:LIMIT.arenaWidth4p)/2 - 4), 0, 0);
        break;
      case 'right':
        root.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
        root.position = new BABYLON.Vector3(((this.playerCount===2?LIMIT.arenaWidth2p:LIMIT.arenaWidth4p)/2 - 4), 0, 0);
        break;
      case 'top':
        root.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        root.position = new BABYLON.Vector3(0, 0, ((this.playerCount===2?LIMIT.arenaLength2p:LIMIT.arenaLength4p)/2 - 4));
        break;
      case 'bottom':
        root.rotation = new BABYLON.Vector3(0, 0, 0);
        root.position = new BABYLON.Vector3(0, 0, -((this.playerCount===2?LIMIT.arenaLength2p:LIMIT.arenaLength4p)/2 - 4));
        break;
    }

    this.moveBottomToY(root, 2);

    const meshes = root.getChildMeshes() as BABYLON.Mesh[];
    for (const m of meshes) {
      this.glow?.addExcludedMesh?.(m);      // keep glow off the paddles themselves
    }

    const isPlayer = (side === this.playerSide);
    const lightColor = isPlayer
      ? new BABYLON.Color3(0.20, 1.00, 0.40)   // green-ish
      : new BABYLON.Color3(0.00, 0.85, 1.00);  // cyan
	const { min, max } = root.getHierarchyBoundingVectors(true);
    const hMesh = max.y - min.y;

    // Put the spotlight a bit higher than before to enlarge the circle
    const lightHeight = hMesh * 1.8;          // raise this to grow the pool further
    const groundY     = 0;                    
    const ySpotWorld  = root.position.y + lightHeight;
    const heightToGround = Math.max(0.001, ySpotWorld - groundY);

    const desiredSpotRadius = 15;             // <-- tweak: circle radius on the floor
    // Angle for that radius at this height (clamped just under 180°)
    const angle = Math.min(Math.PI - 0.1, 2 * Math.atan(desiredSpotRadius / heightToGround));

    const spot = new BABYLON.SpotLight(
      `${side}_spot`,
      new BABYLON.Vector3(0, lightHeight, 0), // higher = larger footprint
      new BABYLON.Vector3(0, -1, 0),          // straight down
      angle,                                  // wider cone = larger radius
      4,                                      // lower exponent = softer edge
      this.scene
    );
    spot.parent   = root;
    spot.diffuse  = lightColor;
    spot.specular = lightColor.scale(0.25);
    spot.intensity = 2.2;                     // brighten if needed
    spot.range     = 50;                      // ensure the floor is within range
    spot.falloffType = BABYLON.Light.FALLOFF_STANDARD;

    // gentle color spill so nearby wall gets some tint
    const fill = new BABYLON.PointLight(`${side}_fill`, new BABYLON.Vector3(0, hMesh * 0.5, 0), this.scene);
    fill.parent    = root;
    fill.diffuse   = lightColor;
    fill.specular  = lightColor.scale(0.2);
    fill.intensity = 0.3;
    fill.range     = 10;

    
    this.paddles.push(meshes[0]);
    this.paddleMap[side] = meshes[0];
  }
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

		// make terrain textures less punchy
		terrainMaterial.specularColor = BABYLON.Color3.Black(); 
		terrainMaterial.maxSimultaneousLights = 8
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
      if (meshes.length === 0) return reject("No meshes loaded");

      const base = new BABYLON.TransformNode("ufoTemplate", this.scene);
      meshes.forEach(m => { if (m instanceof BABYLON.Mesh) { m.parent = base; m.setEnabled(false); } else { m.setEnabled(false); }});
      base.setEnabled(false);

      const BOUNDS = { x: 60, z: 60, yMin: 26, yMax: 36 }; // keep well above the action
      const SPEED = { min: 4.0, max: 7.0 };                // units / second
      const SCALE = 0.005;

      for (let i = 0; i < count; i++) {
        const root = new BABYLON.TransformNode(`ufo_${i}`, this.scene);
        // clone all child meshes under this enabled root
        meshes.forEach(m => {
          if (m instanceof BABYLON.Mesh) {
            const c = m.clone(`${m.name}_clone_${i}`, root) as BABYLON.Mesh;
            c.isVisible = true; c.setEnabled(true);
            c.scaling.copyFromFloats(SCALE, SCALE, SCALE);
          }
        });

        // random start
        const x = (Math.random() * 2 - 1) * (BOUNDS.x - 5);
        const z = (Math.random() * 2 - 1) * (BOUNDS.z - 5);
        const y = BOUNDS.yMin + Math.random() * (BOUNDS.yMax - BOUNDS.yMin);
        root.position.set(x, y, z);

        // random velocity
        const dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        const speed = SPEED.min + Math.random() * (SPEED.max - SPEED.min);
        this.ufos.push({ root, vel: dir.scale(speed) });
      }

      // single update loop for all ufos
      this.startUfoLoop();
      resolve();
    }, undefined, (_s, message, exception) => {
      console.error("Failed to load UFO:", message, exception);
      reject(message);
    });
  });
}

private startUfoLoop() {
  const BOUNDS = { x: 120, z: 120, yMin: 45, yMax: 80 };
  const SPEED = { min: 4.0, max: 7.0 };
  const SEP_RADIUS = 10;       // avoid neighbors within this radius
  const SEP_FORCE  = 10;       // push strength
  const WANDER_JITTER = 0.8;   // random nudges (smaller = smoother)

  // remove any previous hook (avoid duplicates if you respawn)
  this.scene.onBeforeRenderObservable.clear();

  this.scene.onBeforeRenderObservable.add(() => {
    const dt = this.scene.getEngine().getDeltaTime() * 0.001;

    for (let i = 0; i < this.ufos.length; i++) {
      const u = this.ufos[i];
      const p = u.root.position;

      // wander: gentle random change to velocity (no sudden snaps)
      u.vel.x += (Math.random() - 0.5) * WANDER_JITTER;
      u.vel.z += (Math.random() - 0.5) * WANDER_JITTER;

      // separation: steer away from nearby UFOs
      let steer = new BABYLON.Vector3(0, 0, 0);
      for (let j = 0; j < this.ufos.length; j++) if (j !== i) {
        const d = this.ufos[j].root.position.subtract(p);
        const dist = d.length();
        if (dist > 0 && dist < SEP_RADIUS) {
          steer.addInPlace(d.scale(-1 / dist)); // stronger when closer
        }
      }
      if (!steer.equals(BABYLON.Vector3.Zero())) u.vel.addInPlace(steer.normalize().scale(SEP_FORCE * dt));

      // keep inside bounds: reflect softly at edges
      const margin = 4;
      if (p.x >  BOUNDS.x - margin) u.vel.x = -Math.abs(u.vel.x);
      if (p.x < -BOUNDS.x + margin) u.vel.x =  Math.abs(u.vel.x);
      if (p.z >  BOUNDS.z - margin) u.vel.z = -Math.abs(u.vel.z);
      if (p.z < -BOUNDS.z + margin) u.vel.z =  Math.abs(u.vel.z);

      // altitude clamp; optionally stay above terrain if available
      let minY = BOUNDS.yMin;
      p.y = Math.min(Math.max(p.y, minY), BOUNDS.yMax);

      // normalize speed
      const spd = BABYLON.Scalar.Clamp(u.vel.length(), SPEED.min, SPEED.max);
      u.vel.normalize().scaleInPlace(spd);

      // integrate
      p.addInPlace(u.vel.scale(dt));

      // a tiny spin so they feel alive
      u.root.rotate(BABYLON.Axis.X, 0.8 * dt, BABYLON.Space.LOCAL);
    }
  });
}



	private async createGameObjects(){
		await  this.createPaddles();
		await this.createBall();
	}

	private setupInitialPositions() {

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

		public setSide(side:'right'|'left'|'top'|'bottom'){
			this.playerSide = side;
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
			// Object.values(update.paddles).forEach(({ side, pos }) => {
			// 	const mesh = this.paddleMap[side];
			// 	if (!mesh) return;

			// 	if (side === 'left' || side === 'right') {
			// 	mesh.position.z = 0;
			// 	} else {
			// 	mesh.position.x = pos;
			// 	}
			// });

			const firstBall = Object.values(update.balls)[0];
			if (firstBall) {
				this.applyBallKinetics(new BABYLON.Vector3(firstBall.x, 0, firstBall.y));
			}
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