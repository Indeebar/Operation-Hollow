import {
  Scene,
  HemisphereLight,
  DirectionalLight,
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  Color,
  FogExp2,
} from 'three/webgpu';
import { Renderer } from './render/Renderer';
import { Time } from './core/Time';
import { Input } from './core/Input';
import { Game } from './core/Game';
import { PlayerController } from './player/PlayerController';
import { Terrain } from './world/Terrain';

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

// ── Terrain ───────────────────────────────────────────────────────────────────
const terrain = new Terrain();
scene.add(terrain.getMesh());

// ── Player ────────────────────────────────────────────────────────────────────
const player = new PlayerController(input, terrain);
scene.add(player.getObject());
player.getObject().position.set(0, terrain.getHeight(0, 0) + 1.75, 0);

// ── Test cube (M1 visual) ─────────────────────────────────────────────────────
const cube = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshStandardMaterial({ color: 0x44aacc }),
);
cube.position.set(0, terrain.getHeight(0, 0) + 3, -8);
cube.castShadow = true;
scene.add(cube);

// ── Lighting ──────────────────────────────────────────────────────────────────
const ambient = new HemisphereLight(0x0d1f2a, 0x050d05, 0.4);
scene.add(ambient);

const moon = new DirectionalLight(0x8fb3c9, 0.5);
moon.position.set(-50, 100, -80);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 500;
moon.shadow.camera.left = -120;
moon.shadow.camera.right = 120;
moon.shadow.camera.top = 120;
moon.shadow.camera.bottom = -120;
scene.add(moon);

// ── Fog ───────────────────────────────────────────────────────────────────────
scene.fog = new FogExp2(0x0b1a1c, 0.015);
scene.background = new Color(0x040e10);

// ── F3 FPS toggle ─────────────────────────────────────────────────────────────
let showFps = false;
window.addEventListener('keydown', e => {
  if (e.code === 'F3') {
    showFps = !showFps;
    fpsEl.style.display = showFps ? 'block' : 'none';
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

  // Rotate test cube
  cube.rotation.x += time.delta * 0.5;
  cube.rotation.y += time.delta * 0.8;

  // Update player if pointer locked
  if (input.pointerLocked) {
    player.update(time.delta);
    // Follow camera shadow anchor
    moon.shadow.camera.position.copy(player.camera.position);
  }

  if (showFps) {
    fpsEl.textContent = `FPS: ${time.fps}`;
  }

  renderer.renderer.render(scene, player.camera);
});
