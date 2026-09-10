import { GRID, ZONES } from '../config';
import { CELL, HEADER_H } from './Renderer';
import type { InputState } from '../Game';

/**
 * Reads mouse movement (standing in for the original cabinet's Trak-Ball)
 * and keyboard arrows/WASD as an accessible fallback, plus fire input from
 * click, Space, or the keyboard's original "Z" convention.
 */
export class InputSystem {
  private mouseCol = 15;
  private mouseRow = 1;
  private usingMouse = false;
  private keys = new Set<string>();
  private fireHeld = false;
  /** One-shot key presses (e.g. pause, feature panel) — populated on keydown
   * and only cleared when consumed, so a very brief press can't race past a
   * single animation frame the way checking the "currently held" set would. */
  private pressedEdges = new Set<string>();
  onFireEdge: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', () => {
      this.fireHeld = true;
      this.onFireEdge?.();
    });
    window.addEventListener('mouseup', () => (this.fireHeld = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => this.onTouch(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouch(e), { passive: false });
    canvas.addEventListener('touchend', () => (this.fireHeld = false));

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      this.pressedEdges.add(e.key.toLowerCase());
      if (e.key === ' ' || e.key.toLowerCase() === 'z') {
        if (!this.fireHeld) this.onFireEdge?.();
        this.fireHeld = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.key === ' ' || e.key.toLowerCase() === 'z') this.fireHeld = false;
    });
  }

  private onMouseMove(e: MouseEvent): void {
    this.usingMouse = true;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const lx = (e.clientX - rect.left) * scaleX;
    const ly = (e.clientY - rect.top) * scaleY;
    this.mouseCol = lx / CELL + 1;
    this.mouseRow = GRID.ROWS - (ly - HEADER_H) / CELL;
  }

  private onTouch(e: TouchEvent): void {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    this.usingMouse = true;
    this.fireHeld = true;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const lx = (t.clientX - rect.left) * scaleX;
    const ly = (t.clientY - rect.top) * scaleY;
    this.mouseCol = lx / CELL + 1;
    this.mouseRow = GRID.ROWS - (ly - HEADER_H) / CELL;
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  consumePause(): boolean {
    return this.consumeKeyPress('p');
  }

  consumeKeyPress(key: string): boolean {
    if (this.pressedEdges.has(key)) {
      this.pressedEdges.delete(key);
      return true;
    }
    return false;
  }

  computeInput(shooterX: number, shooterY: number): InputState {
    const left = this.isKeyDown('arrowleft') || this.isKeyDown('a');
    const right = this.isKeyDown('arrowright') || this.isKeyDown('d');
    const up = this.isKeyDown('arrowup') || this.isKeyDown('w');
    const down = this.isKeyDown('arrowdown') || this.isKeyDown('s');
    const keyboardActive = left || right || up || down;

    if (keyboardActive) {
      this.usingMouse = false;
      const dx = (right ? 1 : 0) - (left ? 1 : 0);
      const dy = (up ? 1 : 0) - (down ? 1 : 0);
      return {
        targetX: clamp(shooterX + dx * 100, 1, GRID.COLS),
        targetY: clamp(shooterY + dy * 100, 1, ZONES.SHOOTER_MAX_ROW),
        firing: this.fireHeld,
        instantMove: false,
      };
    }

    return {
      targetX: clamp(this.mouseCol, 1, GRID.COLS),
      targetY: clamp(this.mouseRow, 1, ZONES.SHOOTER_MAX_ROW),
      firing: this.fireHeld,
      instantMove: this.usingMouse,
    };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
