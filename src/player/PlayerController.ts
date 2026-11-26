import {
  PerspectiveCamera,
  Vector3,
  Object3D,
  MathUtils,
} from 'three/webgpu';
import type { Input } from '../core/Input';
import type { Time } from '../core/Time';
import type { Terrain } from '../world/Terrain';
import type { CollisionManager } from '../world/CollisionManager';

const WALK_SPEED = 3.0;
const SPRINT_SPEED = 5.5;
const CROUCH_SPEED = 1.5;
const PLAYER_HEIGHT = 1.75;
const CROUCH_HEIGHT = 0.9;
const STAMINA_MAX = 6.0;
const BOUNDARY = 192; // 384m playable area boundary clamp

export class PlayerController {
  camera: PerspectiveCamera;
  private pivot: Object3D;
  private yaw: number = 0;
  private pitch: number = 0;
  private stamina: number = STAMINA_MAX;
  private crouching: boolean = false;
  private currentHeight: number = PLAYER_HEIGHT;
  private bobTime: number = 0;
  private velocity: Vector3 = new Vector3();

  constructor(
    private input: Input,
    private terrain: Terrain,
    private collision?: CollisionManager,
    private sensitivity: number = 0.002,
  ) {
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
    this.pivot = new Object3D();
    this.pivot.add(this.camera);
    this.pivot.position.set(0, 0, 0);
  }

  getObject(): Object3D {
    return this.pivot;
  }

  /** Set initial yaw (radians). 0 = facing -Z, Math.PI = facing +Z (toward trail) */
  setYaw(yaw: number): void {
    this.yaw = yaw;
    this.pivot.rotation.set(0, this.yaw, 0);
  }

  update(dt: number): void {
    // Mouse look
    const mouse = this.input.flushMouse();
    this.yaw -= mouse.x * this.sensitivity;
    this.pitch -= mouse.y * this.sensitivity;
    this.pitch = MathUtils.clamp(this.pitch, -Math.PI / 2.5, Math.PI / 2.5);
    this.pivot.rotation.set(0, this.yaw, 0);
    this.camera.rotation.set(this.pitch, 0, 0);

    // Crouch
    const wantCrouch = this.input.isDown('ControlLeft') || this.input.isDown('ControlRight') || this.input.isDown('KeyC');
    this.crouching = wantCrouch;

    // Sprint & stamina
    const wantSprint = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    const canSprint = wantSprint && this.stamina > 0 && !this.crouching;

    if (canSprint) {
      this.stamina = Math.max(0, this.stamina - dt);
    } else if (!wantSprint) {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + dt * 1.5);
    }

    const speed = this.crouching ? CROUCH_SPEED : (canSprint ? SPRINT_SPEED : WALK_SPEED);

    // Movement
    const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new Vector3();
    if (this.input.isDown('KeyW')) move.addScaledVector(fwd, speed);
    if (this.input.isDown('KeyS')) move.addScaledVector(fwd, -speed);
    if (this.input.isDown('KeyA')) move.addScaledVector(right, -speed);
    if (this.input.isDown('KeyD')) move.addScaledVector(right, speed);

    const prevPos = this.pivot.position.clone();
    this.pivot.position.x += move.x * dt;
    this.pivot.position.z += move.z * dt;

    // Collision resolution (slide against AABB/circle obstacles)
    if (this.collision) {
      const resolved = this.collision.resolve(prevPos, this.pivot.position, 0.35);
      this.pivot.position.x = resolved.x;
      this.pivot.position.z = resolved.z;
    }

    // Boundary clamp
    this.pivot.position.x = MathUtils.clamp(this.pivot.position.x, -BOUNDARY, BOUNDARY);
    this.pivot.position.z = MathUtils.clamp(this.pivot.position.z, -BOUNDARY, BOUNDARY);

    // Terrain height following
    const groundY = this.terrain.getHeight(this.pivot.position.x, this.pivot.position.z);
    const targetHeight = this.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    this.currentHeight = MathUtils.lerp(this.currentHeight, targetHeight, dt * 10);
    this.pivot.position.y = groundY + this.currentHeight;

    // Head bob
    const isMoving = move.length() > 0.01;
    if (isMoving) {
      const bobFreq = canSprint ? 10 : (this.crouching ? 4 : 7);
      this.bobTime += dt * bobFreq;
      const bobAmt = this.crouching ? 0.02 : (canSprint ? 0.055 : 0.03);
      this.camera.position.y = Math.sin(this.bobTime) * bobAmt;
      this.camera.position.x = Math.sin(this.bobTime * 0.5) * bobAmt * 0.5;
    } else {
      this.camera.position.y = MathUtils.lerp(this.camera.position.y, 0, dt * 10);
      this.camera.position.x = MathUtils.lerp(this.camera.position.x, 0, dt * 10);
    }
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
