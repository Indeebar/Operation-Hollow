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
  DoubleSide,
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

  // Base intensity: boosted to 85 for a clear, crisp, bright lit pool on ground and tree trunks
  private baseIntensity: number = 85.0;

  constructor(private camera: PerspectiveCamera, scene: Object3D) {
    // ── SpotLight ──────────────────────────────────────────────────────────
    // Distance ~35m, angle ~0.5 rad (~28.6°), penumbra 0.75 for soft edges, decay 1.2
    // Color: cool crisp white (#e8f4fc)
    this.spotLight = new SpotLight(0xe8f4fc, this.baseIntensity, 35, 0.5, 0.75, 1.2);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.2;
    this.spotLight.shadow.camera.far = 35; // tightly clamped to light distance for crisp shadows
    this.spotLight.shadow.bias = -0.001;

    this.lightTarget = new Object3D();
    scene.add(this.lightTarget);
    this.spotLight.target = this.lightTarget;
    scene.add(this.spotLight);

    // ── Soft Additive Volumetric Cone (Vertex Alpha Gradient) ─────────────
    // Cone length 26m, radius at bottom ~tan(0.5)*26 ≈ 14m (or slightly narrower ~6m for beam)
    const coneLength = 26;
    const coneRadius = Math.tan(0.24) * coneLength; // ~6.4m
    const radialSegs = 24;
    const heightSegs = 16;
    const coneGeo = new ConeGeometry(coneRadius, coneLength, radialSegs, heightSegs, true);

    // Orient cone along -Z with apex at (0,0,0)
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, -coneLength / 2);

    // Bake length and rim alpha fade into vertex colors
    const pos = coneGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i); // ranges from 0 (apex) to -coneLength (base)
      const t = -z / coneLength; // 0 at apex, 1 at base

      // Length fade: gentle fade near apex (so it doesn't clip harshly in player's face),
      // soft peak around 20-40% length, and fade out smoothly towards 100% distance
      let lengthAlpha = 1.0;
      if (t < 0.15) {
        lengthAlpha = t / 0.15;
      } else {
        lengthAlpha = Math.pow(1.0 - t, 1.2);
      }

      // Very low intensity (~0.04 - 0.08) so it's barely visible mist illumination, not a hard wedge
      const baseAlpha = 0.055 * lengthAlpha;

      // Color tint: cool atmospheric teal/blue
      colors[i * 3] = 0.55 * baseAlpha;
      colors[i * 3 + 1] = 0.82 * baseAlpha;
      colors[i * 3 + 2] = 0.95 * baseAlpha;
    }
    coneGeo.setAttribute('color', new Float32BufferAttribute(colors, 3));

    const coneMat = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
    });
    this.volumetricCone = new Mesh(coneGeo, coneMat);
    this.volumetricCone.renderOrder = 10;
    scene.add(this.volumetricCone);

    // ── Beam Dust / Pollen Particles ──────────────────────────────────────
    const particleCount = 100;
    this.dustPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const z = -1 - Math.random() * 20;
      const spread = Math.tan(0.24) * Math.abs(z);
      this.dustPositions[i * 3] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.5;
      this.dustPositions[i * 3 + 2] = z;
    }

    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

    const dustMat = new PointsMaterial({
      color: 0xcee6f2,
      size: 0.07,
      transparent: true,
      opacity: 0.3,
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
    this.volumetricCone.visible = effectiveIntensity > 1.0;
    this.dustParticles.visible = effectiveIntensity > 1.0;

    // ── Hand-Held Sway & Attachment ───────────────────────────────────────
    this.camera.getWorldPosition(this.targetPos);
    this.camera.getWorldQuaternion(this.targetQuat);

    // Offset in camera space: right +0.22m, down -0.16m, forward +0.18m
    const offset = new Vector3(0.22, -0.16, 0.18).applyQuaternion(this.targetQuat);
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

    // Align volumetric cone and dust
    this.volumetricCone.position.copy(this.currentPos);
    this.volumetricCone.quaternion.copy(this.currentQuat);

    this.dustParticles.position.copy(this.currentPos);
    this.dustParticles.quaternion.copy(this.currentQuat);

    // Dust particles drift
    const attr = this.dustParticles.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + dt * 0.12;
      if (y > 3) y = -3;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  }
}
