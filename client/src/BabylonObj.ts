import * as BABYLON from '@babylonjs/core';

export function QuickTree(
	scene: BABYLON.Scene,
	sizeBranch: number,
	sizeTrunk: number,
	radius: number,
	trunkMaterial: BABYLON.Material,
	leafMaterial: BABYLON.Material
): BABYLON.Mesh {
	let tree = new BABYLON.Mesh("tree", scene);

	const leaves = BABYLON.MeshBuilder.CreateSphere("sphere", {
		segments: 2,
		diameter: sizeBranch
	}, scene);

	const positions = leaves.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;
	const indices = leaves.getIndices()!;
	const numberOfPoints = positions.length / 3;

	const map: Array<(BABYLON.Vector3 | number)[]> = [];
	const max: BABYLON.Vector3[] = [];

	for (let i = 0; i < numberOfPoints; i++) {
		const p = new BABYLON.Vector3(
			positions[i * 3],
			positions[i * 3 + 1],
			positions[i * 3 + 2]
		);

		if (p.y >= sizeBranch / 2) {
			max.push(p);
		}

		let found = false;
		for (let index = 0; index < map.length && !found; index++) {
			const array = map[index];
			const p0 = array[0] as BABYLON.Vector3;
			if (p0.equals(p) || p0.subtract(p).lengthSquared() < 0.01) {
				array.push(i * 3);
				found = true;
			}
		}
		if (!found) {
			map.push([p, i * 3]);
		}
	}

	const randomNumber = (min: number, max: number) =>
		min === max ? min : (Math.random() * (max - min)) + min;

	map.forEach(array => {
		const min = -sizeBranch / 10;
		const max = sizeBranch / 10;
		const rx = randomNumber(min, max);
		const ry = randomNumber(min, max);
		const rz = randomNumber(min, max);

		for (let index = 1; index < array.length; index++) {
			const i = array[index] as number;
			positions[i] += rx;
			positions[i + 1] += ry;
			positions[i + 2] += rz;
		}
	});

	leaves.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
	const normals: number[] = [];
	BABYLON.VertexData.ComputeNormals(positions, indices, normals);
	leaves.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
	leaves.convertToFlatShadedMesh();
	leaves.material = leafMaterial;

	const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk", {
		height: sizeTrunk,
		diameterTop: Math.max(1, radius - 2),
		diameterBottom: radius,
		tessellation: 10,
		subdivisions: 2
	}, scene);

	trunk.material = trunkMaterial;
	trunk.convertToFlatShadedMesh();
	
	leaves.position.y = (sizeTrunk + sizeBranch) / 2 - 2;

	// Parent everything to a container first (optional)
	leaves.parent = null;
	trunk.parent = null;

	 tree = BABYLON.Mesh.MergeMeshes([trunk, leaves], true, true, undefined, false, true)!;
	tree.name = "tree";

	return tree;

}

export function simplePine(
	canopies: number,
	height: number,
	trunkMaterial: BABYLON.Material,
	leafMaterial: BABYLON.Material,
	scene: BABYLON.Scene
): BABYLON.Mesh {
	const curvePoints = (length: number, total: number): BABYLON.Vector3[] => {
		const path: BABYLON.Vector3[] = [];
		const step = length / total;

		for (let i = 0; i < length; i += step) {
			path.push(new BABYLON.Vector3(0, i, 0));
			path.push(new BABYLON.Vector3(0, i, 0));
		}
		return path;
	};

	const nbL = canopies + 1;
	const nbS = height;

	const curve = curvePoints(nbS, nbL);

	const radiusFunction = (i: number, _distance: number): number => {
		const factor = (i % 2 === 0) ? 0.5 : 1;
		return (nbL * 2 - i - 1) * factor;
	};

	const leaves = BABYLON.Mesh.CreateTube(
		"tube",
		curve,
		0,
		10,
		radiusFunction,
		1,
		scene
	);

	const trunkHeight = nbS / nbL;
	const trunkRadius = nbL * 1.5 - nbL / 2 - 1;

	const trunk = BABYLON.Mesh.CreateCylinder(
		"trunk",
		trunkHeight,
		trunkRadius,
		trunkRadius,
		12,
		1,
		scene
	);

	leaves.material = leafMaterial;
	trunk.material = trunkMaterial;

	let tree = BABYLON.Mesh.CreateBox("invisibleBox", 1, scene);
	tree.isVisible = false;

	leaves.parent = null;
	trunk.parent = null;

	 tree = BABYLON.Mesh.MergeMeshes([trunk, leaves], true, true, undefined, false, true)!;
	tree.name = "tree";

	return tree;
}