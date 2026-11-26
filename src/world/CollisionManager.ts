// src/world/CollisionManager.ts
import { Vector3 } from 'three/webgpu';
import type { AABBBox, CircleObstacle } from './LevelData';

export class CollisionManager {
  private boxes: AABBBox[] = [];
  private circles: CircleObstacle[] = [];

  addBox(box: AABBBox): void {
    this.boxes.push(box);
  }

  addCircle(circle: CircleObstacle): void {
    this.circles.push(circle);
  }

  getBoxes(): AABBBox[] {
    return this.boxes;
  }

  getCircles(): CircleObstacle[] {
    return this.circles;
  }

  /**
   * Resolves player movement against all AABBs and circles with axis-separated sliding.
   */
  resolve(currentPos: Vector3, newPos: Vector3, radius: number = 0.35): Vector3 {
    const resolved = newPos.clone();

    // 1. Resolve X axis first
    let testX = new Vector3(resolved.x, currentPos.y, currentPos.z);
    for (const b of this.boxes) {
      if (
        testX.x + radius > b.minX &&
        testX.x - radius < b.maxX &&
        currentPos.z + radius > b.minZ &&
        currentPos.z - radius < b.maxZ
      ) {
        // Push out on X
        if (currentPos.x <= b.minX) {
          testX.x = b.minX - radius;
        } else if (currentPos.x >= b.maxX) {
          testX.x = b.maxX + radius;
        } else {
          // Inside: push to nearest edge
          const dMin = Math.abs(testX.x - b.minX);
          const dMax = Math.abs(testX.x - b.maxX);
          testX.x = dMin < dMax ? b.minX - radius : b.maxX + radius;
        }
      }
    }
    resolved.x = testX.x;

    // 2. Resolve Z axis
    let testZ = new Vector3(resolved.x, currentPos.y, resolved.z);
    for (const b of this.boxes) {
      if (
        resolved.x + radius > b.minX &&
        resolved.x - radius < b.maxX &&
        testZ.z + radius > b.minZ &&
        testZ.z - radius < b.maxZ
      ) {
        // Push out on Z
        if (currentPos.z <= b.minZ) {
          testZ.z = b.minZ - radius;
        } else if (currentPos.z >= b.maxZ) {
          testZ.z = b.maxZ + radius;
        } else {
          const dMin = Math.abs(testZ.z - b.minZ);
          const dMax = Math.abs(testZ.z - b.maxZ);
          testZ.z = dMin < dMax ? b.minZ - radius : b.maxZ + radius;
        }
      }
    }
    resolved.z = testZ.z;

    // 3. Resolve circular obstacles (Lantern posts, large trees)
    for (const c of this.circles) {
      const dx = resolved.x - c.x;
      const dz = resolved.z - c.z;
      const distSq = dx * dx + dz * dz;
      const minDist = c.radius + radius;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        resolved.x += (dx / dist) * overlap;
        resolved.z += (dz / dist) * overlap;
      }
    }

    return resolved;
  }
}
