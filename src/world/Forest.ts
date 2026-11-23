// src/world/Forest.ts
import {
  InstancedMesh,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  IcosahedronGeometry,
  Object3D,
  Matrix4,
  Euler,
  Vector3,
  Color,
  MathUtils,
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
} from 'three/webgpu';
import type { Terrain } from './Terrain';

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

    // ── Pine foliage (cone) ──────────────────────────────────────────────
    const foliageGeo = new ConeGeometry(0.9, 4.5, 6);
    foliageGeo.translate(0, 2.25 + 0.6, 0); // lift above trunk
    const foliageMat = new MeshStandardMaterial({
      color: new Color(0x112211),
      roughness: 1.0,
      metalness: 0.0,
    });
    const foliageMesh = new InstancedMesh(foliageGeo, foliageMat, treeCount);
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;

    // ── Pine trunk (cylinder) ────────────────────────────────────────────
    const trunkGeo = new CylinderGeometry(0.12, 0.18, 1.2, 5);
    trunkGeo.translate(0, 0.6, 0);
    const trunkMat = new MeshStandardMaterial({
      color: new Color(0x2a1505),
      roughness: 1.0,
      metalness: 0.0,
    });
    const trunkMesh = new InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkMesh.castShadow = true;

    // ── Dead tree variety ────────────────────────────────────────────────
    const deadCount = Math.floor(treeCount * 0.08);
    const deadGeo = new CylinderGeometry(0.08, 0.14, 5, 5);
    deadGeo.translate(0, 2.5, 0);
    const deadMat = new MeshStandardMaterial({ color: new Color(0x1a1208), roughness: 1 });
    const deadMesh = new InstancedMesh(deadGeo, deadMat, deadCount);

    const SIZE = 190;
    const color = new Color();
    let deadIdx = 0;

    for (let i = 0; i < treeCount; i++) {
      let x: number, z: number;
      // Bias away from center
      do {
        x = (rng() - 0.5) * SIZE * 2;
        z = (rng() - 0.5) * SIZE * 2;
      } while (x * x + z * z < 20 * 20);

      const y = terrain.getHeight(x, z);
      const scale = 0.7 + rng() * 0.6;
      const rotY = rng() * Math.PI * 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      foliageMesh.setMatrixAt(i, dummy.matrix);
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // Slight color variation
      color.setHSL(0.33, 0.4 + rng() * 0.2, 0.06 + rng() * 0.04);
      foliageMesh.setColorAt(i, color);

      // Some trees are dead
      if (deadIdx < deadCount && rng() < 0.1) {
        const deadScale = 0.6 + rng() * 0.8;
        dummy.scale.setScalar(deadScale);
        dummy.updateMatrix();
        deadMesh.setMatrixAt(deadIdx, dummy.matrix);
        deadIdx++;
      }
    }

    foliageMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
    if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
    deadMesh.instanceMatrix.needsUpdate = true;
    deadMesh.count = deadIdx;

    this.meshes.push(foliageMesh, trunkMesh, deadMesh);

    // ── Grass / fern cards ───────────────────────────────────────────────
    const grassCount = 3000;
    const grassGeo = this.makeCrossQuad(0.4, 0.55);
    const grassMat = new MeshStandardMaterial({
      color: new Color(0x0d1f0d),
      roughness: 1,
      metalness: 0,
      side: DoubleSide,
      transparent: true,
      opacity: 0.85,
      alphaTest: 0.1,
    });
    const grassMesh = new InstancedMesh(grassGeo, grassMat, grassCount);

    const rng2 = seededRand(99);
    for (let i = 0; i < grassCount; i++) {
      const gx = (rng2() - 0.5) * SIZE * 2;
      const gz = (rng2() - 0.5) * SIZE * 2;
      const gy = terrain.getHeight(gx, gz);
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, rng2() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.6 + rng2() * 0.8);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    grassMesh.receiveShadow = true;
    this.meshes.push(grassMesh);

    // ── Rocks ────────────────────────────────────────────────────────────
    const rockCount = 300;
    const rockGeo = new IcosahedronGeometry(0.4, 0);
    rockGeo.scale(1, 0.5, 1);
    const rockMat = new MeshStandardMaterial({ color: new Color(0x1a1a1e), roughness: 0.9 });
    const rockMesh = new InstancedMesh(rockGeo, rockMat, rockCount);
    const rng3 = seededRand(777);
    for (let i = 0; i < rockCount; i++) {
      const rx = (rng3() - 0.5) * SIZE * 2;
      const rz = (rng3() - 0.5) * SIZE * 2;
      const ry = terrain.getHeight(rx, rz);
      dummy.position.set(rx, ry + 0.1, rz);
      dummy.rotation.set(0, rng3() * Math.PI * 2, rng3() * 0.3);
      dummy.scale.setScalar(0.5 + rng3() * 1.5);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    rockMesh.castShadow = true;
    this.meshes.push(rockMesh);
  }

  private makeCrossQuad(w: number, h: number): BufferGeometry {
    // Two crossed quads forming an X shape (for grass/fern)
    const hw = w / 2;
    const positions: number[] = [
      // Quad 1 (along X)
      -hw, 0, 0,  hw, 0, 0,  hw, h, 0,
      -hw, 0, 0,  hw, h, 0,  -hw, h, 0,
      // Quad 2 (along Z)
      0, 0, -hw,  0, 0, hw,  0, h, hw,
      0, 0, -hw,  0, h, hw,  0, h, -hw,
    ];
    const normals: number[] = [];
    for (let i = 0; i < 12; i++) normals.push(0, 1, 0);
    const uvs: number[] = [
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
    ];
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  getMeshes(): Object3D[] {
    return this.meshes;
  }
}
