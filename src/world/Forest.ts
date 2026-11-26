// src/world/Forest.ts
import {
  InstancedMesh,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
  CanvasTexture,
  DoubleSide,
  Vector3,
} from 'three/webgpu';
import type { Terrain } from './Terrain';
import { getTrailDistance, isInsideClearing } from './LevelData';
import { Materials } from './MaterialLibrary';

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function createFernTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const blades = [
    { startX: 64, startY: 128, cp1X: 60, cp1Y: 80, cp2X: 30, cp2Y: 40, endX: 18, endY: 20, width: 9 },
    { startX: 64, startY: 128, cp1X: 62, cp1Y: 70, cp2X: 45, cp2Y: 25, endX: 38, endY: 10, width: 8 },
    { startX: 64, startY: 128, cp1X: 64, cp1Y: 60, cp2X: 64, cp2Y: 20, endX: 64, endY: 6, width: 8 },
    { startX: 64, startY: 128, cp1X: 66, cp1Y: 70, cp2X: 83, cp2Y: 25, endX: 90, endY: 10, width: 8 },
    { startX: 64, startY: 128, cp1X: 68, cp1Y: 80, cp2X: 98, cp2Y: 40, endX: 110, endY: 20, width: 9 },
    { startX: 64, startY: 128, cp1X: 58, cp1Y: 95, cp2X: 35, cp2Y: 70, endX: 10, endY: 60, width: 7 },
    { startX: 64, startY: 128, cp1X: 70, cp1Y: 95, cp2X: 93, cp2Y: 70, endX: 118, endY: 60, width: 7 },
  ];

  for (const b of blades) {
    ctx.beginPath();
    ctx.moveTo(b.startX, b.startY);
    ctx.bezierCurveTo(b.cp1X, b.cp1Y, b.cp2X, b.cp2Y, b.endX, b.endY);
    ctx.lineWidth = b.width;
    ctx.strokeStyle = '#122514';
    ctx.lineCap = 'round';
    ctx.stroke();

    for (let t = 0.2; t < 0.9; t += 0.12) {
      const lx = (1 - t) * (1 - t) * b.startX + 2 * (1 - t) * t * b.cp1X + t * t * b.endX;
      const ly = (1 - t) * (1 - t) * b.startY + 2 * (1 - t) * t * b.cp1Y + t * t * b.endY;
      ctx.beginPath();
      ctx.arc(lx - 4, ly, 3, 0, Math.PI * 2);
      ctx.arc(lx + 4, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#0f2011';
      ctx.fill();
    }
  }

  return new CanvasTexture(canvas);
}

interface TreeData {
  x: number;
  z: number;
  y: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  color: Color;
}

export class Forest {
  private meshes: Object3D[] = [];

  // Near LOD trees (<= 30m): 3 stacked cones, castShadow enabled
  private nearFoliageMesh: InstancedMesh;
  private nearTrunkMesh: InstancedMesh;

  // Far LOD trees (> 30m): 1 simple cone + trunk, NO castShadow (massive GPU fillrate saving)
  private farFoliageMesh: InstancedMesh;
  private farTrunkMesh: InstancedMesh;

  // Dead trees
  private deadMesh: InstancedMesh;

  // Clutter meshes
  private fernMesh: InstancedMesh;
  private rockMesh: InstancedMesh;
  private logMesh: InstancedMesh;
  clutterVisible: boolean = true;

  private trees: TreeData[] = [];
  private deadTrees: TreeData[] = [];

  private dummy: Object3D = new Object3D();
  private lastCullPos: Vector3 = new Vector3(9999, 9999, 9999);
  currentCullDist: number = 88;

  constructor(terrain: Terrain, totalTreeCount = 2000) {
    const rng = seededRand(42);

    // ── 1. Near Trees (<= 30m from player, casts shadows only within 25m) ──
    const nearFoliageGeo = new ConeGeometry(1.2, 3.8, 5);
    nearFoliageGeo.translate(0, 2.6, 0);

    const foliageMat = new MeshStandardMaterial({
      color: new Color(0x060f08),
      roughness: 0.95,
      metalness: 0.0,
    });

    const trunkMat = Materials.barkMaterial;

    const nearTrunkGeo = new CylinderGeometry(0.12, 0.20, 1.3, 4);
    nearTrunkGeo.translate(0, 0.65, 0);

    this.nearFoliageMesh = new InstancedMesh(nearFoliageGeo, foliageMat, 600);
    this.nearFoliageMesh.castShadow = true;
    this.nearFoliageMesh.receiveShadow = true;

    this.nearTrunkMesh = new InstancedMesh(nearTrunkGeo, trunkMat, 600);
    this.nearTrunkMesh.castShadow = true;

    // ── 2. Far Trees (> 30m to 90m): Lightweight single cone, NO shadow casting ──
    const farFoliageGeo = new ConeGeometry(1.2, 3.8, 4);
    farFoliageGeo.translate(0, 2.6, 0);

    const farTrunkGeo = new CylinderGeometry(0.12, 0.20, 1.3, 3);
    farTrunkGeo.translate(0, 0.65, 0);

    this.farFoliageMesh = new InstancedMesh(farFoliageGeo, foliageMat, totalTreeCount);
    this.farFoliageMesh.castShadow = false; // Never casts shadows -> saves thousands of shadow draw calls!
    this.farFoliageMesh.receiveShadow = true;

    this.farTrunkMesh = new InstancedMesh(farTrunkGeo, trunkMat, totalTreeCount);
    this.farTrunkMesh.castShadow = false;

    // ── 3. Dead Trees ────────────────────────────────────────────────────
    const deadCount = Math.floor(totalTreeCount * 0.10);
    const deadGeo = new CylinderGeometry(0.06, 0.16, 5.0, 4);
    deadGeo.translate(0, 2.5, 0);
    const deadMat = new MeshStandardMaterial({
      color: new Color(0x0a0805),
      roughness: 1.0,
    });
    this.deadMesh = new InstancedMesh(deadGeo, deadMat, deadCount);
    this.deadMesh.castShadow = true;

    // ── Generate Tree Positions ──────────────────────────────────────────
    for (let i = 0; i < totalTreeCount; i++) {
      let x = 0;
      let z = 0;
      let attempts = 0;

      do {
        // Distribute uniformly across the 380m playable area
        x = (rng() - 0.5) * 370;
        z = (rng() - 0.5) * 370;
        attempts++;
      } while (
        attempts < 40 &&
        (isInsideClearing(x, z) || getTrailDistance(x, z) < 4.0)
      );

      const y = terrain.getHeight(x, z);
      const scale = 0.75 + rng() * 0.9;
      const heightMult = Math.min(1.8 / scale, 0.85 + rng() * 0.35);

      const rotY = rng() * Math.PI * 2;
      const rotX = (rng() - 0.5) * 0.14;
      const rotZ = (rng() - 0.5) * 0.14;

      const col = new Color();
      col.setHSL(0.35 + (rng() - 0.5) * 0.05, 0.4 + rng() * 0.2, 0.035 + rng() * 0.025);

      this.trees.push({
        x,
        z,
        y,
        scaleX: scale,
        scaleY: scale * heightMult,
        scaleZ: scale,
        rotX,
        rotY,
        rotZ,
        color: col,
      });

      if (this.deadTrees.length < deadCount && rng() < 0.13) {
        let dx = 0;
        let dz = 0;
        let dAttempts = 0;
        do {
          dx = (rng() - 0.5) * 360;
          dz = (rng() - 0.5) * 360;
          dAttempts++;
        } while (
          dAttempts < 30 &&
          (isInsideClearing(dx, dz) || getTrailDistance(dx, dz) < 2.0)
        );

        if (dAttempts < 30) {
          const dy = terrain.getHeight(dx, dz);
          const dScale = Math.min(1.8, 0.8 + rng() * 0.8);
          this.deadTrees.push({
            x: dx,
            z: dz,
            y: dy,
            scaleX: dScale,
            scaleY: dScale,
            scaleZ: dScale,
            rotX: (rng() - 0.5) * 0.25,
            rotY: rng() * Math.PI * 2,
            rotZ: (rng() - 0.5) * 0.25,
            color: new Color(0x0a0805),
          });
        }
      }
    }

    this.meshes.push(
      this.nearFoliageMesh,
      this.nearTrunkMesh,
      this.farFoliageMesh,
      this.farTrunkMesh,
      this.deadMesh,
    );

    // Ferns
    const fernCount = 350;
    const fernTex = createFernTexture();
    const fernGeo = new PlaneGeometry(0.7, 0.7);
    fernGeo.translate(0, 0.35, 0);

    const fernMat = new MeshStandardMaterial({
      map: fernTex,
      transparent: true,
      alphaTest: 0.35,
      side: DoubleSide,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: true,
    });
    this.fernMesh = new InstancedMesh(fernGeo, fernMat, fernCount);

    const rng2 = seededRand(888);
    for (let i = 0; i < fernCount; i++) {
      let fx = 0;
      let fz = 0;
      let fAttempts = 0;
      do {
        fx = (rng2() - 0.5) * 360;
        fz = (rng2() - 0.5) * 360;
        fAttempts++;
      } while (
        fAttempts < 20 &&
        (isInsideClearing(fx, fz) || getTrailDistance(fx, fz) < 4.0)
      );

      const fy = terrain.getHeight(fx, fz);
      const fscale = 0.5 + rng2() * 0.6;
      this.dummy.position.set(fx, fy, fz);
      this.dummy.rotation.set((rng2() - 0.5) * 0.2, rng2() * Math.PI * 2, (rng2() - 0.5) * 0.2);
      this.dummy.scale.set(fscale, fscale, fscale);
      this.dummy.updateMatrix();
      this.fernMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.fernMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(this.fernMesh);

    // Rocks
    const rockCount = 70;
    const rockGeo = new DodecahedronGeometry(0.28, 0);
    const rockMat = Materials.rockMaterial;
    this.rockMesh = new InstancedMesh(rockGeo, rockMat, rockCount);

    const rng3 = seededRand(555);
    for (let i = 0; i < rockCount; i++) {
      let rx = 0;
      let rz = 0;
      let rAttempts = 0;
      do {
        rx = (rng3() - 0.5) * 360;
        rz = (rng3() - 0.5) * 360;
        rAttempts++;
      } while (
        rAttempts < 20 &&
        (isInsideClearing(rx, rz) || getTrailDistance(rx, rz) < 4.0)
      );

      const ry = terrain.getHeight(rx, rz);
      const rscale = 0.4 + rng3() * 0.8;
      this.dummy.position.set(rx, ry + 0.08, rz);
      this.dummy.rotation.set(rng3() * Math.PI, rng3() * Math.PI, rng3() * Math.PI);
      this.dummy.scale.set(rscale, rscale * 0.5, rscale * 1.2);
      this.dummy.updateMatrix();
      this.rockMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.rockMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(this.rockMesh);

    // Logs
    const logCount = 25;
    const logGeo = new CylinderGeometry(0.13, 0.16, 3.8, 4);
    logGeo.rotateZ(Math.PI / 2);
    const logMat = new MeshStandardMaterial({
      color: new Color(0x0c0906),
      roughness: 0.95,
      metalness: 0.0,
    });
    this.logMesh = new InstancedMesh(logGeo, logMat, logCount);

    const rng4 = seededRand(333);
    for (let i = 0; i < logCount; i++) {
      let lx = 0;
      let lz = 0;
      let lAttempts = 0;
      do {
        lx = (rng4() - 0.5) * 360;
        lz = (rng4() - 0.5) * 360;
        lAttempts++;
      } while (
        lAttempts < 20 &&
        (isInsideClearing(lx, lz) || getTrailDistance(lx, lz) < 4.0)
      );

      const ly = terrain.getHeight(lx, lz);
      const lscale = 0.7 + rng4() * 0.6;
      this.dummy.position.set(lx, ly + 0.12, lz);
      this.dummy.rotation.set((rng4() - 0.5) * 0.1, rng4() * Math.PI * 2, (rng4() - 0.5) * 0.1);
      this.dummy.scale.set(lscale, lscale, lscale);
      this.dummy.updateMatrix();
      this.logMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.logMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(this.logMesh);

    this.cullPast(0, 0, this.currentCullDist);
  }

  setClutterVisible(visible: boolean): void {
    this.clutterVisible = visible;
    this.fernMesh.visible = visible;
    this.rockMesh.visible = visible;
    this.logMesh.visible = visible;
  }

  setQuality(preset: 'low' | 'medium' | 'high'): void {
    if (preset === 'low') this.currentCullDist = 70;
    else if (preset === 'medium') this.currentCullDist = 88;
    else this.currentCullDist = 105;
    this.cullPast(this.lastCullPos.x, this.lastCullPos.z, this.currentCullDist);
  }

  cullPast(playerX: number, playerZ: number, maxDist = 88): void {
    const maxDistSq = maxDist * maxDist;
    const nearDistSq = 25 * 25; // Shadows only for trees within 25 m!

    let nearCount = 0;
    let farCount = 0;

    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      const dx = t.x - playerX;
      const dz = t.z - playerZ;
      const distSq = dx * dx + dz * dz;

      if (distSq <= maxDistSq) {
        this.dummy.position.set(t.x, t.y, t.z);
        this.dummy.rotation.set(t.rotX, t.rotY, t.rotZ);
        this.dummy.scale.set(t.scaleX, t.scaleY, t.scaleZ);
        this.dummy.updateMatrix();

        if (distSq <= nearDistSq && nearCount < 600) {
          // Near shadow-casting tree
          this.nearFoliageMesh.setMatrixAt(nearCount, this.dummy.matrix);
          this.nearTrunkMesh.setMatrixAt(nearCount, this.dummy.matrix);
          this.nearFoliageMesh.setColorAt(nearCount, t.color);
          nearCount++;
        } else {
          // Far non-shadow tree
          this.farFoliageMesh.setMatrixAt(farCount, this.dummy.matrix);
          this.farTrunkMesh.setMatrixAt(farCount, this.dummy.matrix);
          this.farFoliageMesh.setColorAt(farCount, t.color);
          farCount++;
        }
      }
    }

    this.nearFoliageMesh.count = nearCount;
    this.nearTrunkMesh.count = nearCount;
    this.farFoliageMesh.count = farCount;
    this.farTrunkMesh.count = farCount;

    this.nearFoliageMesh.instanceMatrix.needsUpdate = true;
    this.nearTrunkMesh.instanceMatrix.needsUpdate = true;
    this.farFoliageMesh.instanceMatrix.needsUpdate = true;
    this.farTrunkMesh.instanceMatrix.needsUpdate = true;

    if (this.nearFoliageMesh.instanceColor) this.nearFoliageMesh.instanceColor.needsUpdate = true;
    if (this.farFoliageMesh.instanceColor) this.farFoliageMesh.instanceColor.needsUpdate = true;

    // Dead trees
    let deadVisible = 0;
    for (let i = 0; i < this.deadTrees.length; i++) {
      const dt = this.deadTrees[i];
      const dx = dt.x - playerX;
      const dz = dt.z - playerZ;
      if (dx * dx + dz * dz <= maxDistSq) {
        this.dummy.position.set(dt.x, dt.y, dt.z);
        this.dummy.rotation.set(dt.rotX, dt.rotY, dt.rotZ);
        this.dummy.scale.set(dt.scaleX, dt.scaleY, dt.scaleZ);
        this.dummy.updateMatrix();
        this.deadMesh.setMatrixAt(deadVisible, this.dummy.matrix);
        deadVisible++;
      }
    }
    this.deadMesh.count = deadVisible;
    this.deadMesh.instanceMatrix.needsUpdate = true;
  }

  update(playerX: number, playerZ: number): void {
    const dx = playerX - this.lastCullPos.x;
    const dz = playerZ - this.lastCullPos.z;
    // Throttle culling: re-cull only when player moves at least 8 meters (dx^2 + dz^2 > 64)
    if (dx * dx + dz * dz > 64) {
      this.lastCullPos.set(playerX, 0, playerZ);
      this.cullPast(playerX, playerZ, this.currentCullDist);
    }
  }

  getMeshes(): Object3D[] {
    return this.meshes;
  }
}
