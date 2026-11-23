// src/render/Sky.ts
import {
  Mesh,
  DirectionalLight,
  HemisphereLight,
  Scene,
  BackSide,
  SphereGeometry,
  Float32BufferAttribute,
  AdditiveBlending,
  PlaneGeometry,
  CanvasTexture,
  MeshBasicMaterial,
} from 'three/webgpu';

export class Sky {
  moon: DirectionalLight;
  moonDisc: Mesh;
  moonHalo: Mesh;
  moonOuterHalo: Mesh;
  skyDome: Mesh;
  ambient: HemisphereLight;

  constructor(scene: Scene) {
    // ── Ambient lighting: much darker overall scene, moody horror tone ──
    this.ambient = new HemisphereLight(0x0a161d, 0x020405, 0.22);
    scene.add(this.ambient);

    // ── Moon directional light ───────────────────────────────────────────
    // Soft intensity 0.38, cold moonlight tint.
    // Optimization: turn off moon castShadow (or keep it off) so flashlight is the single
    // high-performance shadow caster, guaranteeing 55+ FPS.
    this.moon = new DirectionalLight(0x9db8c7, 0.38);
    this.moon.position.set(-20, 115, -200);
    this.moon.castShadow = false; // Disabled shadow on moon to hit 55+ FPS target
    scene.add(this.moon);

    // ── Sky Dome with Vertical Gradient (Vertex Colors) ──────────────────
    // Top near-black blue (~#04090d: [0.016, 0.035, 0.051])
    // Horizon dark teal (~#0f1f22: [0.059, 0.122, 0.133])
    // Low segment count (24, 16) for performance
    const domeGeo = new SphereGeometry(450, 24, 16);
    const pos = domeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normalizedY = y / 450; // -1 to 1

      let r: number, g: number, b: number;
      if (normalizedY >= 0) {
        // Horizon (0) to Zenith (1)
        const t = Math.pow(normalizedY, 0.7);
        r = (1 - t) * 0.059 + t * 0.016;
        g = (1 - t) * 0.122 + t * 0.035;
        b = (1 - t) * 0.133 + t * 0.051;
      } else {
        // Below horizon into dark earth/depth
        const t = Math.min(1, -normalizedY * 3);
        r = (1 - t) * 0.059 + t * 0.005;
        g = (1 - t) * 0.122 + t * 0.01;
        b = (1 - t) * 0.133 + t * 0.015;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    domeGeo.setAttribute('color', new Float32BufferAttribute(colors, 3));

    const domeMat = new MeshBasicMaterial({
      vertexColors: true,
      side: BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new Mesh(domeGeo, domeMat);
    this.skyDome.renderOrder = -100;
    scene.add(this.skyDome);

    // ── Moon Disc: Perfect circle facing viewer ──────────────────────────
    // Using a high-resolution circle canvas texture on a billboard plane
    // facing the camera/origin directly ensures it is ALWAYS a crisp, unskewed, perfect circle.
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 128;
    moonCanvas.height = 128;
    const mctx = moonCanvas.getContext('2d')!;
    mctx.clearRect(0, 0, 128, 128);

    // Crisp pale cold moon disc (#d6e5ef) with subtle lunar rim gradient
    const mgrad = mctx.createRadialGradient(64, 64, 0, 64, 64, 58);
    mgrad.addColorStop(0, '#f2f8fc');
    mgrad.addColorStop(0.85, '#d6e5ef');
    mgrad.addColorStop(0.98, '#b8d2e2');
    mgrad.addColorStop(1, 'rgba(184, 210, 226, 0)');
    mctx.fillStyle = mgrad;
    mctx.beginPath();
    mctx.arc(64, 64, 58, 0, Math.PI * 2);
    mctx.fill();

    const moonTex = new CanvasTexture(moonCanvas);
    const moonMat = new MeshBasicMaterial({
      map: moonTex,
      transparent: true,
      fog: false,
      depthWrite: false,
    });
    const moonGeo = new PlaneGeometry(24, 24);
    this.moonDisc = new Mesh(moonGeo, moonMat);
    // At distance ~380m, elevation ~30° along -Z
    this.moonDisc.position.set(-25, 185, -330);
    this.moonDisc.lookAt(0, 0, 0); // Directly facing camera origin
    this.moonDisc.renderOrder = -90;
    scene.add(this.moonDisc);

    // ── Moon Halos: softer, larger additive glows ─────────────────────────
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d')!;
    const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(214, 229, 239, 0.95)');
    grad.addColorStop(0.12, 'rgba(180, 215, 230, 0.65)');
    grad.addColorStop(0.35, 'rgba(110, 175, 195, 0.22)');
    grad.addColorStop(0.65, 'rgba(40, 95, 115, 0.06)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 256, 256);

    const haloTex = new CanvasTexture(haloCanvas);

    // Inner bright halo
    const innerHaloMat = new MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.9,
    });
    const innerHaloGeo = new PlaneGeometry(95, 95);
    this.moonHalo = new Mesh(innerHaloGeo, innerHaloMat);
    this.moonHalo.position.set(-25, 185, -326);
    this.moonHalo.lookAt(0, 0, 0);
    this.moonHalo.renderOrder = -88;
    scene.add(this.moonHalo);

    // Outer soft atmospheric haze halo
    const outerHaloMat = new MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.45,
    });
    const outerHaloGeo = new PlaneGeometry(230, 230);
    this.moonOuterHalo = new Mesh(outerHaloGeo, outerHaloMat);
    this.moonOuterHalo.position.set(-25, 185, -325);
    this.moonOuterHalo.lookAt(0, 0, 0);
    this.moonOuterHalo.renderOrder = -87;
    scene.add(this.moonOuterHalo);
  }

  update(_elapsed: number, playerX = 0, playerY = 0, playerZ = 0): void {
    this.skyDome.position.set(playerX, playerY, playerZ);
  }
}
