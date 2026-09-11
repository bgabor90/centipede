import { GRID } from '../config';
import { MushroomField } from './Mushroom';
import type { Direction } from '../types';

export class Scorpion {
  row: number;
  x: number; // fractional column
  dir: Direction;
  speed: number;
  alive = true;

  constructor(row: number, startFromLeft: boolean, speed: number) {
    this.row = row;
    this.dir = startFromLeft ? 1 : -1;
    this.x = startFromLeft ? 0 : GRID.COLS + 1;
    this.speed = speed;
  }

  update(dt: number, mushrooms: MushroomField): void {
    this.x += this.speed * dt * this.dir;
    const col = Math.round(this.x);
    // VERIFIED (MoveScorpion, $2ecc): the ROM only poisons a fully-intact
    // mushroom ("is this an un-poisoned mushroom?") -- a cell that's
    // already damaged or already poisoned is left alone as the scorpion
    // passes over it.
    const cell = mushrooms.get(this.row, col);
    if (col >= 1 && col <= GRID.COLS && cell && !cell.poisoned && cell.hits === 0) {
      mushrooms.poison(this.row, col);
    }
    if (this.x < -1 || this.x > GRID.COLS + 2) this.alive = false;
  }

  get col(): number {
    return Math.round(this.x);
  }
}
