// src/render/PostFX.ts
import {
  RenderPipeline,
  WebGPURenderer,
  Scene,
  PerspectiveCamera,
} from 'three/webgpu';
import {
  pass,
  screenUV,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  length,
  sin,
  fract,
  dot,
  mix,
  smoothstep,
  nodeObject,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export class PostFX {
  pipeline: RenderPipeline | null = null;
  isReady: boolean = false;

  // Uniform nodes for live control
  private uBloomStrength = uniform(0.35);
  private uGrainIntensity = uniform(0.04);
  private uFear = uniform(0.0);
  private uEnableBloom = uniform(0.0);
  private uEnableVignette = uniform(0.0);
  private uEnableGrain = uniform(0.0);
  private uEnableChromatic = uniform(0.0);
  private uEnableGrading = uniform(0.0);

  // States - OFF by default per user instruction
  enableBloom: boolean = false;
  enableVignette: boolean = false;
  enableGrain: boolean = false;
  enableChromatic: boolean = false;
  enableGrading: boolean = false;

  private pulseTime: number = 0;

  constructor(
    private renderer: WebGPURenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
  ) {
    this.init();
  }

  private init(): void {
    try {
      this.pipeline = new RenderPipeline(this.renderer);
      this.buildGraph();
      this.isReady = true;
      console.log('[PostFX] RenderPipeline built successfully ✓');
    } catch (e) {
      console.warn('[PostFX] Failed to initialize RenderPipeline, falling back to direct render:', e);
      this.isReady = false;
      this.pipeline = null;
    }
  }

  private buildGraph(): void {
    if (!this.pipeline) return;

    // 1. Base Scene Pass
    const scenePass = pass(this.scene, this.camera);
    const baseColor = scenePass.getTextureNode('output');

    let afterBloom: any = baseColor;
    try {
      // 2. Bloom node
      const rawBloom = bloom(baseColor, 0.35, 0.45, 0.75);
      afterBloom = mix(baseColor, nodeObject(rawBloom), this.uEnableBloom);
    } catch (bloomErr) {
      console.warn('[PostFX] BloomNode not supported on this device/backend:', bloomErr);
    }

    // 3. Screen coordinates for radial effects
    const uvCoord = screenUV;
    const centerOffset = length(uvCoord.sub(vec2(0.5, 0.5)));

    // 4. Color Grading (crushed blacks, teal shadows, warm highlights)
    // Cool horror tint: R*0.82, G*0.96, B*1.06
    const gradedRgb = afterBloom.rgb.mul(vec3(0.82, 0.96, 1.06));
    const afterGrading = mix(afterBloom.rgb, gradedRgb, this.uEnableGrading);

    // 5. Chromatic Aberration simulation (edge color shift)
    // Edge channel tint modulation
    const edgeTint = vec3(
      float(1.0).add(centerOffset.mul(0.12)),
      float(1.0),
      float(1.0).sub(centerOffset.mul(0.12))
    );
    const chromaticRgb = afterGrading.mul(edgeTint);
    const afterChromatic = mix(afterGrading, chromaticRgb, this.uEnableChromatic);

    // 6. Vignette with Dynamic Fear Pulse
    const dist = length(uvCoord.sub(vec2(0.5, 0.5)));
    const vigRadius = float(0.75).sub(this.uFear.mul(0.2));
    const vig = smoothstep(vigRadius, float(0.25), dist);
    const vigFactor = mix(float(1.0), vig, this.uEnableVignette);
    const afterVignette = afterChromatic.mul(vigFactor);

    // 7. Film Grain Noise
    const grainNoise = fract(sin(dot(uvCoord, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).mul(this.uGrainIntensity);
    const afterGrain = afterVignette.add(grainNoise.mul(this.uEnableGrain));

    // 8. Desaturation as fear rises (grayscale blend)
    const gray = dot(afterGrain, vec3(0.299, 0.587, 0.114));
    const finalRgb = mix(afterGrain, vec3(gray, gray, gray), this.uFear.mul(0.35));

    this.pipeline.outputNode = vec4(finalRgb, baseColor.a);
  }

  setBloomEnabled(enabled: boolean): void {
    this.enableBloom = enabled;
    this.uEnableBloom.value = enabled ? 1.0 : 0.0;
  }

  setChromaticEnabled(enabled: boolean): void {
    this.enableChromatic = enabled;
    this.uEnableChromatic.value = enabled ? 1.0 : 0.0;
  }

  setVignetteEnabled(enabled: boolean): void {
    this.enableVignette = enabled;
    this.uEnableVignette.value = enabled ? 1.0 : 0.0;
  }

  setGrainEnabled(enabled: boolean): void {
    this.enableGrain = enabled;
    this.uEnableGrain.value = enabled ? 1.0 : 0.0;
  }

  setGradingEnabled(enabled: boolean): void {
    this.enableGrading = enabled;
    this.uEnableGrading.value = enabled ? 1.0 : 0.0;
  }

  setQuality(preset: 'low' | 'medium' | 'high'): void {
    if (preset === 'low') {
      this.setBloomEnabled(false);
      this.setChromaticEnabled(false);
      this.setGradingEnabled(false);
      this.setVignetteEnabled(true);
      this.setGrainEnabled(true);
    } else {
      this.setBloomEnabled(true);
      this.setChromaticEnabled(true);
      this.setGradingEnabled(true);
      this.setVignetteEnabled(true);
      this.setGrainEnabled(true);
    }
  }

  update(dt: number, fear: number): void {
    if (!this.isReady) return;
    this.pulseTime += dt * (2.0 + fear * 4.0);
    const fearPulse = fear * (1.0 + Math.sin(this.pulseTime) * 0.15);
    this.uFear.value = Math.max(0, Math.min(1.0, fearPulse));
  }

  render(): void {
    if (this.pipeline && this.isReady) {
      this.pipeline.render();
    }
  }

  dispose(): void {
    this.isReady = false;
    this.pipeline = null;
    console.log('[PostFX] PostFX disposed cleanly.');
  }
}
