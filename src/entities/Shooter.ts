import { GRID, SHOOTER, ZONES } from '../config';
import { MushroomField } from './Mushroom';

export class Shooter {
  x: number; // column, fractional, 1..30
  y: number; // row, fractional, 1..6
  alive = true;

  constructor() {
    this.x = SHOOTER.START_COL;
    this.y = SHOOTER.START_ROW;
  }

  reset(): void {
    this.x = SHOOTER.START_COL;
    this.y = SHOOTER.START_ROW;
    this.alive = true;
  }

  /** Moves toward (targetX, targetY), clamped to the shooter zone and mushrooms. */
  moveToward(targetX: number, targetY: number, dt: number, mushrooms: MushroomField, instant = false, speed: number = SHOOTER.MOVE_SPEED): void {
    const clampedX = clamp(targetX, 1, GRID.COLS);
    const clampedY = clamp(targetY, 1, ZONES.SHOOTER_MAX_ROW);

    let nx: number, ny: number;
    if (instant) {
      nx = clampedX;
      ny = clampedY;
    } else {
      const maxStep = speed * dt;
      nx = stepToward(this.x, clampedX, maxStep);
      ny = stepToward(this.y, clampedY, maxStep);
    }

    // Resolve axis-independently against mushroom AABBs so the shooter can
    // slide along a mushroom's edge instead of getting fully stuck.
    if (!this.collidesAt(nx, this.y, mushrooms)) this.x = nx;
    if (!this.collidesAt(this.x, ny, mushrooms)) this.y = ny;
  }

  private collidesAt(x: number, y: number, mushrooms: MushroomField): boolean {
    const col = Math.round(x);
    const row = Math.round(y);
    if (row < 1) return false;
    return mushrooms.isBlocking(row, col) && Math.abs(x - col) < 0.4 && Math.abs(y - row) < 0.4;
  }

  get col(): number {
    return Math.round(this.x);
  }

  get row(): number {
    return Math.round(this.y);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function stepToward(cur: number, target: number, maxStep: number): number {
  const diff = target - cur;
  if (Math.abs(diff) <= maxStep) return target;
  return cur + Math.sign(diff) * maxStep;
}
