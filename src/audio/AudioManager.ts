// src/audio/AudioManager.ts
import { Vector3 } from 'three/webgpu';

let audioContextGlobalCounter = 0;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;
  private isDisposed: boolean = false;

  // Master bus nodes
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  // Layer gain nodes & sources
  private windSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windLfoOsc: OscillatorNode | null = null;
  private windLfoGain: GainNode | null = null;

  // Tension drone (silent at fear = 0)
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Timers for episodic ambience
  private insectTimer: number = 0;
  private owlTimer: number = 0;
  private creakTimer: number = 0;
  private heartbeatTimer: number = 0;

  // Concurrency limiter
  private activeSFXCount: number = 0;
  private readonly MAX_SIMULTANEOUS_SFX: number = 6;

  // Parameters
  masterVolume: number = 0.5; // Kept gentle and non-fatiguing
  fearLevel: number = 0.0;
  threatLevel: number = 0.0;

  // F4 Audio Debug Layer Toggles
  enableWind: boolean = true;
  enableInsects: boolean = true;
  enableOwl: boolean = true;
  enableCreaks: boolean = true;
  enableDrone: boolean = true;
  enableHeartbeat: boolean = true;
  enableFootsteps: boolean = true;
  enableSFX: boolean = true;

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
        console.warn('[AudioManager] Web Audio API not supported.');
        return;
      }

      this.ctx = new AudioContextClass();
      audioContextGlobalCounter++;
      console.log(`[AudioManager] Exactly 1 AudioContext created (Instance #${audioContextGlobalCounter}, state: ${this.ctx.state}) ✓`);

      // ── Master Bus Chain: MasterFilter -> DynamicsCompressor -> MasterGain -> Destination
      // 1. Gentle low-pass on master (~9 kHz, Q = 0.707)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 9000;
      this.masterFilter.Q.value = 0.707; // Butterworth gentle roll-off

      // 2. Dynamics Compressor for clean, glued, non-harsh dynamics
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -24;
      this.masterCompressor.knee.value = 30;
      this.masterCompressor.ratio.value = 8;
      this.masterCompressor.attack.value = 0.003;
      this.masterCompressor.release.value = 0.25;

      // 3. Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;

      // Connect master bus
      this.masterFilter.connect(this.masterCompressor);
      this.masterCompressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Start continuous ambient layers (only wind & fear drone; NO continuous high-freq oscillators)
      this.startWindAmbience();
      this.startDroneAmbience();

      this.isInitialized = true;
      console.log('[AudioManager] Master audio bus setup complete ✓');
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  // ── Wind Ambience (Broadband low-Q filtered brownian noise + slow LFO) ─────
  private startWindAmbience(): void {
    if (!this.ctx || !this.masterFilter) return;

    try {
      // 2-second looping soft Brownian noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 2.0; // gentle level
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      // Filter: Very gentle lowpass at 280 Hz with low Q (0.5, well below 1)
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 280;
      windFilter.Q.value = 0.5; // low Q, no resonance peaks

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = this.enableWind ? 0.22 : 0;

      // Slow organic gain swell (0.12 Hz LFO)
      this.windLfoOsc = this.ctx.createOscillator();
      this.windLfoOsc.type = 'sine';
      this.windLfoOsc.frequency.value = 0.12;

      this.windLfoGain = this.ctx.createGain();
      this.windLfoGain.gain.value = 0.06;

      this.windLfoOsc.connect(this.windLfoGain);
      this.windLfoGain.connect(this.windGain.gain);

      this.windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.masterFilter);

      this.windSource.start();
      this.windLfoOsc.start();
    } catch (e) {
      console.warn('[AudioManager] Wind setup failed:', e);
    }
  }

  // ── Tension Drone (Low Sub rumble, SILENT at fear = 0) ────────────────────
  private startDroneAmbience(): void {
    if (!this.ctx || !this.masterFilter) return;

    try {
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.value = 52; // Warm 52 Hz sub-bass hum

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0; // 100% silent at 0 fear

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.masterFilter);
      this.droneOsc.start();
    } catch (e) {
      console.warn('[AudioManager] Drone setup failed:', e);
    }
  }

  // ── Insects / Crickets: Amplitude-Modulated Bursts with Gaps ──────────────
  // Triggered on random intervals, NOT a continuous oscillator
  triggerCricketChirpCluster(): void {
    if (!this.ctx || !this.masterFilter || !this.enableInsects || !this.registerSFX(0.8)) return;
    try {
      const now = this.ctx.currentTime;
      const numChirps = 2 + Math.floor(Math.random() * 2); // 2 to 3 micro-chirps

      for (let i = 0; i < numChirps; i++) {
        const chirpStart = now + i * 0.08;
        const dur = 0.045;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; // triangle has softer harmonics than sine/sawtooth
        const baseFreq = 4200 + Math.random() * 300;
        osc.frequency.setValueAtTime(baseFreq, chirpStart);
        osc.frequency.linearRampToValueAtTime(baseFreq - 400, chirpStart + dur);

        // Amplitude envelope: quick attack, fast decay to absolute zero
        gain.gain.setValueAtTime(0, chirpStart);
        gain.gain.linearRampToValueAtTime(0.04, chirpStart + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, chirpStart + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4100;
        filter.Q.value = 1.0; // low Q, no ringing

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterFilter);

        osc.start(chirpStart);
        osc.stop(chirpStart + dur + 0.01);
      }
    } catch {
      // Ignore audio synthesis errors
    }
  }

  // ── Distant Owl ──────────────────────────────────────────────────────────
  playOwlCue(): void {
    if (!this.ctx || !this.masterFilter || !this.enableOwl || !this.registerSFX(1.2)) return;
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
      gain.gain.linearRampToValueAtTime(0.04, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.masterFilter);
      osc.start(now);
      osc.stop(now + 1.2);
    } catch {
      // Stay silent
    }
  }

  // ── Pine Wood Creak ──────────────────────────────────────────────────────
  playWoodCreak(): void {
    if (!this.ctx || !this.masterFilter || !this.enableCreaks || !this.registerSFX(0.9)) return;
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
      filter.Q.value = 1.5;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterFilter);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {
      // Stay silent
    }
  }

  // ── Footsteps ────────────────────────────────────────────────────────────
  playFootstep(surface: 'dirt' | 'leaves', isSprinting: boolean, isCrouching: boolean): void {
    if (!this.ctx || !this.masterFilter || !this.enableFootsteps || !this.registerSFX(0.15)) return;
    try {
      const now = this.ctx.currentTime;
      const dur = isSprinting ? 0.11 : isCrouching ? 0.07 : 0.09;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const d = buffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.35));
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = surface === 'leaves' ? 'bandpass' : 'lowpass';
      filter.frequency.value = surface === 'leaves' ? 1200 : 340;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      const vol = isSprinting ? 0.22 : isCrouching ? 0.06 : 0.14;
      gain.gain.setValueAtTime(vol, now);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterFilter);
      src.start(now);
    } catch {
      // Stay silent
    }
  }

  // ── Tactical SFX ─────────────────────────────────────────────────────────
  playFlashlightClick(isOn: boolean): void {
    if (!this.ctx || !this.masterFilter || !this.enableSFX || !this.registerSFX(0.06)) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isOn ? 1600 : 1100, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
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
    if (!this.ctx || !this.masterFilter || !this.enableSFX || !this.registerSFX(0.45)) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.setValueAtTime(780, now + 0.15);
      osc.frequency.setValueAtTime(540, now + 0.3);

      gain.gain.setValueAtTime(0.08, now);
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
    if (!this.ctx || !this.masterFilter || !this.enableSFX) return;
    this.registerSFX(2.0);
    try {
      const now = this.ctx.currentTime;

      // 1. Initial crack
      const crackDur = 0.05;
      const crackBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * crackDur), this.ctx.sampleRate);
      const cd = crackBuffer.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;

      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = crackBuffer;
      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.7, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
      crackSrc.connect(crackGain);
      crackGain.connect(this.masterFilter);
      crackSrc.start(now);

      // 2. Heavy low-end thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(130, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

      subGain.gain.setValueAtTime(0.75, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      subOsc.connect(subGain);
      subGain.connect(this.masterFilter);
      subOsc.start(now);
      subOsc.stop(now + 0.45);

      // 3. Forest Reverb Tail (~2.0s decay)
      const tailDur = 2.0;
      const tailBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * tailDur), this.ctx.sampleRate);
      const td = tailBuffer.getChannelData(0);
      for (let i = 0; i < td.length; i++) {
        td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.45));
      }
      const tailSrc = this.ctx.createBufferSource();
      tailSrc.buffer = tailBuffer;

      const tailFilter = this.ctx.createBiquadFilter();
      tailFilter.type = 'lowpass';
      tailFilter.frequency.setValueAtTime(800, now);
      tailFilter.frequency.exponentialRampToValueAtTime(100, now + tailDur);
      tailFilter.Q.value = 0.6;

      const tailGain = this.ctx.createGain();
      tailGain.gain.setValueAtTime(0.35, now);
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
    if (!this.ctx || !this.masterFilter || !this.enableSFX || !this.registerSFX(0.55)) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(480, now + 0.18);
      osc.frequency.setValueAtTime(300, now + 0.4);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.masterFilter);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Stay silent
    }
  }

  playInteract(): void {
    if (!this.ctx || !this.masterFilter || !this.enableSFX || !this.registerSFX(0.15)) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(840, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
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

  // ── Dynamic Updates (Fear & Threat) ──────────────────────────────────────
  update(dt: number, fear: number, threat: number): void {
    if (!this.ctx || !this.isInitialized || this.ctx.state !== 'running') return;
    this.fearLevel = fear;
    this.threatLevel = threat;

    const now = this.ctx.currentTime;

    try {
      // 1. Master Low-Pass Filter: gentle lowpass (9 kHz at fear 0 down to 600 Hz at fear 1)
      if (this.masterFilter) {
        const targetFreq = 9000 * Math.pow(0.065, fear);
        this.masterFilter.frequency.setTargetAtTime(Math.max(450, targetFreq), now, 0.2);
      }

      // 2. Drone volume tied directly to fear (silent at 0 fear)
      if (this.droneGain) {
        const targetDrone = this.enableDrone && fear > 0.1 ? (fear - 0.1) * 0.18 : 0;
        this.droneGain.gain.setTargetAtTime(targetDrone, now, 0.3);
      }

      // 3. Heartbeat Layer: only at high fear (>0.4)
      if (this.enableHeartbeat && fear > 0.4) {
        this.heartbeatTimer -= dt;
        if (this.heartbeatTimer <= 0) {
          this.heartbeatTimer = Math.max(0.45, 0.9 - fear * 0.4);
          this.triggerHeartbeat();
        }
      }

      // 4. Insects: trigger short intermittent chirp clusters with gaps
      this.insectTimer += dt;
      if (this.insectTimer > 2.5 + Math.random() * 3.5) {
        this.insectTimer = 0;
        // Insects silence when threat is high
        if (threat < 0.35) {
          this.triggerCricketChirpCluster();
        }
      }

      // 5. Environmental cues (Owl & Creaks) on timers
      this.owlTimer += dt;
      if (this.owlTimer > 30 + Math.random() * 25) {
        this.owlTimer = 0;
        if (threat < 0.3) this.playOwlCue();
      }

      this.creakTimer += dt;
      if (this.creakTimer > 20 + Math.random() * 18) {
        this.creakTimer = 0;
        this.playWoodCreak();
      }
    } catch {
      // Ignore audio update errors
    }
  }

  private triggerHeartbeat(): void {
    if (!this.ctx || !this.masterFilter || !this.enableHeartbeat) return;
    try {
      const now = this.ctx.currentTime;
      const playThump = (timeOffset: number, freq: number, vol: number) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        osc.frequency.exponentialRampToValueAtTime(30, now + timeOffset + 0.14);

        gain.gain.setValueAtTime(vol * this.fearLevel, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.18);

        osc.connect(gain);
        gain.connect(this.masterFilter!);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.2);
      };

      playThump(0, 80, 0.5);
      playThump(0.14, 65, 0.35);
    } catch {
      // Stay silent
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

  // ── Layer Control Methods for F4 Debug Panel ─────────────────────────────
  setLayerEnabled(layer: string, enabled: boolean): void {
    switch (layer) {
      case 'wind':
        this.enableWind = enabled;
        if (this.windGain && this.ctx) {
          this.windGain.gain.setTargetAtTime(enabled ? 0.22 : 0, this.ctx.currentTime, 0.05);
        }
        break;
      case 'insects':
        this.enableInsects = enabled;
        break;
      case 'owl':
        this.enableOwl = enabled;
        break;
      case 'creaks':
        this.enableCreaks = enabled;
        break;
      case 'drone':
        this.enableDrone = enabled;
        if (this.droneGain && this.ctx) {
          if (!enabled) this.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }
        break;
      case 'heartbeat':
        this.enableHeartbeat = enabled;
        break;
      case 'footsteps':
        this.enableFootsteps = enabled;
        break;
      case 'sfx':
        this.enableSFX = enabled;
        break;
    }
    console.log(`[AudioManager] Audio layer '${layer}' set to: ${enabled}`);
  }

  // ── Master Controls ──────────────────────────────────────────────────────
  pause(): void {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend();
        console.log('[AudioManager] AudioContext suspended on pause');
      } catch (e) {
        console.warn('[AudioManager] Pause error:', e);
      }
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
        console.log('[AudioManager] AudioContext resumed');
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
      if (this.windLfoOsc) {
        this.windLfoOsc.stop();
        this.windLfoOsc.disconnect();
        this.windLfoOsc = null;
      }
      if (this.droneOsc) {
        this.droneOsc.stop();
        this.droneOsc.disconnect();
        this.droneOsc = null;
      }
      if (this.windGain) this.windGain.disconnect();
      if (this.droneGain) this.droneGain.disconnect();
      if (this.masterFilter) this.masterFilter.disconnect();
      if (this.masterCompressor) this.masterCompressor.disconnect();
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
