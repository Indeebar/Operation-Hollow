import { WebGPURenderer } from 'three/webgpu';

export type QualityPreset = 'low' | 'medium' | 'high';

export class Renderer {
  renderer: WebGPURenderer;
  quality: QualityPreset = 'medium';

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({
      canvas,
      antialias: true,
    });
    this.applyQuality('medium');
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Log backend
    this.renderer.init().then(() => {
      const info = (this.renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
      if (info && info.isWebGPUBackend) {
        console.log('%c[Renderer] WebGPU active ✓', 'color: #0f0');
      } else {
        console.log('%c[Renderer] WebGL2 fallback active', 'color: #fa0');
      }
    });
  }

  applyQuality(preset: QualityPreset): void {
    this.quality = preset;
    let pixelRatioCap = 1.25;

    if (preset === 'low') {
      pixelRatioCap = 1.0;
    } else if (preset === 'medium') {
      pixelRatioCap = 1.25;
    } else if (preset === 'high') {
      pixelRatioCap = 1.5;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  toggleQuality(): QualityPreset {
    if (this.quality === 'low') this.applyQuality('medium');
    else if (this.quality === 'medium') this.applyQuality('high');
    else this.applyQuality('low');
    return this.quality;
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
