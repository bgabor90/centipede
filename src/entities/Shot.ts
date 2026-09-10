import { GRID, SHOOTER } from '../config';

/**
 * The single player shot. Centipede's Shooter can only ever have one shot in
 * flight at a time (see manual: "The Firing Mechanism") — this is enforced
 * by the caller only creating a new Shot when the previous one is gone.
 */
export class Shot {
  col: number; // locked to an integer column at fire time
  row: number; // fractional, travels upward
  alive = true;

  constructor(col: number, row: number) {
    this.col = col;
    this.row = row;
  }

  update(dt: number): { prevRow: number; newRow: number } {
    const prevRow = this.row;
    this.row += SHOOTER.SHOT_SPEED * dt;
    if (this.row > GRID.ROWS + 1) this.alive = false;
    return { prevRow, newRow: this.row };
  }
}
