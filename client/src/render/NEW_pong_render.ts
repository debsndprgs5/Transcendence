import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as LIMIT from '../shared/gameTypes';
import type { TypedSocket } from '../shared/gameTypes';
import * as GUI from '@babylonjs/gui';
import { setupLighting, setupCamera, createSkybox, createFloor, spawnUFOs, stopUfoLoop } from './world';
import { createWalls, createPaddles, createBall } from './gameObj';
import { setupGUI } from './ui';
import { registerInput, startRenderLoop, attachResize, processNetworkUpdate, type UpdatePayload } from './coreRender';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface BallState {
	root: BABYLON.TransformNode;
	radius: number;
	lastPos: BABYLON.Vector3;
	lastTime: number;
	light: BABYLON.PointLight;
}

export interface MY_UI {
  adt: GUI.AdvancedDynamicTexture;
  topBar: GUI.Rectangle;
  bottomBar: GUI.Rectangle;
  timeText: GUI.TextBlock;
  gameNameText: GUI.TextBlock;
  leaveBtn: GUI.Button;
  chips: Partial<Record<Side, {
    container: GUI.Rectangle;
    avatarHolder: GUI.Rectangle;  // <= was GUI.Control
    name: GUI.TextBlock;
    score: GUI.TextBlock;
  }>>;
  scoreboard: GUI.TextBlock;
}


export interface RendererCtx {
	// core
	engine: BABYLON.Engine;
	scene: BABYLON.Scene;
	camera: BABYLON.FreeCamera;
	glow: BABYLON.GlowLayer;

	// game meta
	playerCount: number;
	playerSide: Side;
	gameName: string;

	// game objects
	frontWalls: BABYLON.InstancedMesh[];
	sideWalls: BABYLON.InstancedMesh[];
	paddles: BABYLON.Mesh[];
	paddleRoots: Partial<Record<Side, BABYLON.TransformNode>>;
	ballObj?: BallState;

	// fun stuff
	ufos: { root: BABYLON.TransformNode; vel: BABYLON.Vector3 }[];
	ufoObserver?: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>>;

	// input
	inputState: { left: boolean; right: boolean };
	currentDir: 'left' | 'right' | 'stop';

	// UI
	  ui?:MY_UI

	// misc
	playersInfo: Record<Side, string>;
	socket: TypedSocket;
}

export class PongRenderer {
	// keep references public-ish so helpers can mutate via ctx
	private ctx!: RendererCtx;

	constructor(
		canvas: HTMLCanvasElement,
		typedSocket: TypedSocket,
		playerCount: number,
		gameName: string,
		playerSide: Side,
		usernames: Record<Side, string>
	) {
		// persist a few bits for other pages/debug
		localStorage.setItem('playerCount', String(playerCount));
		localStorage.setItem('playerSide', playerSide);
		localStorage.setItem('usernames', JSON.stringify(usernames));
		if (gameName !== undefined) localStorage.setItem('gameName', gameName);

		const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
		const scene = new BABYLON.Scene(engine);
		const glow = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 16 });
		glow.intensity = 0.35;

		// minimal camera; real setup happens in world.setupCamera
		let camera = new BABYLON.FreeCamera('MockCamera', new BABYLON.Vector3(0, 80, 0), scene);
		camera.setTarget(BABYLON.Vector3.Zero());

		this.ctx = {
			engine, scene, camera, glow,
			playerCount, playerSide,gameName,
			frontWalls: [], sideWalls: [],
			paddles: [], paddleRoots: {},
			ufos: [],
			inputState: { left: false, right: false },
			currentDir: 'stop',
			//isPaused: false,
			playersInfo: usernames,
			socket: typedSocket,
		};
		this.setupGame();
	}

	public async setupGame() {
		const { ctx } = this;

		// World
		createSkybox(ctx.scene);
		await createFloor(ctx.scene, async () => {
			ctx.ufoObserver = spawnUFOs(ctx, 7, {
				spawnYMin: 45, spawnYMax: 70,
				flyYMin: 43,  flyYMax: 74
			});
		});
		setupLighting(ctx.scene);
		ctx.camera.dispose();
		ctx.camera = await setupCamera(ctx);

		// Arena & game objects
		await createWalls(ctx);
		await createPaddles(ctx);   // sets ctx.paddles & ctx.paddleRoots
		await createBall(ctx);      // sets ctx.ballObj

		// UI (stubs for now, still useful for pause overlay later)
		setupGUI(ctx);              // safe no-op stub you can expand
		//setupPauseUI(ctx);          // sets ctx.pauseUI later

		// Input + loop + resize
		registerInput(ctx);
		startRenderLoop(ctx);
		attachResize(ctx);
	}

  // Public: server pushes state here
	public updateScene(update: UpdatePayload) {
		processNetworkUpdate(this.ctx, update);
	}

	public async setSide(side: Side) {
		this.ctx.playerSide = side;
	}

	public resumeRenderLoop() {
		this.ctx.engine.stopRenderLoop();
		startRenderLoop(this.ctx);
		//this.ctx.isPaused = false;
		//if (this.ctx.pauseUI?.container) this.ctx.pauseUI.container.isVisible = false;
	}

	public getScene(): BABYLON.Scene {
		return this.ctx.scene;
	}
	public handleResize() {
		window.addEventListener("resize", () => {
			this.ctx.engine.resize();
		});
	}
	public dispose() {
		const { ctx } = this;
		ctx.engine.stopRenderLoop();
		if (ctx.ufoObserver) ctx.scene.onBeforeRenderObservable.remove(ctx.ufoObserver);
		stopUfoLoop(ctx); // safety no-op if none
		ctx.engine.dispose();
		// input listeners are removed by registerInput's disposer (we tie to scene dispose implicitly here)
	}
}
