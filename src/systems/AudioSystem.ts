import { AUDIO } from '../config';
import type { Game, GameEvent } from '../Game';
import type { GameStateName } from '../types';

/**
 * Sound is organized around the four POKEY channels the original hardware
 * used. VERIFIED (UpdateSound's header comment, $3079): "1: all
 * explosions / 2: bonus, centipede, flea/scorpion sounds / 3: shot sound
 * / 4: spider sound" -- read directly from the raw disassembly listing:
 *   CH1 - explosions (player death)
 *   CH2 - bonus-life chime, centipede, scorpion, flea
 *   CH3 - shot / mushroom impact
 *   CH4 - spider
 *
 * VERIFIED (UpdateSound, $3079-$3171, read directly from the raw listing):
 * every one of these effects is driven by a fixed byte table of raw POKEY
 * AUDF/AUDC values (`snd_freq0`-`snd_freq6` at $3172-$31fa) stepped at a
 * specific per-effect cadence -- not an arbitrary envelope. Previously
 * every effect here was a hand-invented frequency/duration guess with no
 * relationship to those tables at all. `pokeyHz()` converts a raw AUDF
 * byte to an approximate frequency using POKEY's well-documented (and
 * ROM-independent) hardware formula for its default, non-linked 64kHz-
 * reference channel mode -- this game's own `POKEY_AUDCTL` value ($20)
 * only sets an unrelated channel-2/4 filter-link bit, leaving every
 * channel in that default mode. The exact absolute Hz this yields isn't
 * independently recalibrated against real hardware audio, only the byte
 * tables and their timing are; treat the resulting pitch as a faithful
 * *shape*, not a lab-verified absolute frequency (the same honesty this
 * project already applies to its color hex values).
 *
 * VERIFIED (the same listing, $30d4-$3128): channel 2 is a genuinely
 * shared, single voice with a strict priority order -- bonus life beats
 * scorpion/flea, which beats the centipede's own ambient movement thump;
 * `:ChkBonus` falls through past the scorpion/flea/centipede-move checks
 * entirely while bonus is playing, and `:ChkFSE`'s own scorpion/flea
 * check falls through to the centipede-move code only when neither is
 * active. Previously each of these was an independent Web Audio
 * oscillator, so e.g. a bonus fanfare and the centipede heartbeat could
 * play simultaneously -- something the real single-voice channel could
 * never do. `playCh2()` below enforces the same one-voice/priority rule.
 *
 * All sound is synthesized live via Web Audio -- there are no original
 * Atari WAV samples in this repo (see IMPLEMENTATION_NOTES.md). If real,
 * legally-obtained samples are dropped into `public/assets/audio/original/`
 * under the names in `SAMPLE_MANIFEST` below, they're used automatically;
 * otherwise this falls back to the synthesized placeholder for that role.
 */

// POKEY's ~1.79MHz NTSC clock, divided down to its own ~64kHz internal
// reference (the "sample_rate" almost every channel actually runs from
// once AUDCTL doesn't opt a channel into the raw 1.79MHz or 15kHz bases --
// neither of which this ROM's AUDCTL=$20 selects for any channel). A raw
// AUDF byte then further divides that by 2*(AUDF+1). Standard, documented
// POKEY hardware arithmetic, not specific to this ROM.
const POKEY_BASE_HZ = 63921;
function pokeyHz(audf: number): number {
  return POKEY_BASE_HZ / (2 * (audf + 1));
}

// Sound 0 ($3172/$3185): explosion, CH1. 19 freq/ctrl pairs, one step per
// 4 frames (~1.27s total). The first 4 pairs are silent ($00/$00) -- a
// brief hush before the tone actually starts -- then the pitch rises
// ($f0 down to $10 is a falling AUDF, i.e. a *rising* pitch) as the
// ctrl bytes' volume nibble climbs 1->2->3->4.
const EXPLOSION_FREQ = [0x00, 0x00, 0x00, 0x00, 0xf0, 0xe0, 0xd0, 0xc0, 0xb0, 0xa0, 0x90, 0x80, 0x70, 0x60, 0x50, 0x40, 0x30, 0x20, 0x10];
const EXPLOSION_CTRL = [0x00, 0x00, 0x00, 0x00, 0x81, 0x81, 0x81, 0x82, 0x82, 0x82, 0x82, 0x83, 0x83, 0x83, 0x83, 0x84, 0x84, 0x84, 0x84];

// Sound 1 ($3198/$319f): centipede moving, CH2's lowest-priority ambient
// default. 7 elements, one step every single frame (~0.117s per cycle,
// restarted continuously while any segment is alive). The $00 entries are
// silent gaps between thumps, not held tones.
const CENTIPEDE_MOVE_FREQ = [0x70, 0x00, 0x00, 0xa0, 0x00, 0xc0, 0xe0];
const CENTIPEDE_MOVE_CTRL = [0xa1, 0x00, 0x00, 0xa2, 0x00, 0xa2, 0xa4];

// Sound 2 ($31a6): shot, CH3. 11 elements, one step every single frame
// (~0.183s total), fixed volume-4 distortion tone (AUDC $64 the whole
// way through -- no separate ctrl table). Falling AUDF -> rising pitch.
const SHOT_FREQ = [0xf0, 0xe0, 0xd0, 0xc0, 0xb0, 0xa0, 0x90, 0x80, 0x70, 0x60, 0x50];

// Sound 3 ($31b1/$31c5): spider, CH4 (its own dedicated channel, never
// contended). 20 elements, one step every *other* frame (~0.667s per
// cycle, restarted continuously while the spider is alive). Alternates
// tone/silence every entry, with volume arcing 1->2->3->4->3->2->1 across
// each half and pitch dipping from a shrill ~5.3kHz down to ~590Hz.
const SPIDER_FREQ = [0x05, 0x05, 0x20, 0x20, 0x30, 0x30, 0x35, 0x35, 0x30, 0x30, 0x20, 0x20, 0x05, 0x05, 0x20, 0x20, 0x30, 0x30, 0x35, 0x35];
const SPIDER_CTRL = [0xa1, 0x00, 0xa2, 0x00, 0xa3, 0x00, 0xa4, 0x00, 0xa3, 0x00, 0xa2, 0x00, 0xa1, 0x00, 0xa2, 0x00, 0xa3, 0x00, 0xa2, 0x00];

// Sound 4 ($31d9): bonus life, CH2's highest priority. 17 elements, one
// step every 8 frames (~2.27s total), fixed volume-4 pure tone (AUDC
// $a4 -- bit 4 set disables the poly/distortion counter for a clean
// waveform, unlike the buzzier shot/explosion/centipede/spider tones).
const BONUS_FREQ = [0x28, 0x28, 0x30, 0x28, 0x28, 0x30, 0x3c, 0x51, 0x50, 0x50, 0x60, 0x50, 0x50, 0x60, 0x74, 0xa2, 0x00];

// Sound 6 ($31ea): scorpion, CH2 (middle priority, alongside flea). 20
// elements, one step every single frame (~0.333s per cycle), same clean
// volume-4 pure tone as bonus.
const SCORPION_FREQ = [0x60, 0x60, 0x70, 0x70, 0x60, 0x60, 0x60, 0x70, 0x70, 0x70, 0x50, 0x50, 0x80, 0x80, 0x50, 0x50, 0x50, 0x80, 0x80, 0x80];

type Ch2Source = 'bonus' | 'scorpionOrFlea' | 'centipedeMove';
const CH2_PRIORITY: Record<Ch2Source, number> = { bonus: 3, scorpionOrFlea: 2, centipedeMove: 1 };

// VERIFIED (UpdateSound, $3079-$308b, and the two GAME_OVER/HIGH_SCORE_ENTRY
// fixes documented in IMPLEMENTATION_NOTES.md): real hardware mutes all
// four channels whenever `attract_mode` is set, which is true for the
// literal attract loop and also, per :NotAttract, from the moment either
// "GAME OVER" or the initials-entry screen starts -- but *not* during the
// death pause / mushroom tally in between, where the manual's own
// spider/flea/scorpion-keep-running behavior (and thus their sound) still
// applies. `update()` and `handle()` must therefore share this exact same
// gate, not the narrower `state !== 'PLAYING'` a first pass used here.
function isAttractLike(state: GameStateName): boolean {
  return state === 'ATTRACT' || state === 'GAME_OVER' || state === 'HIGH_SCORE_ENTRY';
}

const SAMPLE_MANIFEST: Record<string, string> = {
  explosion: 'assets/audio/original/explosion.wav', // CH1
  extraLife: 'assets/audio/original/bonus_life.wav', // CH2
  centipede: 'assets/audio/original/centipede.wav', // CH2
  scorpion: 'assets/audio/original/scorpion.wav', // CH2
  flea: 'assets/audio/original/flea.wav', // CH2
  shot: 'assets/audio/original/shot.wav', // CH3
  mushroom: 'assets/audio/original/mushroom.wav', // CH3
  spider: 'assets/audio/original/spider.wav', // CH4
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private samples = new Map<string, AudioBuffer>();
  private samplesRequested = false;

  // CH2: the one shared, priority-arbitrated voice (see the class-level
  // comment). `ch2EndsAt` is an AudioContext-clock timestamp; the channel
  // reads as "free" once `currentTime` passes it.
  private ch2Osc: OscillatorNode | null = null;
  private ch2BufferSrc: AudioBufferSourceNode | null = null;
  private ch2Source: Ch2Source | null = null;
  private ch2EndsAt = 0;

  // CH4: the spider's own dedicated channel -- still needs to know when
  // its current loop iteration ends so `update()` can restart it.
  private ch4EndsAt = 0;

  // Flea's CH2 tone isn't table-driven at all: UpdateSound recomputes its
  // AUDF directly from the flea's live vertical position every frame it
  // runs ($311a-$3123), so it's synthesized here as a single continuously
  // retuned oscillator instead of a stepped sequence.
  private fleaOsc: OscillatorNode | null = null;
  private fleaGain: GainNode | null = null;

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

  /**
   * Schedules one oscillator through a raw POKEY freq/ctrl table, one step
   * per `stepFrames` (60Hz) frames. `ctrl` is either a per-step byte array
   * (low nibble = 0-15 volume, matching a `$00`/`$00` pair being a real
   * silent gap) or a single fixed volume used for every step.
   */
  private schedulePokeyTable(
    dest: GainNode,
    freq: number[],
    ctrl: number[] | number,
    stepFrames: number,
    type: OscillatorType,
    startAt: number
  ): { osc: OscillatorNode; endsAt: number } {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const stepDur = stepFrames / 60;
    const n = freq.length;
    for (let i = 0; i < n; i++) {
      const t = startAt + i * stepDur;
      const raw = freq[i];
      const vol = Array.isArray(ctrl) ? (ctrl[i] & 0x0f) / 15 : raw === 0 ? 0 : ctrl / 15;
      osc.frequency.setValueAtTime(Math.max(1, pokeyHz(raw)), t);
      gain.gain.setValueAtTime(vol * 0.55, t);
    }
    const endsAt = startAt + n * stepDur;
    gain.gain.setValueAtTime(0, endsAt);
    osc.connect(gain).connect(dest);
    osc.start(startAt);
    osc.stop(endsAt + 0.02);
    return { osc, endsAt };
  }

  /** One-shot table playback on its own private gain node (CH1 explosion, CH3 shot -- never contended). */
  private playOneShot(freq: number[], ctrl: number[] | number, stepFrames: number, type: OscillatorType): void {
    if (!this.ctx || !this.master) return;
    const gain = this.ctx.createGain();
    gain.connect(this.master);
    this.schedulePokeyTable(gain, freq, ctrl, stepFrames, type, this.ctx.currentTime);
  }

  /**
   * CH2's single shared voice. Refuses to (re)start if a strictly higher-
   * priority source is still sounding -- matching real hardware, where
   * bonus/scorpion-flea/centipede-move can never all be heard at once.
   */
  private playCh2(source: Ch2Source, freq: number[], ctrl: number[] | number, stepFrames: number, type: OscillatorType): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    if (this.ch2Source && now < this.ch2EndsAt && CH2_PRIORITY[this.ch2Source] > CH2_PRIORITY[source]) return;
    this.stopCh2();
    const gain = this.ctx.createGain();
    gain.connect(this.master);
    const { osc, endsAt } = this.schedulePokeyTable(gain, freq, ctrl, stepFrames, type, now);
    this.ch2Osc = osc;
    this.ch2Source = source;
    this.ch2EndsAt = endsAt;
  }

  /** Same priority/ownership rule as playCh2(), but for a real supplied sample. Returns false (no-op) if no sample exists for that role, so the caller can fall back to synthesis. */
  private playCh2Sample(source: Ch2Source, sampleKey: string): boolean {
    if (!this.ctx || !this.master) return false;
    const buf = this.samples.get(sampleKey);
    if (!buf) return false;
    const now = this.ctx.currentTime;
    if (this.ch2Source && now < this.ch2EndsAt && CH2_PRIORITY[this.ch2Source] > CH2_PRIORITY[source]) return true;
    this.stopCh2();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start(now);
    this.ch2BufferSrc = src;
    this.ch2Source = source;
    this.ch2EndsAt = now + buf.duration;
    return true;
  }

  private stopCh2(): void {
    if (this.ch2Osc) {
      try {
        this.ch2Osc.stop();
      } catch {
        /* already stopped */
      }
    }
    if (this.ch2BufferSrc) {
      try {
        this.ch2BufferSrc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.ch2Osc = null;
    this.ch2BufferSrc = null;
    this.ch2Source = null;
    this.ch2EndsAt = 0;
  }

  private stopFleaTone(): void {
    if (this.fleaOsc) {
      try {
        this.fleaOsc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.fleaOsc = null;
    this.fleaGain = null;
  }

  update(dt: number, game: Game): void {
    if (!this.ctx || this.muted || isAttractLike(game.state)) {
      this.stopFleaTone();
      return;
    }
    const now = this.ctx.currentTime;

    // CH4 - spider: its own channel, so just keep the loop going for as
    // long as it's alive, restarting the table (or a supplied sample) the
    // instant one pass ends.
    if (game.spider) {
      if (now >= this.ch4EndsAt) {
        if (this.playSample('spider')) {
          this.ch4EndsAt = now + this.samples.get('spider')!.duration;
        } else {
          const gain = this.ctx.createGain();
          gain.connect(this.master!);
          const { endsAt } = this.schedulePokeyTable(gain, SPIDER_FREQ, SPIDER_CTRL, 2, 'square', now);
          this.ch4EndsAt = endsAt;
        }
      }
    } else {
      this.ch4EndsAt = 0;
    }

    // CH2: scorpion beats flea's own tone beats the centipede's ambient
    // default -- matching :ChkFSE's real fallthrough order ($3100-$3128).
    if (game.scorpion) {
      this.stopFleaTone();
      if (this.ch2Source !== 'scorpionOrFlea' || now >= this.ch2EndsAt) {
        if (!this.playCh2Sample('scorpionOrFlea', 'scorpion')) {
          this.playCh2('scorpionOrFlea', SCORPION_FREQ, 4, 1, 'triangle');
        }
      }
    } else if (game.flea) {
      // VERIFIED ($311a-$3123): AUDF is recomputed every frame straight
      // from the flea's live vertical position -- ((vert >> 1) XOR $ff)
      // OR $80 -- rather than stepping a fixed table, so it's one
      // continuously-retuned oscillator instead of a scheduled sequence.
      // Only a strictly higher-priority source (bonus) should hold the
      // channel over it -- the centipede's own lower-priority ambient
      // thump must yield immediately, the same as it does for scorpion.
      const blockedByHigherPriority =
        this.ch2Source !== null &&
        this.ch2Source !== 'scorpionOrFlea' &&
        now < this.ch2EndsAt &&
        CH2_PRIORITY[this.ch2Source] > CH2_PRIORITY.scorpionOrFlea;
      if (blockedByHigherPriority) {
        this.stopFleaTone();
      } else {
        this.stopCh2();
        this.ch2Source = 'scorpionOrFlea';
        this.ch2EndsAt = Infinity;
        if (!this.fleaOsc) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.35 * 0.55, now);
          osc.connect(gain).connect(this.master!);
          osc.start(now);
          this.fleaOsc = osc;
          this.fleaGain = gain;
        }
        const vertByte = Math.round(game.flea.y * 8) & 0xff;
        const audf = (((vertByte >> 1) ^ 0xff) | 0x80) & 0xff;
        this.fleaOsc.frequency.setValueAtTime(pokeyHz(audf), now);
      }
    } else {
      this.stopFleaTone();
      if (this.ch2Source === 'scorpionOrFlea') this.stopCh2();

      // CH2 default: the centipede's own movement thump, only while
      // nothing higher-priority currently owns the channel.
      const segs = game.centipede.totalSegments;
      if (segs > 0) {
        if (!this.ch2Source || (this.ch2Source === 'centipedeMove' && now >= this.ch2EndsAt)) {
          if (!this.playCh2Sample('centipedeMove', 'centipede')) {
            this.playCh2('centipedeMove', CENTIPEDE_MOVE_FREQ, CENTIPEDE_MOVE_CTRL, 1, 'square');
          }
        }
      }
    }
  }

  // VERIFIED (UpdateSound, $3079-$308b): `ldx attract_mode; bpl :Playing`
  // -- when attract_mode is set, execution falls through to zeroing all
  // four POKEY channels and returning immediately, every single frame.
  // The real cabinet is completely silent during the attract demo; sound
  // only plays during real gameplay. GAME_OVER and HIGH_SCORE_ENTRY count
  // as attract-mode too here -- :NotAttract flips attract_mode *before*
  // either screen even starts on real hardware, so their live demo
  // backdrop is equally silent.
  handle(events: GameEvent[], state: GameStateName): void {
    if (!this.ctx || this.muted || isAttractLike(state)) return;
    for (const e of events) {
      switch (e.type) {
        // CH3 - shot (its own channel; no ROM-documented distinct
        // "mushroom impact" sound exists, so those two stay simple
        // placeholder blips rather than a fabricated table).
        case 'fire':
          if (!this.playSample('shot')) this.playOneShot(SHOT_FREQ, 4, 1, 'square');
          break;
        // FEATURES.bombs -- not part of the arcade sound table, just simple
        // placeholder sfx distinct from the regular shot/explosion sounds.
        case 'bombSpawn':
          this.blip({ freq: 180, dur: 0.08, type: 'square', gain: 0.25, slideTo: 260 });
          break;
        case 'bombExplode':
          this.playOneShot(EXPLOSION_FREQ, EXPLOSION_CTRL, 6, 'sawtooth');
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

        // CH2 - bonus life (highest priority; centipede/scorpion/flea are
        // continuous and handled every frame in update() instead).
        case 'extraLife':
          if (!this.playSample('extraLife')) this.playCh2('bonus', BONUS_FREQ, 4, 8, 'triangle');
          break;

        // CH1 - explosions. VERIFIED ($3048-$3055, `:UpdateScore`): every
        // kill -- a centipede segment, the flea, the scorpion, or the
        // spider -- shares this exact same tail (`cn_expl_sound_idx = 19`),
        // playing the identical 19-step explosion table player death uses
        // on the same channel, not a distinct per-enemy sound.
        case 'centipedeBodyHit':
        case 'centipedeHeadHit':
        case 'fleaKilled':
        case 'scorpionHit':
        case 'spiderHit':
        case 'playerDeath':
          // Same 'explosion' sample role as player death -- real hardware
          // plays the literal identical table/channel for both, so a
          // supplied sample should cover both rather than a separate
          // 'centipede' role (that name is reserved for the continuous
          // movement-thump sample instead; see SAMPLE_MANIFEST).
          if (!this.playSample('explosion')) this.playOneShot(EXPLOSION_FREQ, EXPLOSION_CTRL, 4, 'sawtooth');
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
}
