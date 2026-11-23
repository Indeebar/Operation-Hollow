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
import { getTrailDistance } from './Terrain';

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

  private bottomConeMesh: InstancedMesh;
  private midConeMesh: InstancedMesh;
  private topConeMesh: InstancedMesh;
  private trunkMesh: InstancedMesh;
  private deadMesh: InstancedMesh;

  private trees: TreeData[] = [];
  private deadTrees: TreeData[] = [];

  private dummy: Object3D = new Object3D();
  private lastCullPos: Vector3 = new Vector3(9999, 9999, 9999);
  currentCullDist: number = 88;

  constructor(terrain: Terrain, totalTreeCount = 2200) {
    const rng = seededRand(42);

    // Highly optimized low-poly tree primitives (4-5 radial segments)
    const jitterGeo = (geo: ConeGeometry | CylinderGeometry, amount = 0.08) => {
      const pos = geo.attributes.position;
      const jrng = seededRand(1234);
      for (let i = 0; i < pos.count; i++) {
        const jx = (jrng() - 0.5) * amount;
        const jz = (jrng() - 0.5) * amount;
        pos.setX(i, pos.getX(i) + jx);
        pos.setZ(i, pos.getZ(i) + jz);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const bottomConeGeo = new ConeGeometry(1.3, 1.9, 5);
    bottomConeGeo.translate(0, 1.5, 0);
    jitterGeo(bottomConeGeo, 0.10);

    const midConeGeo = new ConeGeometry(0.98, 1.7, 5);
    midConeGeo.translate(0, 2.5, 0);
    jitterGeo(midConeGeo, 0.08);

    const topConeGeo = new ConeGeometry(0.62, 1.5, 5);
    topConeGeo.translate(0, 3.5, 0);
    jitterGeo(topConeGeo, 0.06);

    const foliageMat = new MeshStandardMaterial({
      color: new Color(0x060f08),
      roughness: 0.95,
      metalness: 0.0,
    });

    this.bottomConeMesh = new InstancedMesh(bottomConeGeo, foliageMat, totalTreeCount);
    this.bottomConeMesh.castShadow = true;
    this.bottomConeMesh.receiveShadow = true;

    this.midConeMesh = new InstancedMesh(midConeGeo, foliageMat, totalTreeCount);
    this.midConeMesh.castShadow = true;
    this.midConeMesh.receiveShadow = true;

    this.topConeMesh = new InstancedMesh(topConeGeo, foliageMat, totalTreeCount);
    this.topConeMesh.castShadow = true;
    this.topConeMesh.receiveShadow = true;

    const trunkGeo = new CylinderGeometry(0.12, 0.20, 1.3, 4);
    trunkGeo.translate(0, 0.65, 0);
    const trunkMat = new MeshStandardMaterial({
      color: new Color(0x0e0a06),
      roughness: 0.98,
      metalness: 0.0,
    });
    this.trunkMesh = new InstancedMesh(trunkGeo, trunkMat, totalTreeCount);
    this.trunkMesh.castShadow = true;

    const deadCount = Math.floor(totalTreeCount * 0.10);
    const deadGeo = new CylinderGeometry(0.06, 0.16, 5.0, 4);
    deadGeo.translate(0, 2.5, 0);
    jitterGeo(deadGeo, 0.12);
    const deadMat = new MeshStandardMaterial({
      color: new Color(0x0a0805),
      roughness: 1.0,
    });
    this.deadMesh = new InstancedMesh(deadGeo, deadMat, deadCount);
    this.deadMesh.castShadow = true;

    for (let i = 0; i < totalTreeCount; i++) {
      let x = 0;
      let z = 0;
      let attempts = 0;

      const forceNear = i < 950;
      const maxRadius = forceNear ? 60 : 185;

      do {
        if (forceNear) {
          const angle = rng() * Math.PI * 2;
          const rad = 6.2 + Math.sqrt(rng()) * (60 - 6.2);
          x = Math.cos(angle) * rad;
          z = Math.sin(angle) * rad;
        } else {
          x = (rng() - 0.5) * maxRadius * 2;
          z = (rng() - 0.5) * maxRadius * 2;
        }
        attempts++;
      } while (
        attempts < 30 &&
        (x * x + z * z < 6.0 * 6.0 || getTrailDistance(x, z) < 1.6)
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
        const dAngle = rng() * Math.PI * 2;
        const dRad = 6.5 + Math.sqrt(rng()) * (forceNear ? 60 : 180);
        const dx = Math.cos(dAngle) * dRad;
        const dz = Math.sin(dAngle) * dRad;

        if (getTrailDistance(dx, dz) >= 1.5) {
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
      this.bottomConeMesh,
      this.midConeMesh,
      this.topConeMesh,
      this.trunkMesh,
      this.deadMesh,
    );

    this.cullPast(0, 0, this.currentCullDist);

    // Ferns
    const fernCount = 450;
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
    const fernMesh = new InstancedMesh(fernGeo, fernMat, fernCount);

    const rng2 = seededRand(888);
    for (let i = 0; i < fernCount; i++) {
      const rad = 2.2 + Math.sqrt(rng2()) * 55;
      const ang = rng2() * Math.PI * 2;
      const fx = Math.cos(ang) * rad;
      const fz = Math.sin(ang) * rad;
      const fy = terrain.getHeight(fx, fz);

      const fscale = 0.5 + rng2() * 0.6;
      this.dummy.position.set(fx, fy, fz);
      this.dummy.rotation.set((rng2() - 0.5) * 0.2, rng2() * Math.PI * 2, (rng2() - 0.5) * 0.2);
      this.dummy.scale.set(fscale, fscale, fscale);
      this.dummy.updateMatrix();
      fernMesh.setMatrixAt(i, this.dummy.matrix);
    }
    fernMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(fernMesh);

    // Rocks
    const rockCount = 90;
    const rockGeo = new DodecahedronGeometry(0.28, 0);
    const rockMat = new MeshStandardMaterial({
      color: new Color(0x111315),
      roughness: 0.85,
      metalness: 0.1,
    });
    const rockMesh = new InstancedMesh(rockGeo, rockMat, rockCount);

    const rng3 = seededRand(555);
    for (let i = 0; i < rockCount; i++) {
      const rad = 3.0 + Math.sqrt(rng3()) * 60;
      const ang = rng3() * Math.PI * 2;
      const rx = Math.cos(ang) * rad;
      const rz = Math.sin(ang) * rad;
      const ry = terrain.getHeight(rx, rz);

      const rscale = 0.4 + rng3() * 0.8;
      this.dummy.position.set(rx, ry + 0.08, rz);
      this.dummy.rotation.set(rng3() * Math.PI, rng3() * Math.PI, rng3() * Math.PI);
      this.dummy.scale.set(rscale, rscale * 0.5, rscale * 1.2);
      this.dummy.updateMatrix();
      rockMesh.setMatrixAt(i, this.dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(rockMesh);

    // Logs
    const logCount = 30;
    const logGeo = new CylinderGeometry(0.13, 0.16, 3.8, 4);
    logGeo.rotateZ(Math.PI / 2);
    const logMat = new MeshStandardMaterial({
      color: new Color(0x0c0906),
      roughness: 0.95,
      metalness: 0.0,
    });
    const logMesh = new InstancedMesh(logGeo, logMat, logCount);

    const rng4 = seededRand(333);
    for (let i = 0; i < logCount; i++) {
      const rad = 6.0 + Math.sqrt(rng4()) * 65;
      const ang = rng4() * Math.PI * 2;
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad;
      if (getTrailDistance(lx, lz) < 1.8) continue;

      const ly = terrain.getHeight(lx, lz);
      const lscale = 0.7 + rng4() * 0.6;
      this.dummy.position.set(lx, ly + 0.12, lz);
      this.dummy.rotation.set((rng4() - 0.5) * 0.1, rng4() * Math.PI * 2, (rng4() - 0.5) * 0.1);
      this.dummy.scale.set(lscale, lscale, lscale);
      this.dummy.updateMatrix();
      logMesh.setMatrixAt(i, this.dummy.matrix);
    }
    logMesh.instanceMatrix.needsUpdate = true;
    this.meshes.push(logMesh);
  }

  setQuality(preset: 'low' | 'medium' | 'high'): void {
    if (preset === 'low') this.currentCullDist = 70;
    else if (preset === 'medium') this.currentCullDist = 88;
    else this.currentCullDist = 105;
    this.cullPast(this.lastCullPos.x, this.lastCullPos.z, this.currentCullDist);
  }

  cullPast(playerX: number, playerZ: number, maxDist = 88): void {
    const maxDistSq = maxDist * maxDist;
    let visibleCount = 0;

    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      const dx = t.x - playerX;
      const dz = t.z - playerZ;
      if (dx * dx + dz * dz <= maxDistSq) {
        this.dummy.position.set(t.x, t.y, t.z);
        this.dummy.rotation.set(t.rotX, t.rotY, t.rotZ);
        this.dummy.scale.set(t.scaleX, t.scaleY, t.scaleZ);
        this.dummy.updateMatrix();

        this.bottomConeMesh.setMatrixAt(visibleCount, this.dummy.matrix);
        this.midConeMesh.setMatrixAt(visibleCount, this.dummy.matrix);
        this.topConeMesh.setMatrixAt(visibleCount, this.dummy.matrix);
        this.trunkMesh.setMatrixAt(visibleCount, this.dummy.matrix);

        this.bottomConeMesh.setColorAt(visibleCount, t.color);
        this.midConeMesh.setColorAt(visibleCount, t.color);
        this.topConeMesh.setColorAt(visibleCount, t.color);

        visibleCount++;
      }
    }

    this.bottomConeMesh.count = visibleCount;
    this.midConeMesh.count = visibleCount;
    this.topConeMesh.count = visibleCount;
    this.trunkMesh.count = visibleCount;

    this.bottomConeMesh.instanceMatrix.needsUpdate = true;
    this.midConeMesh.instanceMatrix.needsUpdate = true;
    this.topConeMesh.instanceMatrix.needsUpdate = true;
    this.trunkMesh.instanceMatrix.needsUpdate = true;

    if (this.bottomConeMesh.instanceColor) this.bottomConeMesh.instanceColor.needsUpdate = true;
    if (this.midConeMesh.instanceColor) this.midConeMesh.instanceColor.needsUpdate = true;
    if (this.topConeMesh.instanceColor) this.topConeMesh.instanceColor.needsUpdate = true;

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
    if (dx * dx + dz * dz > 16) {
      this.lastCullPos.set(playerX, 0, playerZ);
      this.cullPast(playerX, playerZ, this.currentCullDist);
    }
  }

  getMeshes(): Object3D[] {
    return this.meshes;
  }
}
