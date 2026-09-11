import { GRID } from '../config';
import type { Game } from '../Game';
import type { SegmentView } from '../entities/Centipede';
import type { FeatureFlags } from '../config';
import { GLYPH_W, drawBitmapText, measureText } from './BitmapFont';
import { getWavePalette } from './Palette';
import { CENTIPEDE_MASK, FLEA_MASK, SCORPION_MASK, SPIDER_MASK, renderMask } from './Sprites';

// Verified screen/tile geometry (6502disassembly.com/va-centipede/graphics.html):
// "Resolution: 240x256 pixels", "30x32 grid of 8x8 pixel tiles", gameplay
// area 30x30 with row 31 (top) holding the score display and row 0
// (bottom) unused during gameplay. CELL/CANVAS_W/CANVAS_H below reproduce
// that exactly: one 8px tile-row for score, 30 tile-rows of gameplay, one
// 8px tile-row left blank during play (used for a disclaimer in attract
// mode, since reproducing Atari's own copyright string isn't appropriate
// for a fan project).
export const CELL = 8;
export const HEADER_H = CELL;
export const FOOTER_H = CELL;
export const CANVAS_W = GRID.COLS * CELL; // 240
export const CANVAS_H = HEADER_H + GRID.ROWS * CELL + FOOTER_H; // 256

const COLORS = {
  bg: '#000000',
  scoreText: '#ffffff',
  hiScore: '#3ad6ff',
  attractText: '#ff8822',
  stem: '#e8e8d8',
  capPoison: '#a64bff',
  poisonedSeg: '#a64bff',
  spiderBody: '#33d0ff',
  spiderLeg: '#ff6ec8',
  flea: '#ff3c6e',
  scorpion: '#ffb02e',
  scorpionTail: '#cc6a12',
  shot: '#ffffff',
  gridLine: 'rgba(255,255,255,0.08)',
  disclaimer: '#3a3a3a',
} as const;

// 8x8 mushroom mask: a two-tone cap (fill 'F' + a darker rim 'R' outline)
// over a stem — a rounder, less flat-looking mushroom than a single-color
// cap. Damage removes cells in `CAP_BITE_ORDER`.
const MUSHROOM_MASK = [
  '..RRRR..',
  '.RFFFFR.',
  'RFFFFFFR',
  'RFFFFFFR',
  '.RFFFFR.',
  '..SSSS..',
  '..SSSS..',
  '........',
].map((row) => row.split(''));

// Every cap cell (fill or rim), ordered by distance from the top-right
// corner so damage reads as a bite eating inward from one side, generated
// from the mask rather than hand-listed.
const CAP_BITE_ORDER: Array<[number, number]> = (() => {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < MUSHROOM_MASK.length; r++) {
    for (let c = 0; c < MUSHROOM_MASK[r].length; c++) {
      if (MUSHROOM_MASK[r][c] !== '.' && MUSHROOM_MASK[r][c] !== 'S') cells.push([r, c]);
    }
  }
  cells.sort((a, b) => a[0] + (7 - a[1]) - (b[0] + (7 - b[1])));
  return cells;
})();
const BITE_CHUNK = Math.ceil(CAP_BITE_ORDER.length / 3);

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
    const palette = getWavePalette(game.waveNumber);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawHeader(game, palette.eyes);
    this.drawPlayfieldBorder();
    if (features.showGrid) this.drawGrid();

    this.drawMushrooms(game, palette.body, palette.eyes);
    this.drawCentipede(game, palette);
    if (game.spider) this.drawSpider(game.spider);
    if (game.flea) this.drawFlea(game.flea);
    if (game.scorpion) this.drawScorpion(game.scorpion);
    if (game.shot) this.drawShot(game.shot);
    if (game.state === 'PLAYING' || game.state === 'ATTRACT' || game.state === 'HIGH_SCORE_ENTRY') {
      this.drawShooter(game.shooter, palette.legs);
    }

    this.drawFooter(game);

    if (features.crtFilter) this.drawCrtOverlay();
    if (game.state === 'GAME_OVER') this.drawGameOver();
    if (game.state === 'ATTRACT') this.drawAttract(game);
    if (game.state === 'HIGH_SCORE_ENTRY') this.drawHighScoreEntry(game);
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
  // Real hardware fits the whole HUD into a single 8px tile-row (row 31),
  // so P1 score, HIGH SCORE, and the lives readout are laid out side by
  // side on one line rather than stacked — width is plentiful (30 tile
  // columns), height is not.
  private drawHeader(game: Game, textColor: string): void {
    this.text('1UP', 2, 1, textColor);
    this.text(pad(game.score, 6), 24, 1, textColor);
    this.centeredText('HIGH SCORE', CANVAS_W / 2, 1, COLORS.hiScore);
    const hiVal = pad(game.highScore, 6);
    this.text(hiVal, CANVAS_W / 2 + 45, 1, textColor);

    const lives = Math.max(0, game.lives - 1);
    for (let i = 0; i < lives; i++) {
      this.drawDiamond(CANVAS_W - 6 - i * 8, 4, 2, textColor);
    }
  }

  // Row 0 (bottom) is documented as unused during gameplay — left blank
  // here to match, with a small disclaimer only shown outside play.
  private drawFooter(game: Game): void {
    if (game.state === 'ATTRACT' || game.state === 'GAME_OVER') {
      this.centeredText('FAN-MADE - NOT AN ATARI PRODUCT', CANVAS_W / 2, CANVAS_H - 7, COLORS.disclaimer);
    }
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
  private drawMushrooms(game: Game, fillColor: string, rimColor: string): void {
    game.mushrooms.forEach((row, col, cell) => {
      const x = this.px(col);
      const y = this.py(row);
      const fill = cell.poisoned ? COLORS.capPoison : fillColor;
      const rim = cell.poisoned ? COLORS.capPoison : rimColor;
      const removed = new Set(
        CAP_BITE_ORDER.slice(0, cell.hits * BITE_CHUNK).map(([r, c]) => `${r},${c}`)
      );
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const ch = MUSHROOM_MASK[r][c];
          if (ch === '.') continue;
          if ((ch === 'F' || ch === 'R') && removed.has(`${r},${c}`)) continue;
          const color = ch === 'F' ? fill : ch === 'R' ? rim : COLORS.stem;
          this.rect(x + c, y + r, 1, 1, color);
        }
      }
    });
  }

  private drawCentipede(game: Game, palette: { body: string; legs: string; eyes: string }): void {
    const views = game.centipede.getAllSegmentViews();
    for (const v of views) this.drawSegment(v, palette);
  }

  private putPixel = (x: number, y: number, color: string): void => this.rect(x, y, 1, 1, color);

  // The original reuses one sprite per row via a horizontal-flip flag
  // rather than drawing separate left/right art; `dir` mirrors the mask
  // and the leg/eye offsets the same way here.
  private drawSegment(v: SegmentView, palette: { body: string; legs: string; eyes: string }): void {
    const { cx, cy } = this.center(v.col, v.row);
    const bodyColor = v.poisoned ? COLORS.poisonedSeg : palette.body;
    const flip = v.dir < 0;

    renderMask(this.putPixel, CENTIPEDE_MASK, cx, cy, { F: bodyColor }, flip);

    // Legs cycle their horizontal position (a "conveyor belt" effect along
    // the body) rather than flapping up and down, stepping at a fast,
    // slightly-jumpy cadence like the original's frame-by-frame animation.
    const legShift = Math.floor(this.frame / 4) % 2;
    this.rect(cx - 7 + legShift, cy - 4, 1, 1, palette.legs);
    this.rect(cx + 1 + legShift, cy - 4, 1, 1, palette.legs);
    this.rect(cx - 3 + legShift, cy + 3, 1, 1, palette.legs);
    this.rect(cx + 5 + legShift, cy + 3, 1, 1, palette.legs);

    if (v.isHead) {
      const eyeDx = flip ? -3 : 3;
      this.rect(cx + eyeDx - 1, cy - 1, 1, 1, palette.eyes);
      this.rect(cx + eyeDx + 1, cy - 1, 1, 1, palette.eyes);
    }
  }

  private drawSpider(spider: NonNullable<Game['spider']>): void {
    const { cx, cy } = this.center(spider.x, spider.y);
    for (const [dx, dy] of [
      [-7, -2], [7, -2], [-8, 1], [8, 1], [-6, 3], [6, 3], [-5, -3], [5, -3],
    ] as const) {
      this.rect(cx + dx, cy + dy, 2, 1, COLORS.spiderLeg);
    }
    renderMask(this.putPixel, SPIDER_MASK, cx, cy, { F: COLORS.spiderBody });
  }

  private drawFlea(flea: NonNullable<Game['flea']>): void {
    const { cx, cy } = this.center(flea.col, flea.y);
    renderMask(this.putPixel, FLEA_MASK, cx, cy, { F: COLORS.flea });
    const wingPhase = (this.frame >> 2) % 2 === 0;
    this.rect(cx - 4, cy + (wingPhase ? -1 : 1), 1, 2, COLORS.flea);
    this.rect(cx + 3, cy + (wingPhase ? 1 : -1), 1, 2, COLORS.flea);
  }

  private drawScorpion(scorpion: NonNullable<Game['scorpion']>): void {
    const { cx, cy } = this.center(scorpion.x, scorpion.row);
    renderMask(this.putPixel, SCORPION_MASK, cx, cy, { F: COLORS.scorpion, D: COLORS.scorpionTail }, scorpion.dir < 0);
    const pincerDx = scorpion.dir >= 0 ? 7 : -7;
    this.rect(cx + pincerDx, cy - 2, 2, 2, COLORS.scorpion);
  }

  private drawShot(shot: NonNullable<Game['shot']>): void {
    const cx = Math.round(this.px(shot.col) + CELL / 2);
    const cy = Math.round(this.py(shot.row));
    this.rect(cx, cy - 3, 1, 6, COLORS.shot);
  }

  private drawShooter(shooter: Game['shooter'], color: string): void {
    const { cx, cy } = this.center(shooter.x, shooter.y);
    this.drawDiamond(cx, cy, 3, color);
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

  private drawAttract(game: Game): void {
    if (game.attractPhase === 'TITLE') {
      this.drawTitleCard();
    } else if (game.attractPhase === 'DEMO') {
      this.centeredText('CLICK OR PRESS FIRE', CANVAS_W / 2, 104, COLORS.attractText);
      this.centeredText('1 COIN 1 PLAY', CANVAS_W / 2, 218, COLORS.attractText);
    } else {
      this.drawHighScoreTable(game);
    }
  }

  private drawTitleCard(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, HEADER_H, CANVAS_W, GRID.ROWS * CELL);
    this.centeredText('CENTIPEDE', CANVAS_W / 2, 56, '#ffe23c', 2);

    const palette = getWavePalette(1);
    for (let i = 0; i < 9; i++) {
      this.drawSegment(
        {
          chainId: 0,
          index: i,
          row: 20,
          col: 10 + i,
          dir: 1,
          poisoned: false,
          isHead: i === 8,
        },
        palette
      );
    }

    this.centeredText('ARCADE RULES', CANVAS_W / 2, 114, COLORS.attractText);
    this.centeredText('CLICK OR PRESS FIRE', CANVAS_W / 2, 140, '#fff');
    this.centeredText('TO START', CANVAS_W / 2, 149, '#fff');
    this.centeredText('MOUSE = TRAK-BALL', CANVAS_W / 2, 168, COLORS.spiderBody);
  }

  private drawHighScoreTable(game: Game): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(34, 34, 172, 176);

    this.centeredText('HIGH SCORES', CANVAS_W / 2, 42, COLORS.attractText);
    game.highScores.forEach((entry, i) => {
      const rank = `${i + 1}`.padStart(2, ' ');
      const row = `${rank}  ${pad(entry.score, 6)}  ${entry.initials}`;
      this.centeredText(row, CANVAS_W / 2, 60 + i * 13, COLORS.attractText);
    });

    this.drawAttractSpinner(CANVAS_W / 2, 153);
    this.centeredText('1 COIN 1 PLAY', CANVAS_W / 2, 176, COLORS.attractText);
    this.centeredText(`BONUS EVERY ${game.options.extraLifeScore}`, CANVAS_W / 2, 190, COLORS.attractText);
    this.centeredText('CLICK OR PRESS FIRE', CANVAS_W / 2, 218, '#fff');
  }

  private drawAttractSpinner(cx: number, cy: number): void {
    const spokes = [
      [0, -5], [4, -4], [5, 0], [4, 4],
      [0, 5], [-4, 4], [-5, 0], [-4, -4],
    ] as const;
    const phase = (this.frame >> 3) % spokes.length;
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = spokes[(phase + i) % spokes.length];
      this.rect(cx + dx, cy + dy, i === 0 ? 2 : 1, i === 0 ? 2 : 1, '#ffffff');
    }
  }

  private drawHighScoreEntry(game: Game): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(20, 42, 200, 156);
    this.centeredText('GREAT SCORE', CANVAS_W / 2, 58, COLORS.attractText);
    this.centeredText('ENTER YOUR INITIALS', CANVAS_W / 2, 78, COLORS.attractText);
    this.centeredText(pad(game.getPendingInitialScore(), 6), CANVAS_W / 2, 98, '#ffffff');

    const initials = game.initials.join('');
    const scale = 2;
    const x = CANVAS_W / 2 - measureText(initials, scale, 2) / 2;
    drawBitmapText(ctx, initials, x, 126, COLORS.attractText, scale, 2);
    if ((this.frame >> 4) % 2 === 0) {
      this.rect(x + game.initialIndex * (GLYPH_W * scale + 2 * scale), 143, GLYPH_W * scale, 2, '#ffffff');
    }

    this.centeredText('LEFT RIGHT CHANGE', CANVAS_W / 2, 166, '#fff');
    this.centeredText('FIRE ENTER SELECT', CANVAS_W / 2, 178, '#fff');
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
}

function pad(n: number, digits: number): string {
  return Math.floor(Math.max(0, n)).toString().padStart(digits, '0');
}
