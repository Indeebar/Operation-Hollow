// src/render/GroundMist.ts
import {
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Color,
  Scene,
  DoubleSide,
} from 'three/webgpu';

export class GroundMist {
  private planes: { mesh: Mesh; speed: number; phase: number }[] = [];

  constructor(scene: Scene) {
    const mistColor = new Color(0x0d2020);
    for (let i = 0; i < 6; i++) {
      const geo = new PlaneGeometry(80 + i * 20, 60 + i * 15);
      const mat = new MeshBasicMaterial({
        color: mistColor,
        transparent: true,
        opacity: 0.18 - i * 0.02,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (Math.random() - 0.5) * 100,
        0.3 + i * 0.4,
        (Math.random() - 0.5) * 100,
      );
      mesh.renderOrder = -1;
      scene.add(mesh);
      this.planes.push({ mesh, speed: 0.3 + Math.random() * 0.4, phase: i * 1.1 });
    }
  }

  update(elapsed: number, playerX: number, playerZ: number): void {
    for (const p of this.planes) {
      // Drift slowly, follow player loosely
      p.mesh.position.x = playerX + Math.sin(elapsed * p.speed * 0.1 + p.phase) * 30;
      p.mesh.position.z = playerZ + Math.cos(elapsed * p.speed * 0.07 + p.phase) * 30;
    }
  }
}
