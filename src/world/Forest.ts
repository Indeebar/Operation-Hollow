// src/world/Forest.ts
import {
  InstancedMesh,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
} from 'three/webgpu';
import type { Terrain } from './Terrain';
import { getTrailDistance } from './Terrain';

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export class Forest {
  private meshes: Object3D[] = [];

  constructor(terrain: Terrain, treeCount = 2500) {
    const rng = seededRand(42);
    const dummy = new Object3D();

    // ── Pine foliage: 3 stacked cones for a realistic pine silhouette ──
    // Bottom cone: widest
    const bottomConeGeo = new ConeGeometry(1.3, 2.0, 7);
    bottomConeGeo.translate(0, 1.6, 0);

    // Middle cone: medium
    const midConeGeo = new ConeGeometry(1.0, 1.8, 7);
    midConeGeo.translate(0, 2.7, 0);

    // Top cone: sharp tip
    const topConeGeo = new ConeGeometry(0.65, 1.6, 7);
    topConeGeo.translate(0, 3.8, 0);

    // Material: very dark green-black color with roughness
    const foliageMat = new MeshStandardMaterial({
      color: new Color(0x0c1a10),
      roughness: 0.95,
      metalness: 0.0,
    });

    const bottomConeMesh = new InstancedMesh(bottomConeGeo, foliageMat, treeCount);
    bottomConeMesh.castShadow = true;
    bottomConeMesh.receiveShadow = true;

    const midConeMesh = new InstancedMesh(midConeGeo, foliageMat, treeCount);
    midConeMesh.castShadow = true;
    midConeMesh.receiveShadow = true;

    const topConeMesh = new InstancedMesh(topConeGeo, foliageMat, treeCount);
    topConeMesh.castShadow = true;
    topConeMesh.receiveShadow = true;

    // ── Pine trunk: dark brown cylinder ────────────────────────────────
    const trunkGeo = new CylinderGeometry(0.12, 0.22, 1.5, 6);
    trunkGeo.translate(0, 0.75, 0);
    const trunkMat = new MeshStandardMaterial({
      color: new Color(0x1a110a),
      roughness: 0.98,
      metalness: 0.0,
    });
    const trunkMesh = new InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkMesh.castShadow = true;

    // ── Dead trees: gnarled/bare tall trunks with slight lean ───────────
    const deadCount = Math.floor(treeCount * 0.1);
    const deadGeo = new CylinderGeometry(0.08, 0.18, 5.5, 5);
    deadGeo.translate(0, 2.75, 0);
    const deadMat = new MeshStandardMaterial({
      color: new Color(0x130e09),
      roughness: 1.0,
    });
    const deadMesh = new InstancedMesh(deadGeo, deadMat, deadCount);
    deadMesh.castShadow = true;

    const SIZE = 190;
    const color = new Color();
    let deadIdx = 0;

    for (let i = 0; i < treeCount; i++) {
      let x: number, z: number;
      // Position trees across terrain, keeping a clear radius of only ~8 m around spawn (0,0)
      // and keeping clear of the immediate walking trail (~2.0 m)
      let attempts = 0;
      do {
        x = (rng() - 0.5) * SIZE * 2;
        z = (rng() - 0.5) * SIZE * 2;
        attempts++;
      } while (
        attempts < 20 &&
        (x * x + z * z < 8 * 8 || getTrailDistance(x, z) < 2.0)
      );

      const y = terrain.getHeight(x, z);
      // Slight scale and rotation variety
      const scale = 0.75 + rng() * 0.55;
      const rotY = rng() * Math.PI * 2;
      const tiltX = (rng() - 0.5) * 0.08;
      const tiltZ = (rng() - 0.5) * 0.08;

      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(scale, scale * (0.9 + rng() * 0.2), scale);
      dummy.updateMatrix();

      bottomConeMesh.setMatrixAt(i, dummy.matrix);
      midConeMesh.setMatrixAt(i, dummy.matrix);
      topConeMesh.setMatrixAt(i, dummy.matrix);
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // Very dark green-black color with subtle individual hue/lightness variation
      color.setHSL(0.35 + (rng() - 0.5) * 0.06, 0.35 + rng() * 0.2, 0.05 + rng() * 0.03);
      bottomConeMesh.setColorAt(i, color);
      midConeMesh.setColorAt(i, color);
      topConeMesh.setColorAt(i, color);

      // Place dead trees interspersed
      if (deadIdx < deadCount && rng() < 0.12) {
        let dx: number, dz: number;
        let dAttempts = 0;
        do {
          dx = (rng() - 0.5) * SIZE * 2;
          dz = (rng() - 0.5) * SIZE * 2;
          dAttempts++;
        } while (
          dAttempts < 20 &&
          (dx * dx + dz * dz < 8 * 8 || getTrailDistance(dx, dz) < 1.8)
        );

        const dy = terrain.getHeight(dx, dz);
        const dScale = 0.7 + rng() * 0.6;
        dummy.position.set(dx, dy, dz);
        dummy.rotation.set((rng() - 0.5) * 0.18, rng() * Math.PI * 2, (rng() - 0.5) * 0.18);
        dummy.scale.set(dScale, dScale, dScale);
        dummy.updateMatrix();
        deadMesh.setMatrixAt(deadIdx, dummy.matrix);
        deadIdx++;
      }
    }

    bottomConeMesh.instanceMatrix.needsUpdate = true;
    midConeMesh.instanceMatrix.needsUpdate = true;
    topConeMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;

    if (bottomConeMesh.instanceColor) bottomConeMesh.instanceColor.needsUpdate = true;
    if (midConeMesh.instanceColor) midConeMesh.instanceColor.needsUpdate = true;
    if (topConeMesh.instanceColor) topConeMesh.instanceColor.needsUpdate = true;

    deadMesh.instanceMatrix.needsUpdate = true;
    deadMesh.count = deadIdx;

    this.meshes.push(bottomConeMesh, midConeMesh, topConeMesh, trunkMesh, deadMesh);
  }

  getMeshes(): Object3D[] {
    return this.meshes;
  }
}
