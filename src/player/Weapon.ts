// src/player/Weapon.ts
import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  Color,
  PerspectiveCamera,
  MathUtils,
} from 'three/webgpu';

export class Weapon {
  group: Group;
  private muzzleFlashLight: PointLight;
  private muzzleFlashMesh: Mesh;

  // Stats
  magCapacity: number = 20;
  ammoInMag: number = 20;
  reserveAmmo: number = 40;

  // Fire / Reload timing
  private fireCooldown: number = 0;
  private fireRate: number = 0.14;
  isReloading: boolean = false;
  private reloadTime: number = 1.8;
  private reloadTimer: number = 0;

  // Aim Down Sights (ADS)
  isAiming: boolean = false;
  private adsWeight: number = 0; // 0 (hip) to 1 (ADS)

  // Positions in camera local space
  // Hipfire position: right +0.19m, down -0.17m, forward -0.32m
  private hipPos: Vector3 = new Vector3(0.19, -0.17, -0.32);
  private hipRot: Vector3 = new Vector3(-0.02, 0.05, -0.04);

  // ADS position: aligned with center crosshair, raised to eye level
  private adsPos: Vector3 = new Vector3(0.0, -0.108, -0.22);
  private adsRot: Vector3 = new Vector3(0.0, 0.0, 0.0);

  // Recoil kick offsets
  private recoilKick: number = 0;
  private muzzleFlashTimer: number = 0;

  constructor() {
    this.group = new Group();

    // ── Build Tactical Rifle with Realistic Dark Materials ──────────────
    // Dark matte gunmetal steel (no bright white/untextured parts)
    const gunMat = new MeshStandardMaterial({
      color: new Color(0x1a1e22),
      roughness: 0.55,
      metalness: 0.8,
    });

    const polymerMat = new MeshStandardMaterial({
      color: new Color(0x101316),
      roughness: 0.88,
      metalness: 0.08,
    });

    const darkAccentMat = new MeshStandardMaterial({
      color: new Color(0x121518),
      roughness: 0.65,
      metalness: 0.7,
    });

    // 1. Receiver body
    const receiverGeo = new BoxGeometry(0.036, 0.06, 0.26);
    const receiver = new Mesh(receiverGeo, gunMat);
    this.group.add(receiver);

    // 2. Barrel
    const barrelGeo = new CylinderGeometry(0.010, 0.012, 0.24, 8);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.012, -0.23);
    const barrel = new Mesh(barrelGeo, gunMat);
    this.group.add(barrel);

    // 3. Handguard shroud
    const handguardGeo = new BoxGeometry(0.034, 0.042, 0.16);
    handguardGeo.translate(0, 0.008, -0.17);
    const handguard = new Mesh(handguardGeo, polymerMat);
    this.group.add(handguard);

    // 4. Stock
    const stockGeo = new BoxGeometry(0.030, 0.07, 0.14);
    stockGeo.translate(0, -0.015, 0.18);
    const stock = new Mesh(stockGeo, polymerMat);
    this.group.add(stock);

    // 5. Magazine (dark curved block pointing down/forward)
    const magGeo = new BoxGeometry(0.024, 0.11, 0.055);
    magGeo.rotateX(0.12);
    magGeo.translate(0, -0.075, -0.03);
    const mag = new Mesh(magGeo, darkAccentMat);
    this.group.add(mag);

    // 6. Pistol Grip
    const gripGeo = new BoxGeometry(0.026, 0.085, 0.038);
    gripGeo.rotateX(0.38);
    gripGeo.translate(0, -0.062, 0.075);
    const grip = new Mesh(gripGeo, polymerMat);
    this.group.add(grip);

    // 7. Tactical Top Rail
    const railGeo = new BoxGeometry(0.020, 0.010, 0.22);
    railGeo.translate(0, 0.035, -0.02);
    const rail = new Mesh(railGeo, darkAccentMat);
    this.group.add(rail);

    // 8. Iron Sights (Dark finish, matching weapon body)
    const rearSightGeo = new BoxGeometry(0.014, 0.018, 0.008);
    rearSightGeo.translate(0, 0.046, 0.06);
    const rearSight = new Mesh(rearSightGeo, darkAccentMat);
    this.group.add(rearSight);

    const frontSightGeo = new BoxGeometry(0.006, 0.022, 0.006);
    frontSightGeo.translate(0, 0.036, -0.31);
    const frontSight = new Mesh(frontSightGeo, darkAccentMat);
    this.group.add(frontSight);

    // ── Muzzle Flash Light & Mesh ───────────────────────────────────────
    this.muzzleFlashLight = new PointLight(0xffb732, 0, 12);
    this.muzzleFlashLight.position.set(0, 0.012, -0.36);
    this.group.add(this.muzzleFlashLight);

    const flashGeo = new CylinderGeometry(0.005, 0.045, 0.06, 6);
    flashGeo.rotateX(Math.PI / 2);
    flashGeo.translate(0, 0.012, -0.37);
    const flashMat = new MeshStandardMaterial({
      color: 0xffea88,
      emissive: 0xffa020,
      emissiveIntensity: 5.0,
      roughness: 0.2,
    });
    this.muzzleFlashMesh = new Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.visible = false;
    this.group.add(this.muzzleFlashMesh);

    // Set initial position
    this.group.position.copy(this.hipPos);
    this.group.rotation.set(this.hipRot.x, this.hipRot.y, this.hipRot.z);
  }

  tryFire(): boolean {
    if (this.fireCooldown > 0 || this.isReloading) return false;

    if (this.ammoInMag <= 0) {
      return false;
    }

    this.ammoInMag--;
    this.fireCooldown = this.fireRate;

    // Recoil kick
    this.recoilKick = 1.0;
    this.muzzleFlashTimer = 0.04;

    return true;
  }

  startReload(): void {
    if (this.isReloading || this.ammoInMag === this.magCapacity || this.reserveAmmo <= 0) {
      return;
    }
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
  }

  setAiming(aim: boolean): void {
    this.isAiming = aim;
  }

  update(dt: number, camera: PerspectiveCamera): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      this.muzzleFlashLight.intensity = 15.0;
      this.muzzleFlashMesh.visible = true;
      this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    } else {
      this.muzzleFlashLight.intensity = 0;
      this.muzzleFlashMesh.visible = false;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = this.magCapacity - this.ammoInMag;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += toLoad;
        this.reserveAmmo -= toLoad;
      }
    }

    // Smooth ADS transition
    const targetAds = this.isAiming && !this.isReloading ? 1.0 : 0.0;
    this.adsWeight = MathUtils.lerp(this.adsWeight, targetAds, dt * 14.0);

    const targetFov = MathUtils.lerp(75, 56, this.adsWeight);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    const currentTargetPos = new Vector3().lerpVectors(this.hipPos, this.adsPos, this.adsWeight);
    const currentTargetRot = new Vector3().lerpVectors(this.hipRot, this.adsRot, this.adsWeight);

    // Recoil recovery
    this.recoilKick = MathUtils.lerp(this.recoilKick, 0.0, dt * 18.0);
    const kickZ = this.recoilKick * 0.04;
    const kickY = this.recoilKick * 0.012;
    const kickPitch = this.recoilKick * 0.1;

    // Reload animation dip
    let reloadY = 0;
    let reloadRotX = 0;
    if (this.isReloading) {
      const reloadPhase = (this.reloadTime - this.reloadTimer) / this.reloadTime;
      reloadY = -Math.sin(reloadPhase * Math.PI) * 0.07;
      reloadRotX = -Math.sin(reloadPhase * Math.PI) * 0.22;
    }

    this.group.position.set(
      currentTargetPos.x,
      currentTargetPos.y + kickY + reloadY,
      currentTargetPos.z + kickZ,
    );

    this.group.rotation.set(
      currentTargetRot.x + kickPitch + reloadRotX,
      currentTargetRot.y,
      currentTargetRot.z,
    );
  }
}
