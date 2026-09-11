import { AUDIO } from '../config';
import type { Game, GameEvent } from '../Game';

/**
 * Sound is organized around the four POKEY channels the original hardware
 * used, per the reference pack's disassembly-derived channel mapping:
 *   CH1 - explosions (player death)
 *   CH2 - bonus-life chime, centipede, scorpion
 *   CH3 - shot / mushroom impact
 *   CH4 - spider
 * That channel assignment is transcribed from the reference pack, not
 * something this session independently confirmed against the disassembly
 * text — flea has no documented channel, so it's grouped with CH4 here as
 * a labeled approximation.
 *
 * All sound is synthesized live via Web Audio — there are no original
 * Atari WAV samples in this repo (see IMPLEMENTATION_NOTES.md). If real,
 * legally-obtained samples are dropped into `public/assets/audio/original/`
 * under the names in `SAMPLE_MANIFEST` below, they're used automatically;
 * otherwise this falls back to the synthesized placeholder for that role.
 */

const SAMPLE_MANIFEST: Record<string, string> = {
  explosion: 'assets/audio/original/explosion.wav', // CH1
  extraLife: 'assets/audio/original/bonus_life.wav', // CH2
  centipede: 'assets/audio/original/centipede.wav', // CH2
  scorpion: 'assets/audio/original/scorpion.wav', // CH2
  shot: 'assets/audio/original/shot.wav', // CH3
  mushroom: 'assets/audio/original/mushroom.wav', // CH3
  spider: 'assets/audio/original/spider.wav', // CH4
  flea: 'assets/audio/original/flea.wav', // CH4 (approximated — unverified role)
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private heartbeatTimer = 0;
  private heartbeatHigh = false;
  private muted = false;
  private samples = new Map<string, AudioBuffer>();
  private samplesRequested = false;

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
    this.loadOptionalSamples();
  }

  /** Best-effort: pulls in real samples if the project owner has supplied them; silently no-ops otherwise. */
  private loadOptionalSamples(): void {
    if (this.samplesRequested || !this.ctx) return;
    this.samplesRequested = true;
    for (const [key, url] of Object.entries(SAMPLE_MANIFEST)) {
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((buf) => this.ctx!.decodeAudioData(buf))
        .then((decoded) => this.samples.set(key, decoded))
        .catch(() => {
          /* no sample supplied for this role — synthesized fallback stays in effect */
        });
    }
  }

  private playSample(key: string): boolean {
    const buf = this.samples.get(key);
    if (!buf || !this.ctx || !this.master) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start();
    return true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : AUDIO.MASTER_VOLUME;
  }

  update(dt: number, game: Game): void {
    if (!this.ctx || this.muted) return;
    // CH2 (centipede): a persistent "heartbeat" thump for as long as any
    // segment is alive on screen, speeding up as the wave thins out.
    const segs = game.centipede.totalSegments;
    if (segs > 0 && game.state === 'PLAYING') {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        const speedFactor = Math.min(1, segs / 12);
        this.heartbeatTimer = 0.42 - speedFactor * 0.18;
        this.heartbeatHigh = !this.heartbeatHigh;
        if (!this.playSample('centipede')) {
          this.blip({ freq: this.heartbeatHigh ? 90 : 70, dur: 0.07, type: 'square', gain: 0.25 });
        }
      }
    }
  }

  handle(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      switch (e.type) {
        // CH3 - shot / mushroom impact
        case 'fire':
          if (!this.playSample('shot')) this.blip({ freq: 900, dur: 0.05, type: 'square', gain: 0.15, slideTo: 1400 });
          break;
        case 'mushroomDamaged':
          if (!this.playSample('mushroom')) this.blip({ freq: 300, dur: 0.04, type: 'square', gain: 0.2 });
          break;
        case 'mushroomDestroyed':
          if (!this.playSample('mushroom')) this.blip({ freq: 220, dur: 0.08, type: 'square', gain: 0.25, slideTo: 90 });
          break;
        case 'sideFeedTrigger':
          this.blip({ freq: 1200, dur: 0.2, type: 'sawtooth', gain: 0.3, slideTo: 400 });
          break;
        case 'mushroomTallyTick':
          this.blip({ freq: 1000, dur: 0.02, type: 'square', gain: 0.15 });
          break;

        // CH2 - bonus life, centipede, scorpion
        case 'centipedeBodyHit':
          if (!this.playSample('centipede')) this.blip({ freq: 500, dur: 0.06, type: 'sawtooth', gain: 0.22, slideTo: 200 });
          break;
        case 'centipedeHeadHit':
          if (!this.playSample('centipede')) this.blip({ freq: 650, dur: 0.09, type: 'sawtooth', gain: 0.28, slideTo: 150 });
          break;
        case 'scorpionHit':
          if (!this.playSample('scorpion')) this.blip({ freq: 700, dur: 0.12, type: 'square', gain: 0.3, slideTo: 100 });
          break;
        case 'extraLife':
          if (!this.playSample('extraLife')) this.fanfare();
          break;

        // CH4 - spider (flea grouped here as an approximation; unverified)
        case 'spiderSpawn':
        case 'spiderHit':
          if (!this.playSample('spider')) this.chime();
          break;
        case 'fleaSpawn':
          if (!this.playSample('flea')) this.whistle();
          break;

        // CH1 - explosions
        case 'playerDeath':
          if (!this.playSample('explosion')) this.explosion();
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
