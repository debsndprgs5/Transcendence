import { showNotification } from './notifications';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { TypedSocket, SocketMessageMap, PreferencesRow} from './shared/gameTypes';
import { availableMaterials, availableTextures } from './settings_types';
import * as BABYLON from '@babylonjs/core';
import * as LIMIT from './shared/gameTypes';
import * as GUI from '@babylonjs/gui';




export class settingsRenderer{
    
    private engine: BABYLON.Engine;
	private scene: BABYLON.Scene;
    private gui : GUI.AdvancedDynamicTexture;
    private preferences: PreferencesRow | null = null;
    private previousPreferences: PreferencesRow | null = null;

    private light: BABYLON.Light | null = null;
    private userPaddle!: BABYLON.Mesh;
    private opponentPaddle!: BABYLON.Mesh;
	private ball!: BABYLON.Mesh;
	private frontWalls: BABYLON.Mesh[] = [];
    private sideWalls: BABYLON.Mesh[] = [];

    private ballDirection: number = 1; // 1 = forward (towards opponent), -1 = backward (towards player)
    private ballSpeed: number = 0.15;
    private lastBounceZ: number = 0;

    constructor(canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.scene = new BABYLON.Scene(this.engine);
    this.gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);

    this.init(canvas);
}

    private async init(canvas: HTMLCanvasElement) {
        try {
            await this.fetchPreferences();       // Wait for preferences to be ready
            console.log("Preferences loaded:", this.preferences);
            await this.initPreviewScene();       // Set up camera + scene

            if (!this.scene.activeCamera) {
                console.error("Camera creation failed — no active camera.");
                return;
            }

            console.log("Starting render loop...");
            this.engine.runRenderLoop(() => {
                this.fakeGameLoop();
                this.scene.render();             // Camera is guaranteed to exist now
            });

        } catch (err) {
            console.error("Error initializing scene:", err);
        }
    }

    private async fetchPreferences(): Promise<void> {
	try {
		const data = await apiFetch<{ success: boolean; preferences: PreferencesRow }>(`/pong/preferences/${state.userId!}`);

		console.log("PREFRENCES AS DATA", data);
		this.preferences = data.preferences;

		console.log("PREF as this:", this.preferences);
	} catch (err) {
		console.error("Failed to fetch preferences", err);
		this.preferences = null;
	}
}


    private  async initPreviewScene(){
        if (!this.preferences) return;
        this.createCamera();
        this.createLight();
        this.createFixObj();

        //Menu on bottom (30%)
        const menuPanel = new GUI.Rectangle();
        menuPanel.height = "30%";
        menuPanel.width = "100%";
        menuPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        menuPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        menuPanel.thickness = 0;
        menuPanel.background = "#0008"; // optional: dim background
        this.gui.addControl(menuPanel);
    }

private createCamera() {
    if (!this.preferences) {
        console.warn(`NO PREFERENCES WHEN SETTING UP CAMERA !!!`);
        return;
    }

    const pref = this.preferences;
    let camera: BABYLON.FreeCamera | null = null;

    if (pref.camera_mode === "2D") {
        const orthoCam = new BABYLON.FreeCamera("OrthoCam", new BABYLON.Vector3(
            pref.camera_pos_x,
            pref.camera_pos_y,
            pref.camera_pos_z
        ), this.scene);

        const distance = 30; // control zoom
        orthoCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

        const ratio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
        orthoCam.orthoLeft   = distance;
        orthoCam.orthoRight  = -distance;
        orthoCam.orthoTop    = -ratio * distance;
        orthoCam.orthoBottom = ratio * distance;

        orthoCam.rotation = new BABYLON.Vector3(0, Math.PI / 4, 0);
        camera = orthoCam;
    } else if (pref.camera_mode === "3D") {
        const freeCam = new BABYLON.FreeCamera("FreeCam", new BABYLON.Vector3(
            pref.camera_pos_x,
            pref.camera_pos_y,
            pref.camera_pos_z
        ), this.scene);

        freeCam.rotation.x = BABYLON.Tools.ToRadians(pref.camera_angle);
        camera = freeCam;
    }

    if (!camera) {
        console.error("Camera creation failed: Unknown camera mode or camera not assigned.");
        return;
    }

    if (pref.camera_focus === "center" && pref.camera_mode === '3D') {
        camera.setTarget(BABYLON.Vector3.Zero());
    }

    camera.inputs.clear();
    this.scene.activeCamera = camera;
    console.log("Camera created successfully:", camera.name);
}

    private createLight() {
        if (!this.preferences) return;

        // Dispose previous light if exists
        if (this.light) {
            this.light.dispose();
            this.light = null;
        }
        // Create Hemispheric Light shining from above (direction: (0,1,0))
        this.light = new BABYLON.HemisphericLight("hemLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        // Set intensity from preferences
        this.light.intensity = this.preferences.light_intensity;
    }
    private createFixObj() {
        if (!this.preferences) return;
        this.disposeOldMeshes(); 

        this.createWalls();
        this.createPaddles();
        this.createBall();
    }
    private disposeOldMeshes(){
        // Dispose walls
        this.frontWalls?.forEach(wall => wall.dispose());
        this.sideWalls?.forEach(wall => wall.dispose());
        this.frontWalls = [];
        this.sideWalls = [];

        // Dispose paddles
        this.userPaddle?.dispose();
        this.opponentPaddle?.dispose();

        // Dispose ball
        this.ball?.dispose();
    }

   private createMaterial(
	shape: string,
	color: string,
	texture: string | null,
	material: string
    ): BABYLON.Material {
        const matName = `${shape}-${material}-${color}`;
        const texturePath = texture ? `../assets/textures/${texture}.jpg` : null;

        if (material === 'tron') {
            const tronMat = new BABYLON.StandardMaterial(matName, this.scene);
            tronMat.emissiveColor = BABYLON.Color3.FromHexString(color);
            if (texturePath) {
                tronMat.emissiveTexture = new BABYLON.Texture(texturePath, this.scene);
            }
            return tronMat;
        }

        if (material === 'metallic') {
            const pbr = new BABYLON.PBRMaterial(matName, this.scene);
            pbr.metallic = 1;
            pbr.roughness = 0.3;
            pbr.albedoColor = BABYLON.Color3.FromHexString(color);
            if (texturePath) {
                pbr.albedoTexture = new BABYLON.Texture(texturePath, this.scene);
            }
            return pbr;
        }

        if (material === 'glass') {
            const glassMat = new BABYLON.PBRMaterial(matName, this.scene);
            glassMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            glassMat.alpha = 0.3;
            glassMat.indexOfRefraction = 0.52;
            glassMat.albedoColor = BABYLON.Color3.FromHexString(color);
            glassMat.metallic = 0.0;
            glassMat.roughness = 0.1;
            if (texturePath) {
                glassMat.albedoTexture = new BABYLON.Texture(texturePath, this.scene);
            }
            return glassMat;
        }

        if (material === 'glow') {
            const glowMat = new BABYLON.StandardMaterial(matName, this.scene);
            glowMat.emissiveColor = BABYLON.Color3.FromHexString(color);
            glowMat.diffuseColor = BABYLON.Color3.Black(); // No diffuse to enhance glow
            if (texturePath) {
                glowMat.emissiveTexture = new BABYLON.Texture(texturePath, this.scene);
            }
            return glowMat;
        }

        // Default: standard material
        const standardMat = new BABYLON.StandardMaterial(matName, this.scene);
        standardMat.diffuseColor = BABYLON.Color3.FromHexString(color);
        if (texturePath) {
            standardMat.diffuseTexture = new BABYLON.Texture(texturePath, this.scene);
        }
        return standardMat;
    }


    private createWalls() {
    if (!this.preferences) return;

    const width = LIMIT.arenaWidth2p;   // e.g. 16 (horizontal)
    const depth = LIMIT.arenaLength2p;  // e.g. 10 (vertical)

    const wallHeight = 0.3;
    const wallDepth = 0.5;   // thickness in Z
    const wallLength = 0.25; // thickness in X

    const wallMaterial = this.createMaterial(
        'walls',
        this.preferences.wall_color,
        this.preferences.wall_texture,
        this.preferences.wall_material
    );

    // LEFT wall (short side)
    const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", {
        width: wallLength,               // short and thick
        height: wallHeight,
        depth: depth                     // full height of arena
    }, this.scene);
    leftWall.position.x = -width / 2 - wallLength / 2;
    leftWall.material = wallMaterial;
    this.frontWalls.push(leftWall);

    // RIGHT wall
    const rightWall = leftWall.clone("rightWall");
    rightWall.position.x = width / 2 + wallLength / 2;
    rightWall.material = wallMaterial;
    this.frontWalls.push(rightWall);

    // TOP wall (long side)
    const topWall = BABYLON.MeshBuilder.CreateBox("topWall", {
        width: width,                   // full width
        height: wallHeight,
        depth: wallDepth                // thin thickness
    }, this.scene);
    topWall.position.z = depth / 2 + wallDepth / 2;
    topWall.material = wallMaterial;
    this.sideWalls.push(topWall);

    // BOTTOM wall
    const bottomWall = topWall.clone("bottomWall");
    bottomWall.position.z = -depth / 2 - wallDepth / 2;
    bottomWall.material = wallMaterial;
    this.sideWalls.push(bottomWall);
}

    private createPaddles() {
        if (!this.preferences) return;

        const paddleMat = this.createMaterial(
            'userPaddle',
            this.preferences.paddle_color,
            this.preferences.paddle_texture,
            this.preferences.paddle_material
        );
        const opPaddleMat = this.createMaterial(
            'opPaddle',
            this.preferences.op_paddle_color,
            this.preferences.op_paddle_texture,
            this.preferences.op_paddle_material
        );
        const userPaddle = BABYLON.MeshBuilder.CreateBox('userPaddle', {
            width: LIMIT.paddleWidth,
            height: 1,
            depth:LIMIT.paddleSize,
        }, this.scene);
        userPaddle.material = paddleMat;
        userPaddle.position.set(-LIMIT.arenaLength2p+ LIMIT.paddleWidth+ 1, 0, 0);
        this.userPaddle = userPaddle;

        const opPaddle = BABYLON.MeshBuilder.CreateBox('opponentPaddle', {
            width: LIMIT.paddleWidth,
            height: 1,
            depth: LIMIT.paddleSize,
        }, this.scene);
        opPaddle.material = opPaddleMat;
        opPaddle.position.set(LIMIT.arenaLength2p - LIMIT.paddleWidth - 1, 0, 0);
        this.opponentPaddle = opPaddle;
    }

    private createBall() {
        if (!this.preferences) return;

        const ballMat = this.createMaterial(
            'ball',
            this.preferences.ball_color,
            this.preferences.ball_texture,
            this.preferences.ball_material
        );

        const ball = BABYLON.MeshBuilder.CreateSphere('ball', {
            diameter: LIMIT.ballSize,
        }, this.scene);
        ball.material = ballMat;
        ball.position.set(0, 0, 0);
        this.ball = ball;

        if (this.preferences.ball_trail_enabled) {
            const trail = new BABYLON.TrailMesh("ballTrail", ball, this.scene, 0.2, 30, true);
            const trailMat = new BABYLON.StandardMaterial("trailMat", this.scene);
            trailMat.emissiveColor = BABYLON.Color3.FromHexString(this.preferences.ball_color);
            trail.material = trailMat;
        }
    }


    private fakeGameLoop() {
        if (!this.preferences) return;  // safety check

        // 1) Update ball position (simple up/down movement)
        this.updateBallPosition();

        // 2) Check collisions and play sound if needed
        this.checkCollisionsAndPlaySound();

        // 3) Apply any changes from preferences (e.g., colors, materials)
        this.applyPreferences();

    }

    private updateBallPosition() {
        if (!this.ball) return;

        // Move the ball along Z axis
        this.ball.position.x += this.ballDirection * this.ballSpeed;

        const maxX = LIMIT.arenaLength2p - LIMIT.ballSize - LIMIT.paddleWidth ;
        const minX = -maxX;

        if (this.ball.position.x >= maxX) {
            this.ball.position.x = maxX;
            this.ballDirection = -1;
        }

        if (this.ball.position.x <= minX) {
            this.ball.position.x = minX;
            this.ballDirection = 1;
        }
    }

    //WRONG POS.Z ? 
    private checkCollisionsAndPlaySound() {
        if (!this.ball) return;

        // Get paddle positions
        const playerPaddleZ = this.userPaddle?.position.z ?? -LIMIT.arenaLength2p / 2;
        const opponentPaddleZ = this.opponentPaddle?.position.z ?? LIMIT.arenaLength2p / 2;

        // Tolerance to detect a "hit"
        const hitTolerance = 0.1;

        // Check if ball just bounced on a paddle
        if (
            this.ballDirection === -1 &&
            Math.abs(this.ball.position.z - opponentPaddleZ) < hitTolerance &&
            Math.abs(this.lastBounceZ - this.ball.position.z) > hitTolerance
        ) {
            //this.playBounceSound();
            this.lastBounceZ = this.ball.position.z;
        }

        if (
            this.ballDirection === 1 &&
            Math.abs(this.ball.position.z - playerPaddleZ) < hitTolerance &&
            Math.abs(this.lastBounceZ - this.ball.position.z) > hitTolerance
        ) {
            //this.playBounceSound();
            this.lastBounceZ = this.ball.position.z;
        }
    }

    
    private applyPreferences() {
        if (!this.preferences) return;

        // Compare to previous
        const prefsChanged = JSON.stringify(this.preferences) !== JSON.stringify(this.previousPreferences);
        if (!prefsChanged) return;

        // Update previous
        this.previousPreferences = JSON.parse(JSON.stringify(this.preferences));

        // Recreate and assign materials
        if (this.ball) {
            this.ball.material = this.createMaterial('ball', this.preferences.ball_color, this.preferences.ball_texture, this.preferences.ball_material);
        }

        if (this.userPaddle) {
            this.userPaddle.material = this.createMaterial('userPaddle', this.preferences.paddle_color, this.preferences.paddle_texture, this.preferences.paddle_material);
        }

        if (this.opponentPaddle) {
            this.opponentPaddle.material = this.createMaterial('opPaddle', this.preferences.op_paddle_color, this.preferences.op_paddle_texture, this.preferences.op_paddle_material);
        }

        if (this.sideWalls && this.sideWalls.length > 0) {
            const wallMat = this.createMaterial('walls', this.preferences.wall_color, this.preferences.wall_texture, this.preferences.wall_material);
            for (const wall of this.sideWalls) {
                wall.material = wallMat;
            }
        }
            if (this.frontWalls && this.frontWalls.length > 0) {
            const wallMat = this.createMaterial('walls', this.preferences.wall_color, this.preferences.wall_texture, this.preferences.wall_material);
            for (const wall of this.frontWalls) {
                wall.material = wallMat;
            }
        }
    }

    public dispose() {
        this.engine.dispose();
    }

    public handleResize() {
        this.engine.resize();
    }
    
};