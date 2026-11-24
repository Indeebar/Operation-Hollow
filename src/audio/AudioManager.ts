// src/audio/AudioManager.ts
import { Vector3 } from 'three/webgpu';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;

  // Master Gain & Fear Lowpass Filter
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  // Ambience loops
  private windGain: GainNode | null = null;
  private insectGain: GainNode | null = null;
  private owlTimer: number = 0;
  private creakTimer: number = 0;

  // Heartbeat layer
  private heartbeatGain: GainNode | null = null;
  private heartbeatTimer: number = 0;

  // Parameters
  masterVolume: number = 0.8;
  fearLevel: number = 0.0; // 0.0 to 1.0
  threatLevel: number = 0.0; // 0.0 to 1.0

  constructor() {
    // Audio Context will be started on the first user interaction
    const initAudio = () => {
      if (!this.isInitialized) {
        this.init();
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
      }
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
  }

  private init(): void {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Low-pass Filter that muffles audio as fear rises
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000; // wide open initially

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;

    this.masterFilter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Start Synthesized Ambience Loops
    this.startAmbience();

    this.isInitialized = true;
    console.log('[AudioManager] Audio initialized with Web Audio API ✓');
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx!.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // ── Ambience Synthesis ──────────────────────────────────────────────────
  private startAmbience(): void {
    if (!this.ctx || !this.masterFilter) return;

    // 1. Wind Ambience: Filtered Pink/Brownian Noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02; // brownian noise
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 380;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.45;

    windNoise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterFilter);
    windNoise.start();

    // 2. Night Insects (Crickets): Multi-frequency modulated oscillator
    const insectOsc = this.ctx.createOscillator();
    insectOsc.type = 'sine';
    insectOsc.frequency.value = 4600;

    const insectLfo = this.ctx.createOscillator();
    insectLfo.type = 'sawtooth';
    insectLfo.frequency.value = 14; // rapid insect chirp frequency

    const insectLfoGain = this.ctx.createGain();
    insectLfoGain.gain.value = 1800;
    insectLfo.connect(insectLfoGain);
    insectLfoGain.connect(insectOsc.frequency);

    const insectFilter = this.ctx.createBiquadFilter();
    insectFilter.type = 'bandpass';
    insectFilter.frequency.value = 4800;
    insectFilter.Q.value = 3.0;

    this.insectGain = this.ctx.createGain();
    this.insectGain.gain.value = 0.08;

    insectOsc.connect(insectFilter);
    insectFilter.connect(this.insectGain);
    this.insectGain.connect(this.masterFilter);

    insectOsc.start();
    insectLfo.start();

    // 3. Heartbeat Layer: Sub-bass double pulse
    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0;
    this.heartbeatGain.connect(this.masterFilter);
  }

  // Trigger synthesized distant owl screech / hoot
  playOwlCue(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(510, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(380, now + 1.1);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  // Trigger creaking pine wood
  playWoodCreak(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.4);
    osc.frequency.linearRampToValueAtTime(80, now + 0.85);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 4.0;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  // ── Sound Effects (SFX) ────────────────────────────────────────────────
  playFootstep(surface: 'dirt' | 'leaves', isSprinting: boolean, isCrouching: boolean): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;

    // Filtered noise burst
    const dur = isSprinting ? 0.12 : isCrouching ? 0.08 : 0.1;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.35));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = surface === 'leaves' ? 'bandpass' : 'lowpass';
    filter.frequency.value = surface === 'leaves' ? 1400 : 380;

    const gain = this.ctx.createGain();
    const vol = isSprinting ? 0.28 : isCrouching ? 0.08 : 0.18;
    gain.gain.setValueAtTime(vol, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);
    src.start(now);
  }

  playFlashlightClick(isOn: boolean): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 1800 : 1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playBatterySwap(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;

    // Mechanical latch & click sequence
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.setValueAtTime(900, now + 0.15);
    osc.frequency.setValueAtTime(600, now + 0.3);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playGunshot(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;

    // 1. Initial sharp crack
    const crackDur = 0.06;
    const crackBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * crackDur), this.ctx.sampleRate);
    const cd = crackBuffer.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1);

    const crackSrc = this.ctx.createBufferSource();
    crackSrc.buffer = crackBuffer;
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.85, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
    crackSrc.connect(crackGain);
    crackGain.connect(this.masterFilter);
    crackSrc.start(now);

    // 2. Heavy low-end thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    subOsc.connect(subGain);
    subGain.connect(this.masterFilter);
    subOsc.start(now);
    subOsc.stop(now + 0.45);

    // 3. Long Forest Reverb Tail (~2.2s decay)
    const tailDur = 2.2;
    const tailBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * tailDur), this.ctx.sampleRate);
    const td = tailBuffer.getChannelData(0);
    for (let i = 0; i < td.length; i++) {
      td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.45));
    }
    const tailSrc = this.ctx.createBufferSource();
    tailSrc.buffer = tailBuffer;

    const tailFilter = this.ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.setValueAtTime(900, now);
    tailFilter.frequency.exponentialRampToValueAtTime(120, now + tailDur);

    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime(0.45, now);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + tailDur);

    tailSrc.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(this.masterFilter);
    tailSrc.start(now);
  }

  playReload(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.setValueAtTime(540, now + 0.2);
    osc.frequency.setValueAtTime(320, now + 0.45);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playInteract(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // ── 3D Positional Audio Helper (For Watcher, Radio, Lanterns) ──────────
  createPositionalSource(pos: Vector3, playerPos: Vector3): PannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3;
    panner.maxDistance = 60;
    panner.rolloffFactor = 1.2;

    panner.positionX.value = pos.x - playerPos.x;
    panner.positionY.value = pos.y - playerPos.y;
    panner.positionZ.value = pos.z - playerPos.z;

    return panner;
  }

  // ── Dynamic Updates (Fear & Threat) ──────────────────────────────────
  update(dt: number, fear: number, threat: number): void {
    if (!this.ctx || !this.isInitialized) return;
    this.fearLevel = fear;
    this.threatLevel = threat;

    const now = this.ctx.currentTime;

    // 1. Master Low-Pass Filter: as fear increases (0 to 1), muffle audio from 20000Hz down to 600Hz
    if (this.masterFilter) {
      const targetFreq = 20000 * Math.pow(0.03, fear); // 20kHz down to 600Hz
      this.masterFilter.frequency.setTargetAtTime(Math.max(450, targetFreq), now, 0.2);
    }

    // 2. Silence = Danger: Insects fade completely out as threat rises
    if (this.insectGain) {
      const targetInsectVol = Math.max(0, 0.08 * (1.0 - threat * 1.3));
      this.insectGain.gain.setTargetAtTime(targetInsectVol, now, 0.3);
    }

    // 3. Heartbeat Layer: at high fear (>0.4), pulse sub-bass heartbeat
    if (fear > 0.4) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = Math.max(0.45, 0.9 - fear * 0.4); // faster pulse when terrified
        this.triggerHeartbeat();
      }
    }

    // Random forest environmental cues
    this.owlTimer += dt;
    if (this.owlTimer > 28 + Math.random() * 20) {
      this.owlTimer = 0;
      if (threat < 0.3) this.playOwlCue();
    }

    this.creakTimer += dt;
    if (this.creakTimer > 18 + Math.random() * 15) {
      this.creakTimer = 0;
      this.playWoodCreak();
    }
  }

  private triggerHeartbeat(): void {
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;

    // Double thump (lub-dub)
    const playThump = (timeOffset: number, freq: number, vol: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(32, now + timeOffset + 0.14);

      gain.gain.setValueAtTime(vol * this.fearLevel, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.18);

      osc.connect(gain);
      gain.connect(this.masterFilter!);
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.2);
    };

    playThump(0, 85, 0.65);
    playThump(0.14, 70, 0.45);
  }
}
