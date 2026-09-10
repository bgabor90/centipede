import { GRID, ZONES } from '../config';
import type { Game } from '../Game';
import type { SegmentView } from '../entities/Centipede';
import type { FeatureFlags } from '../config';

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
    if (game.state === 'GAME_OVER') this.drawGameOver(game);
    if (game.state === 'ATTRACT') this.drawAttract(game);
    if (features.debugOverlay) this.drawDebug(game);
  }

  // -- coordinate helpers -------------------------------------------------
  private px(col: number): number {
    return (col - 1) * CELL;
  }
  private py(row: number): number {
    return HEADER_H + (GRID.ROWS - row) * CELL;
  }

  // -- header / footer ------------------------------------------------------
  private drawHeader(game: Game): void {
    const ctx = this.ctx;
    ctx.textBaseline = 'top';
    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = COLORS.scoreP1;
    ctx.fillText('1UP', 4, 2);
    ctx.fillText(pad(game.score, 6), 4, 11);

    ctx.fillStyle = COLORS.hiScore;
    const hiLabel = 'HIGH SCORE';
    ctx.fillText(hiLabel, CANVAS_W / 2 - ctx.measureText(hiLabel).width / 2, 2);
    const hiVal = pad(game.highScore, 6);
    ctx.fillStyle = COLORS.scoreP1;
    ctx.fillText(hiVal, CANVAS_W / 2 - ctx.measureText(hiVal).width / 2, 11);
  }

  private drawFooter(game: Game): void {
    const ctx = this.ctx;
    const y = CANVAS_H - FOOTER_H + 4;
    for (let i = 0; i < Math.max(0, game.lives - 1); i++) {
      this.drawShooterIcon(4 + i * 10, y);
    }
    ctx.font = '7px "Courier New", monospace';
    ctx.fillStyle = COLORS.headerText;
    const label = `WAVE ${game.waveNumber}`;
    ctx.fillText(label, CANVAS_W - ctx.measureText(label).width - 4, y);
  }

  private drawShooterIcon(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.lives;
    ctx.beginPath();
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 6, y + 8);
    ctx.lineTo(x, y + 8);
    ctx.closePath();
    ctx.fill();
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
          this.ctx.fillStyle = ch === 'C' ? capColor : COLORS.stem;
          this.ctx.fillRect(x + c, y + r, 1, 1);
        }
      }
    });
  }

  private drawCentipede(game: Game): void {
    const views = game.centipede.getAllSegmentViews();
    for (const v of views) this.drawSegment(v, game.waveNumber);
  }

  private drawSegment(v: SegmentView, waveNumber: number): void {
    const ctx = this.ctx;
    const cx = this.px(v.col) + CELL / 2;
    const cy = this.py(v.row) + CELL / 2;
    const bodyPalette = [COLORS.bodyA, COLORS.bodyB];
    const bodyColor = v.poisoned ? COLORS.poisonedSeg : bodyPalette[(v.index + waveNumber) % 2];

    ctx.fillStyle = v.isHead ? COLORS.head : bodyColor;
    roundedBlock(ctx, cx - 3.5, cy - 3.5, 7, 7);

    // little legs, alternating side based on frame parity for a walk-cycle feel
    const legPhase = (this.frame >> 3) % 2 === 0;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx - 4, cy + (legPhase ? -2 : 1), 1, 2);
    ctx.fillRect(cx + 3, cy + (legPhase ? 1 : -2), 1, 2);

    if (v.isHead) {
      ctx.fillStyle = COLORS.headEye;
      ctx.fillRect(cx - 2, cy - 1, 1, 1);
      ctx.fillRect(cx + 1, cy - 1, 1, 1);
    }
  }

  private drawSpider(spider: NonNullable<Game['spider']>): void {
    const ctx = this.ctx;
    const cx = this.px(spider.x) + CELL / 2;
    const cy = this.py(spider.y) + CELL / 2;
    ctx.fillStyle = COLORS.spiderLeg;
    for (const [dx, dy] of [
      [-5, -2], [5, -2], [-6, 1], [6, 1], [-4, 3], [4, 3],
    ]) {
      ctx.fillRect(cx + dx, cy + dy, 2, 1);
    }
    ctx.fillStyle = COLORS.spiderBody;
    roundedBlock(ctx, cx - 3, cy - 3, 6, 6);
  }

  private drawFlea(flea: NonNullable<Game['flea']>): void {
    const ctx = this.ctx;
    const cx = this.px(flea.col) + CELL / 2;
    const cy = this.py(flea.y) + CELL / 2;
    ctx.fillStyle = COLORS.flea;
    ctx.fillRect(cx - 2, cy - 4, 4, 8);
    ctx.fillRect(cx - 3, cy - 1, 1, 2);
    ctx.fillRect(cx + 2, cy - 1, 1, 2);
  }

  private drawScorpion(scorpion: NonNullable<Game['scorpion']>): void {
    const ctx = this.ctx;
    const cx = this.px(scorpion.x) + CELL / 2;
    const cy = this.py(scorpion.row) + CELL / 2;
    ctx.fillStyle = COLORS.scorpion;
    ctx.fillRect(cx - 4, cy - 2, 8, 4);
    ctx.fillRect(cx + 3 * scorpion.dir, cy - 4, 2, 2);
    ctx.fillRect(cx - 5 * scorpion.dir, cy - 3, 2, 3);
  }

  private drawShot(shot: NonNullable<Game['shot']>): void {
    const ctx = this.ctx;
    const x = this.px(shot.col) + CELL / 2;
    const y = this.py(shot.row);
    ctx.fillStyle = COLORS.shot;
    ctx.fillRect(x - 0.5, y - 3, 1, 6);
  }

  private drawShooter(shooter: Game['shooter']): void {
    const ctx = this.ctx;
    const cx = this.px(shooter.x) + CELL / 2;
    const cy = this.py(shooter.y) + CELL / 2;
    ctx.fillStyle = COLORS.shooter;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.lineTo(cx, cy + 1);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.closePath();
    ctx.fill();
  }

  private drawCrtOverlay(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    for (let y = 0; y < CANVAS_H; y += 2) ctx.fillRect(0, y, CANVAS_W, 1);
    ctx.restore();
  }

  private drawGameOver(game: Game): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HEADER_H, CANVAS_W, GRID.ROWS * CELL);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#ff3c3c';
    const text = 'GAME OVER';
    ctx.fillText(text, CANVAS_W / 2 - ctx.measureText(text).width / 2, CANVAS_H / 2 - 10);
    ctx.font = '7px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    const sub = 'CLICK OR PRESS FIRE TO CONTINUE';
    ctx.fillText(sub, CANVAS_W / 2 - ctx.measureText(sub).width / 2, CANVAS_H / 2 + 8);
  }

  private drawAttract(game: Game): void {
    const ctx = this.ctx;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = COLORS.head;
    const title = 'CENTIPEDE';
    ctx.fillText(title, CANVAS_W / 2 - ctx.measureText(title).width / 2, 70);
    ctx.font = '7px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    const sub = 'CLICK OR PRESS FIRE TO START';
    ctx.fillText(sub, CANVAS_W / 2 - ctx.measureText(sub).width / 2, 110);
    ctx.fillStyle = COLORS.spiderBody;
    ctx.fillText('MOUSE = TRAK-BALL', CANVAS_W / 2 - ctx.measureText('MOUSE = TRAK-BALL').width / 2, 130);
  }

  private drawDebug(game: Game): void {
    const ctx = this.ctx;
    ctx.font = '6px monospace';
    ctx.fillStyle = '#0f0';
    const lines = [
      `state=${game.state} wave=${game.waveNumber}`,
      `segs=${game.centipede.totalSegments} chains=${game.centipede.chains.length}`,
      `shooter=${game.shooter.x.toFixed(1)},${game.shooter.y.toFixed(1)}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 2, HEADER_H + 2 + i * 7));
  }
}

function pad(n: number, digits: number): string {
  return Math.floor(Math.max(0, n)).toString().padStart(digits, '0');
}

function roundedBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
}
