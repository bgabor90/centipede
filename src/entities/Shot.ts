import { GRID, SHOOTER } from '../config';

/**
 * The single player shot. Centipede's Shooter can only ever have one shot in
 * flight at a time (see manual: "The Firing Mechanism") — this is enforced
 * by the caller only creating a new Shot when the previous one is gone.
 */
export class Shot {
  col: number; // locked to an integer column at fire time — used for all collision
  row: number; // fractional, travels upward
  visualX: number; // the shooter's exact fractional x at fire time — rendering only
  alive = true;

  constructor(col: number, row: number, visualX: number = col) {
    this.col = col;
    this.row = row;
    this.visualX = visualX;
  }

  update(dt: number): { prevRow: number; newRow: number } {
    const prevRow = this.row;
    this.row += SHOOTER.SHOT_SPEED * dt;
    if (this.row > GRID.ROWS + 1) this.alive = false;
    return { prevRow, newRow: this.row };
  }
}
