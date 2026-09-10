import {
  DEFAULT_FEATURES,
  DEFAULT_OPERATOR_OPTIONS,
  FLEA,
  GRID,
  LIVES,
  CENTIPEDE_SPEED,
  SCORING,
  SCORPION,
  SHOOTER,
  SIDE_FEED,
  SPIDER,
  WAVE_CYCLE,
  ZONES,
  type FeatureFlags,
  type OperatorOptions,
} from './config';
import { Random } from './core/Random';
import { MushroomField } from './entities/Mushroom';
import { CentipedeManager, type Chain } from './entities/Centipede';
import { Shooter } from './entities/Shooter';
import { Shot } from './entities/Shot';
import { Spider, spiderZoneMaxRow } from './entities/Spider';
import { Flea } from './entities/Flea';
import { Scorpion } from './entities/Scorpion';
import type { GameStateName } from './types';

export type GameEventType =
  | 'fire'
  | 'mushroomDamaged'
  | 'mushroomDestroyed'
  | 'centipedeBodyHit'
  | 'centipedeHeadHit'
  | 'spiderHit'
  | 'spiderEscaped'
  | 'spiderSpawn'
  | 'fleaHit'
  | 'fleaKilled'
  | 'fleaSpawn'
  | 'scorpionHit'
  | 'scorpionSpawn'
  | 'playerDeath'
  | 'extraLife'
  | 'waveClear'
  | 'waveStart'
  | 'sideFeedTrigger'
  | 'mushroomTallyTick'
  | 'gameOver'
  | 'gameStart';

export interface GameEvent {
  type: GameEventType;
  points?: number;
}

export interface InputState {
  /** Target position for the shooter, in grid space (trackball / mouse / keyboard-derived). */
  targetX: number;
  targetY: number;
  /** True on the frame fire begins (edge) — a held button still only fires once the prior shot resolves. */
  firing: boolean;
  /** If true, snap the shooter directly to target instead of easing (mouse mode). */
  instantMove: boolean;
}

interface WaveSpec {
  compositionIndex0: number;
  chainLength: number;
  singleHeads: number;
  speed: 'slow' | 'fast';
}

const TALLY_TICK_SECONDS = 0.06;

export class Game {
  mushrooms = new MushroomField();
  centipede = new CentipedeManager();
  shooter = new Shooter();
  shot: Shot | null = null;
  spider: Spider | null = null;
  flea: Flea | null = null;
  scorpion: Scorpion | null = null;

  score = 0;
  highScore = 0;
  lives = LIVES.STARTING_DEFAULT;
  bonusLivesAwarded = 0;
  waveNumber = 1; // 1-based, ever-increasing, for HUD display
  state: GameStateName = 'ATTRACT';

  features: FeatureFlags;
  options: OperatorOptions;

  readonly events: GameEvent[] = [];

  private rng = new Random();
  private currentWave: WaveSpec = { compositionIndex0: 0, chainLength: 12, singleHeads: 0, speed: 'fast' };
  private nextSpeedForComposition = new Map<number, 'slow' | 'fast'>();

  private spiderTimer = 2.5;
  private fleaAllowedTimer = 1.5;
  private scorpionTimer = 5;

  private sideFeedActive = false;
  private sideFeedTimer = 0;
  private sideFeedLinksThisActivation = 0;
  private sideFeedSide: 'left' | 'right' = 'left';

  private tallyQueue: Array<{ row: number; col: number; kind: 'poisoned' | 'damaged' }> = [];
  private tallyTimer = 0;
  private deathTimer = 0;
  private justClearedWave = false;

  constructor(features: Partial<FeatureFlags> = {}, options: Partial<OperatorOptions> = {}) {
    this.features = { ...DEFAULT_FEATURES, ...features };
    this.options = { ...DEFAULT_OPERATOR_OPTIONS, ...options };
    this.lives = this.options.startingLives;
    this.highScore = loadHighScore();
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  startNewGame(): void {
    this.score = 0;
    this.lives = this.options.startingLives;
    this.bonusLivesAwarded = 0;
    this.waveNumber = 1;
    this.mushrooms.clearAll();
    this.scatterInitialMushrooms();
    this.centipede.clear();
    this.shot = null;
    this.spider = null;
    this.flea = null;
    this.scorpion = null;
    this.sideFeedActive = false;
    this.sideFeedTimer = 0;
    this.sideFeedLinksThisActivation = 0;
    this.nextSpeedForComposition.clear();
    this.shooter.reset();
    this.currentWave = { compositionIndex0: 0, chainLength: 12, singleHeads: 0, speed: 'fast' };
    this.spawnWave(this.currentWave);
    this.spiderTimer = 2.5;
    this.fleaAllowedTimer = 3;
    this.scorpionTimer = this.rng.int(SCORPION.SPAWN_INTERVAL_MIN_MS, SCORPION.SPAWN_INTERVAL_MAX_MS) / 1000;
    this.state = 'PLAYING';
    this.emit('gameStart');
  }

  private scatterInitialMushrooms(): void {
    // A believable opening field: a modest, randomly scattered patch,
    // biased toward the outfield, matching the "sparse early screen" look.
    const count = this.rng.int(28, 36);
    for (let i = 0; i < count; i++) {
      const row = this.rng.int(ZONES.MUSHROOM_MIN_ROW, GRID.ROWS);
      const col = this.rng.int(1, GRID.COLS);
      this.mushrooms.plant(row, col);
    }
  }

  update(dt: number, input: InputState): void {
    if (this.features.slowMotion) dt *= 0.25;

    switch (this.state) {
      case 'PLAYING':
        this.updatePlaying(dt, input);
        break;
      case 'LIFE_LOST_TALLY':
        this.updateTally(dt);
        break;
      default:
        break;
    }
  }

  private emit(type: GameEventType, points?: number): void {
    this.events.push({ type, points });
  }

  /** Drains queued events (call once per frame from the render/audio loop). */
  drainEvents(): GameEvent[] {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  // ---------------------------------------------------------------------
  // Main playing-state update
  // ---------------------------------------------------------------------

  private updatePlaying(dt: number, input: InputState): void {
    this.shooter.moveToward(input.targetX, input.targetY, dt, this.mushrooms, input.instantMove);

    if (input.firing && !this.shot) {
      this.shot = new Shot(this.shooter.col, this.shooter.y + 0.4);
      this.emit('fire');
    }

    this.updateShot(dt);
    this.updateCentipede(dt);
    this.updateSpider(dt);
    this.updateFlea(dt);
    this.updateScorpion(dt);
    this.updateSideFeed(dt);
    this.checkShooterCollisions();

    if (this.centipede.isWaveClear && !this.justClearedWave) {
      this.justClearedWave = true;
      this.onWaveClear();
    }
  }

  // ---------------------------------------------------------------------
  // Shot / collision resolution
  // ---------------------------------------------------------------------

  private updateShot(dt: number): void {
    if (!this.shot) return;
    const { prevRow, newRow } = this.shot.update(dt);
    if (!this.shot.alive) {
      this.shot = null;
      return;
    }

    const col = this.shot.col;
    // Sweep row-by-row from prevRow to newRow to avoid tunnelling through
    // thin targets when the shot travels several cells in one frame.
    const startRow = Math.floor(prevRow);
    const endRow = Math.ceil(newRow);
    for (let r = startRow; r <= endRow; r++) {
      if (r < 1 || r > GRID.ROWS) continue;

      if (this.mushrooms.has(r, col)) {
        const result = this.mushrooms.shoot(r, col);
        this.shot = null;
        if (result === 'destroyed') {
          this.addScore(SCORING.MUSHROOM_DESTROYED);
          this.emit('mushroomDestroyed', SCORING.MUSHROOM_DESTROYED);
        } else {
          this.emit('mushroomDamaged');
        }
        return;
      }

      const segHit = this.centipede.findSegmentNear(r, col, 0.6);
      if (segHit) {
        const result = this.centipede.destroySegment(segHit.chain, segHit.index, this.mushrooms);
        this.addScore(result.points);
        this.emit(result.wasHead ? 'centipedeHeadHit' : 'centipedeBodyHit', result.points);
        this.shot = null;
        return;
      }

      if (this.flea && Math.round(this.flea.row) === r && this.flea.col === col) {
        const killed = this.flea.registerHit();
        this.emit(killed ? 'fleaKilled' : 'fleaHit');
        if (killed) {
          this.addScore(SCORING.FLEA);
          this.flea = null;
        }
        this.shot = null;
        return;
      }

      if (this.scorpion && this.scorpion.row === r && this.scorpion.col === col) {
        this.addScore(SCORING.SCORPION);
        this.emit('scorpionHit', SCORING.SCORPION);
        this.scorpion = null;
        this.shot = null;
        return;
      }

      if (this.spider && Math.round(this.spider.row) === r && this.spider.col === col) {
        const dist = Math.hypot(this.spider.row - this.shooter.y, this.spider.col - this.shooter.x);
        const points =
          dist <= SCORING.SPIDER_CLOSE_ROWS
            ? SCORING.SPIDER_CLOSE
            : dist <= SCORING.SPIDER_MEDIUM_ROWS
              ? SCORING.SPIDER_MEDIUM
              : SCORING.SPIDER_FAR;
        this.addScore(points);
        this.emit('spiderHit', points);
        this.spider = null;
        this.spiderTimer = SPIDER.RESPAWN_AFTER_KILL_MS / 1000;
        this.shot = null;
        return;
      }
    }
  }

  /** All scoring flows through here so the six-digit register wrap (manual: "the millionth point earned makes the register turn over to zero") and the extra-life check both stay in one place. */
  private addScore(points: number): void {
    this.score = (this.score + points) % 1_000_000;
    this.checkExtraLife();
  }

  private checkExtraLife(): void {
    const threshold = this.options.extraLifeScore * (this.bonusLivesAwarded + 1);
    if (this.score >= threshold && this.bonusLivesAwarded < LIVES.MAX_BONUS_LIVES) {
      this.bonusLivesAwarded++;
      this.lives++;
      this.emit('extraLife');
    }
  }

  // ---------------------------------------------------------------------
  // Centipede
  // ---------------------------------------------------------------------

  private updateCentipede(dt: number): void {
    this.centipede.update(dt, {
      mushrooms: this.mushrooms,
      isOccupiedByOtherChain: (r, c, exceptId) => this.centipede.isOccupiedByOtherChain(r, c, exceptId),
      onReachBottom: (_chain: Chain) => this.triggerSideFeed(),
    });
  }

  // ---------------------------------------------------------------------
  // Spider
  // ---------------------------------------------------------------------

  private updateSpider(dt: number): void {
    if (this.spider) {
      this.spider.update(dt, {
        mushrooms: this.mushrooms,
        maxRow: spiderZoneMaxRow(this.score),
        isCentipedeOccupied: (r, c) => this.centipede.collidesWithCell(r, c, 0.5),
      });
      if (!this.spider.alive) {
        this.emit('spiderEscaped');
        this.spider = null;
        this.spiderTimer = SPIDER.RESPAWN_AFTER_ESCAPE_MS / 1000;
      }
      return;
    }
    this.spiderTimer -= dt;
    if (this.spiderTimer <= 0) {
      const speedupScore = this.options.spiderSpeedupScore;
      const speed = this.score >= speedupScore ? SPIDER.SPEED_FAST : SPIDER.SPEED_SLOW;
      this.spider = new Spider(this.rng.chance(0.5), speed, this.rng);
      this.emit('spiderSpawn');
    }
  }

  // ---------------------------------------------------------------------
  // Flea
  // ---------------------------------------------------------------------

  private requiredInfieldMushrooms(): number {
    for (const band of FLEA.MIN_INFIELD_MUSHROOMS_BY_SCORE) {
      if (this.score <= band.upTo) return band.count;
    }
    const last = FLEA.MIN_INFIELD_MUSHROOMS_BY_SCORE[FLEA.MIN_INFIELD_MUSHROOMS_BY_SCORE.length - 1];
    const over = this.score - last.upTo;
    return last.count + Math.ceil(over / FLEA.MUSHROOMS_NEEDED_INCREMENT_SCORE_STEP);
  }

  private updateFlea(dt: number): void {
    if (this.flea) {
      this.flea.update(dt, this.mushrooms);
      if (!this.flea.alive) {
        this.flea = null;
        this.fleaAllowedTimer = randRange(this.rng, FLEA.RELEASE_DELAY_AFTER_ESCAPE_MS) / 1000;
      }
      return;
    }
    const firstWaveOfCycle = this.currentWave.compositionIndex0 === 0;
    if (firstWaveOfCycle || this.scorpion) return;

    if (this.mushrooms.countInfield() >= this.requiredInfieldMushrooms()) return;

    this.fleaAllowedTimer -= dt;
    if (this.fleaAllowedTimer <= 0) {
      this.flea = new Flea(this.rng.int(1, GRID.COLS), this.rng);
      this.emit('fleaSpawn');
    }
  }

  // ---------------------------------------------------------------------
  // Scorpion
  // ---------------------------------------------------------------------

  private updateScorpion(dt: number): void {
    if (this.scorpion) {
      this.scorpion.update(dt, this.mushrooms);
      if (!this.scorpion.alive) this.scorpion = null;
      return;
    }
    if (this.flea) return;
    if (this.currentWave.compositionIndex0 < WAVE_CYCLE.SCORPION_UNLOCKS_AFTER_WAVE_INDEX0) return;

    this.scorpionTimer -= dt;
    if (this.scorpionTimer <= 0) {
      const fast =
        this.score >= SCORPION.FAST_SPEED_UNLOCK_SCORE &&
        this.rng.chance(SCORPION.FAST_SPEED_CHANCE_AFTER_UNLOCK);
      const speed = fast ? SCORPION.SPEED_FAST : SCORPION.SPEED_SLOW;
      const row = this.rng.int(ZONES.SCORPION_MIN_ROW, GRID.ROWS);
      this.scorpion = new Scorpion(row, this.rng.chance(0.5), speed);
      this.scorpionTimer = randRange(this.rng, [SCORPION.SPAWN_INTERVAL_MIN_MS, SCORPION.SPAWN_INTERVAL_MAX_MS]) / 1000;
      this.emit('scorpionSpawn');
    }
  }

  // ---------------------------------------------------------------------
  // Side feed
  // ---------------------------------------------------------------------

  private sideFeedBaseIntervalMs(): number {
    const cyclical = this.score % SIDE_FEED.CYCLE_RESET_SCORE_SPAN;
    const steps = Math.floor(cyclical / SIDE_FEED.STAGE2_SCORE_STEP);
    const ms = SIDE_FEED.FIRST_INTERVAL_MS - steps * SIDE_FEED.STAGE2_DECREASE_PER_10K_MS;
    return Math.max(SIDE_FEED.ABSOLUTE_MIN_INTERVAL_MS, ms);
  }

  private triggerSideFeed(): void {
    if (!this.sideFeedActive) {
      this.sideFeedActive = true;
      this.sideFeedLinksThisActivation = 0;
      this.sideFeedTimer = this.sideFeedBaseIntervalMs() / 1000;
      this.emit('sideFeedTrigger');
    }
  }

  private updateSideFeed(dt: number): void {
    if (!this.sideFeedActive) return;
    if (this.centipede.isWaveClear) {
      this.sideFeedActive = false;
      return;
    }
    this.sideFeedTimer -= dt;
    if (this.sideFeedTimer <= 0) {
      this.sideFeedSide = this.sideFeedSide === 'left' ? 'right' : 'left';
      const col = this.sideFeedSide === 'left' ? 1 : GRID.COLS;
      const dir = this.sideFeedSide === 'left' ? 1 : -1;
      const speed = this.currentWave.speed === 'fast' ? CENTIPEDE_SPEED.FAST : CENTIPEDE_SPEED.SLOW;
      this.centipede.spawnChain(SIDE_FEED.ENTRY_ROW, col, dir as 1 | -1, 1, speed, -1);
      this.sideFeedLinksThisActivation++;
      const decay = Math.min(this.sideFeedLinksThisActivation, SIDE_FEED.STAGE1_LINK_COUNT) * SIDE_FEED.INTERVAL_DECREASE_STAGE1_MS;
      const interval = Math.max(SIDE_FEED.ABSOLUTE_MIN_INTERVAL_MS, this.sideFeedBaseIntervalMs() - decay);
      this.sideFeedTimer = interval / 1000;
    }
  }

  // ---------------------------------------------------------------------
  // Shooter collisions (death)
  // ---------------------------------------------------------------------

  private checkShooterCollisions(): void {
    if (this.features.godMode) return;
    const sx = this.shooter.x;
    const sy = this.shooter.y;

    if (this.centipede.collidesWithCell(sy, sx, 0.55)) return this.killPlayer();
    if (this.spider && Math.hypot(this.spider.row - sy, this.spider.col - sx) < 0.6) return this.killPlayer();
    if (this.flea && Math.round(this.flea.row) === Math.round(sy) && this.flea.col === Math.round(sx)) {
      return this.killPlayer();
    }
  }

  private killPlayer(): void {
    if (this.state !== 'PLAYING') return;
    this.emit('playerDeath');
    this.lives--;
    this.shot = null;
    this.buildTallyQueue();
    this.state = 'LIFE_LOST_TALLY';
    this.tallyTimer = 0;
  }

  private buildTallyQueue(): void {
    this.tallyQueue = [];
    this.mushrooms.forEach((row, col, cell) => {
      if (cell.poisoned) this.tallyQueue.push({ row, col, kind: 'poisoned' });
      else if (cell.hits > 0) this.tallyQueue.push({ row, col, kind: 'damaged' });
    });
  }

  private updateTally(dt: number): void {
    this.tallyTimer -= dt;
    if (this.tallyTimer > 0) return;
    this.tallyTimer = TALLY_TICK_SECONDS;

    const next = this.tallyQueue.shift();
    if (next) {
      const cell = this.mushrooms.get(next.row, next.col);
      if (cell) {
        cell.poisoned = false;
        cell.hits = 0;
      }
      const pts = next.kind === 'poisoned' ? SCORING.MUSHROOM_POISONED_CREDIT : SCORING.MUSHROOM_DAMAGED_CREDIT;
      this.addScore(pts);
      this.emit('mushroomTallyTick', pts);
      return;
    }

    // Tally complete.
    this.mushrooms.restoreAll();
    this.spider = null;
    this.flea = null;
    this.scorpion = null;
    this.sideFeedActive = false;

    if (this.lives <= 0) {
      this.state = 'GAME_OVER';
      saveHighScore(this.score);
      this.highScore = Math.max(this.highScore, this.score);
      this.emit('gameOver');
      return;
    }

    this.shooter.reset();
    this.spawnWave(this.currentWave); // repeats the same attack wave, per the manual
    this.spiderTimer = SPIDER.RESPAWN_AFTER_ESCAPE_MS / 1000;
    this.fleaAllowedTimer = 2;
    this.state = 'PLAYING';
  }

  // ---------------------------------------------------------------------
  // Wave composition / spawning (Table 4)
  // ---------------------------------------------------------------------

  private speedForComposition(index0: number): 'slow' | 'fast' {
    if (index0 === 0) return 'fast'; // first wave of any cycle is always fast
    if (this.score >= WAVE_CYCLE.SLOW_FAST_STOPS_AT_SCORE) return 'fast';
    return this.nextSpeedForComposition.get(index0) ?? 'slow';
  }

  private onWaveClear(): void {
    this.emit('waveClear');
    const cur = this.currentWave;
    let next: WaveSpec;

    if (cur.speed === 'slow') {
      // Replay the same composition at fast speed before advancing.
      this.nextSpeedForComposition.set(cur.compositionIndex0, 'fast');
      next = { ...cur, speed: 'fast' };
    } else {
      const nextIndex0 = (cur.compositionIndex0 + 1) % WAVE_CYCLE.LENGTH;
      const speed = this.speedForComposition(nextIndex0);
      next = {
        compositionIndex0: nextIndex0,
        chainLength: WAVE_CYCLE.chainLengthForIndex(nextIndex0),
        singleHeads: WAVE_CYCLE.singleHeadsForIndex(nextIndex0),
        speed,
      };
    }

    this.currentWave = next;
    this.waveNumber++;
    this.spawnWave(next);
  }

  private spawnWave(spec: WaveSpec): void {
    this.justClearedWave = false;
    this.centipede.clear();
    const speed = spec.speed === 'fast' ? CENTIPEDE_SPEED.FAST : CENTIPEDE_SPEED.SLOW;
    const centerCol = 15 + this.rng.int(0, 1);

    if (spec.chainLength > 0) {
      const dir = this.rng.chance(0.5) ? 1 : -1;
      this.centipede.spawnChain(GRID.ROWS, centerCol, dir as 1 | -1, spec.chainLength, speed, -1);
    }

    const usedCols = new Set<number>([centerCol]);
    for (let i = 0; i < spec.singleHeads; i++) {
      let col = this.rng.int(1, GRID.COLS);
      let guard = 0;
      while (usedCols.has(col) && guard++ < 60) col = this.rng.int(1, GRID.COLS);
      usedCols.add(col);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      this.centipede.spawnChain(GRID.ROWS, col, dir as 1 | -1, 1, speed, -1);
    }

    this.emit('waveStart');
  }

  // ---------------------------------------------------------------------
  // Shooter position helper for renderer / input clamping
  // ---------------------------------------------------------------------

  get shooterZoneMaxRow(): number {
    return ZONES.SHOOTER_MAX_ROW;
  }
}

function randRange(rng: Random, [min, max]: [number, number]): number {
  return rng.int(min, max);
}

const HIGH_SCORE_KEY = 'centipede.highScore';

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score: number): void {
  try {
    const cur = loadHighScore();
    if (score > cur) localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* localStorage unavailable (e.g. private mode) — not fatal */
  }
}
