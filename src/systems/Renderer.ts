import { GRID } from '../config';
import type { Game } from '../Game';
import type { SegmentView } from '../entities/Centipede';
import type { FeatureFlags } from '../config';
import { drawBitmapText, measureText } from './BitmapFont';

export const CELL = 8;
export const HEADER_H = 24;
export const FOOTER_H = 18;
export const CANVAS_W = GRID.COLS * CELL;
export const CANVAS_H = HEADER_H + GRID.ROWS * CELL + FOOTER_H;

const COLORS = {
  bg: '#000000',
  headerText: '#ffffff',
  scoreP1: '#ffffff',
  hiScore: '#3ad6ff',
  stem: '#e8e8d8',
  cap: ['#ff5a3c', '#ff9d2e', '#e84fa0', '#5ad1e6'],
  capPoison: '#a64bff',
  head: '#ffe23c',
  headEye: '#c81e3c',
  bodyA: '#3cff6e',
  bodyB: '#2ec7ff',
  poisonedSeg: '#a64bff',
  spiderBody: '#33d0ff',
  spiderLeg: '#ff6ec8',
  flea: '#ff3c6e',
  scorpion: '#ffb02e',
  shooter: '#4be8ff',
  shot: '#ffffff',
  lives: '#4be8ff',
  gridLine: 'rgba(255,255,255,0.08)',
} as const;

// 8x8 pristine mushroom mask; damage removes cells in `biteOrder`.
const MUSHROOM_MASK = [
  '..CCCC..',
  '.CCCCCC.',
  'CCCCCCCC',
  'CCCCCCCC',
  '..SSSS..',
  '..SSSS..',
  '..SSSS..',
  '........',
].map((row) => row.split(''));

// Order in which cap cells are chipped away as the mushroom takes hits,
// biased to eat one corner first so damage reads as a "bite."
const BITE_ORDER: Array<[number, number]> = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 6], [1, 7], [2, 7], [3, 7],
  [1, 0], [1, 1], [2, 0], [3, 0],
  [2, 1], [2, 6], [3, 6], [3, 1],
];

/**
 * Everything in this renderer is drawn on a hard pixel grid — every fill
 * origin is `Math.round`ed before it reaches the canvas API. Left
 * unrounded, sub-pixel positions (which happen constantly, since entities
 * move continuously) get anti-aliased by the canvas, and that soft edge
 * then gets blown up 3-4x by the CSS upscale into visible blur. Real
 * arcade hardware had no sub-pixel positions to begin with; snapping here
 * reproduces that hard-edged look and is what actually fixes the blur.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private frame = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  resizeToFit(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const availW = window.innerWidth;
    const availH = window.innerHeight - 32;
    const scale = Math.max(1, Math.floor(Math.min(availW / CANVAS_W, availH / CANVAS_H)));
    this.canvas.style.width = `${CANVAS_W * scale}px`;
    this.canvas.style.height = `${CANVAS_H * scale}px`;
  }

  render(game: Game, features: FeatureFlags): void {
    this.frame++;
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawHeader(game);
    this.drawPlayfieldBorder();
    if (features.showGrid) this.drawGrid();

    this.drawMushrooms(game);
    this.drawCentipede(game);
    if (game.spider) this.drawSpider(game.spider);
    if (game.flea) this.drawFlea(game.flea);
    if (game.scorpion) this.drawScorpion(game.scorpion);
    if (game.shot) this.drawShot(game.shot);
    if (game.state === 'PLAYING') this.drawShooter(game.shooter);

    this.drawFooter(game);

    if (features.crtFilter) this.drawCrtOverlay();
    if (game.state === 'GAME_OVER') this.drawGameOver();
    if (game.state === 'ATTRACT') this.drawAttract();
    if (features.debugOverlay) this.drawDebug(game);
  }

  // -- coordinate helpers -------------------------------------------------
  private px(col: number): number {
    return (col - 1) * CELL;
  }
  private py(row: number): number {
    return HEADER_H + (GRID.ROWS - row) * CELL;
  }
  /** Rounded pixel center of a (possibly fractional) grid position. */
  private center(col: number, row: number): { cx: number; cy: number } {
    return {
      cx: Math.round(this.px(col) + CELL / 2),
      cy: Math.round(this.py(row) + CELL / 2),
    };
  }
  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  private text(str: string, x: number, y: number, color: string, scale = 1): void {
    drawBitmapText(this.ctx, str, x, y, color, scale);
  }
  private centeredText(str: string, cx: number, y: number, color: string, scale = 1): void {
    drawBitmapText(this.ctx, str, cx - measureText(str, scale) / 2, y, color, scale);
  }

  // -- header / footer ------------------------------------------------------
  private drawHeader(game: Game): void {
    this.text('1UP', 4, 2, COLORS.scoreP1);
    this.text(pad(game.score, 6), 4, 11, COLORS.scoreP1);
    this.centeredText('HIGH SCORE', CANVAS_W / 2, 2, COLORS.hiScore);
    this.centeredText(pad(game.highScore, 6), CANVAS_W / 2, 11, COLORS.scoreP1);
  }

  private drawFooter(game: Game): void {
    const y = CANVAS_H - FOOTER_H + 5;
    for (let i = 0; i < Math.max(0, game.lives - 1); i++) {
      this.drawDiamond(6 + i * 10, y + 3, 3, COLORS.lives);
    }
    const label = `WAVE ${game.waveNumber}`;
    this.text(label, CANVAS_W - measureText(label) - 4, y, COLORS.headerText);
  }

  private drawPlayfieldBorder(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, HEADER_H + 0.5, CANVAS_W - 1, GRID.ROWS * CELL - 1);
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.gridLine;
    for (let c = 1; c <= GRID.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(this.px(c), HEADER_H);
      ctx.lineTo(this.px(c), HEADER_H + GRID.ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 1; r <= GRID.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, this.py(r));
      ctx.lineTo(CANVAS_W, this.py(r));
      ctx.stroke();
    }
  }

  /** A hard-edged pixel diamond — used for the shooter and the lives readout. */
  private drawDiamond(cx: number, cy: number, radius: number, color: string): void {
    for (let dy = -radius; dy <= radius; dy++) {
      const half = radius - Math.abs(dy);
      this.rect(cx - half, cy + dy, half * 2 + 1, 1, color);
    }
  }

  // -- entities -------------------------------------------------------------
  private drawMushrooms(game: Game): void {
    game.mushrooms.forEach((row, col, cell) => {
      const x = this.px(col);
      const y = this.py(row);
      const capColor = cell.poisoned
        ? COLORS.capPoison
        : COLORS.cap[(row + col) % COLORS.cap.length];
      const removed = new Set(BITE_ORDER.slice(0, cell.hits * 4).map(([r, c]) => `${r},${c}`));
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const ch = MUSHROOM_MASK[r][c];
          if (ch === '.') continue;
          if (ch === 'C' && removed.has(`${r},${c}`)) continue;
          this.rect(x + c, y + r, 1, 1, ch === 'C' ? capColor : COLORS.stem);
        }
      }
    });
  }

  private drawCentipede(game: Game): void {
    const views = game.centipede.getAllSegmentViews();
    for (const v of views) this.drawSegment(v, game.waveNumber);
  }

  private drawSegment(v: SegmentView, waveNumber: number): void {
    const { cx, cy } = this.center(v.col, v.row);
    const bodyPalette = [COLORS.bodyA, COLORS.bodyB];
    const bodyColor = v.poisoned ? COLORS.poisonedSeg : bodyPalette[(v.index + waveNumber) % 2];
    const mainColor = v.isHead ? COLORS.head : bodyColor;

    this.roundedBlock(cx - 3, cy - 3, 7, 7, mainColor);

    // little legs, alternating side based on frame parity for a walk-cycle feel
    const legPhase = (this.frame >> 3) % 2 === 0;
    this.rect(cx - 4, cy + (legPhase ? -2 : 1), 1, 2, bodyColor);
    this.rect(cx + 3, cy + (legPhase ? 1 : -2), 1, 2, bodyColor);

    if (v.isHead) {
      this.rect(cx - 2, cy - 1, 1, 1, COLORS.headEye);
      this.rect(cx + 1, cy - 1, 1, 1, COLORS.headEye);
    }
  }

  private drawSpider(spider: NonNullable<Game['spider']>): void {
    const { cx, cy } = this.center(spider.x, spider.y);
    for (const [dx, dy] of [
      [-5, -2], [5, -2], [-6, 1], [6, 1], [-4, 3], [4, 3],
    ] as const) {
      this.rect(cx + dx, cy + dy, 2, 1, COLORS.spiderLeg);
    }
    this.roundedBlock(cx - 3, cy - 3, 6, 6, COLORS.spiderBody);
  }

  private drawFlea(flea: NonNullable<Game['flea']>): void {
    const { cx, cy } = this.center(flea.col, flea.y);
    this.rect(cx - 2, cy - 4, 4, 8, COLORS.flea);
    this.rect(cx - 3, cy - 1, 1, 2, COLORS.flea);
    this.rect(cx + 2, cy - 1, 1, 2, COLORS.flea);
  }

  private drawScorpion(scorpion: NonNullable<Game['scorpion']>): void {
    const { cx, cy } = this.center(scorpion.x, scorpion.row);
    this.rect(cx - 4, cy - 2, 8, 4, COLORS.scorpion);
    this.rect(cx + 3 * scorpion.dir, cy - 4, 2, 2, COLORS.scorpion);
    this.rect(cx - 5 * scorpion.dir, cy - 3, 2, 3, COLORS.scorpion);
  }

  private drawShot(shot: NonNullable<Game['shot']>): void {
    const cx = Math.round(this.px(shot.col) + CELL / 2);
    const cy = Math.round(this.py(shot.row));
    this.rect(cx, cy - 3, 1, 6, COLORS.shot);
  }

  private drawShooter(shooter: Game['shooter']): void {
    const { cx, cy } = this.center(shooter.x, shooter.y);
    this.drawDiamond(cx, cy, 3, COLORS.shooter);
  }

  private drawCrtOverlay(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    for (let y = 0; y < CANVAS_H; y += 2) ctx.fillRect(0, y, CANVAS_W, 1);
    ctx.restore();
  }

  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HEADER_H, CANVAS_W, GRID.ROWS * CELL);
    this.centeredText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 14, '#ff3c3c', 2);
    this.centeredText('CLICK OR PRESS FIRE', CANVAS_W / 2, CANVAS_H / 2 + 6, '#fff');
    this.centeredText('TO CONTINUE', CANVAS_W / 2, CANVAS_H / 2 + 15, '#fff');
  }

  private drawAttract(): void {
    this.centeredText('CENTIPEDE', CANVAS_W / 2, 64, COLORS.head, 2);
    this.centeredText('CLICK OR PRESS FIRE', CANVAS_W / 2, 104, '#fff');
    this.centeredText('TO START', CANVAS_W / 2, 113, '#fff');
    this.centeredText('MOUSE = TRAK-BALL', CANVAS_W / 2, 132, COLORS.spiderBody);
  }

  drawPausedBanner(): void {
    this.centeredText('PAUSED', CANVAS_W / 2, CANVAS_H / 2, '#ffffff', 2);
  }

  private drawDebug(game: Game): void {
    const lines = [
      `${game.state} WAVE ${game.waveNumber}`,
      `SEGS ${game.centipede.totalSegments} CHAINS ${game.centipede.chains.length}`,
      `SHOOTER ${game.shooter.x.toFixed(1)} ${game.shooter.y.toFixed(1)}`,
    ];
    lines.forEach((l, i) => this.text(l, 2, HEADER_H + 2 + i * 8, '#33ff66'));
  }

  private roundedBlock(x: number, y: number, w: number, h: number, color: string): void {
    this.rect(x + 1, y, w - 2, h, color);
    this.rect(x, y + 1, w, h - 2, color);
  }
}

function pad(n: number, digits: number): string {
  return Math.floor(Math.max(0, n)).toString().padStart(digits, '0');
}
