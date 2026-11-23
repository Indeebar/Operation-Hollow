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
  enabled: boolean = true;

  constructor(scene: Scene) {
    const mistColor = new Color(0x071214);

    // Reduced to exactly 2 ground mist layers with very low opacity (~0.04)
    // to eliminate transparent overdraw overhead
    for (let i = 0; i < 2; i++) {
      const geo = new PlaneGeometry(110 + i * 20, 90 + i * 15);
      const mat = new MeshBasicMaterial({
        color: mistColor,
        transparent: true,
        opacity: 0.045 - i * 0.015,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.35 + i * 0.3, 0);
      mesh.renderOrder = -10;
      scene.add(mesh);
      this.planes.push({
        mesh,
        speedX: 0.12,
        speedZ: 0.16,
        phase: i * 1.5,
      });
    }
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    for (const p of this.planes) {
      p.mesh.visible = visible;
    }
  }

  update(elapsed: number, playerX: number, playerZ: number): void {
    if (!this.enabled) return;
    for (const p of this.planes) {
      p.mesh.position.x = playerX + Math.sin(elapsed * p.speedX * 0.2 + p.phase) * 25;
      p.mesh.position.z = playerZ + Math.cos(elapsed * p.speedZ * 0.15 + p.phase) * 25;
    }
  }
}
