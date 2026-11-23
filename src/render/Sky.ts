// src/render/Sky.ts
import {
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  DirectionalLight,
  HemisphereLight,
  Object3D,
  Color,
  Scene,
  BackSide,
  PointLight,
} from 'three/webgpu';

export class Sky {
  moon: DirectionalLight;
  moonDisc: Mesh;
  ambient: HemisphereLight;

  constructor(scene: Scene) {
    // ── Hemisphere ambient (dark teal sky, near-black ground) ────────────
    this.ambient = new HemisphereLight(0x0d1f2a, 0x050a05, 0.35);
    scene.add(this.ambient);

    // ── Moon directional light ───────────────────────────────────────────
    this.moon = new DirectionalLight(0x8fb3c9, 0.55);
    this.moon.position.set(-80, 120, -100);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 600;
    this.moon.shadow.camera.left = -150;
    this.moon.shadow.camera.right = 150;
    this.moon.shadow.camera.top = 150;
    this.moon.shadow.camera.bottom = -150;
    this.moon.shadow.bias = -0.001;
    scene.add(this.moon);

    // ── Moon disc (visible glowing sphere in sky) ────────────────────────
    const moonGeo = new SphereGeometry(8, 16, 16);
    const moonMat = new MeshBasicMaterial({ color: 0xddeeff });
    this.moonDisc = new Mesh(moonGeo, moonMat);
    // Position the disc far away in the direction of the light
    this.moonDisc.position.set(-400, 600, -500);
    scene.add(this.moonDisc);
  }

  update(_elapsed: number): void {
    // Optionally animate clouds / mist drift here later
  }
}
