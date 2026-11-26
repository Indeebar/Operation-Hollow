// src/world/LevelBuilder.ts
import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PointLight,
  Color,
  Vector3,
  DoubleSide,
  Object3D,
} from 'three/webgpu';
import type { Terrain } from './Terrain';
import { LEVEL_DATA, type LanternPostData } from './LevelData';
import type { CollisionManager } from './CollisionManager';

export interface LanternPostInstance {
  data: LanternPostData;
  group: Group;
  light: PointLight;
  flameMesh: Mesh;
  safeRingMesh: Mesh;
  setLit: (lit: boolean) => void;
  update: (time: number) => void;
}

export class LevelBuilder {
  group: Group = new Group();
  lanterns: LanternPostInstance[] = [];
  guideGlows: Mesh[] = [];

  // Cabin interior dim light
  cabinLight!: PointLight;

  constructor(private terrain: Terrain, private collision: CollisionManager) {
    this.buildRangerTruck();
    this.buildForestGate();
    this.buildStation7Cabin();
    this.buildLanternPosts();
    this.buildTheHollow();
    this.buildGuideGlows();
    this.buildBoundaryRocks();
  }

  // ── 1. Ranger Pickup Truck (Spawn at z = -160) ──────────────────────────────
  private buildRangerTruck(): void {
    const tData = LEVEL_DATA.truck;
    const truckY = this.terrain.getHeight(tData.x, tData.z);

    const truckGroup = new Group();
    truckGroup.position.set(tData.x, truckY, tData.z);
    truckGroup.rotation.y = tData.rotY;

    // Materials
    const bodyMat = new MeshStandardMaterial({
      color: 0x1b3624, // Forest Service Dark Pine Green
      roughness: 0.6,
      metalness: 0.25,
    });
    const bedMat = new MeshStandardMaterial({
      color: 0x14281c,
      roughness: 0.8,
    });
    const glassMat = new MeshStandardMaterial({
      color: 0x0a1418,
      roughness: 0.15,
      metalness: 0.8,
    });
    const tireMat = new MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
    });
    const chromeMat = new MeshStandardMaterial({
      color: 0x889098,
      roughness: 0.3,
      metalness: 0.7,
    });
    const headlightMat = new MeshBasicMaterial({
      color: 0xfff0aa,
    });
    const taillightMat = new MeshBasicMaterial({
      color: 0xaa2211,
    });

    // Main Chassis & Lower Body (2.2m wide, 5.2m long, 0.75m high)
    const lowerBody = new Mesh(new BoxGeometry(2.2, 0.75, 5.0), bodyMat);
    lowerBody.position.set(0, 0.75, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    truckGroup.add(lowerBody);

    // Cab (Front compartment with roof and windshield)
    const cab = new Mesh(new BoxGeometry(2.1, 0.95, 2.3), bodyMat);
    cab.position.set(0, 1.55, 0.4);
    cab.castShadow = true;
    truckGroup.add(cab);

    // Windshield (facing forward +Z)
    const windshield = new Mesh(new BoxGeometry(1.95, 0.7, 0.15), glassMat);
    windshield.position.set(0, 1.55, 1.52);
    windshield.rotation.x = -0.3;
    truckGroup.add(windshield);

    // Rear Window
    const rearWindow = new Mesh(new BoxGeometry(1.85, 0.55, 0.1), glassMat);
    rearWindow.position.set(0, 1.6, -0.72);
    truckGroup.add(rearWindow);

    // Side Windows
    const sideWinL = new Mesh(new BoxGeometry(0.1, 0.55, 1.8), glassMat);
    sideWinL.position.set(-1.03, 1.55, 0.4);
    const sideWinR = sideWinL.clone();
    sideWinR.position.x = 1.03;
    truckGroup.add(sideWinL, sideWinR);

    // Truck Bed (Rear cargo area)
    const bedFloor = new Mesh(new BoxGeometry(2.1, 0.15, 2.4), bedMat);
    bedFloor.position.set(0, 0.95, -1.8);
    truckGroup.add(bedFloor);

    const bedWallL = new Mesh(new BoxGeometry(0.15, 0.65, 2.4), bodyMat);
    bedWallL.position.set(-1.0, 1.3, -1.8);
    const bedWallR = bedWallL.clone();
    bedWallR.position.x = 1.0;
    const tailgate = new Mesh(new BoxGeometry(2.0, 0.65, 0.15), bodyMat);
    tailgate.position.set(0, 1.3, -2.95);
    truckGroup.add(bedWallL, bedWallR, tailgate);

    // Front Grill & Bumpers
    const grill = new Mesh(new BoxGeometry(1.8, 0.5, 0.2), chromeMat);
    grill.position.set(0, 0.75, 2.55);
    const frontBumper = new Mesh(new BoxGeometry(2.3, 0.35, 0.35), chromeMat);
    frontBumper.position.set(0, 0.45, 2.65);
    const rearBumper = frontBumper.clone();
    rearBumper.position.set(0, 0.45, -3.05);
    truckGroup.add(grill, frontBumper, rearBumper);

    // Headlights
    const hlL = new Mesh(new BoxGeometry(0.4, 0.25, 0.08), headlightMat);
    hlL.position.set(-0.75, 0.82, 2.58);
    const hlR = hlL.clone();
    hlR.position.x = 0.75;
    truckGroup.add(hlL, hlR);

    // Taillights
    const tlL = new Mesh(new BoxGeometry(0.25, 0.3, 0.08), taillightMat);
    tlL.position.set(-0.9, 1.3, -3.02);
    const tlR = tlL.clone();
    tlR.position.x = 0.9;
    truckGroup.add(tlL, tlR);

    // Wheels (4 big rugged truck tires)
    const wheelGeo = new CylinderGeometry(0.45, 0.45, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-1.1, 0.45, 1.6],
      [1.1, 0.45, 1.6],
      [-1.1, 0.45, -1.8],
      [1.1, 0.45, -1.8],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
      const wheel = new Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      truckGroup.add(wheel);
    }

    this.group.add(truckGroup);

    // Collision box for Truck (AABB)
    this.collision.addBox({
      minX: tData.x - 1.4,
      maxX: tData.x + 1.4,
      minZ: tData.z - 3.2,
      maxZ: tData.z + 3.0,
      name: 'Ranger Truck',
    });
  }

  // ── 2. Forest Gate & Boundary Fence (z = -168) ──────────────────────────────
  private buildForestGate(): void {
    const gateZ = LEVEL_DATA.gate.z;
    const gateGroup = new Group();

    const timberMat = new MeshStandardMaterial({
      color: 0x1c1612,
      roughness: 0.95,
    });
    const chainMat = new MeshStandardMaterial({
      color: 0x22262a,
      roughness: 0.7,
      metalness: 0.6,
      wireframe: true, // Cheap chainlink wire look
    });
    const signMat = new MeshStandardMaterial({
      color: 0x241d16,
      roughness: 0.85,
    });

    // Gate Arch Posts
    const postGeo = new CylinderGeometry(0.22, 0.25, 5.5, 6);
    const leftPost = new Mesh(postGeo, timberMat);
    leftPost.position.set(-3.5, this.terrain.getHeight(-3.5, gateZ) + 2.7, gateZ);
    const rightPost = new Mesh(postGeo, timberMat);
    rightPost.position.set(3.5, this.terrain.getHeight(3.5, gateZ) + 2.7, gateZ);
    gateGroup.add(leftPost, rightPost);

    // Crossbeam
    const beamGeo = new BoxGeometry(8.2, 0.35, 0.35);
    const beam = new Mesh(beamGeo, timberMat);
    beam.position.set(0, Math.max(leftPost.position.y, rightPost.position.y) + 2.2, gateZ);
    gateGroup.add(beam);

    // Wooden Reserve Sign
    const sign = new Mesh(new BoxGeometry(5.0, 0.85, 0.12), signMat);
    sign.position.set(0, beam.position.y - 0.65, gateZ);
    gateGroup.add(sign);

    // Fence wings blocking exit to the left and right (from x = -45 to -3.5 and 3.5 to 45)
    const buildFenceWing = (startX: number, endX: number) => {
      const segCount = 6;
      const step = (endX - startX) / segCount;
      for (let i = 0; i <= segCount; i++) {
        const fx = startX + i * step;
        const fy = this.terrain.getHeight(fx, gateZ);
        const fPost = new Mesh(new CylinderGeometry(0.12, 0.14, 3.2, 5), timberMat);
        fPost.position.set(fx, fy + 1.6, gateZ);
        gateGroup.add(fPost);

        if (i < segCount) {
          const nextX = fx + step;
          const nextY = this.terrain.getHeight(nextX, gateZ);
          const midX = (fx + nextX) / 2;
          const midY = (fy + nextY) / 2 + 1.4;
          const dist = Math.abs(nextX - fx);
          const fenceMesh = new Mesh(new BoxGeometry(dist, 2.2, 0.08), chainMat);
          fenceMesh.position.set(midX, midY, gateZ);
          gateGroup.add(fenceMesh);
        }
      }
    };

    buildFenceWing(-45, -3.5);
    buildFenceWing(3.5, 45);

    this.group.add(gateGroup);

    // Collision boxes for fence line
    this.collision.addBox({
      minX: -50,
      maxX: -3.5,
      minZ: gateZ - 0.5,
      maxZ: gateZ + 0.5,
      name: 'Forest Gate West Fence',
    });
    this.collision.addBox({
      minX: 3.5,
      maxX: 50,
      minZ: gateZ - 0.5,
      maxZ: gateZ + 0.5,
      name: 'Forest Gate East Fence',
    });
    // Gate posts collision
    this.collision.addCircle({ x: -3.5, z: gateZ, radius: 0.35, name: 'Gate Left Post' });
    this.collision.addCircle({ x: 3.5, z: gateZ, radius: 0.35, name: 'Gate Right Post' });
  }

  // ── 3. Ranger Station 7 (Cabin at x = -25, z = -45) ─────────────────────────
  private buildStation7Cabin(): void {
    const cData = LEVEL_DATA.cabin;
    const cabinGroundY = this.terrain.getHeight(cData.x, cData.z);
    const cabinGroup = new Group();
    cabinGroup.position.set(cData.x, cabinGroundY, cData.z);

    // Materials
    const logMat = new MeshStandardMaterial({
      color: 0x1f1712, // Dark weathered timber
      roughness: 0.9,
    });
    const floorMat = new MeshStandardMaterial({
      color: 0x15100c, // Pine plank floor
      roughness: 0.85,
    });
    const roofMat = new MeshStandardMaterial({
      color: 0x14181a, // Dark corrugated metal roof
      roughness: 0.7,
      metalness: 0.3,
    });
    const doorMat = new MeshStandardMaterial({
      color: 0x2d1e15,
      roughness: 0.8,
    });
    const metalMat = new MeshStandardMaterial({
      color: 0x282c30,
      roughness: 0.5,
      metalness: 0.6,
    });
    const glassMat = new MeshStandardMaterial({
      color: 0x101a20,
      roughness: 0.2,
      metalness: 0.4,
    });

    const W = cData.width;  // 10m (X: -5 to +5)
    const L = cData.length; // 12m (Z: -6 to +6)
    const H = cData.height; // 4.2m

    // ── Foundation & Floor
    const floor = new Mesh(new BoxGeometry(W, 0.35, L), floorMat);
    floor.position.set(0, 0.18, 0);
    floor.receiveShadow = true;
    cabinGroup.add(floor);

    // ── Cabin Walls (Exterior)
    // North wall (Z = -6): Solid wall
    const wallNorth = new Mesh(new BoxGeometry(W, H, 0.35), logMat);
    wallNorth.position.set(0, H / 2, -L / 2);
    wallNorth.castShadow = true;
    cabinGroup.add(wallNorth);

    // South wall (Z = +6): Solid back wall of generator room
    const wallSouth = new Mesh(new BoxGeometry(W, H, 0.35), logMat);
    wallSouth.position.set(0, H / 2, L / 2);
    wallSouth.castShadow = true;
    cabinGroup.add(wallSouth);

    // West wall (X = -5): Solid side wall
    const wallWest = new Mesh(new BoxGeometry(0.35, H, L), logMat);
    wallWest.position.set(-W / 2, H / 2, 0);
    wallWest.castShadow = true;
    cabinGroup.add(wallWest);

    // East wall (X = +5): Faces trail & porch, contains front door and window
    // Door is at Z = 0 (width 1.4m, height 2.5m)
    // Left part of East Wall (Z from -6 to -0.7)
    const wallEastLeft = new Mesh(new BoxGeometry(0.35, H, 5.3), logMat);
    wallEastLeft.position.set(W / 2, H / 2, -3.35);
    // Right part of East Wall (Z from +0.7 to +6)
    const wallEastRight = new Mesh(new BoxGeometry(0.35, H, 5.3), logMat);
    wallEastRight.position.set(W / 2, H / 2, 3.35);
    // Lintel above door
    const doorLintel = new Mesh(new BoxGeometry(0.35, H - 2.5, 1.4), logMat);
    doorLintel.position.set(W / 2, 2.5 + (H - 2.5) / 2, 0);
    cabinGroup.add(wallEastLeft, wallEastRight, doorLintel);

    // Window on East Wall Left (porch view)
    const windowFrame = new Mesh(new BoxGeometry(0.4, 1.2, 1.4), metalMat);
    windowFrame.position.set(W / 2, 2.0, -2.5);
    const windowGlass = new Mesh(new BoxGeometry(0.1, 1.1, 1.3), glassMat);
    windowGlass.position.set(W / 2, 2.0, -2.5);
    cabinGroup.add(windowFrame, windowGlass);

    // Front Door (slightly ajar or modeled door frame)
    const doorMesh = new Mesh(new BoxGeometry(0.12, 2.45, 1.3), doorMat);
    doorMesh.position.set(W / 2 - 0.2, 1.25, 0.45);
    doorMesh.rotation.y = -0.45; // slightly open
    cabinGroup.add(doorMesh);

    // ── Interior Partition Wall (Separates Main Quarters from Generator Room at Z = 2.0)
    // Doorway between rooms at X = 0 (width 1.4m)
    const partLeft = new Mesh(new BoxGeometry(4.3, H, 0.25), logMat);
    partLeft.position.set(-2.85, H / 2, 2.0);
    const partRight = new Mesh(new BoxGeometry(4.3, H, 0.25), logMat);
    partRight.position.set(2.85, H / 2, 2.0);
    const partLintel = new Mesh(new BoxGeometry(1.4, H - 2.4, 0.25), logMat);
    partLintel.position.set(0, 2.4 + (H - 2.4) / 2, 2.0);
    cabinGroup.add(partLeft, partRight, partLintel);

    // ── Roof (Pitched corrugated metal)
    const roofL = new Mesh(new BoxGeometry(W / 2 + 0.8, 0.18, L + 1.0), roofMat);
    roofL.position.set(-W / 4, H + 0.6, 0);
    roofL.rotation.z = 0.25;
    const roofR = new Mesh(new BoxGeometry(W / 2 + 0.8, 0.18, L + 1.0), roofMat);
    roofR.position.set(W / 4, H + 0.6, 0);
    roofR.rotation.z = -0.25;
    roofL.castShadow = true;
    roofR.castShadow = true;
    cabinGroup.add(roofL, roofR);

    // ── Covered Front Porch (East side, X from +5 to +8.5)
    const porchW = cData.porchDepth; // 3.5m
    const porchL = 6.0;              // Z from -3 to +3
    const porchFloor = new Mesh(new BoxGeometry(porchW, 0.25, porchL), floorMat);
    porchFloor.position.set(W / 2 + porchW / 2, 0.12, 0);
    cabinGroup.add(porchFloor);

    // Porch Support Posts & Awning Roof
    const porchPostGeo = new CylinderGeometry(0.1, 0.12, 3.2, 5);
    const pPost1 = new Mesh(porchPostGeo, logMat);
    pPost1.position.set(W / 2 + porchW - 0.15, 1.6, -porchL / 2 + 0.15);
    const pPost2 = new Mesh(porchPostGeo, logMat);
    pPost2.position.set(W / 2 + porchW - 0.15, 1.6, porchL / 2 - 0.15);
    const porchRoof = new Mesh(new BoxGeometry(porchW + 0.5, 0.15, porchL + 0.4), roofMat);
    porchRoof.position.set(W / 2 + porchW / 2, 3.2, 0);
    porchRoof.rotation.z = -0.15;
    cabinGroup.add(pPost1, pPost2, porchRoof);

    // Porch Steps facing Trail
    const steps = new Mesh(new BoxGeometry(1.2, 0.14, 2.0), floorMat);
    steps.position.set(W / 2 + porchW + 0.6, 0.07, 0);
    cabinGroup.add(steps);

    // ── Interior Props
    // 1. Ranger Desk (in main room at X = -3.5, Z = -2.5)
    const deskTop = new Mesh(new BoxGeometry(2.2, 0.1, 1.1), doorMat);
    deskTop.position.set(-3.2, 0.9, -2.5);
    const deskLegs = new Mesh(new BoxGeometry(2.0, 0.85, 0.9), logMat);
    deskLegs.position.set(-3.2, 0.45, -2.5);
    cabinGroup.add(deskTop, deskLegs);

    // 2. Bunk Bed (in main room at X = -3.5, Z = -4.8)
    const bunkFrame = new Mesh(new BoxGeometry(1.4, 1.8, 2.4), metalMat);
    bunkFrame.position.set(-3.5, 0.9, -4.6);
    cabinGroup.add(bunkFrame);

    // 3. Diesel Generator (in generator room at X = 0, Z = 4.5)
    const genBody = new Mesh(new BoxGeometry(1.8, 1.2, 1.4), metalMat);
    genBody.position.set(0, 0.6, 4.5);
    const genPanel = new Mesh(new BoxGeometry(0.6, 0.4, 0.08), new MeshBasicMaterial({ color: 0x334433 }));
    genPanel.position.set(0, 0.9, 3.75);
    cabinGroup.add(genBody, genPanel);

    // ── Dim Interior Light (Hanging over desk)
    this.cabinLight = new PointLight(0xffb266, 2.4, 14, 2.0);
    this.cabinLight.position.set(-2.0, 2.8, -1.0);
    cabinGroup.add(this.cabinLight);

    // Small emissive lantern mesh hanging from ceiling
    const lampMesh = new Mesh(
      new CylinderGeometry(0.12, 0.16, 0.35, 6),
      new MeshBasicMaterial({ color: 0xffaa44 })
    );
    lampMesh.position.set(-2.0, 2.8, -1.0);
    cabinGroup.add(lampMesh);

    this.group.add(cabinGroup);

    // ── Collision Setup for Station 7 (AABBs in world coordinates)
    const cx = cData.x;
    const cz = cData.z;

    // North Wall: Z from cz - 6.2 to cz - 5.8
    this.collision.addBox({
      minX: cx - W / 2 - 0.2,
      maxX: cx + W / 2 + 0.2,
      minZ: cz - L / 2 - 0.3,
      maxZ: cz - L / 2 + 0.3,
      name: 'Cabin North Wall',
    });

    // South Wall: Z from cz + 5.8 to cz + 6.2
    this.collision.addBox({
      minX: cx - W / 2 - 0.2,
      maxX: cx + W / 2 + 0.2,
      minZ: cz + L / 2 - 0.3,
      maxZ: cz + L / 2 + 0.3,
      name: 'Cabin South Wall',
    });

    // West Wall: X from cx - 5.2 to cx - 4.8
    this.collision.addBox({
      minX: cx - W / 2 - 0.3,
      maxX: cx - W / 2 + 0.3,
      minZ: cz - L / 2,
      maxZ: cz + L / 2,
      name: 'Cabin West Wall',
    });

    // East Wall Left of Door (Z from cz - 6 to cz - 0.7)
    this.collision.addBox({
      minX: cx + W / 2 - 0.3,
      maxX: cx + W / 2 + 0.3,
      minZ: cz - L / 2,
      maxZ: cz - 0.7,
      name: 'Cabin East Wall Left',
    });

    // East Wall Right of Door (Z from cz + 0.7 to cz + 6)
    this.collision.addBox({
      minX: cx + W / 2 - 0.3,
      maxX: cx + W / 2 + 0.3,
      minZ: cz + 0.7,
      maxZ: cz + L / 2,
      name: 'Cabin East Wall Right',
    });

    // Interior Partition Wall Left (X from cx - 5 to cx - 0.7)
    this.collision.addBox({
      minX: cx - W / 2,
      maxX: cx - 0.7,
      minZ: cz + 2.0 - 0.2,
      maxZ: cz + 2.0 + 0.2,
      name: 'Cabin Partition Left',
    });

    // Interior Partition Wall Right (X from cx + 0.7 to cx + 5)
    this.collision.addBox({
      minX: cx + 0.7,
      maxX: cx + W / 2,
      minZ: cz + 2.0 - 0.2,
      maxZ: cz + 2.0 + 0.2,
      name: 'Cabin Partition Right',
    });

    // Desk Collision
    this.collision.addBox({
      minX: cx - 4.4,
      maxX: cx - 2.0,
      minZ: cz - 3.2,
      maxZ: cz - 1.8,
      name: 'Cabin Desk',
    });

    // Bunk Bed Collision
    this.collision.addBox({
      minX: cx - 4.5,
      maxX: cx - 2.5,
      minZ: cz - 5.9,
      maxZ: cz - 3.3,
      name: 'Cabin Bunk Bed',
    });

    // Generator Collision
    this.collision.addBox({
      minX: cx - 1.2,
      maxX: cx + 1.2,
      minZ: cz + 3.6,
      maxZ: cz + 5.4,
      name: 'Cabin Generator',
    });
  }

  // ── 4. 4 Lantern Posts (3 along trail, 1 at The Hollow) ─────────────────────
  private buildLanternPosts(): void {
    const postMat = new MeshStandardMaterial({
      color: 0x1c1510,
      roughness: 0.9,
    });
    const ironMat = new MeshStandardMaterial({
      color: 0x222528,
      roughness: 0.5,
      metalness: 0.7,
    });
    const flameMatLit = new MeshBasicMaterial({
      color: 0xffaa33,
    });
    const flameMatDead = new MeshBasicMaterial({
      color: 0x221a14,
    });

    // Shared geometry
    const postGeo = new CylinderGeometry(0.14, 0.18, 3.8, 6);
    postGeo.translate(0, 1.9, 0);

    const armGeo = new BoxGeometry(0.14, 0.14, 1.1);
    armGeo.translate(0, 3.5, 0.45);

    const lanternCageGeo = new CylinderGeometry(0.18, 0.24, 0.55, 6);
    lanternCageGeo.translate(0, 3.05, 0.85);

    const flameGeo = new CylinderGeometry(0.04, 0.08, 0.18, 5);
    flameGeo.translate(0, 3.02, 0.85);

    const ringGeo = new TorusGeometry(8.0, 0.04, 4, 32);
    ringGeo.rotateX(Math.PI / 2);

    for (const lData of LEVEL_DATA.lanterns) {
      const ly = this.terrain.getHeight(lData.x, lData.z);
      const lGroup = new Group();
      lGroup.position.set(lData.x, ly, lData.z);

      const postMesh = new Mesh(postGeo, postMat);
      postMesh.castShadow = true;
      const armMesh = new Mesh(armGeo, postMat);
      const cageMesh = new Mesh(lanternCageGeo, ironMat);
      const flameMesh = new Mesh(flameGeo, lData.isLit ? flameMatLit : flameMatDead);

      lGroup.add(postMesh, armMesh, cageMesh, flameMesh);

      // Warm PointLight (non-shadow for high FPS)
      const light = new PointLight(0xff9933, lData.isLit ? 3.0 : 0.0, 22, 2.0);
      light.position.set(0, 3.05, 0.85);
      lGroup.add(light);

      // Safe Zone radius ring (8m)
      const safeRingMesh = new Mesh(
        ringGeo,
        new MeshBasicMaterial({
          color: 0xffaa44,
          transparent: true,
          opacity: lData.isLit ? 0.25 : 0.0,
        })
      );
      safeRingMesh.position.set(0, 0.08, 0);
      lGroup.add(safeRingMesh);

      this.group.add(lGroup);

      // Collision for post
      this.collision.addCircle({
        x: lData.x,
        z: lData.z,
        radius: 0.35,
        name: lData.name,
      });

      const instance: LanternPostInstance = {
        data: lData,
        group: lGroup,
        light,
        flameMesh,
        safeRingMesh,
        setLit: (lit: boolean) => {
          lData.isLit = lit;
          light.intensity = lit ? 3.0 : 0.0;
          (flameMesh.material as MeshBasicMaterial).color.setHex(lit ? 0xffaa33 : 0x221a14);
          (safeRingMesh.material as MeshBasicMaterial).opacity = lit ? 0.25 : 0.0;
        },
        update: (time: number) => {
          if (lData.isLit) {
            // Subtle flickering candle light
            const flicker = Math.sin(time * 12 + lData.x) * 0.25 + Math.sin(time * 23 + lData.z) * 0.15;
            light.intensity = Math.max(0.8, 2.8 + flicker);
          }
        },
      };

      this.lanterns.push(instance);
    }
  }

  // ── 5. The Hollow Clearing & Iron Grate (x = 5, z = 145) ────────────────────
  private buildTheHollow(): void {
    const hData = LEVEL_DATA.hollow;
    const hy = this.terrain.getHeight(hData.x, hData.z);

    const hollowGroup = new Group();
    hollowGroup.position.set(hData.x, hy, hData.z);

    // Stone Rim around the Grate
    const rimMat = new MeshStandardMaterial({
      color: 0x181c1c,
      roughness: 0.95,
    });
    const rimGeo = new TorusGeometry(hData.grateRadius + 0.35, 0.45, 6, 24);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new Mesh(rimGeo, rimMat);
    rim.position.set(0, 0.15, 0);
    rim.receiveShadow = true;
    hollowGroup.add(rim);

    // Black Void Pit underneath
    const voidMat = new MeshBasicMaterial({ color: 0x010202 });
    const voidMesh = new Mesh(new CylinderGeometry(hData.grateRadius, hData.grateRadius, 2.0, 16), voidMat);
    voidMesh.position.set(0, -1.0, 0);
    hollowGroup.add(voidMesh);

    // Heavy Iron Grate Bars
    const grateBarMat = new MeshStandardMaterial({
      color: 0x252a2d,
      roughness: 0.5,
      metalness: 0.8,
    });
    const barCount = 9;
    const barR = hData.grateRadius;
    for (let i = 0; i < barCount; i++) {
      const t = (i / (barCount - 1) - 0.5) * 2; // -1 to +1
      const offset = t * (barR - 0.2);
      const halfLen = Math.sqrt(Math.max(0.1, barR * barR - offset * offset));

      // Longitudinal bars
      const barLong = new Mesh(new CylinderGeometry(0.04, 0.04, halfLen * 2, 5), grateBarMat);
      barLong.rotateX(Math.PI / 2);
      barLong.position.set(offset, 0.12, 0);
      hollowGroup.add(barLong);

      // Transverse bars
      const barTrans = new Mesh(new CylinderGeometry(0.04, 0.04, halfLen * 2, 5), grateBarMat);
      barTrans.rotateZ(Math.PI / 2);
      barTrans.position.set(0, 0.15, offset);
      hollowGroup.add(barTrans);
    }

    // Heavy Iron Lock & Chain in Center
    const lockMesh = new Mesh(new BoxGeometry(0.35, 0.45, 0.2), grateBarMat);
    lockMesh.position.set(0, 0.3, 0);
    hollowGroup.add(lockMesh);

    this.group.add(hollowGroup);

    // Circular collision around the sinkhole grate
    this.collision.addCircle({
      x: hData.x,
      z: hData.z,
      radius: hData.grateRadius + 0.3,
      name: 'The Hollow Sinkhole Grate',
    });
  }

  // ── 6. Distant Warm Lantern Glows (Guides eye down trail) ───────────────────
  private buildGuideGlows(): void {
    const glowGeo = new PlaneGeometry(1.2, 1.2);
    const glowMat = new MeshBasicMaterial({
      color: 0xff9522,
      transparent: true,
      opacity: 0.4,
      side: DoubleSide,
      depthWrite: false,
    });

    for (const g of LEVEL_DATA.guideGlows) {
      const gy = this.terrain.getHeight(g.x, g.z) + g.yOffset;
      const glowMesh = new Mesh(glowGeo, glowMat);
      glowMesh.position.set(g.x, gy, g.z);
      this.guideGlows.push(glowMesh);
      this.group.add(glowMesh);
    }
  }

  // ── 7. Map Boundary Rocks / Cliffs (±190m perimeter) ────────────────────────
  private buildBoundaryRocks(): void {
    const rockMat = new MeshStandardMaterial({
      color: 0x121516,
      roughness: 0.95,
    });
    const rockGeo = new BoxGeometry(12, 8, 12);

    const addCliff = (x: number, z: number) => {
      const cy = this.terrain.getHeight(x, z) + 3.0;
      const rock = new Mesh(rockGeo, rockMat);
      rock.position.set(x, cy, z);
      rock.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      this.group.add(rock);
      this.collision.addCircle({ x, z, radius: 5.5, name: 'Boundary Cliff' });
    };

    // North & South Perimeter
    for (let x = -190; x <= 190; x += 30) {
      addCliff(x, -195);
      addCliff(x, 195);
    }
    // East & West Perimeter
    for (let z = -190; z <= 190; z += 30) {
      addCliff(-195, z);
      addCliff(195, z);
    }
  }

  update(time: number, cameraPos: Vector3): void {
    // 1. Update lantern flickers
    for (const l of this.lanterns) {
      l.update(time);
    }

    // 2. Billboarding for distant guide glows (face camera)
    for (const g of this.guideGlows) {
      g.lookAt(cameraPos);
    }
  }
}
