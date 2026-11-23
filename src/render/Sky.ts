// src/render/Sky.ts
import {
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  DirectionalLight,
  HemisphereLight,
  Scene,
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  AdditiveBlending,
  PlaneGeometry,
  CanvasTexture,
} from 'three/webgpu';

export class Sky {
  moon: DirectionalLight;
  moonDisc: Mesh;
  moonGlow: Mesh;
  skyDome: Mesh;
  ambient: HemisphereLight;

  constructor(scene: Scene) {
    // ── Hemisphere ambient (cool night blue sky, near-black ground) ───────
    // It should look moonlit, not unlit
    this.ambient = new HemisphereLight(0x224455, 0x050a0a, 0.6);
    scene.add(this.ambient);

    // ── Moon directional light ───────────────────────────────────────────
    // Initial camera look direction is (0, 0, -1).
    // Moon positioned at ~30° elevation in front of the player (e.g. z = -200, y = 115, x = -20)
    this.moon = new DirectionalLight(0xbcd6e8, 1.3);
    this.moon.position.set(-20, 115, -200);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 500;
    this.moon.shadow.camera.left = -150;
    this.moon.shadow.camera.right = 150;
    this.moon.shadow.camera.top = 150;
    this.moon.shadow.camera.bottom = -150;
    this.moon.shadow.bias = -0.001;
    scene.add(this.moon);

    // ── Sky Dome with Vertical Gradient (Vertex Colors) ──────────────────
    // near-black blue at top (~#030914), lighter muted teal (~#1f3a3d) near horizon
    const domeGeo = new SphereGeometry(450, 32, 16);
    const pos = domeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Top color: near-black blue [0.015, 0.04, 0.09]
    // Horizon color: muted teal [0.12, 0.23, 0.24] (~#1f3a3d)
    // Bottom color: deep void [0.01, 0.02, 0.03]
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normalizedY = y / 450; // -1 to 1

      let r: number, g: number, b: number;
      if (normalizedY >= 0) {
        // Horizon (0) to Top (1)
        const t = Math.pow(normalizedY, 0.6); // smooth gradient curve
        r = (1 - t) * 0.12 + t * 0.015;
        g = (1 - t) * 0.23 + t * 0.04;
        b = (1 - t) * 0.24 + t * 0.09;
      } else {
        // Below horizon
        const t = Math.min(1, -normalizedY * 2);
        r = (1 - t) * 0.12 + t * 0.01;
        g = (1 - t) * 0.23 + t * 0.02;
        b = (1 - t) * 0.24 + t * 0.03;
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

    // ── Moon Disc ────────────────────────────────────────────────────────
    // Bright pale disc (~#cfe3ee), ~30° elevation in initial look direction
    const moonGeo = new SphereGeometry(12, 24, 24);
    const moonMat = new MeshBasicMaterial({
      color: 0xcfe3ee,
      fog: false,
      depthWrite: false,
    });
    this.moonDisc = new Mesh(moonGeo, moonMat);
    // Distance ~380m, elevation ~30 deg (sin(30)=0.5, cos(30)=0.866)
    // Camera initially looks along -Z. Let's place it at x: -30, y: 190, z: -330
    this.moonDisc.position.set(-30, 190, -330);
    this.moonDisc.renderOrder = -90;
    scene.add(this.moonDisc);

    // ── Moon Additive Glow Sprite ────────────────────────────────────────
    // Generate soft circular glow texture via canvas
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(207, 227, 238, 0.8)');
    grad.addColorStop(0.2, 'rgba(160, 205, 230, 0.45)');
    grad.addColorStop(0.5, 'rgba(90, 150, 180, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const glowTex = new CanvasTexture(glowCanvas);
    const glowMat = new MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: AdditiveBlending,
      fog: false,
      depthWrite: false,
    });

    const glowGeo = new PlaneGeometry(80, 80);
    this.moonGlow = new Mesh(glowGeo, glowMat);
    this.moonGlow.position.set(-30, 190, -325);
    // Look towards origin/camera
    this.moonGlow.lookAt(0, 0, 0);
    this.moonGlow.renderOrder = -85;
    scene.add(this.moonGlow);
  }

  update(_elapsed: number, playerX = 0, playerY = 0, playerZ = 0): void {
    // Keep sky dome centered on player
    this.skyDome.position.set(playerX, playerY, playerZ);
  }
}
