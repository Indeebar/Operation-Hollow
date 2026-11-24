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
  pipeline: RenderPipeline;

  // Uniform nodes for live control
  private uBloomStrength = uniform(0.35);
  private uGrainIntensity = uniform(0.045);
  private uFear = uniform(0.0);
  private uEnableBloom = uniform(1.0);
  private uEnableVignette = uniform(1.0);
  private uEnableGrain = uniform(1.0);
  private uEnableChromatic = uniform(1.0);
  private uEnableGrading = uniform(1.0);

  // States
  enableBloom: boolean = true;
  enableVignette: boolean = true;
  enableGrain: boolean = true;
  enableChromatic: boolean = true;
  enableGrading: boolean = true;

  private pulseTime: number = 0;

  constructor(
    private renderer: WebGPURenderer,
    private scene: Scene,
    private camera: PerspectiveCamera,
  ) {
    this.pipeline = new RenderPipeline(renderer);
    this.buildGraph();
  }

  private buildGraph(): void {
    // 1. Base Scene Pass
    const scenePass = pass(this.scene, this.camera);
    const baseColor = scenePass.getTextureNode('output');

    // 2. Subtle Bloom (moon, lantern, wrist screen)
    // Scaled with uEnableBloom
    const rawBloom = bloom(baseColor, 0.35, 0.45, 0.75);
    const afterBloom = mix(baseColor, nodeObject(rawBloom), this.uEnableBloom);

    // 3. Chromatic Aberration at Screen Edges (TSL radial RGB split)
    const uvCoord = screenUV;
    const centerOffset = length(uvCoord.sub(vec2(0.5, 0.5)));
    // Split R and B slightly based on radial distance
    const rShift = uvCoord.add(vec2(0.003, 0.001).mul(centerOffset).mul(this.uEnableChromatic));
    const bShift = uvCoord.sub(vec2(0.003, 0.001).mul(centerOffset).mul(this.uEnableChromatic));
    const rSample = scenePass.getTextureNode('output').sample(rShift).r;
    const bSample = scenePass.getTextureNode('output').sample(bShift).b;
    const chromaticRgb = vec3(rSample, afterBloom.g, bSample);
    const afterChromatic = mix(afterBloom.rgb, chromaticRgb, this.uEnableChromatic);

    // 4. Color Grading (crushed blacks, teal shadows, warm highlights)
    // Cool horror tint: R*0.82, G*0.96, B*1.06
    const gradedRgb = afterChromatic.mul(vec3(0.82, 0.96, 1.06));
    const afterGrading = mix(afterChromatic, gradedRgb, this.uEnableGrading);

    // 5. Vignette with Dynamic Fear Pulse
    // Fear increases darkness and pulses inwards
    const dist = length(uvCoord.sub(vec2(0.5, 0.5)));
    const vigRadius = float(0.75).sub(this.uFear.mul(0.2));
    const vig = smoothstep(vigRadius, float(0.25), dist);
    const vigFactor = mix(float(1.0), vig, this.uEnableVignette);
    const afterVignette = afterGrading.mul(vigFactor);

    // 6. Film Grain Noise
    const grainNoise = fract(sin(dot(uvCoord, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).mul(this.uGrainIntensity);
    const afterGrain = afterVignette.add(grainNoise.mul(this.uEnableGrain));

    // Desaturation as fear rises (grayscale blend)
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
    this.pulseTime += dt * (2.0 + fear * 4.0);
    const fearPulse = fear * (1.0 + Math.sin(this.pulseTime) * 0.15);
    this.uFear.value = Math.max(0, Math.min(1.0, fearPulse));
  }

  render(): void {
    this.pipeline.render();
  }
}
