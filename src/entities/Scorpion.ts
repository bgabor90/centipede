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
    if (col >= 1 && col <= GRID.COLS && mushrooms.has(this.row, col)) {
      mushrooms.poison(this.row, col);
    }
    if (this.x < -1 || this.x > GRID.COLS + 2) this.alive = false;
  }

  get col(): number {
    return Math.round(this.x);
  }
}
