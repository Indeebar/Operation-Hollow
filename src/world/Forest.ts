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

// Procedural alpha cutout texture for ferns/grass blades
function createFernTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);

  // Draw 5-7 arching fern fronds
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

    // Leaf serrations / leaflets along curve
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

  const tex = new CanvasTexture(canvas);
  return tex;
}

export class Forest {
  private meshes: Object3D[] = [];

  constructor(terrain: Terrain, totalTreeCount = 3400) {
    const rng = seededRand(42);
    const dummy = new Object3D();

    // ── Pine foliage: 3 stacked cones with vertex jitter for organic look ──
    const jitterGeo = (geo: ConeGeometry | CylinderGeometry, amount = 0.08) => {
      const pos = geo.attributes.position;
      const jrng = seededRand(1234);
      for (let i = 0; i < pos.count; i++) {
        // Don't displace the very top apex of cones heavily
        const y = pos.getY(i);
        const jx = (jrng() - 0.5) * amount;
        const jz = (jrng() - 0.5) * amount;
        pos.setX(i, pos.getX(i) + jx);
        pos.setZ(i, pos.getZ(i) + jz);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const bottomConeGeo = new ConeGeometry(1.4, 2.2, 7);
    bottomConeGeo.translate(0, 1.6, 0);
    jitterGeo(bottomConeGeo, 0.12);

    const midConeGeo = new ConeGeometry(1.05, 1.9, 7);
    midConeGeo.translate(0, 2.7, 0);
    jitterGeo(midConeGeo, 0.10);

    const topConeGeo = new ConeGeometry(0.68, 1.7, 7);
    topConeGeo.translate(0, 3.8, 0);
    jitterGeo(topConeGeo, 0.08);

    // Foliage material: near-black pine green
    const foliageMat = new MeshStandardMaterial({
      color: new Color(0x060f08),
      roughness: 0.95,
      metalness: 0.0,
    });

    const bottomConeMesh = new InstancedMesh(bottomConeGeo, foliageMat, totalTreeCount);
    bottomConeMesh.castShadow = true;
    bottomConeMesh.receiveShadow = true;

    const midConeMesh = new InstancedMesh(midConeGeo, foliageMat, totalTreeCount);
    midConeMesh.castShadow = true;
    midConeMesh.receiveShadow = true;

    const topConeMesh = new InstancedMesh(topConeGeo, foliageMat, totalTreeCount);
    topConeMesh.castShadow = true;
    topConeMesh.receiveShadow = true;

    // Pine trunk
    const trunkGeo = new CylinderGeometry(0.12, 0.22, 1.5, 6);
    trunkGeo.translate(0, 0.75, 0);
    jitterGeo(trunkGeo, 0.04);
    const trunkMat = new MeshStandardMaterial({
      color: new Color(0x0e0a06),
      roughness: 0.98,
      metalness: 0.0,
    });
    const trunkMesh = new InstancedMesh(trunkGeo, trunkMat, totalTreeCount);
    trunkMesh.castShadow = true;

    // ── Dead / bare trees (~10% of total) ─────────────────────────────────
    const deadCount = Math.floor(totalTreeCount * 0.10); // ~340
    const deadGeo = new CylinderGeometry(0.06, 0.18, 5.8, 5);
    deadGeo.translate(0, 2.9, 0);
    jitterGeo(deadGeo, 0.14);
    const deadMat = new MeshStandardMaterial({
      color: new Color(0x0a0805),
      roughness: 1.0,
    });
    const deadMesh = new InstancedMesh(deadGeo, deadMat, deadCount);
    deadMesh.castShadow = true;

    const color = new Color();
    let deadIdx = 0;

    for (let i = 0; i < totalTreeCount; i++) {
      let x = 0;
      let z = 0;
      let attempts = 0;

      // Higher density within 60 m of the player (clearing radius only ~5 m at spawn)
      const forceNear = i < 1400; // first 1400 trees concentrated within 60m radius
      const maxRadius = forceNear ? 60 : 190;

      do {
        if (forceNear) {
          const angle = rng() * Math.PI * 2;
          const rad = 5.2 + Math.sqrt(rng()) * (60 - 5.2);
          x = Math.cos(angle) * rad;
          z = Math.sin(angle) * rad;
        } else {
          x = (rng() - 0.5) * maxRadius * 2;
          z = (rng() - 0.5) * maxRadius * 2;
        }
        attempts++;
      } while (
        attempts < 30 &&
        (x * x + z * z < 5.0 * 5.0 || getTrailDistance(x, z) < 1.6)
      );

      const y = terrain.getHeight(x, z);

      // Random lean, scale variation, rotation
      const scale = 0.7 + rng() * 0.65;
      const rotY = rng() * Math.PI * 2;
      const leanX = (rng() - 0.5) * 0.16; // noticeable natural lean
      const leanZ = (rng() - 0.5) * 0.16;

      dummy.position.set(x, y, z);
      dummy.rotation.set(leanX, rotY, leanZ);
      dummy.scale.set(scale, scale * (0.85 + rng() * 0.3), scale);
      dummy.updateMatrix();

      bottomConeMesh.setMatrixAt(i, dummy.matrix);
      midConeMesh.setMatrixAt(i, dummy.matrix);
      topConeMesh.setMatrixAt(i, dummy.matrix);
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // Very subtle variation in dark hue
      color.setHSL(0.35 + (rng() - 0.5) * 0.05, 0.4 + rng() * 0.2, 0.035 + rng() * 0.025);
      bottomConeMesh.setColorAt(i, color);
      midConeMesh.setColorAt(i, color);
      topConeMesh.setColorAt(i, color);

      // Place dead trees
      if (deadIdx < deadCount && rng() < 0.12) {
        const dAngle = rng() * Math.PI * 2;
        const dRad = 5.5 + Math.sqrt(rng()) * (forceNear ? 60 : 185);
        const dx = Math.cos(dAngle) * dRad;
        const dz = Math.sin(dAngle) * dRad;

        if (getTrailDistance(dx, dz) >= 1.5) {
          const dy = terrain.getHeight(dx, dz);
          const dScale = 0.7 + rng() * 0.7;
          dummy.position.set(dx, dy, dz);
          dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
          dummy.scale.set(dScale, dScale, dScale);
          dummy.updateMatrix();
          deadMesh.setMatrixAt(deadIdx, dummy.matrix);
          deadIdx++;
        }
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

    // ── Near-field clutter: Ferns/grass with proper alpha cutout texture ────
    const fernCount = 1200;
    const fernTex = createFernTexture();
    const fernGeo = new PlaneGeometry(0.7, 0.7);
    fernGeo.translate(0, 0.35, 0);

    const fernMat = new MeshStandardMaterial({
      map: fernTex,
      transparent: true,
      alphaTest: 0.35, // crisp alpha cutout, no black boxes
      side: DoubleSide,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: true,
    });
    const fernMesh = new InstancedMesh(fernGeo, fernMat, fernCount);

    const rng2 = seededRand(888);
    for (let i = 0; i < fernCount; i++) {
      // Clustered mostly near path and near player (within 70m)
      const rad = 2.0 + Math.sqrt(rng2()) * 65;
      const ang = rng2() * Math.PI * 2;
      const fx = Math.cos(ang) * rad;
      const fz = Math.sin(ang) * rad;
      const fy = terrain.getHeight(fx, fz);

      const fscale = 0.5 + rng2() * 0.7;
      dummy.position.set(fx, fy, fz);
      dummy.rotation.set((rng2() - 0.5) * 0.2, rng2() * Math.PI * 2, (rng2() - 0.5) * 0.2);
      dummy.scale.set(fscale, fscale, fscale);
      dummy.updateMatrix();
      fernMesh.setMatrixAt(i, dummy.matrix);
    }
    fernMesh.instanceMatrix.needsUpdate = true;
    fernMesh.receiveShadow = true;
    this.meshes.push(fernMesh);

    // ── Near-field clutter: Small rocks (irregular low-poly) ───────────────
    const rockCount = 280;
    const rockGeo = new DodecahedronGeometry(0.3, 0);
    jitterGeo(rockGeo as unknown as CylinderGeometry, 0.08);
    const rockMat = new MeshStandardMaterial({
      color: new Color(0x111315),
      roughness: 0.85,
      metalness: 0.1,
    });
    const rockMesh = new InstancedMesh(rockGeo, rockMat, rockCount);

    const rng3 = seededRand(555);
    for (let i = 0; i < rockCount; i++) {
      const rad = 3.0 + Math.sqrt(rng3()) * 80;
      const ang = rng3() * Math.PI * 2;
      const rx = Math.cos(ang) * rad;
      const rz = Math.sin(ang) * rad;
      const ry = terrain.getHeight(rx, rz);

      const rscale = 0.4 + rng3() * 1.0;
      dummy.position.set(rx, ry + 0.08, rz);
      dummy.rotation.set(rng3() * Math.PI, rng3() * Math.PI, rng3() * Math.PI);
      dummy.scale.set(rscale, rscale * 0.5, rscale * 1.2);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    this.meshes.push(rockMesh);

    // ── Near-field clutter: Fallen logs ────────────────────────────────────
    const logCount = 80;
    const logGeo = new CylinderGeometry(0.14, 0.18, 4.2, 5);
    logGeo.rotateZ(Math.PI / 2);
    const logMat = new MeshStandardMaterial({
      color: new Color(0x0c0906),
      roughness: 0.95,
      metalness: 0.0,
    });
    const logMesh = new InstancedMesh(logGeo, logMat, logCount);

    const rng4 = seededRand(333);
    for (let i = 0; i < logCount; i++) {
      const rad = 6.0 + Math.sqrt(rng4()) * 85;
      const ang = rng4() * Math.PI * 2;
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad;
      if (getTrailDistance(lx, lz) < 1.8) continue; // don't block trail

      const ly = terrain.getHeight(lx, lz);
      const lscale = 0.7 + rng4() * 0.7;
      dummy.position.set(lx, ly + 0.12, lz);
      dummy.rotation.set((rng4() - 0.5) * 0.1, rng4() * Math.PI * 2, (rng4() - 0.5) * 0.1);
      dummy.scale.set(lscale, lscale, lscale);
      dummy.updateMatrix();
      logMesh.setMatrixAt(i, dummy.matrix);
    }
    logMesh.instanceMatrix.needsUpdate = true;
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    this.meshes.push(logMesh);
  }

  getMeshes(): Object3D[] {
    return this.meshes;
  }
}
