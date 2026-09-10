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
 * The Spider never reverses its net column direction — it always enters at
 * row 12 near one side and eventually exits the far side. Along the way it
 * alternates 45-degree diagonal "slashes" with vertical bounce holding
 * patterns, per the manual's description (Figs. 13-15).
 */
export class Spider {
  x: number;
  y = 12;
  readonly exitDir: Direction;
  speed: number;
  alive = true;
  private mode: Mode = 'diag';
  private verticalDir: 1 | -1 = -1;
  private verticalTarget = 1;
  private rng: Random;
  private modeTimer = 0;

  constructor(enterFromLeft: boolean, speed: number, rng: Random) {
    this.exitDir = enterFromLeft ? 1 : -1;
    this.x = enterFromLeft ? 0 : GRID.COLS + 1;
    this.speed = speed;
    this.rng = rng;
    this.pickNewVerticalTarget(12, 1);
  }

  private pickNewVerticalTarget(maxRow: number, minRow: number): void {
    this.verticalTarget = this.rng.int(minRow, maxRow);
  }

  update(dt: number, world: SpiderWorld): void {
    const minRow = 1;
    const maxRow = world.maxRow;
    const DIAG = Math.SQRT1_2;

    if (this.mode === 'diag') {
      const nx = this.x + this.exitDir * this.speed * dt * DIAG;
      let ny = this.y + this.verticalDir * this.speed * dt * DIAG;
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
      this.modeTimer += dt;
      if (this.modeTimer > 0.35 && this.rng.chance(0.35 * dt * 6)) {
        this.mode = 'vertical';
        this.modeTimer = 0;
        this.pickNewVerticalTarget(maxRow, minRow);
      }
    } else {
      const dir = this.y < this.verticalTarget ? 1 : -1;
      const ny = this.y + dir * this.speed * dt;
      const reached = (dir === 1 && ny >= this.verticalTarget) || (dir === -1 && ny <= this.verticalTarget);
      const clampedY = Math.min(maxRow, Math.max(minRow, ny));
      if (world.isCentipedeOccupied(Math.round(clampedY), Math.round(this.x))) {
        this.verticalDir = (dir * -1) as 1 | -1;
        this.mode = 'diag';
      } else {
        this.y = clampedY;
      }
      if (reached) {
        this.modeTimer += dt;
        if (this.rng.chance(0.45)) {
          // Bounce again to a new height (irregular holding pattern).
          this.pickNewVerticalTarget(maxRow, minRow);
        } else {
          this.mode = 'diag';
          this.verticalDir = this.rng.chance(0.5) ? 1 : -1;
          this.modeTimer = 0;
        }
      }
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
