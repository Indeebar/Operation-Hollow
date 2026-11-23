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
import { ViewmodelRig } from './player/ViewmodelRig';
import { Terrain } from './world/Terrain';
import { Forest } from './world/Forest';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const fpsEl = document.getElementById('fps-counter') as HTMLDivElement;
const qualityToggleEl = document.getElementById('quality-toggle') as HTMLDivElement;
const crosshairEl = document.getElementById('crosshair') as HTMLDivElement;
const infoEl = document.getElementById('info-bar') as HTMLDivElement;
const slotDisplayEl = document.getElementById('slot-display') as HTMLSpanElement;
const lightStateEl = document.getElementById('light-state') as HTMLSpanElement;
const batteryFillEl = document.getElementById('battery-fill') as HTMLDivElement;
const batteryPctEl = document.getElementById('battery-pct') as HTMLSpanElement;
const batteryCountEl = document.getElementById('battery-count') as HTMLSpanElement;
const ammoDisplayEl = document.getElementById('ammo-display') as HTMLSpanElement;
const promptMsgEl = document.getElementById('prompt-msg') as HTMLDivElement;

// ── Core systems ──────────────────────────────────────────────────────────────
const renderer = new Renderer(canvas);
renderer.renderer.autoClear = false; // Required for 2-pass viewmodel depth clearing!

const scene = new Scene();
const viewmodelScene = new Scene();

const time = new Time();
const input = new Input(canvas);
const game = new Game();

// ── Fog & Background ──────────────────────────────────────────────────────────
scene.fog = new FogExp2(0x03090a, 0.017);
scene.background = new Color(0x03090a);

// ── Terrain ───────────────────────────────────────────────────────────────────
const terrain = new Terrain();
scene.add(terrain.getMesh());

// ── Sky & Lighting ────────────────────────────────────────────────────────────
const sky = new Sky(scene);

// ── Ground Mist ───────────────────────────────────────────────────────────────
const groundMist = new GroundMist(scene);

// ── Forest (culling <= 88m default) ───────────────────────────────────────────
console.log('[Forest] Building instanced trees and forest clutter...');
const forest = new Forest(terrain, 2200);
for (const mesh of forest.getMeshes()) {
  scene.add(mesh);
}
console.log('[Forest] Done.');

// ── Player & Camera ───────────────────────────────────────────────────────────
const player = new PlayerController(input, terrain);
scene.add(player.getObject());
player.getObject().position.set(0, terrain.getHeight(0, 0) + 1.75, 0);

// ── Flashlight (Decoupled from weapon, smoothed camera lag) ───────────────────
const flashlight = new Flashlight(player.camera, scene);

// ── Viewmodel Rig (Weapon + Left Arm/Hand + Wrist Device) ─────────────────────
// Attached to its own isolated viewmodelScene, rendered with autoClear=false + clearDepth()
const viewmodel = new ViewmodelRig();
viewmodelScene.add(viewmodel.group);

// Dedicated input states
let rKeyHeldDuration = 0;
let rKeyTriggeredHold = false;

// ── Quality Toggle Functionality ──────────────────────────────────────────────
function updateQualityUI(preset: string): void {
  qualityToggleEl.textContent = `QUALITY: ${preset.toUpperCase()}`;
  forest.setQuality(preset as 'low' | 'medium' | 'high');
}
qualityToggleEl.addEventListener('click', () => {
  const newQ = renderer.toggleQuality();
  updateQualityUI(newQ);
});

// ── F3 FPS toggle & Keyboard Shortcuts ────────────────────────────────────────
let showFps = true;
fpsEl.style.display = 'block';

window.addEventListener('keydown', e => {
  if (e.code === 'F3') {
    showFps = !showFps;
    fpsEl.style.display = showFps ? 'block' : 'none';
    e.preventDefault();
  }
  if (e.code === 'KeyK') {
    const newQ = renderer.toggleQuality();
    updateQualityUI(newQ);
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
  viewmodel.onResize();
});

// ── Game loop ─────────────────────────────────────────────────────────────────
let started = false;
renderer.renderer.setAnimationLoop((now: number) => {
  time.tick(now);

  if (!started) {
    started = true;
    game.transition('PLAYING');
  }

  // ── Input Handling (Slots, Firing, Aiming, Movement) ──────────────────────
  let mouseDelta = { x: 0, y: 0 };

  if (input.pointerLocked) {
    player.update(time.delta);
    mouseDelta = input.flushMouse();

    // Weapon slot selection: keys 1, 2, 3
    if (input.isJustPressed('Digit1')) viewmodel.setSlot(1);
    if (input.isJustPressed('Digit2')) viewmodel.setSlot(2);
    if (input.isJustPressed('Digit3')) viewmodel.setSlot(3);

    // Mouse wheel slot switching
    if (input.wheelDeltaY > 0) viewmodel.nextSlot();
    else if (input.wheelDeltaY < 0) viewmodel.prevSlot();

    // Toggle flashlight: [F]
    if (input.isJustPressed('KeyF')) {
      flashlight.toggle();
    }

    // Tap R for Gun Reload, Hold R (>= 0.45s) for Battery Swap
    if (input.isDown('KeyR')) {
      rKeyHeldDuration += time.delta;
      if (rKeyHeldDuration >= 0.45 && !rKeyTriggeredHold) {
        rKeyTriggeredHold = true;
        flashlight.startBatterySwap();
      }
    } else {
      if (rKeyHeldDuration > 0 && rKeyHeldDuration < 0.45 && !rKeyTriggeredHold) {
        viewmodel.startReload();
      }
      rKeyHeldDuration = 0;
      rKeyTriggeredHold = false;
    }

    // Fire weapon: [LMB]
    if (input.isMouseJustPressed(0)) {
      viewmodel.tryFire();
    }

    // Aim down sights (ADS): [RMB]
    viewmodel.setAiming(input.isMouseDown(2));
  } else {
    input.flushMouse();
  }

  // Clear single-frame triggers
  input.clearFrame();

  // ── Update Viewmodel Rig & Flashlight ────────────────────────────────────
  const isMoving = input.isDown('KeyW') || input.isDown('KeyS') || input.isDown('KeyA') || input.isDown('KeyD');
  viewmodel.update(time.delta, flashlight.battery, mouseDelta, isMoving, time.elapsed * 8);

  // Update flashlight (completely decoupled from gun recoil)
  flashlight.update(time.delta);

  // Crosshair visibility
  crosshairEl.style.opacity = viewmodel.isAiming || viewmodel.currentSlot !== 1 ? '0' : '0.45';

  // ── Update Slot & HUD Prompts ───────────────────────────────────────────
  if (viewmodel.currentSlot === 1) {
    slotDisplayEl.textContent = '[1] RIFLE';
    slotDisplayEl.style.color = '#38e078';
  } else if (viewmodel.currentSlot === 2) {
    slotDisplayEl.textContent = '[2] TORCH ONLY';
    slotDisplayEl.style.color = '#60a5fa';
  } else {
    slotDisplayEl.textContent = '[3] FLARE';
    slotDisplayEl.style.color = '#f59e0b';
  }

  ammoDisplayEl.textContent = `${viewmodel.ammoInMag} / ${viewmodel.reserveAmmo}`;

  if (viewmodel.isReloading) {
    promptMsgEl.textContent = 'Reloading weapon...';
    promptMsgEl.style.display = 'block';
  } else if (flashlight.isSwapping) {
    promptMsgEl.textContent = 'Swapping battery...';
    promptMsgEl.style.display = 'block';
  } else {
    promptMsgEl.style.display = 'none';
  }

  // Flashlight battery bar
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

  // ── Update World ─────────────────────────────────────────────────────────
  const pp = player.getObject().position;
  sky.update(time.elapsed, pp.x, pp.y, pp.z);
  groundMist.update(time.elapsed, pp.x, pp.z);
  forest.update(pp.x, pp.z);

  if (showFps) {
    fpsEl.textContent = `FPS: ${time.fps} | LIGHT: ${flashlight.isOn ? 'ON' : 'OFF'} | ${renderer.quality.toUpperCase()}`;
  }

  // ── Render Passes ────────────────────────────────────────────────────────
  // Pass 1: Render main world scene
  renderer.renderer.clear();
  renderer.renderer.render(scene, player.camera);

  // Pass 2: Clear depth buffer and render viewmodel rig (never clips into trees/walls)
  renderer.renderer.clearDepth();
  renderer.renderer.render(viewmodelScene, viewmodel.camera);
});
