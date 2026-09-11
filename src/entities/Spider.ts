import { GRID, SPIDER } from '../config';
import { Random } from '../core/Random';
import { MushroomField } from './Mushroom';
import type { Direction } from '../types';

export interface SpiderWorld {
  mushrooms: MushroomField;
  maxRow: number; // current zone ceiling (Table 6, driven by score)
  isCentipedeOccupied(row: number, col: number): boolean;
}

type Mode = 'diag' | 'vertical';

/**
 * Ports MoveSpider ($2202 in the Rev4 disassembly) rather than a
 * hand-tuned approximation: the spider drifts vertically at a constant
 * `speed` at all times, independently toggling a horizontal component on
 * or off (the "diagonal slash" vs. "vertical hold" alternation) on a
 * fixed ~48-frame (0.8s) cadence, with two independent coin-flips at each
 * tick -- one toggles the horizontal component, the other may reverse the
 * vertical direction outright (more often under the "hard" difficulty DIP
 * setting). It never reverses its net column direction -- it always
 * enters near one side and eventually exits the other.
 */
export class Spider {
  x: number;
  y = 12;
  readonly exitDir: Direction;
  speed: number;
  alive = true;
  private mode: Mode = 'diag';
  private verticalDir: 1 | -1 = -1;
  private rng: Random;
  private redecideTimer: number;
  private hardDifficulty: boolean;

  constructor(enterFromLeft: boolean, speed: number, rng: Random, hardDifficulty: boolean) {
    this.exitDir = enterFromLeft ? 1 : -1;
    this.x = enterFromLeft ? 0 : GRID.COLS + 1;
    this.speed = speed;
    this.rng = rng;
    this.hardDifficulty = hardDifficulty;
    // VERIFIED (":DeadSpider", $22fa): the first redecision after spawning
    // comes sooner than the steady-state cadence.
    const [lo, hi] = SPIDER.RESPAWN_FIRST_CHECK_FRAMES;
    this.redecideTimer = (rng.chance(0.5) ? lo : hi) / 60;
  }

  update(dt: number, world: SpiderWorld): void {
    const minRow = 1;
    const maxRow = world.maxRow;

    this.redecideTimer -= dt;
    if (this.redecideTimer <= 0) {
      this.redecideTimer = SPIDER.DIRECTION_CHECK_FRAMES / 60;

      // Near either screen edge, let it keep going straight through
      // (entering or leaving) instead of toggling into a vertical hold.
      const nearEdge = this.x <= 2 || this.x >= GRID.COLS - 1;
      if (!nearEdge && this.rng.chance(0.5)) {
        this.mode = this.mode === 'diag' ? 'vertical' : 'diag';
      }

      const reversalChance = this.hardDifficulty
        ? SPIDER.VERTICAL_REVERSAL_CHANCE_HARD
        : SPIDER.VERTICAL_REVERSAL_CHANCE_EASY;
      if (this.rng.chance(reversalChance)) {
        this.verticalDir = (this.verticalDir * -1) as 1 | -1;
      }
    }

    const nx = this.mode === 'diag' ? this.x + this.exitDir * this.speed * dt : this.x;
    let ny = this.y + this.verticalDir * this.speed * dt;

    if (ny <= minRow) {
      ny = minRow;
      this.verticalDir = 1;
    } else if (ny >= maxRow) {
      ny = maxRow;
      this.verticalDir = -1;
    }

    if (world.isCentipedeOccupied(Math.round(ny), Math.round(nx))) {
      this.verticalDir = (this.verticalDir * -1) as 1 | -1;
    } else {
      this.x = nx;
      this.y = ny;
    }

    const col = Math.round(this.x);
    const row = Math.round(this.y);
    if (world.mushrooms.has(row, col)) world.mushrooms.remove(row, col);

    if (this.x < -1.5 || this.x > GRID.COLS + 2.5) this.alive = false;
  }

  get col(): number {
    return Math.round(this.x);
  }
  get row(): number {
    return Math.round(this.y);
  }
}

export function spiderZoneMaxRow(score: number): number {
  for (const band of SPIDER.ZONE_BY_SCORE) {
    if (score <= band.upTo) return band.maxRow;
  }
  return 12;
}
