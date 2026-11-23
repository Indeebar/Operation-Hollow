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
  private fireRate: number = 0.14; // ~7 rounds per second (semi-auto / rapid single)
  isReloading: boolean = false;
  private reloadTime: number = 1.8;
  private reloadTimer: number = 0;

  // Aim Down Sights (ADS)
  isAiming: boolean = false;
  private adsWeight: number = 0; // 0 (hip) to 1 (ADS)

  // Positions in camera local space
  // Hipfire position: lower-right of the screen
  private hipPos: Vector3 = new Vector3(0.18, -0.16, -0.32);
  private hipRot: Vector3 = new Vector3(0.04, -0.06, 0.0);

  // ADS position: aligned with center view, raised to eye level
  private adsPos: Vector3 = new Vector3(0.0, -0.105, -0.22);
  private adsRot: Vector3 = new Vector3(0.0, 0.0, 0.0);

  // Recoil & kick offsets
  private recoilPos: Vector3 = new Vector3();
  private recoilRot: Vector3 = new Vector3();
  private recoilKick: number = 0;

  // Muzzle flash timer
  private muzzleFlashTimer: number = 0;

  constructor() {
    this.group = new Group();

    // ── Build Tactical Rifle from Primitives ────────────────────────────
    // Gun receiver / body: dark matte gunmetal steel
    const gunMat = new MeshStandardMaterial({
      color: new Color(0x1a1e22),
      roughness: 0.55,
      metalness: 0.8,
    });

    const polymerMat = new MeshStandardMaterial({
      color: new Color(0x101316),
      roughness: 0.85,
      metalness: 0.1,
    });

    // 1. Receiver
    const receiverGeo = new BoxGeometry(0.04, 0.065, 0.28);
    const receiver = new Mesh(receiverGeo, gunMat);
    receiver.position.set(0, 0, 0);
    this.group.add(receiver);

    // 2. Barrel
    const barrelGeo = new CylinderGeometry(0.012, 0.014, 0.22, 8);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.015, -0.22);
    const barrel = new Mesh(barrelGeo, gunMat);
    this.group.add(barrel);

    // 3. Handguard / Shroud
    const handguardGeo = new BoxGeometry(0.036, 0.045, 0.16);
    handguardGeo.translate(0, 0.01, -0.18);
    const handguard = new Mesh(handguardGeo, polymerMat);
    this.group.add(handguard);

    // 4. Stock
    const stockGeo = new BoxGeometry(0.034, 0.075, 0.15);
    stockGeo.translate(0, -0.015, 0.19);
    const stock = new Mesh(stockGeo, polymerMat);
    this.group.add(stock);

    // 5. Magazine
    const magGeo = new BoxGeometry(0.026, 0.12, 0.06);
    magGeo.translate(0, -0.075, -0.02);
    const mag = new Mesh(magGeo, polymerMat);
    this.group.add(mag);

    // 6. Pistol Grip
    const gripGeo = new BoxGeometry(0.028, 0.09, 0.04);
    gripGeo.rotateX(0.35);
    gripGeo.translate(0, -0.065, 0.08);
    const grip = new Mesh(gripGeo, polymerMat);
    this.group.add(grip);

    // 7. Iron Sights (front and rear posts)
    const rearSightGeo = new BoxGeometry(0.016, 0.02, 0.01);
    rearSightGeo.translate(0, 0.042, 0.06);
    const rearSight = new Mesh(rearSightGeo, gunMat);
    this.group.add(rearSight);

    const frontSightGeo = new BoxGeometry(0.008, 0.025, 0.008);
    frontSightGeo.translate(0, 0.038, -0.3);
    const frontSight = new Mesh(frontSightGeo, gunMat);
    this.group.add(frontSight);

    // ── Muzzle Flash Light & Mesh ───────────────────────────────────────
    this.muzzleFlashLight = new PointLight(0xffcc66, 0, 14);
    this.muzzleFlashLight.position.set(0, 0.015, -0.34);
    this.group.add(this.muzzleFlashLight);

    const flashGeo = new CylinderGeometry(0.01, 0.06, 0.08, 6);
    flashGeo.rotateX(Math.PI / 2);
    flashGeo.translate(0, 0.015, -0.36);
    const flashMat = new MeshStandardMaterial({
      color: 0xffea88,
      emissive: 0xffb732,
      emissiveIntensity: 6.0,
      roughness: 0.1,
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
      // Empty click
      return false;
    }

    // Fire round!
    this.ammoInMag--;
    this.fireCooldown = this.fireRate;

    // Recoil kick: backwards and muzzle rises up
    this.recoilKick = 1.0;
    this.muzzleFlashTimer = 0.045; // flash visible for ~45ms

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
    // ── Cooldowns & Timers ──────────────────────────────────────────────
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      this.muzzleFlashLight.intensity = 18.0;
      this.muzzleFlashMesh.visible = true;
      // Slight random rotation for varied flash silhouette
      this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    } else {
      this.muzzleFlashLight.intensity = 0;
      this.muzzleFlashMesh.visible = false;
    }

    // ── Reload Logic ────────────────────────────────────────────────────
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

    // ── ADS Transition (Hip to Sights) ──────────────────────────────────
    const targetAds = this.isAiming && !this.isReloading ? 1.0 : 0.0;
    this.adsWeight = MathUtils.lerp(this.adsWeight, targetAds, dt * 14.0);

    // Zoom camera FOV when ADS (75 down to ~58)
    const targetFov = MathUtils.lerp(75, 56, this.adsWeight);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // Base position interpolated between hip and ADS
    const currentTargetPos = new Vector3().lerpVectors(this.hipPos, this.adsPos, this.adsWeight);
    const currentTargetRot = new Vector3().lerpVectors(this.hipRot, this.adsRot, this.adsWeight);

    // ── Recoil Recovery ─────────────────────────────────────────────────
    this.recoilKick = MathUtils.lerp(this.recoilKick, 0.0, dt * 18.0);
    const kickZ = this.recoilKick * 0.045; // kick backwards
    const kickY = this.recoilKick * 0.015; // muzzle rise
    const kickPitch = this.recoilKick * 0.12;

    // Reload animation dip
    let reloadY = 0;
    let reloadRotX = 0;
    if (this.isReloading) {
      const reloadPhase = (this.reloadTime - this.reloadTimer) / this.reloadTime;
      reloadY = -Math.sin(reloadPhase * Math.PI) * 0.08;
      reloadRotX = -Math.sin(reloadPhase * Math.PI) * 0.25;
    }

    // Apply combined transforms to weapon group
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
