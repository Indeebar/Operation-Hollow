import { WebGPURenderer } from 'three/webgpu';

export class Renderer {
  renderer: WebGPURenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({
      canvas,
      antialias: true,
    });
    // Cap pixel ratio to 1.5 to maintain high framerate (55+ FPS)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
