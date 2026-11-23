// src/player/Flashlight.ts
import {
  SpotLight,
  Object3D,
  PerspectiveCamera,
  Vector3,
  Quaternion,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  AdditiveBlending,
} from 'three/webgpu';

// Battery config: ~4 minutes (240s) runtime per battery from 100% to 0%
const BATTERY_DRAIN_RATE = 100 / 240; // ~0.416 % per sec
const SWAP_TIME = 1.5; // seconds to swap battery

export class Flashlight {
  spotLight: SpotLight;
  private lightTarget: Object3D;
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

  // Base intensity: clear bright spot on the ground and trees
  private baseIntensity: number = 75.0;

  constructor(private camera: PerspectiveCamera, scene: Object3D) {
    // ── SpotLight ──────────────────────────────────────────────────────────
    // Distance 32m, cone angle 0.44 rad (~25°), soft penumbra 0.7, decay 1.3
    // Cool crisp torchlight (#e4f2fb)
    this.spotLight = new SpotLight(0xe4f2fb, this.baseIntensity, 32, 0.44, 0.7, 1.3);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.2;
    this.spotLight.shadow.camera.far = 32;
    this.spotLight.shadow.bias = -0.001;

    this.lightTarget = new Object3D();
    scene.add(this.lightTarget);
    this.spotLight.target = this.lightTarget;
    scene.add(this.spotLight);

    // ── Subtle Atmospheric Dust Motes in Beam ─────────────────────────────
    // Removed the hard volumetric cone mesh completely. Atmospheric beam dust particles
    // provide the organic sense of light scattering without rendering any hard cylinder/cone edges.
    const particleCount = 140;
    this.dustPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const z = -1 - Math.random() * 22;
      const spread = Math.tan(0.22) * Math.abs(z);
      this.dustPositions[i * 3] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 2] = z;
    }

    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

    const dustMat = new PointsMaterial({
      color: 0xc4e5f5,
      size: 0.055,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.dustParticles = new Points(dustGeo, dustMat);
    scene.add(this.dustParticles);

    // Initial position sync
    this.camera.getWorldPosition(this.currentPos);
    this.camera.getWorldQuaternion(this.currentQuat);
  }

  toggle(): void {
    if (this.isSwapping) return;
    if (this.battery <= 0 && !this.isOn) {
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
    if (this.isOn && this.battery < 25) {
      this.flickerTimer -= dt;
      if (this.flickerTimer <= 0) {
        const intensityRisk = 1.0 - this.battery / 25;
        if (Math.random() < 0.35 + intensityRisk * 0.45) {
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
    this.dustParticles.visible = effectiveIntensity > 1.0;

    // ── Hand-Held Sway & Attachment ───────────────────────────────────────
    this.camera.getWorldPosition(this.targetPos);
    this.camera.getWorldQuaternion(this.targetQuat);

    // Offset in camera space: right +0.20m, down -0.15m, forward +0.16m
    const offset = new Vector3(0.2, -0.15, 0.16).applyQuaternion(this.targetQuat);
    this.targetPos.add(offset);

    // Smooth lag
    const smoothFactor = Math.min(1.0, dt * 16.0);
    this.currentPos.lerp(this.targetPos, smoothFactor);
    this.currentQuat.slerp(this.targetQuat, smoothFactor);

    // Direct spotlight positioning
    this.spotLight.position.copy(this.currentPos);
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.currentQuat);
    this.lightTarget.position.copy(this.currentPos).addScaledVector(forward, 25);
    this.lightTarget.updateMatrixWorld();

    // Align dust particles
    this.dustParticles.position.copy(this.currentPos);
    this.dustParticles.quaternion.copy(this.currentQuat);

    // Dust particles drift
    const attr = this.dustParticles.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + dt * 0.1;
      if (y > 3) y = -3;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  }
}
