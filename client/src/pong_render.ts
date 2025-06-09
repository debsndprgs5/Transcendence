import { showNotification } from './notifications';
import { SocketMessage, SocketMessageMap } from './shared/gameTypes';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import * as BABYLON from 'babylonjs';


export class PongRenderer {
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.FreeCamera;

  private paddle1!: BABYLON.Mesh;
  private paddle2!: BABYLON.Mesh;
  private ball!: BABYLON.Mesh;

  private socket: WebSocket;


  constructor(canvas: HTMLCanvasElement, socket: WebSocket) {
    this.socket = socket;

    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.scene = new BABYLON.Scene(this.engine);

    this.setupCamera();
    this.setupLighting();
    this.createWalls();
    this.createGameObjects();
    this.setupInitialPositions();
    this.startRenderLoop();
    this.handleResize();

    this.initInputListeners();
  }

private setupCamera() {
  const isLeftPlayer = state.playerInterface?.playerSide === 'left';

  const cameraPosition = isLeftPlayer
    ? new BABYLON.Vector3(-15, 10, -15) // back-left
    : new BABYLON.Vector3(15, 10, -15); // back-right

  this.camera = new BABYLON.FreeCamera("camera", cameraPosition, this.scene);
  this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
}

  private setupLighting() {
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
  }
private createWalls() {
  const wallWidth = 16;    // x: -8 to 8
  const wallHeight = 0.3;
  const wallDepth = 0.5;

  // Top wall (at z = 5)
  const topWall = BABYLON.MeshBuilder.CreateBox("topWall", {
    width: wallWidth,
    height: wallHeight,
    depth: wallDepth,
  }, this.scene);
  topWall.position.z = 5 + wallDepth / 2;
  topWall.position.y = 0;

  // Bottom wall (at z = -5)
  const bottomWall = topWall.clone("bottomWall");
  bottomWall.position.z = -5 - wallDepth / 2;

  // Left and right walls (go up/down at x = -8 and x = 8)
  const verticalWallHeight = 0.3;
  const verticalWallDepth = 10;
  const verticalWallWidth = 0.25;

  const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", {
    width: verticalWallWidth,
    height: verticalWallHeight,
    depth: verticalWallDepth,
  }, this.scene);
  leftWall.position.x = -8;
  leftWall.position.y = 0;
  leftWall.position.z = 0;

  const rightWall = leftWall.clone("rightWall");
  rightWall.position.x = 8;
}

  private createGameObjects() {
    this.paddle1 = BABYLON.MeshBuilder.CreateBox("paddle1", { height: 1, width: 0.5, depth: 3 }, this.scene);
    this.paddle2 = BABYLON.MeshBuilder.CreateBox("paddle2", { height: 1, width: 0.5, depth: 3 }, this.scene);
    this.ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: 0.7 }, this.scene);
    //adds colors to paddle 
    const redMat = new BABYLON.StandardMaterial("redMat", this.scene);
    redMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // red
    this.paddle1.material = redMat;

    const greenMat = new BABYLON.StandardMaterial("greenMat", this.scene);
    greenMat.diffuseColor = new BABYLON.Color3(0, 1, 0); // green
    this.paddle2.material = greenMat;
  }

  private setupInitialPositions() {
    this.paddle1.position.x = -8;
    this.paddle2.position.x = 8;
    this.paddle1.position.z = 0;
    this.paddle2.position.z = 0;
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
   // if (e.repeat) return; // ignore repeats

    if (e.key === 'ArrowLeft') this.sendMove('left');
    else if (e.key === 'ArrowRight') this.sendMove('right');
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.sendMove('stop');
  });
}

  private sendMove(direction:string) {
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
    this.paddle1.position.z = gameState.paddle1Y;
    this.paddle2.position.z = gameState.paddle2Y;
    this.ball.position.x = gameState.ballX;
    this.ball.position.y = gameState.ballY;
  }

  public dispose() {
    this.engine.dispose();
  }
}
