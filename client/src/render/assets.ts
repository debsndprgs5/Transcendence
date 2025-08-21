<<<<<<< HEAD

=======
>>>>>>> 6a292efe47ced3c6da1a65d6fd057b3e91dbf44e
import * as BABYLON from '@babylonjs/core';

export async function loadModelAsContainer(
  scene: BABYLON.Scene,
  path: string,
  file: string
): Promise<BABYLON.Mesh> {
  const meshes = await importGLBMeshes(scene, path, file);
  const container = new BABYLON.Mesh(`${file}_container`, scene);
  container.setEnabled(false);
  meshes.forEach((m) => {
    if (m instanceof BABYLON.Mesh) {
      m.setEnabled(false);
      m.parent = container;
    } else {
      m.setEnabled(false);
    }
  });
  return container;
}

export async function loadPrimaryMesh(
  scene: BABYLON.Scene,
  path: string,
  file: string
): Promise<BABYLON.Mesh> {
  const meshes = await importGLBMeshes(scene, path, file);
  const mesh = meshes
    .filter((m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0)
    .sort((a, b) => b.getTotalVertices() - a.getTotalVertices())[0];
  if (!mesh) throw new Error(`No valid mesh found in ${file}`);
  mesh.setEnabled(false);
  return mesh;
}

export async function loadPaddleTemplates(
  scene: BABYLON.Scene,
  path: string,
  file: string
): Promise<{ light: BABYLON.TransformNode; dark: BABYLON.TransformNode }> {
  const meshes = await importGLBMeshes(scene, path, file);
  meshes.forEach((m) => m.setEnabled(false));

  const lightRoot = new BABYLON.TransformNode('paddle_light_root', scene);
  const darkRoot  = new BABYLON.TransformNode('paddle_dark_root', scene);
  lightRoot.setEnabled(false);
  darkRoot.setEnabled(false);

  let lightTop = scene.getNodeByName('Box_low_0') as BABYLON.TransformNode | null;
  let darkTop  = scene.getNodeByName('Box_low001_1') as BABYLON.TransformNode | null;

  const climbToTop = (n: BABYLON.Node | null) => {
    let cur = n;
    while (cur && cur.parent && cur.parent.name !== 'GLTF_SceneRootNode') cur = cur.parent;
    return cur as BABYLON.TransformNode | null;
  };

  if (!lightTop || !darkTop) {
    const byMat = (needle: string) =>
      meshes.find((m) => (m as BABYLON.Mesh).material?.name?.toLowerCase().includes(needle));
    const lightChild = byMat('box_light');
    const darkChild  = byMat('box_dark');
    if (lightChild && !lightTop) lightTop = climbToTop(lightChild);
    if (darkChild  && !darkTop)  darkTop  = climbToTop(darkChild);
  }

  if (!lightTop || !darkTop) {
    console.table(meshes.map((m) => ({ mesh: m.name, material: (m as BABYLON.Mesh).material?.name || '(none)' })));
    throw new Error(`Couldn’t locate both variants (Box_low_0 / Box_low001_1 or materials Box_light / Box_dark).`);
  }

  lightTop.parent = lightRoot;
  darkTop.parent  = darkRoot;
  return { light: lightRoot, dark: darkRoot };
}

async function importGLBMeshes(
  scene: BABYLON.Scene,
  path: string,
  file: string
): Promise<BABYLON.AbstractMesh[]> {
  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh('', path, file, scene,
      (meshes) => resolve(meshes),
      undefined,
      (_s, msg, err) => reject(err ?? msg)
    );
  });
}
