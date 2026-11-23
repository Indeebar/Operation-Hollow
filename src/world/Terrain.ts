import {
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  CanvasTexture,
  RepeatWrapping,
} from 'three/webgpu';

// Simple 2D value noise
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >>> 13)) * 1274126177) & 0x7fffffff;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = smoothstep(fx);
  const uy = smoothstep(fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function fbm(x: number, y: number, octaves: number = 5): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / total;
}

export const TERRAIN_SIZE = 400;
export const TERRAIN_SEGMENTS = 128;

// Trail path function: winding trail starting from spawn (0, 0)
export function getTrailDistance(x: number, z: number): number {
  const trailX = Math.sin(z * 0.03) * 12 + Math.sin(z * 0.01) * 20;
  return Math.abs(x - trailX);
}

export class Terrain {
  private mesh: Mesh;

  constructor() {
    const segs = TERRAIN_SEGMENTS;
    const size = TERRAIN_SIZE;

    const geo = new PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const nx = (wx / size + 0.5) * 4;
      const nz = (wz / size + 0.5) * 4;
      let h = (fbm(nx, nz) - 0.5) * 12; // ±6m

      // Flatten walking trail path slightly
      const trailDist = getTrailDistance(wx, wz);
      if (trailDist < 4.0) {
        const factor = smoothstep(trailDist / 4.0);
        h = lerp(h * 0.5, h, factor);
      }

      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Procedural terrain texture: near-black wet ground + subtle roughness noise + lighter dirt trail
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 512;
    roughCanvas.height = 512;
    const roughCtx = roughCanvas.getContext('2d')!;

    const imgData = ctx.createImageData(512, 512);
    const roughData = roughCtx.createImageData(512, 512);

    for (let py = 0; py < 512; py++) {
      for (let px = 0; px < 512; px++) {
        const wx = (px / 512 - 0.5) * size;
        const wz = (py / 512 - 0.5) * size;

        const n = fbm(px * 0.06, py * 0.06, 4);
        const fineNoise = hash(px, py);
        const trailDist = getTrailDistance(wx, wz);
        const trailT = Math.max(0, 1 - trailDist / 3.0);

        // Near-black wet ground base (~#090e0b to #0e1410)
        let r = 7 + n * 6;
        let g = 11 + n * 7;
        let b = 9 + n * 6;
        // Wet roughness with fine grain noise (lower = shinier wet puddles/damp mud)
        let roughness = 110 + n * 60 + fineNoise * 20;

        // Lighter dirt trail (~#2e2a22)
        if (trailT > 0) {
          const trailR = 44 + n * 12;
          const trailG = 40 + n * 10;
          const trailB = 32 + n * 8;
          const tSmoothed = smoothstep(trailT);

          r = lerp(r, trailR, tSmoothed);
          g = lerp(g, trailG, tSmoothed);
          b = lerp(b, trailB, tSmoothed);
          // Packed damp dirt path sheen
          roughness = lerp(roughness, 130 + fineNoise * 30, tSmoothed);
        }

        const idx = (py * 512 + px) * 4;
        imgData.data[idx] = Math.floor(r);
        imgData.data[idx + 1] = Math.floor(g);
        imgData.data[idx + 2] = Math.floor(b);
        imgData.data[idx + 3] = 255;

        roughData.data[idx] = Math.floor(roughness);
        roughData.data[idx + 1] = Math.floor(roughness);
        roughData.data[idx + 2] = Math.floor(roughness);
        roughData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    roughCtx.putImageData(roughData, 0, 0);

    const diffuseTex = new CanvasTexture(canvas);
    diffuseTex.wrapS = RepeatWrapping;
    diffuseTex.wrapT = RepeatWrapping;

    const roughnessTex = new CanvasTexture(roughCanvas);
    roughnessTex.wrapS = RepeatWrapping;
    roughnessTex.wrapT = RepeatWrapping;

    const mat = new MeshStandardMaterial({
      map: diffuseTex,
      roughnessMap: roughnessTex,
      roughness: 0.75,
      metalness: 0.15, // wet sheen under faint moonlight
    });

    this.mesh = new Mesh(geo, mat);
    this.mesh.receiveShadow = true;
  }

  getMesh(): Mesh {
    return this.mesh;
  }

  getHeight(wx: number, wz: number): number {
    const size = TERRAIN_SIZE;
    const nx = (wx / size + 0.5) * 4;
    const nz = (wz / size + 0.5) * 4;
    let h = (fbm(nx, nz) - 0.5) * 12;

    const trailDist = getTrailDistance(wx, wz);
    if (trailDist < 4.0) {
      const factor = smoothstep(trailDist / 4.0);
      h = lerp(h * 0.5, h, factor);
    }
    return h;
  }
}
