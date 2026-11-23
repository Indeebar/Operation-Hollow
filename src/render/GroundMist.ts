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
  private planes: { mesh: Mesh; speedX: number; speedZ: number; phase: number }[] = [];

  constructor(scene: Scene) {
    // Dark teal ground mist matching the horizon fog color (#0f1f22)
    const mistColor = new Color(0x0f1f22);

    // 8 low, expansive drifting mist layers hovering just above terrain
    for (let i = 0; i < 8; i++) {
      const geo = new PlaneGeometry(110 + i * 15, 90 + i * 12);
      const mat = new MeshBasicMaterial({
        color: mistColor,
        transparent: true,
        opacity: 0.14 - i * 0.012,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (Math.random() - 0.5) * 60,
        0.4 + i * 0.28,
        (Math.random() - 0.5) * 60,
      );
      mesh.renderOrder = -10;
      scene.add(mesh);
      this.planes.push({
        mesh,
        speedX: 0.15 + (Math.random() - 0.5) * 0.15,
        speedZ: 0.2 + Math.random() * 0.2,
        phase: i * 0.9,
      });
    }
  }

  update(elapsed: number, playerX: number, playerZ: number): void {
    for (const p of this.planes) {
      // Drifts slowly across the forest floor while staying in player range
      p.mesh.position.x = playerX + Math.sin(elapsed * p.speedX * 0.2 + p.phase) * 35;
      p.mesh.position.z = playerZ + Math.cos(elapsed * p.speedZ * 0.15 + p.phase) * 35;
    }
  }
}
