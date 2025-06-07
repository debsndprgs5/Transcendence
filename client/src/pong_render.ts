import { showNotification } from './notifications';
import { SocketMessage, SocketMessageMap } from './shared/gameTypes';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import * as BABYLON from 'babylonjs';


export class PongRenderer {
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;

  private paddle1!: BABYLON.Mesh;
  private paddle2!: BABYLON.Mesh;
  private ball!: BABYLON.Mesh;

  private socket: WebSocket;
  private currentMoveDir: number = 0; // -1: up, 1: down, 0: no move

  constructor(canvas: HTMLCanvasElement, socket: WebSocket) {
    this.socket = socket;

    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new BABYLON.Scene(this.engine);

    this.setupCamera();
    this.setupLighting();
    this.createGameObjects();
    this.setupInitialPositions();
    this.startRenderLoop();
    this.handleResize();

    this.initInputListeners();
  }

  private setupCamera() {
    const baseAlpha = Math.PI / 2;
    const alpha = state.playerInterface?.playerSide === 'left' ? baseAlpha : baseAlpha + Math.PI;
    const beta = Math.PI / 2.5;
    const radius = 15;

    this.camera = new BABYLON.ArcRotateCamera("camera", alpha, beta, radius, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(this.engine.getRenderingCanvas(), true);
  }

  private setupLighting() {
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
  }

  private createGameObjects() {
    this.paddle1 = BABYLON.MeshBuilder.CreateBox("paddle1", { height: 3, width: 0.5, depth: 1 }, this.scene);
    this.paddle2 = BABYLON.MeshBuilder.CreateBox("paddle2", { height: 3, width: 0.5, depth: 1 }, this.scene);
    this.ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: 0.7 }, this.scene);
  }

  private setupInitialPositions() {
    this.paddle1.position.x = -8;
    this.paddle2.position.x = 8;
    this.ball.position = new BABYLON.Vector3(0, 0, 0);
  }

  private startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  private handleResize() {
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

private initInputListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // ignore repeats

    if (e.key === 'ArrowLeft') this.sendMove(-1);
    else if (e.key === 'ArrowRight') this.sendMove(1);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.sendMove(0);
  });
}

  private sendMove(direction: number) {
    if (this.currentMoveDir === direction) return; // no duplicate sends
    this.currentMoveDir = direction;

    if (this.socket.readyState === WebSocket.OPEN && state.playerInterface?.gameID !== undefined && state.userId !== undefined) {
    const msg: SocketMessageMap['playerMove'] = {
      type: 'playerMove',
      gameID: state.playerInterface.gameID,
      userID: state.userId,
      direction
    };
    this.socket.send(JSON.stringify(msg));
  }
}

  /**
   * Update the positions of paddles and ball
   * @param gameState - object containing the positions
   * Example: { paddle1Y: number, paddle2Y: number, ballX: number, ballY: number }
   */
  public updatePositions(gameState: { paddle1Y: number; paddle2Y: number; ballX: number; ballY: number }) {
    this.paddle1.position.y = gameState.paddle1Y;
    this.paddle2.position.y = gameState.paddle2Y;
    this.ball.position.x = gameState.ballX;
    this.ball.position.y = gameState.ballY;
  }

  public dispose() {
    this.engine.dispose();
  }
}
