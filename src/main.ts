import {
  Scene,
  FogExp2,
  Color,
} from 'three/webgpu';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { GroundMist } from './render/GroundMist';
import { Time } from './core/Time';
import { Input } from './core/Input';
import { Game } from './core/Game';
import { PlayerController } from './player/PlayerController';
import { Flashlight } from './player/Flashlight';
import { Weapon } from './player/Weapon';
import { Radio } from './player/Radio';
import { Terrain } from './world/Terrain';
import { Forest } from './world/Forest';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const fpsEl = document.getElementById('fps-counter') as HTMLDivElement;
const crosshairEl = document.getElementById('crosshair') as HTMLDivElement;
const infoEl = document.getElementById('info-bar') as HTMLDivElement;
const lightStateEl = document.getElementById('light-state') as HTMLSpanElement;
const batteryFillEl = document.getElementById('battery-fill') as HTMLDivElement;
const batteryPctEl = document.getElementById('battery-pct') as HTMLSpanElement;
const batteryCountEl = document.getElementById('battery-count') as HTMLSpanElement;
const ammoDisplayEl = document.getElementById('ammo-display') as HTMLSpanElement;
const promptMsgEl = document.getElementById('prompt-msg') as HTMLDivElement;

// ── Core systems ──────────────────────────────────────────────────────────────
const renderer = new Renderer(canvas);
const scene = new Scene();
const time = new Time();
const input = new Input(canvas);
const game = new Game();

// ── Fog & Background ──────────────────────────────────────────────────────────
// Deep dark night fog matching horizon: #03090a
scene.fog = new FogExp2(0x03090a, 0.017);
scene.background = new Color(0x03090a);

// ── Terrain ───────────────────────────────────────────────────────────────────
const terrain = new Terrain();
scene.add(terrain.getMesh());

// ── Sky & Lighting ────────────────────────────────────────────────────────────
const sky = new Sky(scene);

// ── Ground Mist ───────────────────────────────────────────────────────────────
const groundMist = new GroundMist(scene);

// ── Forest (optimized instanced trees with distance culling <= 92m) ───────────
console.log('[Forest] Building instanced trees and forest clutter...');
const forest = new Forest(terrain, 2600);
for (const mesh of forest.getMeshes()) {
  scene.add(mesh);
}
console.log('[Forest] Done.');

// ── Player & Camera ───────────────────────────────────────────────────────────
const player = new PlayerController(input, terrain);
scene.add(player.getObject());
player.getObject().position.set(0, terrain.getHeight(0, 0) + 1.75, 0);

// ── Flashlight ────────────────────────────────────────────────────────────────
const flashlight = new Flashlight(player.camera, scene);

// ── Weapon & Radio HUD ────────────────────────────────────────────────────────
const weapon = new Weapon();
player.camera.add(weapon.group);

const radio = new Radio();
player.camera.add(radio.group);

// Dedicated key state tracking for separate swap and reload
let rKeyHeldDuration = 0;
let rKeyTriggeredHold = false;

// ── F3 FPS toggle ─────────────────────────────────────────────────────────────
let showFps = true;
fpsEl.style.display = 'block';

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

  // ── Input Handling (Movement, Flashlight, Weapon) ──
  if (input.pointerLocked) {
    player.update(time.delta);

    // Toggle flashlight: [F]
    if (input.isJustPressed('KeyF')) {
      flashlight.toggle();
    }

    // Weapon Reload (tap R) vs Battery Swap (hold R > 0.45s)
    if (input.isDown('KeyR')) {
      rKeyHeldDuration += time.delta;
      if (rKeyHeldDuration >= 0.45 && !rKeyTriggeredHold) {
        rKeyTriggeredHold = true;
        flashlight.startBatterySwap();
      }
    } else {
      // Key released
      if (rKeyHeldDuration > 0 && rKeyHeldDuration < 0.45 && !rKeyTriggeredHold) {
        weapon.startReload();
      }
      rKeyHeldDuration = 0;
      rKeyTriggeredHold = false;
    }

    // Fire weapon: [LMB]
    if (input.isMouseJustPressed(0)) {
      weapon.tryFire();
    }

    // Aim down sights (ADS): [RMB]
    weapon.setAiming(input.isMouseDown(2));
  }

  // Clear single-frame key & mouse triggers
  input.clearFrame();

  // Update weapon & radio models in view
  weapon.update(time.delta, player.camera);
  radio.update(time.delta, flashlight.battery, weapon.ammoInMag, weapon.reserveAmmo);

  // Update flashlight physics & battery
  flashlight.update(time.delta);

  // Crosshair visibility fades out when aiming down sights
  crosshairEl.style.opacity = weapon.isAiming ? '0' : '0.45';

  // Update HUD status & prompts
  ammoDisplayEl.textContent = `${weapon.ammoInMag} / ${weapon.reserveAmmo}`;
  if (weapon.isReloading) {
    promptMsgEl.textContent = 'Reloading weapon...';
    promptMsgEl.style.display = 'block';
  } else if (flashlight.isSwapping) {
    promptMsgEl.textContent = 'Swapping battery...';
    promptMsgEl.style.display = 'block';
  } else {
    promptMsgEl.style.display = 'none';
  }

  // Update Flashlight Battery Status
  const pct = Math.round(flashlight.battery);
  batteryPctEl.textContent = `${pct}%`;
  batteryFillEl.style.width = `${pct}%`;

  if (pct > 40) {
    batteryFillEl.style.backgroundColor = '#38e078';
  } else if (pct > 20) {
    batteryFillEl.style.backgroundColor = '#f0a030';
  } else {
    batteryFillEl.style.backgroundColor = '#e04040';
  }

  if (flashlight.isSwapping) {
    lightStateEl.textContent = 'SWAPPING...';
    lightStateEl.style.color = '#f0a030';
  } else {
    if (flashlight.isOn) {
      lightStateEl.textContent = 'ON';
      lightStateEl.style.color = '#70f0a0';
    } else {
      lightStateEl.textContent = flashlight.battery <= 0 ? 'DEAD' : 'OFF';
      lightStateEl.style.color = flashlight.battery <= 0 ? '#e05050' : '#88a0a8';
    }
  }
  batteryCountEl.textContent = `(x${flashlight.spareBatteries})`;

  // Update sky dome, ground mist, and forest culling
  const pp = player.getObject().position;
  sky.update(time.elapsed, pp.x, pp.y, pp.z);
  groundMist.update(time.elapsed, pp.x, pp.z);
  forest.update(pp.x, pp.z);

  if (showFps) {
    fpsEl.textContent = `FPS: ${time.fps} | LIGHT: ${flashlight.isOn ? 'ON' : 'OFF'}`;
  }

  renderer.renderer.render(scene, player.camera);
});
