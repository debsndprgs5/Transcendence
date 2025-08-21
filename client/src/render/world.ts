
import * as BABYLON from '@babylonjs/core';
import { TerrainMaterial } from '@babylonjs/materials/terrain';
import * as LIMIT from '../shared/gameTypes';
import type { RendererCtx } from './pong_render';

export function setupLighting(scene: BABYLON.Scene) {
	const hemi = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
	hemi.intensity = 0.35;

	const dir = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), scene);
	dir.position = new BABYLON.Vector3(50, 100, 50);
	dir.intensity = 0.8;

	scene.environmentIntensity = 0.55;
}

export function createSkybox(scene: BABYLON.Scene) {
	new BABYLON.PhotoDome('skyDome', '../assets/milkyWay.jpg', { resolution: 64, size: 1000 }, scene);
}

export async function createFloor(scene: BABYLON.Scene, onReady?: () => void) {
	const terrain = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
		'planetTerrain',
		'../assets/textures/height_map.png',
		{ width: 200, height: 200, subdivisions: 100, minHeight: -20, maxHeight: 60, onReady },
		scene
	) as BABYLON.GroundMesh;

	const mat = new TerrainMaterial('terrainMat', scene);
	mat.mixTexture = new BABYLON.Texture('../assets/textures/mixmap.png', scene);

	mat.diffuseTexture1 = new BABYLON.Texture('../assets/textures/fire.jpg', scene);
	mat.diffuseTexture2 = new BABYLON.Texture('../assets/textures/brick.jpg', scene);
	mat.diffuseTexture3 = new BABYLON.Texture('../assets/textures/fire.jpg', scene);
	//mat.bumpTexture2 = new BABYLON.Texture('../assets/textures/wood2.jpg', scene);
	mat.bumpTexture3 = new BABYLON.Texture('../assets/textures/marble.jpg', scene);

	mat.diffuseTexture1.uScale = mat.diffuseTexture1.vScale = 10;
	mat.diffuseTexture2.uScale = mat.diffuseTexture2.vScale = 5;
	mat.diffuseTexture3.uScale = mat.diffuseTexture3.vScale = 10;
	mat.specularColor = BABYLON.Color3.Black();
	mat.maxSimultaneousLights = 20;

	terrain.material = mat;
	terrain.position.y = 0;
}

export function setupCamera(ctx: RendererCtx) {
	const { scene, engine, playerSide, playerCount } = ctx;
	const width = playerCount === 2 ? LIMIT.arenaWidth2p : LIMIT.arenaWidth4p;
	const depth = playerCount === 2 ? LIMIT.arenaLength2p : LIMIT.arenaLength4p;

	const dist = Math.max(width, depth) * 1.2;
	const height = 40;

	let pos = new BABYLON.Vector3(0, height, -dist);
  let target = new BABYLON.Vector3(0,0,0);
	console.warn(`[CAMERA] setting up side:${playerSide}`)
	switch (playerSide) {
		case 'left':
      pos = new BABYLON.Vector3(-dist, height, 0);
      target = new BABYLON.Vector3(-(dist/10), 0, 0);
      break;
		case 'right':
      pos = new BABYLON.Vector3(+dist, height, 0);
      target = new BABYLON.Vector3((dist/10), 0, 0);
      break;
		case 'top':
      pos = new BABYLON.Vector3(0, height, +dist);
      target = new BABYLON.Vector3(0, 0, (dist/10));
      break;
		case 'bottom':
      pos = new BABYLON.Vector3(0, height, -dist);
      target = new BABYLON.Vector3(0, 0, -(dist/10));
      break;
	}

	let camera = new BABYLON.FreeCamera('camera', pos, scene);
	camera.minZ = 0.1;
	camera.maxZ = 5000;
	camera.inertia = 0.7;
	camera.speed = 0.75;
	camera.setTarget(target);
	camera.attachControl(engine.getRenderingCanvas(), true);

  camera.fovMode = BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
  camera.fov = BABYLON.Tools.ToRadians(85); // or whatever you like

	// clamp + face center
	const margin = 25;
	scene.onBeforeRenderObservable.add(() => {
		const p = camera.position;
		const xMin = -width / 2 - margin, xMax = width / 2 + margin;
		const zMin = -depth / 2 - margin, zMax = depth / 2 + margin;
		p.x = Math.min(xMax, Math.max(xMin, p.x));
		p.z = Math.min(zMax, Math.max(zMin, p.z));
		p.y = BABYLON.Scalar.Clamp(p.y, 8, 120);
	});

	return camera;
}
/** Spawn UFOs and return the observer so we can remove it later. */
export function spawnUFOs(
  ctx: RendererCtx,
  count = 5,
  opts: { spawnYMin?: number; spawnYMax?: number; flyYMin?: number; flyYMax?: number } = {}
) {
  const { scene, ufos } = ctx;

  // Defaults: "a bit higher" than before
  const spawnYMin = opts.spawnYMin ?? 40;  // was ~26
  const spawnYMax = opts.spawnYMax ?? 65;  // was ~36
  const flyYMin   = opts.flyYMin   ?? (spawnYMin - 2); // optional clamp band
  const flyYMax   = opts.flyYMax   ?? (spawnYMax + 2);

  // Import once and create clones
  BABYLON.SceneLoader.ImportMesh('', '../assets/', 'spaceship.glb', scene, (meshes) => {
    // Hide originals
    meshes.forEach(m => {
      m.setEnabled(false);
      m.isVisible = false;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = false;
    });

    const SCALE = 0.005;

    for (let i = 0; i < count; i++) {
      const root = new BABYLON.TransformNode(`ufo_${i}`, scene);

      // Clone only real geometry
      for (const m of meshes) {
        if (!(m instanceof BABYLON.Mesh) || m.getTotalVertices() === 0) continue;
        const c = m.clone(`${m.name}_clone_${i}`, root) as BABYLON.Mesh;
        c.setEnabled(true);
        c.isVisible = true;
        c.isPickable = false;
        c.scaling.copyFromFloats(SCALE, SCALE, SCALE);
      }

      // Random spawn position (higher)
      const x = (Math.random() * 2 - 1) * 55;
      const z = (Math.random() * 2 - 1) * 55;
      const y = spawnYMin + Math.random() * (spawnYMax - spawnYMin);
      root.position.set(x, y, z);

      // Random horizontal velocity
      const dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      const speed = 4 + Math.random() * 3;
      ufos.push({ root, vel: dir.scale(speed) });
    }
  });

  const SEP_R = 10, SEP_F = 10, JITTER = 0.8;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() * 0.001;

    for (let i = 0; i < ufos.length; i++) {
      const u = ufos[i];
      const p = u.root.position;

      // Gentle wander
      u.vel.x += (Math.random() - 0.5) * JITTER;
      u.vel.z += (Math.random() - 0.5) * JITTER;

      // Separation
      let steer = new BABYLON.Vector3();
      for (let j = 0; j < ufos.length; j++) if (j !== i) {
        const d = ufos[j].root.position.subtract(p);
        const dist = d.length();
        if (dist > 0 && dist < SEP_R) steer.addInPlace(d.scale(-1 / dist));
      }
      if (!steer.equals(BABYLON.Vector3.Zero())) u.vel.addInPlace(steer.normalize().scale(SEP_F * dt));

      // Horizontal bounds
      const B = 120, margin = 4;
      if (p.x >  B - margin) u.vel.x = -Math.abs(u.vel.x);
      if (p.x < -B + margin) u.vel.x =  Math.abs(u.vel.x);
      if (p.z >  B - margin) u.vel.z = -Math.abs(u.vel.z);
      if (p.z < -B + margin) u.vel.z =  Math.abs(u.vel.z);

      // Normalize speed
      const spd = BABYLON.Scalar.Clamp(u.vel.length(), 4, 7);
      u.vel.normalize().scaleInPlace(spd);

      // Integrate
      p.addInPlace(u.vel.scale(dt));

      // Optional altitude clamp (keeps them "a bit higher")
      p.y = BABYLON.Scalar.Clamp(p.y, flyYMin, flyYMax);

      // Tiny spin
      u.root.rotate(BABYLON.Axis.X, 0.8 * dt, BABYLON.Space.LOCAL);
    }
  });

  return observer;
}


export function stopUfoLoop(ctx: RendererCtx) {
	if (ctx.ufoObserver) {
		ctx.scene.onBeforeRenderObservable.remove(ctx.ufoObserver);
		ctx.ufoObserver = undefined;
	}
}
