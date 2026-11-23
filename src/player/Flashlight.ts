// src/player/Flashlight.ts
import {
  SpotLight,
  Object3D,
  PerspectiveCamera,
  ConeGeometry,
  MeshBasicMaterial,
  Mesh,
  AdditiveBlending,
  Vector3,
  Quaternion,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
} from 'three/webgpu';

// Battery config: ~4 minutes (240s) runtime per battery from 100% to 0%
const BATTERY_DRAIN_RATE = 100 / 240; // ~0.416 % per sec
const SWAP_TIME = 1.5; // seconds to swap battery

export class Flashlight {
  spotLight: SpotLight;
  private lightTarget: Object3D;
  private volumetricCone: Mesh;
  private dustParticles: Points;
  private dustPositions: Float32Array;

  // State
  isOn: boolean = true;
  battery: number = 100; // 0 to 100%
  spareBatteries: number = 3; // reserve batteries
  isSwapping: boolean = false;
  swapTimer: number = 0;

  // Smoothing / lag
  private currentPos: Vector3 = new Vector3();
  private currentQuat: Quaternion = new Quaternion();
  private targetPos: Vector3 = new Vector3();
  private targetQuat: Quaternion = new Quaternion();

  // Flicker
  private flickerTimer: number = 0;
  private flickerIntensityFactor: number = 1.0;

  // Base intensity
  private baseIntensity: number = 18.0;

  constructor(private camera: PerspectiveCamera, scene: Object3D) {
    // ── SpotLight ──────────────────────────────────────────────────────────
    // Cone ~28 deg (Math.PI * 28 / 180 ≈ 0.49 rad), range 35m, soft penumbra
    // Color: faint warm-white cold blue-green tint (#dfe8ff)
    this.spotLight = new SpotLight(0xdfe8ff, this.baseIntensity, 35, 0.49, 0.55, 1.2);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.2;
    this.spotLight.shadow.camera.far = 35;
    this.spotLight.shadow.bias = -0.001;

    this.lightTarget = new Object3D();
    scene.add(this.lightTarget);
    this.spotLight.target = this.lightTarget;
    scene.add(this.spotLight);

    // ── Fake Volumetric Beam ──────────────────────────────────────────────
    // Additive cone mesh (low alpha) that represents light scattering in fog
    // Cone length 25m, radius at bottom ~tan(14deg)*25 ≈ 6.2m
    const coneLength = 26;
    const coneRadius = Math.tan(0.245) * coneLength; // ~6.5m
    const coneGeo = new ConeGeometry(coneRadius, coneLength, 24, 1, true);
    // Orient cone so tip is at origin (0,0,0) and base extends along -Z
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, -coneLength / 2);

    const coneMat = new MeshBasicMaterial({
      color: 0x90c5d8,
      transparent: true,
      opacity: 0.045,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.volumetricCone = new Mesh(coneGeo, coneMat);
    scene.add(this.volumetricCone);

    // ── Beam Dust / Pollen Particles ──────────────────────────────────────
    const particleCount = 160;
    this.dustPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Scatter within light cone in local space (z from -1 to -20)
      const z = -1 - Math.random() * 20;
      const spread = Math.tan(0.24) * Math.abs(z);
      this.dustPositions[i * 3] = (Math.random() - 0.5) * spread * 1.6;
      this.dustPositions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.6;
      this.dustPositions[i * 3 + 2] = z;
    }

    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

    const dustMat = new PointsMaterial({
      color: 0xcee6f2,
      size: 0.08,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.dustParticles = new Points(dustGeo, dustMat);
    scene.add(this.dustParticles);

    // Init positions
    this.camera.getWorldPosition(this.currentPos);
    this.camera.getWorldQuaternion(this.currentQuat);
  }

  toggle(): void {
    if (this.isSwapping) return;
    if (this.battery <= 0 && !this.isOn) {
      // Can't turn on a completely dead battery
      return;
    }
    this.isOn = !this.isOn;
  }

  startBatterySwap(): void {
    if (this.isSwapping || this.spareBatteries <= 0 || this.battery >= 98) return;
    this.isSwapping = true;
    this.swapTimer = SWAP_TIME;
  }

  update(dt: number): void {
    // ── Battery Swap Logic ────────────────────────────────────────────────
    if (this.isSwapping) {
      this.swapTimer -= dt;
      if (this.swapTimer <= 0) {
        this.isSwapping = false;
        this.spareBatteries--;
        this.battery = 100;
        this.isOn = true;
      }
    }

    // ── Battery Drain Logic ───────────────────────────────────────────────
    if (this.isOn && !this.isSwapping) {
      this.battery = Math.max(0, this.battery - BATTERY_DRAIN_RATE * dt);
      if (this.battery <= 0) {
        this.isOn = false;
      }
    }

    // ── Flicker Logic ─────────────────────────────────────────────────────
    // Below 25% battery, flickering increases in severity and frequency
    if (this.isOn && this.battery < 25) {
      this.flickerTimer -= dt;
      if (this.flickerTimer <= 0) {
        // More erratic when near 0%
        const intensityRisk = 1.0 - this.battery / 25; // 0 to 1
        if (Math.random() < 0.35 + intensityRisk * 0.45) {
          // Micro cut / dim
          this.flickerIntensityFactor = Math.random() < 0.4 ? 0.0 : 0.2 + Math.random() * 0.5;
        } else {
          this.flickerIntensityFactor = 1.0;
        }
        this.flickerTimer = 0.05 + Math.random() * (0.25 - intensityRisk * 0.15);
      }
    } else {
      this.flickerIntensityFactor = 1.0;
    }

    // Apply active intensity
    const effectiveIntensity =
      (this.isOn && !this.isSwapping ? this.baseIntensity * this.flickerIntensityFactor : 0) *
      (this.battery < 15 ? 0.4 + (this.battery / 15) * 0.6 : 1.0);

    this.spotLight.intensity = effectiveIntensity;
    this.volumetricCone.visible = effectiveIntensity > 0.5;
    this.dustParticles.visible = effectiveIntensity > 0.5;

    // ── Smooth Lag & Sway ─────────────────────────────────────────────────
    // Target position is offset slightly down and right from camera (as if held in right hand)
    this.camera.getWorldPosition(this.targetPos);
    this.camera.getWorldQuaternion(this.targetQuat);

    // Apply hand-held offset: right +0.22m, down -0.18m, forward +0.15m in camera local frame
    const offset = new Vector3(0.22, -0.18, 0.15).applyQuaternion(this.targetQuat);
    this.targetPos.add(offset);

    // Slerp and lerp for smooth responsive hand sway
    const smoothFactor = Math.min(1.0, dt * 14.0);
    this.currentPos.lerp(this.targetPos, smoothFactor);
    this.currentQuat.slerp(this.targetQuat, smoothFactor);

    // Update spot light position & target
    this.spotLight.position.copy(this.currentPos);
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.currentQuat);
    this.lightTarget.position.copy(this.currentPos).addScaledVector(forward, 25);
    this.lightTarget.updateMatrixWorld();

    // Align volumetric cone and dust particles
    this.volumetricCone.position.copy(this.currentPos);
    this.volumetricCone.quaternion.copy(this.currentQuat);

    this.dustParticles.position.copy(this.currentPos);
    this.dustParticles.quaternion.copy(this.currentQuat);

    // Gently drift dust particles in beam
    const attr = this.dustParticles.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + dt * 0.15;
      if (y > 3) y = -3;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  }
}
