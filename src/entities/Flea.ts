import { FLEA, GRID, ZONES } from '../config';
import { Random } from '../core/Random';
import { MushroomField } from './Mushroom';

export class Flea {
  col: number;
  y: number; // fractional row, descends from just above 30 down past 1
  speed: number;
  hits = 0;
  alive = true;
  private plantRows: Set<number>;
  private plantedSoFar = new Set<number>();
  private lastWholeRow: number;

  constructor(col: number, rng: Random) {
    this.col = col;
    this.y = GRID.ROWS + 0.9;
    this.speed = FLEA.DROP_SPEED_FAST;
    this.lastWholeRow = GRID.ROWS + 1;

    const plantCount = rng.int(FLEA.PLANT_MIN, FLEA.PLANT_MAX);
    const candidateRows: number[] = [];
    for (let r = 2; r <= GRID.ROWS; r++) candidateRows.push(r);
    // Fisher-Yates partial shuffle to pick `plantCount` unique rows.
    for (let i = candidateRows.length - 1; i > 0 && candidateRows.length - i <= plantCount; i--) {
      const j = rng.int(0, i);
      [candidateRows[i], candidateRows[j]] = [candidateRows[j], candidateRows[i]];
    }
    this.plantRows = new Set(candidateRows.slice(-plantCount));
  }

  /** Call once when hit; escalates speed and tracks the 2-shot kill. */
  registerHit(): boolean {
    this.hits++;
    this.speed = FLEA.DROP_SPEED_VERY_FAST; // fast -> very fast on first hit; never reverses
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
      if (r < 2 || r > GRID.ROWS) continue;
      if (this.plantRows.has(r) && !this.plantedSoFar.has(r) && !mushrooms.has(r, this.col)) {
        mushrooms.plant(r, this.col);
        this.plantedSoFar.add(r);
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
