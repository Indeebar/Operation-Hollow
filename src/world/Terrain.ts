import {
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  Color,
} from 'three/webgpu';

// Simple 2D value noise (no external deps)
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
      const h = (fbm(nx, nz) - 0.5) * 12; // ±6m
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new MeshStandardMaterial({
      color: new Color(0x1a2b1a),
      roughness: 0.95,
      metalness: 0.0,
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
    return (fbm(nx, nz) - 0.5) * 12;
  }
}
