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

  threatLevel: number = 0.15; // 0.0 to 1.0 (rises when Watcher is near)

  constructor() {
    this.group = new Group();

    // ── Wrist Strap / Arm Mount ──────────────────────────────────────────
    const strapGeo = new BoxGeometry(0.065, 0.035, 0.08);
    const strapMat = new MeshStandardMaterial({
      color: new Color(0x0a0d0e),
      roughness: 0.9,
      metalness: 0.1,
    });
    const strap = new Mesh(strapGeo, strapMat);
    this.group.add(strap);

    // ── Tracker Casing ───────────────────────────────────────────────────
    const caseGeo = new BoxGeometry(0.055, 0.018, 0.065);
    caseGeo.translate(0, 0.018, 0);
    const caseMat = new MeshStandardMaterial({
      color: new Color(0x13181a),
      roughness: 0.8,
      metalness: 0.3,
    });
    const casing = new Mesh(caseGeo, caseMat);
    this.group.add(casing);

    // ── Screen Surface & Canvas Texture ─────────────────────────────────
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 128;
    this.screenCanvas.height = 128;
    this.screenCtx = this.screenCanvas.getContext('2d')!;

    this.screenTexture = new CanvasTexture(this.screenCanvas);

    // Screen lies on top face of casing (pointing UP in local coords)
    const screenGeo = new PlaneGeometry(0.042, 0.05);
    screenGeo.rotateX(-Math.PI / 2);
    screenGeo.translate(0, 0.028, 0);

    const screenMat = new MeshBasicMaterial({
      map: this.screenTexture,
    });
    const screenMesh = new Mesh(screenGeo, screenMat);
    this.group.add(screenMesh);

    // ── Green Ambient Glow Light ────────────────────────────────────────
    this.screenLight = new PointLight(0x22c55e, 0.25, 0.4);
    this.screenLight.position.set(0, 0.05, 0);
    this.group.add(this.screenLight);

    // ── Position on Left Forearm in View ─────────────────────────────────
    // Screen tilted ~40° towards player's eyes so text is readable and flat to view
    this.group.position.set(-0.25, -0.22, -0.42);
    this.group.rotation.set(0.65, 0.35, -0.15);

    this.drawScreen(100, 20, 40, this.threatLevel);
  }

  private drawScreen(battery: number, ammo: number, reserve: number, threat: number): void {
    const ctx = this.screenCtx;

    // Dark military LCD green background
    ctx.fillStyle = '#030d06';
    ctx.fillRect(0, 0, 128, 128);

    // Subtle CRT scanline effect
    ctx.fillStyle = 'rgba(0, 15, 5, 0.45)';
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
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = ammo <= 5 ? '#f87171' : '#22c55e';
    ctx.fillText(`AMMO: ${ammo}/${reserve}`, 10, 52);

    // Proximity / Threat Noise Bar
    ctx.font = '9px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THREAT / PROX', 10, 72);

    // Threat bar background
    ctx.fillStyle = '#04180b';
    ctx.fillRect(10, 78, 108, 14);
    ctx.strokeStyle = '#16a34a';
    ctx.strokeRect(10, 78, 108, 14);

    // Threat bar fill
    const threatWidth = Math.max(0, Math.min(108, Math.round(threat * 108)));
    ctx.fillStyle = threat > 0.7 ? '#ef4444' : threat > 0.4 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(11, 79, threatWidth, 12);

    // Radio signal pulse / audio wave line
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 110);
    for (let x = 10; x <= 118; x += 6) {
      const wave = Math.sin((x + Date.now() * 0.015) * 0.4) * (2 + threat * 6);
      ctx.lineTo(x, 110 + wave);
    }
    ctx.stroke();

    this.screenTexture.needsUpdate = true;
  }

  update(dt: number, battery: number, ammo: number, reserve: number): void {
    this.drawScreen(battery, ammo, reserve, this.threatLevel);
    this.screenLight.intensity = 0.2 + this.threatLevel * 0.35;
  }
}
