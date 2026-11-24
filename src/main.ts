import {
  Scene,
  FogExp2,
  Color,
} from 'three/webgpu';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { GroundMist } from './render/GroundMist';
import { PostFX } from './render/PostFX';
import { AudioManager } from './audio/AudioManager';
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

// Debug panel refs
const debugPanel = document.getElementById('debug-panel') as HTMLDivElement;
const dbgFpsLive = document.getElementById('dbg-fps-live') as HTMLSpanElement;
const dbgPostfxMaster = document.getElementById('dbg-postfx-master') as HTMLInputElement;
const dbgBloom = document.getElementById('dbg-bloom') as HTMLInputElement;
const dbgVignette = document.getElementById('dbg-vignette') as HTMLInputElement;
const dbgGrain = document.getElementById('dbg-grain') as HTMLInputElement;
const dbgChromatic = document.getElementById('dbg-chromatic') as HTMLInputElement;
const dbgGrading = document.getElementById('dbg-grading') as HTMLInputElement;
const dbgFearSlider = document.getElementById('dbg-fear-slider') as HTMLInputElement;
const dbgFearVal = document.getElementById('dbg-fear-val') as HTMLSpanElement;

const dbgMoonShadow = document.getElementById('dbg-moon-shadow') as HTMLInputElement;
const dbgTorchShadow = document.getElementById('dbg-torch-shadow') as HTMLInputElement;
const dbgMist = document.getElementById('dbg-mist') as HTMLInputElement;
const dbgClutter = document.getElementById('dbg-clutter') as HTMLInputElement;
const dbgViewmodelPass = document.getElementById('dbg-viewmodel-pass') as HTMLInputElement;
const dbgPr10 = document.getElementById('dbg-pr-10') as HTMLButtonElement;
const dbgPr125 = document.getElementById('dbg-pr-125') as HTMLButtonElement;
const dbgPr15 = document.getElementById('dbg-pr-15') as HTMLButtonElement;

// Pause Menu refs
const pauseMenu = document.getElementById('pause-menu') as HTMLDivElement;
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const volumeVal = document.getElementById('volume-val') as HTMLSpanElement;
const muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;
const resumeBtn = document.getElementById('resume-btn') as HTMLButtonElement;

// ── Core systems ──────────────────────────────────────────────────────────────
const renderer = new Renderer(canvas);
renderer.renderer.autoClear = false;

const scene = new Scene();
const viewmodelScene = new Scene();

const time = new Time();
const input = new Input(canvas);
const game = new Game();
const audio = new AudioManager();

// ── Fog & Background ──────────────────────────────────────────────────────────
scene.fog = new FogExp2(0x03090a, 0.017);
scene.background = new Color(0x03090a);

// ── Terrain ───────────────────────────────────────────────────────────────────
const terrain = new Terrain();
scene.add(terrain.getMesh());

// ── Sky & Lighting ────────────────────────────────────────────────────────────
const sky = new Sky(scene);

// ── Ground Mist (2 layers) ────────────────────────────────────────────────────
const groundMist = new GroundMist(scene);

// ── Forest (Tree LODs, 25m shadow cutoff, <=88m culling) ─────────────────────
console.log('[Forest] Building instanced trees with near/far LODs...');
const forest = new Forest(terrain, 2000);
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

// ── Viewmodel Rig ─────────────────────────────────────────────────────────────
const viewmodel = new ViewmodelRig();
viewmodelScene.add(viewmodel.group);

// ── Post Processing Pipeline (Milestone M6) ───────────────────────────────────
const postFX = new PostFX(renderer.renderer, scene, player.camera);

// ── Dynamic Game States ───────────────────────────────────────────────────────
let rKeyHeldDuration = 0;
let rKeyTriggeredHold = false;
let renderViewmodelPass = true;
let enablePostFXMaster = true;
let isPaused = false;
let fearLevel = 0.0;
let threatLevel = 0.15;
let footstepTimer = 0.0;

// ── Quality Settings ──────────────────────────────────────────────────────────
function updateQualityUI(preset: string): void {
  qualityToggleEl.textContent = `QUALITY: ${preset.toUpperCase()}`;
  forest.setQuality(preset as 'low' | 'medium' | 'high');
  postFX.setQuality(preset as 'low' | 'medium' | 'high');

  // Sync checkboxes
  dbgBloom.checked = postFX.enableBloom;
  dbgChromatic.checked = postFX.enableChromatic;
  dbgGrading.checked = postFX.enableGrading;
  dbgVignette.checked = postFX.enableVignette;
  dbgGrain.checked = postFX.enableGrain;
}
qualityToggleEl.addEventListener('click', () => {
  const newQ = renderer.toggleQuality();
  updateQualityUI(newQ);
});

// ── Pause Menu & Audio Controls ───────────────────────────────────────────────
function setPaused(paused: boolean): void {
  isPaused = paused;
  pauseMenu.style.display = isPaused ? 'flex' : 'none';
  if (isPaused) {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

volumeSlider.addEventListener('input', () => {
  const v = parseFloat(volumeSlider.value);
  audio.setVolume(v);
  volumeVal.textContent = `${Math.round(v * 100)}%`;
});

muteBtn.addEventListener('click', () => {
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? 'Unmute Audio [M]' : 'Mute Audio [M]';
});

resumeBtn.addEventListener('click', () => {
  setPaused(false);
  canvas.requestPointerLock();
});

// ── F4 Debug Panel Setup & Toggles ───────────────────────────────────────────
let debugOpen = false;
function toggleDebugPanel(): void {
  debugOpen = !debugOpen;
  debugPanel.style.display = debugOpen ? 'flex' : 'none';
}

dbgPostfxMaster.addEventListener('change', () => {
  enablePostFXMaster = dbgPostfxMaster.checked;
});
dbgBloom.addEventListener('change', () => {
  postFX.setBloomEnabled(dbgBloom.checked);
});
dbgVignette.addEventListener('change', () => {
  postFX.setVignetteEnabled(dbgVignette.checked);
});
dbgGrain.addEventListener('change', () => {
  postFX.setGrainEnabled(dbgGrain.checked);
});
dbgChromatic.addEventListener('change', () => {
  postFX.setChromaticEnabled(dbgChromatic.checked);
});
dbgGrading.addEventListener('change', () => {
  postFX.setGradingEnabled(dbgGrading.checked);
});

dbgFearSlider.addEventListener('input', () => {
  fearLevel = parseFloat(dbgFearSlider.value);
  dbgFearVal.textContent = fearLevel.toFixed(2);
});

dbgMoonShadow.addEventListener('change', () => {
  sky.setMoonShadow(dbgMoonShadow.checked);
});
dbgTorchShadow.addEventListener('change', () => {
  flashlight.setShadow(dbgTorchShadow.checked);
});
dbgMist.addEventListener('change', () => {
  groundMist.setVisible(dbgMist.checked);
});
dbgClutter.addEventListener('change', () => {
  forest.setClutterVisible(dbgClutter.checked);
});
dbgViewmodelPass.addEventListener('change', () => {
  renderViewmodelPass = dbgViewmodelPass.checked;
});

dbgPr10.addEventListener('click', () => {
  renderer.renderer.setPixelRatio(1.0);
  renderer.renderer.setSize(window.innerWidth, window.innerHeight);
});
dbgPr125.addEventListener('click', () => {
  renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.renderer.setSize(window.innerWidth, window.innerHeight);
});
dbgPr15.addEventListener('click', () => {
  renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Key Listeners ─────────────────────────────────────────────────────────────
let showFps = true;
fpsEl.style.display = 'block';

window.addEventListener('keydown', e => {
  if (e.code === 'F3') {
    showFps = !showFps;
    fpsEl.style.display = showFps ? 'block' : 'none';
    e.preventDefault();
  }
  if (e.code === 'F4') {
    toggleDebugPanel();
    e.preventDefault();
  }
  if (e.code === 'KeyK') {
    const newQ = renderer.toggleQuality();
    updateQualityUI(newQ);
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    muteBtn.textContent = muted ? 'Unmute Audio [M]' : 'Mute Audio [M]';
  }
  if (e.code === 'Escape') {
    setPaused(!isPaused);
    e.preventDefault();
  }
});

// ── Pointer lock UI ───────────────────────────────────────────────────────────
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  infoEl.style.display = locked ? 'none' : 'block';
  if (!locked && !debugOpen && !isPaused) {
    // If lost focus not by debug or pause, show click hint
  }
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
  const isMoving = input.isDown('KeyW') || input.isDown('KeyS') || input.isDown('KeyA') || input.isDown('KeyD');
  const isSprinting = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && isMoving;
  const isCrouching = input.isDown('ControlLeft') || input.isDown('KeyC');

  if (input.pointerLocked && !isPaused) {
    player.update(time.delta);
    mouseDelta = input.flushMouse();

    // Weapon slot selection: keys 1, 2, 3
    if (input.isJustPressed('Digit1')) {
      viewmodel.setSlot(1);
      audio.playInteract();
    }
    if (input.isJustPressed('Digit2')) {
      viewmodel.setSlot(2);
      audio.playInteract();
    }
    if (input.isJustPressed('Digit3')) {
      viewmodel.setSlot(3);
      audio.playInteract();
    }

    // Mouse wheel slot switching
    if (input.wheelDeltaY > 0) {
      viewmodel.nextSlot();
      audio.playInteract();
    } else if (input.wheelDeltaY < 0) {
      viewmodel.prevSlot();
      audio.playInteract();
    }

    // Toggle flashlight: [F]
    if (input.isJustPressed('KeyF')) {
      flashlight.toggle();
      audio.playFlashlightClick(flashlight.isOn);
    }

    // Tap R for Gun Reload, Hold R (>= 0.45s) for Battery Swap
    if (input.isDown('KeyR')) {
      rKeyHeldDuration += time.delta;
      if (rKeyHeldDuration >= 0.45 && !rKeyTriggeredHold) {
        rKeyTriggeredHold = true;
        flashlight.startBatterySwap();
        audio.playBatterySwap();
      }
    } else {
      if (rKeyHeldDuration > 0 && rKeyHeldDuration < 0.45 && !rKeyTriggeredHold) {
        if (viewmodel.ammoInMag < viewmodel.magCapacity && viewmodel.reserveAmmo > 0) {
          viewmodel.startReload();
          audio.playReload();
        }
      }
      rKeyHeldDuration = 0;
      rKeyTriggeredHold = false;
    }

    // Fire weapon: [LMB]
    if (input.isMouseJustPressed(0)) {
      if (viewmodel.tryFire()) {
        audio.playGunshot();
      }
    }

    // Aim down sights (ADS): [RMB]
    viewmodel.setAiming(input.isMouseDown(2));

    // Footstep audio trigger
    if (isMoving) {
      const stepInterval = isSprinting ? 0.32 : isCrouching ? 0.65 : 0.48;
      footstepTimer += time.delta;
      if (footstepTimer >= stepInterval) {
        footstepTimer = 0;
        audio.playFootstep('dirt', isSprinting, isCrouching);
      }
    } else {
      footstepTimer = 0;
    }
  } else {
    input.flushMouse();
  }

  input.clearFrame();

  // ── Update Audio & PostFX Dynamic States ─────────────────────────────────
  audio.update(time.delta, fearLevel, threatLevel);
  postFX.update(time.delta, fearLevel);

  // ── Update Viewmodel Rig & Flashlight ────────────────────────────────────
  viewmodel.update(time.delta, flashlight.battery, mouseDelta, isMoving, time.elapsed * 8);
  flashlight.update(time.delta);

  // Crosshair visibility
  crosshairEl.style.opacity = viewmodel.isAiming || viewmodel.currentSlot !== 1 ? '0' : '0.45';

  // HUD Slot display
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
  if (debugOpen) {
    dbgFpsLive.textContent = `${time.fps} FPS`;
  }

  // ── Render Passes ────────────────────────────────────────────────────────
  // Main World Pass: Render either via PostProcessing Pipeline or standard render
  if (enablePostFXMaster) {
    postFX.render();
  } else {
    renderer.renderer.clear();
    renderer.renderer.render(scene, player.camera);
  }

  // Viewmodel Pass: Depth-cleared overlay on top of screen
  if (renderViewmodelPass) {
    renderer.renderer.clearDepth();
    renderer.renderer.render(viewmodelScene, viewmodel.camera);
  }
});
