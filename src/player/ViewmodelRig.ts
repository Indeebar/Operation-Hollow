// src/player/ViewmodelRig.ts
import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  PointLight,
  Color,
  Vector3,
  MathUtils,
  PerspectiveCamera,
} from 'three/webgpu';

export type WeaponSlot = 1 | 2 | 3; // 1 = Rifle, 2 = Flashlight only / Lowered, 3 = Flare

export class ViewmodelRig {
  group: Group;

  // Viewmodel camera with dedicated ~60° FOV
  camera: PerspectiveCamera;

  // Components
  private rifleGroup: Group;
  private leftArmGroup: Group;

  // Sights dot
  private sightDot: Mesh;

  // Muzzle flash
  private muzzleFlashLight: PointLight;
  private muzzleFlashMesh: Mesh;
  private muzzleFlashTimer: number = 0;

  // Wrist device screen & texture
  private screenCanvas: HTMLCanvasElement;
  private screenCtx: CanvasRenderingContext2D;
  private screenTexture: CanvasTexture;
  private screenLight: PointLight;
  threatLevel: number = 0.15;

  // Weapon Stats
  magCapacity: number = 20;
  ammoInMag: number = 20;
  reserveAmmo: number = 40;

  // Fire / Reload timing
  private fireCooldown: number = 0;
  private fireRate: number = 0.14;
  isReloading: boolean = false;
  private reloadTime: number = 1.8;
  private reloadTimer: number = 0;

  // ADS
  isAiming: boolean = false;
  private adsWeight: number = 0;

  // Slots & Switching (1: Rifle, 2: Lowered/Flashlight, 3: Flare)
  currentSlot: WeaponSlot = 1;
  targetSlot: WeaponSlot = 1;
  private switchProgress: number = 1.0; // 1.0 = fully raised, 0.0 = lowered

  // Sway & Bob
  private swayOffset: Vector3 = new Vector3();
  private swayRot: Vector3 = new Vector3();

  // Recoil
  private recoilKick: number = 0;

  // Base positions in camera view space
  private hipPos: Vector3 = new Vector3(0.18, -0.16, -0.32);
  private hipRot: Vector3 = new Vector3(-0.02, 0.04, -0.03);

  private adsPos: Vector3 = new Vector3(0.0, -0.108, -0.21);
  private adsRot: Vector3 = new Vector3(0.0, 0.0, 0.0);

  constructor() {
    this.group = new Group();

    // Dedicated Viewmodel camera (60° FOV, near 0.01 to 10)
    this.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
    this.camera.position.set(0, 0, 0);

    // ── 1. Tactical Rifle Group ──────────────────────────────────────────
    this.rifleGroup = new Group();
    this.group.add(this.rifleGroup);

    // Consistent dark metal & composite polymer materials (zero unlit white)
    const metalMat = new MeshStandardMaterial({
      color: new Color(0x1a1e22),
      roughness: 0.45,
      metalness: 0.85,
    });

    const polymerMat = new MeshStandardMaterial({
      color: new Color(0x101316),
      roughness: 0.85,
      metalness: 0.08,
    });

    const darkAccentMat = new MeshStandardMaterial({
      color: new Color(0x14171a),
      roughness: 0.6,
      metalness: 0.7,
    });

    // Receiver
    const receiverGeo = new BoxGeometry(0.036, 0.06, 0.26);
    this.rifleGroup.add(new Mesh(receiverGeo, metalMat));

    // Barrel
    const barrelGeo = new CylinderGeometry(0.010, 0.012, 0.24, 8);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0.012, -0.23);
    this.rifleGroup.add(new Mesh(barrelGeo, metalMat));

    // Handguard
    const handguardGeo = new BoxGeometry(0.034, 0.042, 0.16);
    handguardGeo.translate(0, 0.008, -0.17);
    this.rifleGroup.add(new Mesh(handguardGeo, polymerMat));

    // Stock
    const stockGeo = new BoxGeometry(0.030, 0.07, 0.14);
    stockGeo.translate(0, -0.015, 0.18);
    this.rifleGroup.add(new Mesh(stockGeo, polymerMat));

    // Magazine (Dark metal accent, NO white)
    const magGeo = new BoxGeometry(0.024, 0.11, 0.055);
    magGeo.rotateX(0.12);
    magGeo.translate(0, -0.075, -0.03);
    this.rifleGroup.add(new Mesh(magGeo, darkAccentMat));

    // Pistol grip
    const gripGeo = new BoxGeometry(0.026, 0.085, 0.038);
    gripGeo.rotateX(0.38);
    gripGeo.translate(0, -0.062, 0.075);
    this.rifleGroup.add(new Mesh(gripGeo, polymerMat));

    // Tactical Rail
    const railGeo = new BoxGeometry(0.020, 0.010, 0.22);
    railGeo.translate(0, 0.035, -0.02);
    this.rifleGroup.add(new Mesh(railGeo, darkAccentMat));

    // Iron sights (Rear notch & front post with emissive green sight dot)
    const rearSightGeo = new BoxGeometry(0.014, 0.018, 0.008);
    rearSightGeo.translate(0, 0.046, 0.06);
    this.rifleGroup.add(new Mesh(rearSightGeo, darkAccentMat));

    const frontSightGeo = new BoxGeometry(0.006, 0.022, 0.006);
    frontSightGeo.translate(0, 0.036, -0.31);
    this.rifleGroup.add(new Mesh(frontSightGeo, darkAccentMat));

    // Small emissive green sight bead on front sight post
    const dotGeo = new BoxGeometry(0.003, 0.003, 0.003);
    dotGeo.translate(0, 0.048, -0.31);
    const dotMat = new MeshStandardMaterial({
      color: 0x44ff88,
      emissive: 0x22cc55,
      emissiveIntensity: 2.5,
    });
    this.sightDot = new Mesh(dotGeo, dotMat);
    this.rifleGroup.add(this.sightDot);

    // Muzzle Flash
    this.muzzleFlashLight = new PointLight(0xffb732, 0, 10);
    this.muzzleFlashLight.position.set(0, 0.012, -0.36);
    this.rifleGroup.add(this.muzzleFlashLight);

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
    this.rifleGroup.add(this.muzzleFlashMesh);

    // ── 2. Left Arm & Hand with Attached Wrist Device ────────────────────
    this.leftArmGroup = new Group();
    this.group.add(this.leftArmGroup);

    // Forearm sleeve (dark tactical jacket)
    const sleeveMat = new MeshStandardMaterial({
      color: new Color(0x121a18),
      roughness: 0.95,
      metalness: 0.05,
    });
    const gloveMat = new MeshStandardMaterial({
      color: new Color(0x0a0c0d),
      roughness: 0.85,
      metalness: 0.1,
    });

    const armGeo = new CylinderGeometry(0.038, 0.044, 0.26, 8);
    armGeo.rotateZ(0.25);
    armGeo.translate(-0.06, -0.06, 0.08);
    this.leftArmGroup.add(new Mesh(armGeo, sleeveMat));

    // Tactical glove / hand
    const handGeo = new BoxGeometry(0.045, 0.038, 0.07);
    handGeo.translate(0, 0.01, -0.04);
    this.leftArmGroup.add(new Mesh(handGeo, gloveMat));

    // Wrist device mounted directly onto left forearm
    const caseGeo = new BoxGeometry(0.054, 0.018, 0.062);
    caseGeo.translate(0, 0.032, 0.02);
    this.leftArmGroup.add(new Mesh(caseGeo, darkAccentMat));

    // Wrist device green display
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 128;
    this.screenCanvas.height = 128;
    this.screenCtx = this.screenCanvas.getContext('2d')!;
    this.screenTexture = new CanvasTexture(this.screenCanvas);

    const screenGeo = new PlaneGeometry(0.042, 0.048);
    screenGeo.rotateX(-Math.PI / 2);
    screenGeo.translate(0, 0.042, 0.02);
    const screenMesh = new Mesh(screenGeo, new MeshBasicMaterial({ map: this.screenTexture }));
    this.leftArmGroup.add(screenMesh);

    this.screenLight = new PointLight(0x22c55e, 0.25, 0.4);
    this.screenLight.position.set(0, 0.06, 0.02);
    this.leftArmGroup.add(this.screenLight);

    // Initial positioning of Left Arm in view
    this.leftArmGroup.position.set(-0.21, -0.19, -0.38);
    this.leftArmGroup.rotation.set(0.65, 0.35, -0.15);

    // Initial positioning of Rifle
    this.rifleGroup.position.copy(this.hipPos);
    this.rifleGroup.rotation.set(this.hipRot.x, this.hipRot.y, this.hipRot.z);

    this.drawScreen(100, 20, 40, this.threatLevel);
  }

  setSlot(slot: WeaponSlot): void {
    if (this.currentSlot === slot && this.targetSlot === slot) return;
    this.targetSlot = slot;
  }

  nextSlot(): void {
    const next = (this.targetSlot % 3 + 1) as WeaponSlot;
    this.setSlot(next);
  }

  prevSlot(): void {
    const prev = (this.targetSlot === 1 ? 3 : this.targetSlot - 1) as WeaponSlot;
    this.setSlot(prev);
  }

  tryFire(): boolean {
    if (this.currentSlot !== 1 || this.switchProgress < 0.9) return false;
    if (this.fireCooldown > 0 || this.isReloading) return false;
    if (this.ammoInMag <= 0) return false;

    this.ammoInMag--;
    this.fireCooldown = this.fireRate;
    this.recoilKick = 1.0;
    this.muzzleFlashTimer = 0.04;
    return true;
  }

  startReload(): void {
    if (this.currentSlot !== 1 || this.switchProgress < 0.9) return;
    if (this.isReloading || this.ammoInMag === this.magCapacity || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
  }

  setAiming(aim: boolean): void {
    this.isAiming = aim && this.currentSlot === 1 && this.switchProgress > 0.9;
  }

  private drawScreen(battery: number, ammo: number, reserve: number, threat: number): void {
    const ctx = this.screenCtx;
    ctx.fillStyle = '#030d06';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(0, 15, 5, 0.45)';
    for (let y = 0; y < 128; y += 4) {
      ctx.fillRect(0, y, 128, 2);
    }

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('HW-TRK // S7', 10, 18);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#86efac';
    ctx.fillText(`PWR: ${Math.round(battery)}%`, 10, 34);

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = ammo <= 5 ? '#f87171' : '#22c55e';
    ctx.fillText(`AMMO: ${ammo}/${reserve}`, 10, 52);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THREAT / PROX', 10, 72);

    ctx.fillStyle = '#04180b';
    ctx.fillRect(10, 78, 108, 14);
    ctx.strokeStyle = '#16a34a';
    ctx.strokeRect(10, 78, 108, 14);

    const threatWidth = Math.max(0, Math.min(108, Math.round(threat * 108)));
    ctx.fillStyle = threat > 0.7 ? '#ef4444' : threat > 0.4 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(11, 79, threatWidth, 12);

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 110);
    for (let x = 10; x <= 118; x += 6) {
      const wave = Math.sin((x + Date.now() * 0.015) * 0.4) * (2 + threat * 6);
      ctx.lineTo(x, 110 + wave);
    }
    ctx.stroke();

    this.screenTexture.needsUpdate = true;
  }

  update(
    dt: number,
    battery: number,
    mouseDelta: { x: number; y: number },
    isMoving: boolean,
    bobTime: number,
  ): void {
    // ── 1. Slot Raising / Lowering Animations ────────────────────────────
    if (this.currentSlot !== this.targetSlot) {
      // Lower current weapon
      this.switchProgress = Math.max(0, this.switchProgress - dt * 5.0);
      if (this.switchProgress <= 0) {
        this.currentSlot = this.targetSlot;
      }
    } else {
      // Raise new weapon
      this.switchProgress = Math.min(1.0, this.switchProgress + dt * 5.0);
    }

    // ── 2. Timers & Cooldowns ───────────────────────────────────────────
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

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

    // ── 3. Shared Viewmodel Bobbing & Mouse Sway ─────────────────────────
    const targetSwayX = -mouseDelta.x * 0.0006;
    const targetSwayY = mouseDelta.y * 0.0006;
    this.swayOffset.x = MathUtils.lerp(this.swayOffset.x, targetSwayX, dt * 10);
    this.swayOffset.y = MathUtils.lerp(this.swayOffset.y, targetSwayY, dt * 10);

    const bobY = isMoving ? Math.sin(bobTime) * 0.008 : 0;
    const bobX = isMoving ? Math.sin(bobTime * 0.5) * 0.005 : 0;

    // Apply shared sway/bob to the entire viewmodel group
    this.group.position.set(this.swayOffset.x + bobX, this.swayOffset.y + bobY, 0);

    // ── 4. Rifle Positioning (ADS, Lowering, Recoil) ─────────────────────
    const targetAds = this.isAiming && !this.isReloading && this.currentSlot === 1 ? 1.0 : 0.0;
    this.adsWeight = MathUtils.lerp(this.adsWeight, targetAds, dt * 14.0);

    // Zoom viewmodel FOV slightly when aiming
    this.camera.fov = MathUtils.lerp(60, 48, this.adsWeight);
    this.camera.updateProjectionMatrix();

    const currentPos = new Vector3().lerpVectors(this.hipPos, this.adsPos, this.adsWeight);
    const currentRot = new Vector3().lerpVectors(this.hipRot, this.adsRot, this.adsWeight);

    // Recoil kick on rifle only
    this.recoilKick = MathUtils.lerp(this.recoilKick, 0.0, dt * 18.0);
    const kickZ = this.recoilKick * 0.04;
    const kickY = this.recoilKick * 0.012;
    const kickPitch = this.recoilKick * 0.1;

    // Lowering / Raising offset (slots)
    // When slot 2 (flashlight only), rifle dips down ~0.35m
    const lowerOffset = (1.0 - this.switchProgress) * 0.35;
    const isRifleSlot = this.currentSlot === 1;
    this.rifleGroup.visible = this.switchProgress > 0.05 || isRifleSlot;

    // Reload animation dip
    let reloadY = 0;
    let reloadRotX = 0;
    if (this.isReloading) {
      const reloadPhase = (this.reloadTime - this.reloadTimer) / this.reloadTime;
      reloadY = -Math.sin(reloadPhase * Math.PI) * 0.07;
      reloadRotX = -Math.sin(reloadPhase * Math.PI) * 0.22;
    }

    this.rifleGroup.position.set(
      currentPos.x,
      currentPos.y + kickY + reloadY - (isRifleSlot ? lowerOffset : 0.35),
      currentPos.z + kickZ,
    );

    this.rifleGroup.rotation.set(
      currentRot.x + kickPitch + reloadRotX - (isRifleSlot ? lowerOffset * 0.6 : 0.5),
      currentRot.y,
      currentRot.z,
    );

    // ── 5. Left Arm / Wrist Device Update ────────────────────────────────
    // Wrist device stays steady on forearm with subtle idle sway
    this.drawScreen(battery, this.ammoInMag, this.reserveAmmo, this.threatLevel);
    this.screenLight.intensity = 0.2 + this.threatLevel * 0.35;
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
