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
    // ── Deep Horror Night Lighting ─────────────────────────────────────────
    // Section 1: "near-total darkness. The flashlight is your main way of seeing."
    // Heavily dimmed ambient: very low moonlight bounce
    this.ambient = new HemisphereLight(0x050e14, 0x010202, 0.05);
    scene.add(this.ambient);

    // ── Moon directional light: low dim moonlight (~0.12) ──────────────────
    // Just enough to pick out distant tree silhouettes against the horizon
    this.moon = new DirectionalLight(0x759cb5, 0.12);
    this.moon.position.set(-20, 115, -200);
    this.moon.castShadow = false;
    scene.add(this.moon);

    // ── Sky Dome with Vertical Gradient (Deep Night) ───────────────────────
    // Top pitch-black blue (~#010408: [0.005, 0.015, 0.03])
    // Horizon deep dark teal (~#071214: [0.028, 0.07, 0.078])
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
        r = (1 - t) * 0.028 + t * 0.005;
        g = (1 - t) * 0.07 + t * 0.015;
        b = (1 - t) * 0.078 + t * 0.03;
      } else {
        // Below horizon into black void
        const t = Math.min(1, -normalizedY * 3);
        r = (1 - t) * 0.028 + t * 0.002;
        g = (1 - t) * 0.07 + t * 0.005;
        b = (1 - t) * 0.078 + t * 0.008;
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
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 128;
    moonCanvas.height = 128;
    const mctx = moonCanvas.getContext('2d')!;
    mctx.clearRect(0, 0, 128, 128);

    const mgrad = mctx.createRadialGradient(64, 64, 0, 64, 64, 58);
    mgrad.addColorStop(0, '#eaf2f8');
    mgrad.addColorStop(0.85, '#bfd7e6');
    mgrad.addColorStop(0.98, '#9cbacb');
    mgrad.addColorStop(1, 'rgba(156, 186, 203, 0)');
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
    const moonGeo = new PlaneGeometry(22, 22);
    this.moonDisc = new Mesh(moonGeo, moonMat);
    this.moonDisc.position.set(-25, 185, -330);
    this.moonDisc.lookAt(0, 0, 0);
    this.moonDisc.renderOrder = -90;
    scene.add(this.moonDisc);

    // ── Moon Halos ────────────────────────────────────────────────────────
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d')!;
    const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(195, 218, 232, 0.85)');
    grad.addColorStop(0.15, 'rgba(140, 185, 205, 0.45)');
    grad.addColorStop(0.4, 'rgba(60, 120, 140, 0.12)');
    grad.addColorStop(0.7, 'rgba(15, 45, 55, 0.03)');
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
      opacity: 0.8,
    });
    const innerHaloGeo = new PlaneGeometry(85, 85);
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
      opacity: 0.3,
    });
    const outerHaloGeo = new PlaneGeometry(200, 200);
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
