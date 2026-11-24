// src/audio/AudioManager.ts
import { Vector3 } from 'three/webgpu';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;
  private isDisposed: boolean = false;

  // Master Gain & Fear Lowpass Filter
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  // Ambience loops (created once)
  private windSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private insectOsc: OscillatorNode | null = null;
  private insectLfo: OscillatorNode | null = null;
  private insectGain: GainNode | null = null;
  private owlTimer: number = 0;
  private creakTimer: number = 0;

  // Heartbeat layer
  private heartbeatTimer: number = 0;

  // Sound concurrency cap
  private activeSFXCount: number = 0;
  private readonly MAX_SIMULTANEOUS_SFX: number = 6;

  // Parameters
  masterVolume: number = 0.8;
  fearLevel: number = 0.0;
  threatLevel: number = 0.0;

  private cleanupListeners: (() => void) | null = null;

  constructor() {
    const initAudio = () => {
      if (!this.isInitialized && !this.isDisposed) {
        this.init();
        removeListeners();
      }
    };

    const removeListeners = () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    this.cleanupListeners = removeListeners;
  }

  private init(): void {
    if (this.isInitialized || this.isDisposed) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[AudioManager] Web Audio API not supported on this browser.');
        return;
      }
      this.ctx = new AudioContextClass();

      // Master Low-pass Filter that muffles audio as fear rises
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 20000;

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;

      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Start Synthesized Ambience Loops once
      this.startAmbience();

      this.isInitialized = true;
      console.log('[AudioManager] Audio initialized with Web Audio API ✓');
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  pause(): void {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend();
      } catch (e) {
        console.warn('[AudioManager] Pause error:', e);
      }
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {
        console.warn('[AudioManager] Resume error:', e);
      }
    }
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      try {
        this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
      } catch {
        this.masterGain.gain.value = this.masterVolume;
      }
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.masterVolume;
      try {
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      } catch {
        this.masterGain.gain.value = target;
      }
    }
    return this.isMuted;
  }

  // ── Ambience Synthesis ──────────────────────────────────────────────────
  private startAmbience(): void {
    if (!this.ctx || !this.masterFilter) return;

    try {
      // 1. Wind Ambience: Filtered Noise Buffer (created once)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 380;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.45;

      this.windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.masterFilter);
      this.windSource.start();

      // 2. Night Insects (Crickets): Multi-frequency modulated oscillator (created once)
      this.insectOsc = this.ctx.createOscillator();
      this.insectOsc.type = 'sine';
      this.insectOsc.frequency.value = 4600;

      this.insectLfo = this.ctx.createOscillator();
      this.insectLfo.type = 'sawtooth';
      this.insectLfo.frequency.value = 14;

      const insectLfoGain = this.ctx.createGain();
      insectLfoGain.gain.value = 1800;
      this.insectLfo.connect(insectLfoGain);
      insectLfoGain.connect(this.insectOsc.frequency);

      const insectFilter = this.ctx.createBiquadFilter();
      insectFilter.type = 'bandpass';
      insectFilter.frequency.value = 4800;
      insectFilter.Q.value = 3.0;

      this.insectGain = this.ctx.createGain();
      this.insectGain.gain.value = 0.08;

      this.insectOsc.connect(insectFilter);
      insectFilter.connect(this.insectGain);
      this.insectGain.connect(this.masterFilter);

      this.insectOsc.start();
      this.insectLfo.start();
    } catch (e) {
      console.warn('[AudioManager] Ambience synthesis failed:', e);
    }
  }

  private registerSFX(durationSec: number): boolean {
    if (this.activeSFXCount >= this.MAX_SIMULTANEOUS_SFX) {
      return false;
    }
    this.activeSFXCount++;
    setTimeout(() => {
      this.activeSFXCount = Math.max(0, this.activeSFXCount - 1);
    }, Math.ceil(durationSec * 1000) + 50);
    return true;
  }

  // Trigger synthesized distant owl screech / hoot
  playOwlCue(): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(1.2)) return;
    try {
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
    } catch {
      // Stay silent on error
    }
  }

  // Trigger creaking pine wood
  playWoodCreak(): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.9)) return;
    try {
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
    } catch {
      // Stay silent on error
    }
  }

  // ── Sound Effects (SFX) ────────────────────────────────────────────────
  playFootstep(surface: 'dirt' | 'leaves', isSprinting: boolean, isCrouching: boolean): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.15)) return;
    try {
      const now = this.ctx.currentTime;
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
    } catch {
      // Stay silent
    }
  }

  playFlashlightClick(isOn: boolean): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.06)) return;
    try {
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
    } catch {
      // Stay silent
    }
  }

  playBatterySwap(): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.45)) return;
    try {
      const now = this.ctx.currentTime;
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
    } catch {
      // Stay silent
    }
  }

  playGunshot(): void {
    if (!this.ctx || !this.masterFilter) return;
    this.registerSFX(2.2);
    try {
      const now = this.ctx.currentTime;

      // 1. Initial sharp crack
      const crackDur = 0.06;
      const crackBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * crackDur), this.ctx.sampleRate);
      const cd = crackBuffer.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;

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
    } catch {
      // Stay silent
    }
  }

  playReload(): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.6)) return;
    try {
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
    } catch {
      // Stay silent
    }
  }

  playInteract(): void {
    if (!this.ctx || !this.masterFilter || !this.registerSFX(0.15)) return;
    try {
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
    } catch {
      // Stay silent
    }
  }

  createPositionalSource(pos: Vector3, playerPos: Vector3): PannerNode | null {
    if (!this.ctx) return null;
    try {
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
    } catch {
      return null;
    }
  }

  update(dt: number, fear: number, threat: number): void {
    if (!this.ctx || !this.isInitialized || this.ctx.state !== 'running') return;
    this.fearLevel = fear;
    this.threatLevel = threat;

    const now = this.ctx.currentTime;

    try {
      // 1. Master Low-Pass Filter: as fear increases (0 to 1), muffle audio from 20000Hz down to 600Hz
      if (this.masterFilter) {
        const targetFreq = 20000 * Math.pow(0.03, fear);
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
          this.heartbeatTimer = Math.max(0.45, 0.9 - fear * 0.4);
          this.triggerHeartbeat();
        }
      }

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
    } catch {
      // Ignore audio update errors
    }
  }

  private triggerHeartbeat(): void {
    if (!this.ctx || !this.masterFilter) return;
    try {
      const now = this.ctx.currentTime;
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
    } catch {
      // Stay silent
    }
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }

    try {
      if (this.windSource) {
        this.windSource.stop();
        this.windSource.disconnect();
        this.windSource = null;
      }
      if (this.insectOsc) {
        this.insectOsc.stop();
        this.insectOsc.disconnect();
        this.insectOsc = null;
      }
      if (this.insectLfo) {
        this.insectLfo.stop();
        this.insectLfo.disconnect();
        this.insectLfo = null;
      }
      if (this.windGain) this.windGain.disconnect();
      if (this.insectGain) this.insectGain.disconnect();
      if (this.masterFilter) this.masterFilter.disconnect();
      if (this.masterGain) this.masterGain.disconnect();

      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close();
        this.ctx = null;
      }
    } catch (e) {
      console.warn('[AudioManager] Error during audio disposal:', e);
    }
    this.isInitialized = false;
    console.log('[AudioManager] Audio disposed cleanly.');
  }
}
