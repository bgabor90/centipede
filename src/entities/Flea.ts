import { FLEA, GRID, ZONES } from '../config';
import { Random } from '../core/Random';
import { MushroomField } from './Mushroom';

export class Flea {
  col: number;
  y: number; // fractional row, descends from just above 30 down past 1
  speed: number;
  hits = 0;
  alive = true;
  private hitEscalated = false;
  private rng: Random;
  private lastWholeRow: number;

  constructor(col: number, rng: Random, score: number) {
    this.col = col;
    this.y = GRID.ROWS + 0.9;
    this.rng = rng;
    this.lastWholeRow = GRID.ROWS + 1;
    this.speed = score >= FLEA.FALL_SPEED_SCORE_THRESHOLD ? FLEA.FALL_SPEED_BASE_HIGH : FLEA.FALL_SPEED_BASE_LOW;
  }

  /** Call once when hit; escalates speed (fast -> very fast, never back) and tracks the 2-shot kill. */
  registerHit(): boolean {
    this.hits++;
    if (!this.hitEscalated) {
      this.hitEscalated = true;
      this.speed *= FLEA.HIT_SPEED_MULTIPLIER;
    }
    if (this.hits >= FLEA.SHOTS_TO_KILL) {
      this.alive = false;
      return true; // killed
    }
    return false;
  }

  update(dt: number, mushrooms: MushroomField): void {
    this.y -= this.speed * dt;
    const wholeRow = Math.ceil(this.y);
    for (let r = this.lastWholeRow - 1; r >= wholeRow; r--) {
      if (r < ZONES.MUSHROOM_MIN_ROW || r > GRID.ROWS) continue;
      if (!mushrooms.has(r, this.col) && this.rng.chance(FLEA.PLANT_CHANCE_PER_ROW)) {
        mushrooms.plant(r, this.col);
      }
    }
    this.lastWholeRow = wholeRow;
    if (this.y < 0) this.alive = false;
  }

  get row(): number {
    return Math.round(this.y);
  }

  /** A flea can only be shot once it has descended past every mushroom in its column. */
  isVulnerableAtRow(row: number, mushrooms: MushroomField): boolean {
    for (let r = ZONES.MUSHROOM_MIN_ROW; r < row; r++) {
      if (mushrooms.has(r, this.col)) return false;
    }
    return true;
  }
}
