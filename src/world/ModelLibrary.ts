// src/world/ModelLibrary.ts
import {
  Box3,
  Color,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface FitOptions {
  /** Uniformly scale to fit within targetSize (preserving aspect ratio). Default: true */
  uniform?: boolean;
  /** Y-axis rotation in radians applied before measuring/fitting */
  rotY?: number;
  /** X-axis rotation in radians applied before measuring/fitting */
  rotX?: number;
  /** Z-axis rotation in radians applied before measuring/fitting */
  rotZ?: number;
  /** Align bottom of bounding box to y = 0. Default: true */
  alignBottom?: boolean;
  /** Center XZ of bounding box at (0, 0). Default: true */
  centerXZ?: boolean;
  /** Darken factor for base color (0..1). Default: 0.45 */
  darken?: number;
  /** Minimum roughness clamp for matte look. Default: 0.65 */
  minRoughness?: number;
  /** Maximum metalness clamp. Default: 0.55 */
  maxMetalness?: number;
  /** Cast shadow on all child meshes. Default: true */
  castShadow?: boolean;
  /** Receive shadow on all child meshes. Default: true */
  receiveShadow?: boolean;
}

class ModelLibraryImpl {
  private loader: GLTFLoader;
  private cache = new Map<string, Promise<Group>>();
  private triCounts = new Map<string, number>();

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  /**
   * Loads a glTF/GLB once, caches the parsed scene, and returns a fresh clone.
   */
  async loadClone(url: string): Promise<Group> {
    let promise = this.cache.get(url);
    if (!promise) {
      promise = this.loader.loadAsync(url).then((gltf) => {
        const root = gltf.scene;
        this.triCounts.set(url, countTriangles(root));
        return root;
      });
      this.cache.set(url, promise);
    }
    const template = await promise;
    return template.clone(true);
  }

  /**
   * Returns cached triangle count for a loaded model URL (0 if not yet loaded).
   */
  getTriangleCount(url: string): number {
    return this.triCounts.get(url) ?? 0;
  }

  /**
   * Applies dark, matte material styling so models match Hollow Watch's night atmosphere.
   */
  applyDarkMatte(root: Object3D, opts: Pick<FitOptions, 'darken' | 'minRoughness' | 'maxMetalness' | 'castShadow' | 'receiveShadow'> = {}): void {
    const darken = opts.darken ?? 0.45;
    const minRoughness = opts.minRoughness ?? 0.65;
    const maxMetalness = opts.maxMetalness ?? 0.55;
    const castShadow = opts.castShadow ?? true;
    const receiveShadow = opts.receiveShadow ?? true;

    const clonedMats = new Map<Material, Material>();

    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      obj.castShadow = castShadow;
      obj.receiveShadow = receiveShadow;

      const applyMat = (mat: Material): Material => {
        const existing = clonedMats.get(mat);
        if (existing) return existing;

        const m = mat.clone();
        if (m instanceof MeshStandardMaterial) {
          m.color.multiplyScalar(darken);
          m.roughness = Math.max(m.roughness, minRoughness);
          m.metalness = Math.min(m.metalness, maxMetalness);
          if (m.emissive && m.emissiveIntensity > 0) {
            m.emissive.multiplyScalar(0.3);
          }
          m.needsUpdate = true;
        } else if ('color' in m && (m as { color?: Color }).color instanceof Color) {
          (m as { color: Color }).color.multiplyScalar(darken);
        }
        clonedMats.set(mat, m);
        return m;
      };

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(applyMat);
      } else if (obj.material) {
        obj.material = applyMat(obj.material);
      }
    });
  }

  /**
   * Wraps a model in a normalized Group scaled and oriented to fit `targetSize`,
   * with bottom at y=0 and XZ centered at (0, 0).
   */
  fitToFootprint(model: Object3D, targetSize: Vector3, opts: FitOptions = {}): Group {
    const wrapper = new Group();
    if (opts.rotX) model.rotation.x = opts.rotX;
    if (opts.rotY) model.rotation.y = opts.rotY;
    if (opts.rotZ) model.rotation.z = opts.rotZ;

    this.applyDarkMatte(model, opts);
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);

    const box = new Box3().setFromObject(wrapper);
    const size = new Vector3();
    box.getSize(size);

    const sx = size.x > 1e-5 ? targetSize.x / size.x : 1;
    const sy = size.y > 1e-5 ? targetSize.y / size.y : 1;
    const sz = size.z > 1e-5 ? targetSize.z / size.z : 1;

    if (opts.uniform !== false) {
      const s = Math.min(sx, sy, sz);
      model.scale.multiplyScalar(s);
    } else {
      model.scale.set(model.scale.x * sx, model.scale.y * sy, model.scale.z * sz);
    }

    wrapper.updateMatrixWorld(true);
    const scaledBox = new Box3().setFromObject(wrapper);
    const center = new Vector3();
    scaledBox.getCenter(center);

    if (opts.centerXZ !== false) {
      model.position.x -= center.x;
      model.position.z -= center.z;
    }
    if (opts.alignBottom !== false) {
      model.position.y -= scaledBox.min.y;
    }

    return wrapper;
  }
}

export function countTriangles(root: Object3D): number {
  let tris = 0;
  root.traverse((obj) => {
    if (obj instanceof Mesh && obj.geometry) {
      const geo = obj.geometry;
      if (geo.index) {
        tris += geo.index.count / 3;
      } else if (geo.attributes.position) {
        tris += geo.attributes.position.count / 3;
      }
    }
  });
  return Math.round(tris);
}

export const Models = new ModelLibraryImpl();
