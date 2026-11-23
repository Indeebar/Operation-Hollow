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
    // Deep dark teal ground mist matching the dimmed horizon fog color (#071214)
    const mistColor = new Color(0x071214);

    // Subtle, low opacity so it stays dark and atmospheric
    for (let i = 0; i < 6; i++) {
      const geo = new PlaneGeometry(100 + i * 15, 80 + i * 12);
      const mat = new MeshBasicMaterial({
        color: mistColor,
        transparent: true,
        opacity: 0.08 - i * 0.008,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (Math.random() - 0.5) * 50,
        0.3 + i * 0.22,
        (Math.random() - 0.5) * 50,
      );
      mesh.renderOrder = -10;
      scene.add(mesh);
      this.planes.push({
        mesh,
        speedX: 0.12 + (Math.random() - 0.5) * 0.1,
        speedZ: 0.15 + Math.random() * 0.15,
        phase: i * 0.9,
      });
    }
  }

  update(elapsed: number, playerX: number, playerZ: number): void {
    for (const p of this.planes) {
      p.mesh.position.x = playerX + Math.sin(elapsed * p.speedX * 0.2 + p.phase) * 30;
      p.mesh.position.z = playerZ + Math.cos(elapsed * p.speedZ * 0.15 + p.phase) * 30;
    }
  }
}
