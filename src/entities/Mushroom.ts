import { GRID, MUSHROOM, ZONES } from '../config';

export interface MushroomCell {
  hits: number; // 0 = pristine, up to HITS_TO_DESTROY-1 = damaged, destroyed = removed
  poisoned: boolean;
}

/**
 * The mushroom field: a 30x30 grid (row 1 = bottom .. row 30 = top) of
 * optional mushrooms. Row 1 can never hold a mushroom (see manual: fleas
 * never plant there, and links can only be replaced by mushrooms above the
 * shooter's row).
 */
export class MushroomField {
  private cells: (MushroomCell | null)[][]; // [row-1][col-1]

  constructor() {
    this.cells = Array.from({ length: GRID.ROWS }, () =>
      Array.from({ length: GRID.COLS }, () => null)
    );
  }

  private idx(row: number, col: number): MushroomCell | null {
    if (row < 1 || row > GRID.ROWS || col < 1 || col > GRID.COLS) return null;
    return this.cells[row - 1][col - 1];
  }

  get(row: number, col: number): MushroomCell | null {
    return this.idx(row, col);
  }

  has(row: number, col: number): boolean {
    return this.idx(row, col) !== null;
  }

  isBlocking(row: number, col: number): boolean {
    // A mushroom always blocks horizontal movement regardless of damage
    // (only fully-destroyed mushrooms stop blocking).
    return this.has(row, col);
  }

  plant(row: number, col: number, opts?: { poisoned?: boolean; force?: boolean }): boolean {
    if (row < ZONES.MUSHROOM_MIN_ROW || row > GRID.ROWS) return false;
    if (col < 1 || col > GRID.COLS) return false;
    if (!opts?.force && this.has(row, col)) return false;
    this.cells[row - 1][col - 1] = { hits: 0, poisoned: !!opts?.poisoned };
    return true;
  }

  remove(row: number, col: number): void {
    if (row < 1 || row > GRID.ROWS || col < 1 || col > GRID.COLS) return;
    this.cells[row - 1][col - 1] = null;
  }

  /** Returns 'destroyed' | 'damaged' | 'none' for scoring/effects purposes. */
  shoot(row: number, col: number): 'destroyed' | 'damaged' | 'none' {
    const cell = this.idx(row, col);
    if (!cell) return 'none';
    cell.hits++;
    if (cell.hits >= MUSHROOM.HITS_TO_DESTROY) {
      this.remove(row, col);
      return 'destroyed';
    }
    return 'damaged';
  }

  poison(row: number, col: number): void {
    const cell = this.idx(row, col);
    if (cell) cell.poisoned = true;
  }

  isPoisoned(row: number, col: number): boolean {
    return this.idx(row, col)?.poisoned ?? false;
  }

  /** Clears poison + repairs all damage. Called during the end-of-life tally. */
  restoreAll(): { poisonedCleared: number; damagedRepaired: number } {
    let poisonedCleared = 0;
    let damagedRepaired = 0;
    for (let r = 0; r < GRID.ROWS; r++) {
      for (let c = 0; c < GRID.COLS; c++) {
        const cell = this.cells[r][c];
        if (!cell) continue;
        if (cell.poisoned) poisonedCleared++;
        if (cell.hits > 0) damagedRepaired++;
        cell.poisoned = false;
        cell.hits = 0;
      }
    }
    return { poisonedCleared, damagedRepaired };
  }

  clearAll(): void {
    for (let r = 0; r < GRID.ROWS; r++) {
      for (let c = 0; c < GRID.COLS; c++) this.cells[r][c] = null;
    }
  }

  countInfield(): number {
    let count = 0;
    for (let r = 0; r < ZONES.INFIELD_MAX_ROW; r++) {
      for (let c = 0; c < GRID.COLS; c++) {
        if (this.cells[r][c]) count++;
      }
    }
    return count;
  }

  countTotal(): number {
    let count = 0;
    for (let r = 0; r < GRID.ROWS; r++)
      for (let c = 0; c < GRID.COLS; c++) if (this.cells[r][c]) count++;
    return count;
  }

  /** Random empty cell within [minRow, maxRow], or null if the band is full. */
  randomEmptyCell(
    rng: { int: (a: number, b: number) => number },
    minRow: number,
    maxRow: number
  ): { row: number; col: number } | null {
    const candidates: { row: number; col: number }[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = 1; c <= GRID.COLS; c++) {
        if (!this.has(r, c)) candidates.push({ row: r, col: c });
      }
    }
    if (candidates.length === 0) return null;
    return candidates[rng.int(0, candidates.length - 1)];
  }

  forEach(fn: (row: number, col: number, cell: MushroomCell) => void): void {
    for (let r = 0; r < GRID.ROWS; r++) {
      for (let c = 0; c < GRID.COLS; c++) {
        const cell = this.cells[r][c];
        if (cell) fn(r + 1, c + 1, cell);
      }
    }
  }
}
