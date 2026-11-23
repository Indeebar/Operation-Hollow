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

const BATTERY_DRAIN_RATE = 100 / 240; // ~4 minutes per battery
const SWAP_TIME = 1.5;

export class Flashlight {
  spotLight: SpotLight;
  private lightTarget: Object3D;
  private dustParticles: Points;
  private dustPositions: Float32Array;

  // State
  isOn: boolean = true;
  battery: number = 100;
  spareBatteries: number = 3;
  isSwapping: boolean = false;
  swapTimer: number = 0;

  // Smoothed rotation lag (slerp ~0.1 per frame, completely decoupled from weapon recoil/sway)
  private currentPos: Vector3 = new Vector3();
  private currentQuat: Quaternion = new Quaternion();
  private targetPos: Vector3 = new Vector3();
  private targetQuat: Quaternion = new Quaternion();

  // Flicker
  private flickerTimer: number = 0;
  private flickerIntensityFactor: number = 1.0;

  // Base intensity: clear bright spot on the ground and trees
  private baseIntensity: number = 70.0;

  constructor(private camera: PerspectiveCamera, scene: Object3D) {
    // ── SpotLight ──────────────────────────────────────────────────────────
    // Distance ~35m, cone angle ~0.5 rad (~28.6°), soft penumbra ~0.7, decay 1.2
    // Crisp pale cool torch tint (#e6f4fc)
    this.spotLight = new SpotLight(0xe6f4fc, this.baseIntensity, 35, 0.5, 0.7, 1.2);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.2;
    this.spotLight.shadow.camera.far = 35;
    this.spotLight.shadow.bias = -0.001;

    this.lightTarget = new Object3D();
    scene.add(this.lightTarget);
    this.spotLight.target = this.lightTarget;
    scene.add(this.spotLight);

    // ── Atmospheric Dust Motes in Beam ─────────────────────────────────────
    const particleCount = 120;
    this.dustPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const z = -1 - Math.random() * 22;
      const spread = Math.tan(0.24) * Math.abs(z);
      this.dustPositions[i * 3] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 2] = z;
    }

    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

    const dustMat = new PointsMaterial({
      color: 0xc4e5f5,
      size: 0.05,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.dustParticles = new Points(dustGeo, dustMat);
    scene.add(this.dustParticles);

    // Initial position
    this.camera.getWorldPosition(this.currentPos);
    this.camera.getWorldQuaternion(this.currentQuat);
  }

  toggle(): void {
    if (this.isSwapping) return;
    if (this.battery <= 0 && !this.isOn) return;
    this.isOn = !this.isOn;
  }

  startBatterySwap(): void {
    if (this.isSwapping || this.spareBatteries <= 0 || this.battery >= 98) return;
    this.isSwapping = true;
    this.swapTimer = SWAP_TIME;
  }

  update(dt: number): void {
    // Battery Swap
    if (this.isSwapping) {
      this.swapTimer -= dt;
      if (this.swapTimer <= 0) {
        this.isSwapping = false;
        this.spareBatteries--;
        this.battery = 100;
        this.isOn = true;
      }
    }

    // Battery Drain
    if (this.isOn && !this.isSwapping) {
      this.battery = Math.max(0, this.battery - BATTERY_DRAIN_RATE * dt);
      if (this.battery <= 0) {
        this.isOn = false;
      }
    }

    // Flicker
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

    const effectiveIntensity =
      (this.isOn && !this.isSwapping ? this.baseIntensity * this.flickerIntensityFactor : 0) *
      (this.battery < 15 ? 0.4 + (this.battery / 15) * 0.6 : 1.0);

    this.spotLight.intensity = effectiveIntensity;
    this.dustParticles.visible = effectiveIntensity > 1.0;

    // ── Smoothed Rotation Lag Parented Directly to Camera ─────────────────
    // Decoupled from weapon: weapon recoil and sway do NOT affect the spotlight.
    this.camera.getWorldPosition(this.targetPos);
    this.camera.getWorldQuaternion(this.targetQuat);

    // Subtle hand offset in camera space (+0.18m right, -0.14m down, +0.15m forward)
    const offset = new Vector3(0.18, -0.14, 0.15).applyQuaternion(this.targetQuat);
    this.targetPos.add(offset);

    // Smooth rotation lag using slerp (~0.1 per frame / dt*10)
    const smoothFactor = Math.min(1.0, dt * 10.0);
    this.currentPos.lerp(this.targetPos, smoothFactor * 1.5);
    this.currentQuat.slerp(this.targetQuat, smoothFactor);

    this.spotLight.position.copy(this.currentPos);
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.currentQuat);
    this.lightTarget.position.copy(this.currentPos).addScaledVector(forward, 25);
    this.lightTarget.updateMatrixWorld();

    this.dustParticles.position.copy(this.currentPos);
    this.dustParticles.quaternion.copy(this.currentQuat);

    // Dust float
    const attr = this.dustParticles.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + dt * 0.08;
      if (y > 3) y = -3;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  }
}
