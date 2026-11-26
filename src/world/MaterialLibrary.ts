// src/world/MaterialLibrary.ts
import {
  TextureLoader,
  RepeatWrapping,
  MeshStandardMaterial,
  Color,
  Texture,
} from 'three/webgpu';

export interface PBRMaps {
  diffuse: Texture;
  normal: Texture;
  roughness: Texture;
}

class MaterialLibraryClass {
  private loader: TextureLoader = new TextureLoader();

  // Cached Texture Sets
  private textures: Map<string, PBRMaps> = new Map();

  // Shared Materials
  groundMaterial!: MeshStandardMaterial;
  barkMaterial!: MeshStandardMaterial;
  rockMaterial!: MeshStandardMaterial;
  cabinWoodMaterial!: MeshStandardMaterial;
  fenceWoodMaterial!: MeshStandardMaterial;
  truckBodyMaterial!: MeshStandardMaterial;
  truckMetalMaterial!: MeshStandardMaterial;

  constructor() {
    this.init();
  }

  private loadPBR(category: string, repeatX = 1, repeatY = 1): PBRMaps {
    const diff = this.loader.load(`/textures/${category}/diffuse.jpg`);
    const norm = this.loader.load(`/textures/${category}/normal.jpg`);
    const rough = this.loader.load(`/textures/${category}/roughness.jpg`);

    diff.wrapS = RepeatWrapping;
    diff.wrapT = RepeatWrapping;
    diff.repeat.set(repeatX, repeatY);

    norm.wrapS = RepeatWrapping;
    norm.wrapT = RepeatWrapping;
    norm.repeat.set(repeatX, repeatY);

    rough.wrapS = RepeatWrapping;
    rough.wrapT = RepeatWrapping;
    rough.repeat.set(repeatX, repeatY);

    const maps: PBRMaps = { diffuse: diff, normal: norm, roughness: rough };
    this.textures.set(category, maps);
    return maps;
  }

  private init(): void {
    // 1. Terrain Ground (Tiled across the 400m landscape)
    const groundMaps = this.loadPBR('ground', 60, 60);
    this.groundMaterial = new MeshStandardMaterial({
      map: groundMaps.diffuse,
      normalMap: groundMaps.normal,
      roughnessMap: groundMaps.roughness,
      color: new Color(0x38423b), // tinted dark forest soil/mud to preserve night ambience
      roughness: 0.9,
      metalness: 0.05,
    });

    // 2. Pine Tree Trunks (Vertical wrap)
    const barkMaps = this.loadPBR('bark', 1, 3);
    this.barkMaterial = new MeshStandardMaterial({
      map: barkMaps.diffuse,
      normalMap: barkMaps.normal,
      roughnessMap: barkMaps.roughness,
      color: new Color(0x40352c), // dark bark tone
      roughness: 0.95,
      metalness: 0.0,
    });

    // 3. Rocks & Boundary Cliffs
    const rockMaps = this.loadPBR('rock', 3, 3);
    this.rockMaterial = new MeshStandardMaterial({
      map: rockMaps.diffuse,
      normalMap: rockMaps.normal,
      roughnessMap: rockMaps.roughness,
      color: new Color(0x3a4042), // dark wet slate/granite
      roughness: 0.85,
      metalness: 0.1,
    });

    // 4. Wood Planks (Cabin, Floor, Doors)
    const woodMaps = this.loadPBR('wood', 4, 4);
    this.cabinWoodMaterial = new MeshStandardMaterial({
      map: woodMaps.diffuse,
      normalMap: woodMaps.normal,
      roughnessMap: woodMaps.roughness,
      color: new Color(0x4a3c30), // dark weathered cabin timber
      roughness: 0.85,
      metalness: 0.05,
    });

    // Wood for Fence & Trail Stakes
    const fenceMaps = this.loadPBR('wood', 1, 2);
    this.fenceWoodMaterial = new MeshStandardMaterial({
      map: fenceMaps.diffuse,
      normalMap: fenceMaps.normal,
      roughnessMap: fenceMaps.roughness,
      color: new Color(0x352b22),
      roughness: 0.9,
      metalness: 0.05,
    });

    // 5. Metal for Ranger Truck & Details
    const metalMaps = this.loadPBR('metal', 2, 2);
    // Green painted truck chassis/body
    this.truckBodyMaterial = new MeshStandardMaterial({
      map: metalMaps.diffuse,
      normalMap: metalMaps.normal,
      roughnessMap: metalMaps.roughness,
      color: new Color(0x1e3f2b), // Forest Service dark pine green tinted
      roughness: 0.55,
      metalness: 0.45,
    });

    // Truck bed & mechanical metal
    this.truckMetalMaterial = new MeshStandardMaterial({
      map: metalMaps.diffuse,
      normalMap: metalMaps.normal,
      roughnessMap: metalMaps.roughness,
      color: new Color(0x353a3e), // dark weathered steel
      roughness: 0.65,
      metalness: 0.7,
    });
  }
}

export const Materials = new MaterialLibraryClass();
