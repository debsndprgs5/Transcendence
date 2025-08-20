// gameObj.ts
import * as BABYLON from '@babylonjs/core';
import * as LIMIT from '../shared/gameTypes';
import type { RendererCtx, Side } from './pong_render';
import { loadPrimaryMesh, loadModelAsContainer, loadPaddleTemplates } from './assets';

export async function createWalls(ctx: RendererCtx) {
  const { scene, playerCount } = ctx;
  const baseMesh = await loadPrimaryMesh(scene, '../assets/', 'old_wall_coast02.glb');
  baseMesh.isVisible = false;

  const width = playerCount === 2 ? LIMIT.arenaWidth2p : LIMIT.arenaWidth4p;
  const depth = playerCount === 2 ? LIMIT.arenaLength2p : LIMIT.arenaLength4p;
  const halfW = width / 2, halfD = depth / 2;

  const bb = baseMesh.getBoundingInfo().boundingBox;
  const tileSize = (bb.maximum.z - bb.minimum.z) * baseMesh.scaling.z; // local Z

  // depths
const wallDeep = -3;
const wallPlayerSideDeep = -6;

type SideName = 'top' | 'bottom' | 'left' | 'right';

// helper to choose how deep to bury this wall
const yFor = (sideName: SideName) =>
  sideName === ctx.playerSide ? wallPlayerSideDeep : wallDeep;

const sides = [
  {
    name: 'top' as const,
    origin: new BABYLON.Vector3(-halfW, yFor('top'), +halfD),
    length: width,
    axis: 'x' as const,
    dir: +1 as const,
    yawOff: Math.PI,
    target: ctx.frontWalls,
  },
  {
    name: 'bottom' as const,
    origin: new BABYLON.Vector3(+halfW, yFor('bottom'), -halfD),
    length: width,
    axis: 'x' as const,
    dir: -1 as const,
    yawOff: 0,
    target: ctx.frontWalls,
  },
  {
    name: 'left' as const,
    origin: new BABYLON.Vector3(-halfW, yFor('left'), -halfD),
    length: depth,
    axis: 'z' as const,
    dir: +1 as const,
    yawOff: Math.PI / 2,
    target: ctx.sideWalls,
  },
  {
    name: 'right' as const,
    origin: new BABYLON.Vector3(+halfW, yFor('right'), +halfD),
    length: depth,
    axis: 'z' as const,
    dir: -1 as const,
    yawOff: -Math.PI / 2,
    target: ctx.sideWalls,
  },
];

  const baseYaw = -Math.PI / 2;

  for (const side of sides) {
    const fullCount = Math.floor(side.length / tileSize);
    const leftover  = side.length - fullCount * tileSize;
    const halfGap   = leftover / 2;

    // full tiles
    for (let i = 0; i < fullCount; i++) {
      const inst = baseMesh.createInstance(`${side.name}_tile_${i}`);
      const offset = side.dir * (halfGap + (i + 0.5) * tileSize);
      inst.position = side.axis === 'x'
        ? side.origin.add(new BABYLON.Vector3(offset, 0, 0))
        : side.origin.add(new BABYLON.Vector3(0, 0, offset));
      inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, baseYaw + side.yawOff);
      inst.isVisible = true;
      side.target.push(inst);
    }

    // tiny end fillers
    if (halfGap > 0.01) {
      for (const end of [0, 1]) {
        const inst = baseMesh.createInstance(`${side.name}_filler_${end}`);
        const gapCenterOffset = side.dir * ((end === 0 ? halfGap / 2 : side.length - halfGap / 2));
        inst.position = side.axis === 'x'
          ? side.origin.add(new BABYLON.Vector3(gapCenterOffset, 0, 0))
          : side.origin.add(new BABYLON.Vector3(0, 0, gapCenterOffset));
        const scale = halfGap / tileSize;
        inst.scaling = new BABYLON.Vector3(1, 1, scale);
        inst.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, baseYaw + side.yawOff);
        inst.isVisible = true;
        side.target.push(inst);
      }
    }
  }
}

export async function createPaddles(ctx: RendererCtx) {
  const { scene, glow, playerCount, playerSide } = ctx;
  const { light, dark } = await loadPaddleTemplates(scene, '../assets/', 'sci-fi_box.glb');

  const scaleProto = (proto: BABYLON.TransformNode) => {
    const b = proto.getHierarchyBoundingVectors(true);
    const curLenX = Math.max(0.001, b.max.x - b.min.x);
    const curThkY = Math.max(0.001, b.max.y - b.min.y);
    const curDepZ = Math.max(0.001, b.max.z - b.min.z);

    const thicknessFactor = 1.5;
    const depthFactor     = 1.5;

    const targetLenX = LIMIT.paddleSize;
    const targetThkY = LIMIT.paddleWidth * thicknessFactor;
    const targetDepZ = curDepZ * depthFactor;

    proto.scaling.x *= targetLenX / curLenX;
    proto.scaling.y *= targetThkY / curThkY;
    proto.scaling.z *= targetDepZ / curDepZ;
  };

  scaleProto(light);
  scaleProto(dark);

  const sides: Side[] = (playerCount === 4) ? ['left','right','top','bottom'] : ['left','right'];
  const width = playerCount === 2 ? LIMIT.arenaWidth2p  : LIMIT.arenaWidth4p;
  const depth = playerCount === 2 ? LIMIT.arenaLength2p : LIMIT.arenaLength4p;

  for (const side of sides) {
    const isPlayer = side === playerSide;
    const template = isPlayer ? light : dark;

    const root = cloneHierarchy(scene, template, `${side}_paddle`);
    root.rotationQuaternion = null;

    const wallTh = 1.5;
    const halfW = LIMIT.paddleWidth/2;
    const halfL = LIMIT.paddleSize/2;

    switch (side) {
      case 'left':
        root.rotation = new BABYLON.Vector3(0,  Math.PI / 2, 0);
        root.position = new BABYLON.Vector3(-width / 2 + wallTh + halfW, 0, 0);
        break;
      case 'right':
        root.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
        root.position = new BABYLON.Vector3( width / 2 - wallTh - halfW, 0, 0);
        break;
      case 'top':
        root.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        root.position = new BABYLON.Vector3(0, 0,  depth / 2 - wallTh - halfL);
        break;
      case 'bottom':
        root.rotation = new BABYLON.Vector3(0, 0, 0);
        root.position = new BABYLON.Vector3(0, 0, -depth / 2 + wallTh + halfL);
        break;
    }

    moveBottomToY(root, -3);

    const meshes = root.getChildMeshes() as BABYLON.Mesh[];
    meshes.forEach((m) => glow?.addExcludedMesh?.(m));

    const lightColor = isPlayer ? new BABYLON.Color3(0.20, 1.00, 0.40) : new BABYLON.Color3(0.00, 0.85, 1.00);
    const { min, max } = root.getHierarchyBoundingVectors(true);
    const hMesh = max.y - min.y;
    const lightHeight = hMesh * 1.8;
    const ySpotWorld  = root.position.y + lightHeight;
    const heightToGround = Math.max(0.001, ySpotWorld - 0);
    const desiredSpotRadius = 15;
    const angle = Math.min(Math.PI - 0.1, 2 * Math.atan(desiredSpotRadius / heightToGround));

    const spot = new BABYLON.SpotLight(`${side}_spot`, new BABYLON.Vector3(0, lightHeight, 0), new BABYLON.Vector3(0, -1, 0), angle, 4, scene);
    spot.parent = root; spot.diffuse = lightColor; spot.specular = lightColor.scale(0.25);
    spot.intensity = 2.2; spot.range = 50; spot.falloffType = BABYLON.Light.FALLOFF_STANDARD;

    const fill = new BABYLON.PointLight(`${side}_fill`, new BABYLON.Vector3(0, hMesh * 0.5, 0), scene);
    fill.parent = root; fill.diffuse = lightColor; fill.specular = lightColor.scale(0.2);
    fill.intensity = 0.3; fill.range = 10;

    // choose a stable main mesh (largest volume)
    let main: BABYLON.Mesh | undefined; let bestVol = -Infinity;
    for (const m of meshes) {
      const e = m.getBoundingInfo().boundingBox.extendSizeWorld;
      const vol = e.x * e.y * e.z;
      if (vol > bestVol) { bestVol = vol; main = m; }
    }

    if (main) ctx.paddles.push(main);
    ctx.paddleRoots[side] = root;
  }
}

export async function createBall(ctx: RendererCtx) {
  const { scene, glow } = ctx;

  const base = await loadModelAsContainer(scene, '../assets/', 'organic_ball.glb');
  const { min, max } = base.getHierarchyBoundingVectors(true);
  const curDia = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
  base.scaling.scaleInPlace(LIMIT.ballSize / Math.max(0.001, curDia));

  const ballRoot = cloneHierarchy(scene, base, 'ball');
  ballRoot.rotationQuaternion = ballRoot.rotationQuaternion ?? BABYLON.Quaternion.Identity();
  moveBottomToY(ballRoot, -2.5);

  const glowCol = new BABYLON.Color3(0.7, 0.9, 1.0);
  ballRoot.getChildMeshes().forEach((m) => {
    const src = (m.material as BABYLON.Material) ?? new BABYLON.PBRMaterial('ball_pbr', scene);
    const mat = src.clone?.(`${src.name}_ball`) as BABYLON.Material || src;
    if (mat instanceof BABYLON.PBRMaterial) { mat.emissiveColor = glowCol; mat.emissiveIntensity = 1.5; }
    else if (mat instanceof BABYLON.StandardMaterial) { mat.emissiveColor = glowCol; }
    m.material = mat;
  });

  const light = new BABYLON.PointLight('ballLight', BABYLON.Vector3.Zero(), scene);
  light.parent = ballRoot; light.range = 10; light.intensity = 2;

  const b2 = ballRoot.getHierarchyBoundingVectors(true);
  const radius = Math.max(b2.max.x - b2.min.x, b2.max.y - b2.min.y, b2.max.z - b2.min.z) * 0.5;

  ctx.ballObj = {
    root: ballRoot,
    radius,
    lastPos: ballRoot.position.clone(),
    lastTime: performance.now() * 0.001,
    light
  };
}

// ---------- tiny transforms / cloning ----------

export function moveBottomToY(node: BABYLON.TransformNode | BABYLON.AbstractMesh, y: number) {
  node.computeWorldMatrix(true);
  const before = node.getHierarchyBoundingVectors(true);
  const dy = y - before.min.y;
  node.position.y += dy;
  node.computeWorldMatrix(true);
  if (node instanceof BABYLON.AbstractMesh) node.refreshBoundingInfo(true);
}

export function cloneHierarchy(scene: BABYLON.Scene, template: BABYLON.TransformNode, name: string) {
  const root = new BABYLON.TransformNode(name, scene);
  root.setEnabled(true);
  root.position.copyFrom(template.position);
  root.scaling.copyFrom(template.scaling);
  root.rotationQuaternion = template.rotationQuaternion?.clone() ?? null;

  template.getChildMeshes().forEach((m) => {
    const c = m.clone(`${name}_${m.name}`, root) as BABYLON.Mesh;
    c.setEnabled(true); c.isVisible = true;
    if (m.material) c.material = (m.material.clone?.(`${m.material.name}_${name}`) as BABYLON.Material) ?? m.material;
  });

  root.computeWorldMatrix(true);
  root.getChildMeshes().forEach((cm) => cm.refreshBoundingInfo(true));
  return root;
}
