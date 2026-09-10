import { AUDIO } from '../config';
import type { Game, GameEvent } from '../Game';

/**
 * All sound is synthesized with the Web Audio API — no sample assets to
 * ship, and every effect is cheap to retune (frequency/duration constants
 * are all local to this file).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private heartbeatTimer = 0;
  private heartbeatHigh = false;
  private muted = false;

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = AUDIO.MASTER_VOLUME;
    this.master.connect(this.ctx.destination);
  }

  /** Must be called from a user gesture (click/keydown) before any sound plays. */
  unlock(): void {
    this.ensureContext();
    this.ctx?.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : AUDIO.MASTER_VOLUME;
  }

  update(dt: number, game: Game): void {
    if (!this.ctx || this.muted) return;
    const segs = game.centipede.totalSegments;
    if (segs > 0 && game.state === 'PLAYING') {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        const speedFactor = Math.min(1, segs / 12);
        this.heartbeatTimer = 0.42 - speedFactor * 0.18;
        this.heartbeatHigh = !this.heartbeatHigh;
        this.blip({ freq: this.heartbeatHigh ? 90 : 70, dur: 0.07, type: 'square', gain: 0.25 });
      }
    }
  }

  handle(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      switch (e.type) {
        case 'fire':
          this.blip({ freq: 900, dur: 0.05, type: 'square', gain: 0.15, slideTo: 1400 });
          break;
        case 'mushroomDamaged':
          this.blip({ freq: 300, dur: 0.04, type: 'square', gain: 0.2 });
          break;
        case 'mushroomDestroyed':
          this.blip({ freq: 220, dur: 0.08, type: 'square', gain: 0.25, slideTo: 90 });
          break;
        case 'centipedeBodyHit':
          this.blip({ freq: 500, dur: 0.06, type: 'sawtooth', gain: 0.22, slideTo: 200 });
          break;
        case 'centipedeHeadHit':
          this.blip({ freq: 650, dur: 0.09, type: 'sawtooth', gain: 0.28, slideTo: 150 });
          break;
        case 'spiderSpawn':
        case 'spiderHit':
          this.chime();
          break;
        case 'fleaSpawn':
          this.whistle();
          break;
        case 'scorpionHit':
          this.blip({ freq: 700, dur: 0.12, type: 'square', gain: 0.3, slideTo: 100 });
          break;
        case 'playerDeath':
          this.explosion();
          break;
        case 'extraLife':
          this.fanfare();
          break;
        case 'sideFeedTrigger':
          this.blip({ freq: 1200, dur: 0.2, type: 'sawtooth', gain: 0.3, slideTo: 400 });
          break;
        case 'mushroomTallyTick':
          this.blip({ freq: 1000, dur: 0.02, type: 'square', gain: 0.15 });
          break;
      }
    }
  }

  private blip(opts: { freq: number; dur: number; type: OscillatorType; gain: number; slideTo?: number }): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, this.ctx.currentTime);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), this.ctx.currentTime + opts.dur);
    }
    gain.gain.setValueAtTime(opts.gain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + opts.dur);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + opts.dur + 0.02);
  }

  private chime(): void {
    if (!this.ctx || !this.master) return;
    [1200, 1500, 1800].forEach((f, i) => {
      const t = this.ctx!.currentTime + i * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  private whistle(): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  private explosion(): void {
    if (!this.ctx || !this.master) return;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    noise.connect(gain).connect(this.master);
    noise.start();
  }

  private fanfare(): void {
    if (!this.ctx || !this.master) return;
    [660, 880, 1100, 1320].forEach((f, i) => {
      const t = this.ctx!.currentTime + i * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }
}
