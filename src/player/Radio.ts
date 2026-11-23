// src/player/Radio.ts
import {
  Group,
  Mesh,
  BoxGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  PointLight,
  Color,
} from 'three/webgpu';

export class Radio {
  group: Group;
  private screenCanvas: HTMLCanvasElement;
  private screenCtx: CanvasRenderingContext2D;
  private screenTexture: CanvasTexture;
  private screenLight: PointLight;

  // Tracked states
  private lastBattery: number = -1;
  private lastAmmo: number = -1;
  private lastReserve: number = -1;
  private lastThreat: number = -1;
  threatLevel: number = 0.15; // 0.0 to 1.0 (rises when Watcher is near)

  constructor() {
    this.group = new Group();

    // ── Wrist Band / Arm Mount ──────────────────────────────────────────
    // Dark matte tactical fabric/polymer
    const strapGeo = new BoxGeometry(0.08, 0.05, 0.09);
    const strapMat = new MeshStandardMaterial({
      color: new Color(0x111618),
      roughness: 0.9,
      metalness: 0.1,
    });
    const strap = new Mesh(strapGeo, strapMat);
    this.group.add(strap);

    // ── Device Casing ───────────────────────────────────────────────────
    // Rugged tracker casing with beveled bevel/frame
    const caseGeo = new BoxGeometry(0.072, 0.025, 0.076);
    caseGeo.translate(0, 0.026, 0);
    const caseMat = new MeshStandardMaterial({
      color: new Color(0x1a2124),
      roughness: 0.75,
      metalness: 0.35,
    });
    const casing = new Mesh(caseGeo, caseMat);
    this.group.add(casing);

    // ── Screen Surface & Canvas Texture ─────────────────────────────────
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 128;
    this.screenCanvas.height = 128;
    this.screenCtx = this.screenCanvas.getContext('2d')!;

    this.screenTexture = new CanvasTexture(this.screenCanvas);

    const screenGeo = new PlaneGeometry(0.052, 0.056);
    screenGeo.rotateX(-Math.PI / 2);
    screenGeo.translate(0, 0.039, 0);

    const screenMat = new MeshBasicMaterial({
      map: this.screenTexture,
    });
    const screenMesh = new Mesh(screenGeo, screenMat);
    this.group.add(screenMesh);

    // ── Green Ambient Glow Light ────────────────────────────────────────
    // Faint atmospheric green light cast onto the hand / weapon
    this.screenLight = new PointLight(0x38e078, 0.35, 0.6);
    this.screenLight.position.set(0, 0.07, 0);
    this.group.add(this.screenLight);

    // Position radio in view at lower-left of screen
    this.group.position.set(-0.24, -0.19, -0.38);
    this.group.rotation.set(0.38, 0.52, -0.22);

    this.drawScreen(100, 20, 40, this.threatLevel);
  }

  private drawScreen(battery: number, ammo: number, reserve: number, threat: number): void {
    const ctx = this.screenCtx;

    // Dark military LCD green background
    ctx.fillStyle = '#051409';
    ctx.fillRect(0, 0, 128, 128);

    // Subtle CRT scanline effect
    ctx.fillStyle = 'rgba(0, 20, 5, 0.4)';
    for (let y = 0; y < 128; y += 4) {
      ctx.fillRect(0, y, 128, 2);
    }

    // Outer screen border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 120, 120);

    // Header: RAD-7 / TRACKER
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('HW-TRK // S7', 10, 18);

    // Battery readout
    ctx.font = '10px monospace';
    ctx.fillStyle = '#86efac';
    ctx.fillText(`PWR: ${Math.round(battery)}%`, 10, 34);

    // Ammo readout
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = ammo <= 5 ? '#f87171' : '#22c55e';
    ctx.fillText(`AMMO: ${ammo}/${reserve}`, 10, 54);

    // Proximity / Threat Noise Bar
    ctx.font = '10px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THREAT / PROX', 10, 74);

    // Threat bar background
    ctx.fillStyle = '#062610';
    ctx.fillRect(10, 80, 108, 14);
    ctx.strokeStyle = '#16a34a';
    ctx.strokeRect(10, 80, 108, 14);

    // Threat bar fill with color transition
    const threatWidth = Math.max(0, Math.min(108, Math.round(threat * 108)));
    ctx.fillStyle = threat > 0.7 ? '#ef4444' : threat > 0.4 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(11, 81, threatWidth, 12);

    // Radio signal pulse / audio wave line
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 110);
    for (let x = 10; x <= 118; x += 6) {
      const freq = threat * 12 + 2;
      const wave = Math.sin((x + Date.now() * 0.015) * 0.4) * (2 + threat * 6);
      ctx.lineTo(x, 110 + wave);
    }
    ctx.stroke();

    this.screenTexture.needsUpdate = true;
  }

  update(dt: number, battery: number, ammo: number, reserve: number): void {
    // Pulse threat slightly or update if changed
    const threat = this.threatLevel;

    // Redraw screen when values change or periodically for animated wave
    this.drawScreen(battery, ammo, reserve, threat);

    // Light intensity pulses with threat
    this.screenLight.intensity = 0.3 + threat * 0.45;
  }
}
