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
    this.ambient = new HemisphereLight(0x02070a, 0x000101, 0.015);
    scene.add(this.ambient);

    this.moon = new DirectionalLight(0x5c7f99, 0.04);
    this.moon.position.set(-20, 115, -200);
    this.moon.castShadow = false; // Moon shadows off by default
    this.moon.shadow.mapSize.set(1024, 1024);
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 120;
    this.moon.shadow.camera.left = -40;
    this.moon.shadow.camera.right = 40;
    this.moon.shadow.camera.top = 40;
    this.moon.shadow.camera.bottom = -40;
    scene.add(this.moon);

    // Sky Dome
    const domeGeo = new SphereGeometry(450, 20, 14);
    const pos = domeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normalizedY = y / 450;

      let r: number, g: number, b: number;
      if (normalizedY >= 0) {
        const t = Math.pow(normalizedY, 0.7);
        r = (1 - t) * 0.012 + t * 0.001;
        g = (1 - t) * 0.035 + t * 0.005;
        b = (1 - t) * 0.04 + t * 0.01;
      } else {
        r = 0.012;
        g = 0.035;
        b = 0.04;
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

    // Moon Disc
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
    const moonGeo = new PlaneGeometry(20, 20);
    this.moonDisc = new Mesh(moonGeo, moonMat);
    this.moonDisc.position.set(-25, 185, -330);
    this.moonDisc.lookAt(0, 0, 0);
    this.moonDisc.renderOrder = -90;
    scene.add(this.moonDisc);

    // Moon Halos
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d')!;
    const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(180, 210, 225, 0.75)');
    grad.addColorStop(0.15, 'rgba(110, 165, 185, 0.35)');
    grad.addColorStop(0.4, 'rgba(40, 90, 110, 0.08)');
    grad.addColorStop(0.7, 'rgba(10, 30, 40, 0.02)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 256, 256);

    const haloTex = new CanvasTexture(haloCanvas);

    const innerHaloMat = new MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.65,
    });
    this.moonHalo = new Mesh(new PlaneGeometry(80, 80), innerHaloMat);
    this.moonHalo.position.set(-25, 185, -326);
    this.moonHalo.lookAt(0, 0, 0);
    this.moonHalo.renderOrder = -88;
    scene.add(this.moonHalo);

    const outerHaloMat = new MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.22,
    });
    this.moonOuterHalo = new Mesh(new PlaneGeometry(180, 180), outerHaloMat);
    this.moonOuterHalo.position.set(-25, 185, -325);
    this.moonOuterHalo.lookAt(0, 0, 0);
    this.moonOuterHalo.renderOrder = -87;
    scene.add(this.moonOuterHalo);
  }

  setMoonShadow(enabled: boolean): void {
    this.moon.castShadow = enabled;
  }

  update(_elapsed: number, playerX = 0, playerY = 0, playerZ = 0): void {
    this.skyDome.position.set(playerX, playerY, playerZ);
  }
}
