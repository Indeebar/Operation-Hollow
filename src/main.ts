import {
  Scene,
  FogExp2,
  Color,
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  PointLight,
} from 'three/webgpu';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { GroundMist } from './render/GroundMist';
import { Time } from './core/Time';
import { Input } from './core/Input';
import { Game } from './core/Game';
import { PlayerController } from './player/PlayerController';
import { Terrain } from './world/Terrain';
import { Forest } from './world/Forest';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const fpsEl = document.getElementById('fps-counter') as HTMLDivElement;
const infoEl = document.getElementById('info-bar') as HTMLDivElement;

// ── Core systems ──────────────────────────────────────────────────────────────
const renderer = new Renderer(canvas);
const scene = new Scene();
const time = new Time();
const input = new Input(canvas);
const game = new Game();

// ── Fog & Background ──────────────────────────────────────────────────────────
scene.fog = new FogExp2(0x0b1a1c, 0.018);
scene.background = new Color(0x040e10);

// ── Terrain ───────────────────────────────────────────────────────────────────
const terrain = new Terrain();
scene.add(terrain.getMesh());

// ── Sky & Lighting ────────────────────────────────────────────────────────────
const sky = new Sky(scene);
scene.add(sky.moon.target);

// ── Ground Mist ───────────────────────────────────────────────────────────────
const groundMist = new GroundMist(scene);

// ── Forest ────────────────────────────────────────────────────────────────────
console.log('[Forest] Building instanced trees...');
const forest = new Forest(terrain, 2500);
for (const mesh of forest.getMeshes()) {
  scene.add(mesh);
}
console.log('[Forest] Done.');

// ── Test cube (M1 leftover, kept for M3 reference as a small landmark) ────────
const cube = new Mesh(
  new BoxGeometry(0.6, 0.6, 0.6),
  new MeshStandardMaterial({ color: 0x44aacc, emissive: 0x224455 }),
);
cube.position.set(0, terrain.getHeight(0, 0) + 1.0, -5);
scene.add(cube);

// A small warm lantern-like placeholder light near spawn
const spawnLight = new PointLight(0xffaa44, 2.0, 12);
spawnLight.position.set(0, terrain.getHeight(0, 0) + 2.5, -5);
scene.add(spawnLight);

// ── Player ────────────────────────────────────────────────────────────────────
const player = new PlayerController(input, terrain);
scene.add(player.getObject());
player.getObject().position.set(0, terrain.getHeight(0, 0) + 1.75, 0);

// ── F3 FPS toggle ─────────────────────────────────────────────────────────────
let showFps = false;
window.addEventListener('keydown', e => {
  if (e.code === 'F3') {
    showFps = !showFps;
    fpsEl.style.display = showFps ? 'block' : 'none';
    e.preventDefault();
  }
});

// ── Pointer lock UI ───────────────────────────────────────────────────────────
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  infoEl.style.display = locked ? 'none' : 'block';
});

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.resize();
  player.onResize();
});

// ── Game loop ─────────────────────────────────────────────────────────────────
let started = false;
renderer.renderer.setAnimationLoop((now: number) => {
  time.tick(now);

  if (!started) {
    started = true;
    game.transition('PLAYING');
  }

  // Animate test cube
  cube.rotation.y += time.delta * 0.5;

  // Update player
  if (input.pointerLocked) {
    player.update(time.delta);
  }

  // Update sky & mist
  sky.update(time.elapsed);
  const pp = player.getObject().position;
  groundMist.update(time.elapsed, pp.x, pp.z);

  // Track moon shadow near player
  sky.moon.target.position.set(pp.x, 0, pp.z);

  if (showFps) {
    fpsEl.textContent = `FPS: ${time.fps}`;
  }

  renderer.renderer.render(scene, player.camera);
});
