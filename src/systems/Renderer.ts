import { GRID } from '../config';
import type { Game } from '../Game';
import type { SegmentView } from '../entities/Centipede';
import type { FeatureFlags } from '../config';
import { GLYPH_W, drawBitmapText, measureText } from './BitmapFont';
import { getWavePalette } from './Palette';
import {
  CENTIPEDE_BODY_FRAMES,
  CENTIPEDE_HEAD_FRAMES,
  FLEA_MASK,
  MUSHROOM_STAGES,
  POISONED_MUSHROOM_STAGES,
  SCORPION_MASK,
  SHOOTER_MASK,
  SPIDER_FRAMES,
  type Mask,
  renderMask,
} from './Sprites';
import { getCustomSpriteSheet, pickFrame } from './spriteMapping';

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
  poisonedSeg: '#a64bff',
  spiderBody: '#00f01d',
  spiderLeg: '#fffbc0',
  spiderCenter: '#ff1a0d',
  shooterBody: '#fffbc0',
  shooterDetail: '#ff1a0d',
  flea: '#ff3c6e',
  scorpion: '#ffb02e',
  scorpionTail: '#cc6a12',
  shot: '#ff3333',
  tallyFlash: '#ffffff',
  gridLine: 'rgba(255,255,255,0.08)',
  disclaimer: '#3a3a3a',
} as const;

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
    if (features.showGrid) this.drawGrid();

    this.drawMushrooms(game, palette);
    if (game.state === 'LIFE_LOST_TALLY' && game.tallyHighlight) this.drawTallyHighlight(game.tallyHighlight);
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
  private text(str: string, x: number, y: number, color: string, scale = 1, spacing = 0): void {
    drawBitmapText(this.ctx, str, x, y, color, scale, spacing);
  }
  private centeredText(str: string, cx: number, y: number, color: string, scale = 1, spacing = 0): void {
    drawBitmapText(this.ctx, str, cx - measureText(str, scale, spacing) / 2, y, color, scale, spacing);
  }

  // -- header / footer ------------------------------------------------------
  // Real hardware fits the whole HUD into a single 8px tile-row (row 31),
  // so P1 score, HIGH SCORE, and the lives readout are laid out side by
  // side on one line rather than stacked — width is plentiful (30 tile
  // columns), height is not.
  // Live gameplay shows bare numbers only -- no "1UP"/"HIGH SCORE" text --
  // per a real captured frame: score + lives at the far left, high score
  // left-of-center, no labels anywhere. Lives icons use the shooter's own
  // sprite/colors, not the score/text color.
  private drawHeader(game: Game, textColor: string): void {
    const scoreStr = pad(game.score, 6);
    this.text(scoreStr, 4, 0, textColor);

    // Same sprite as the in-game shooter (SHOOTER_MASK), not a generic
    // diamond, so the lives readout actually reads as tiny player ships.
    // The mask's visible content is only ~7px wide despite the 16px mask
    // canvas (most of that width is transparent margin), so icons need a
    // tight ~8px center-to-center spacing to sit nearly touching, matching
    // the reference frame -- the previous 18px spacing (sized for the
    // mask's full canvas width) left visibly large gaps between them.
    const livesX = 4 + measureText(scoreStr) + 6;
    const lives = Math.max(0, game.lives - 1);
    for (let i = 0; i < lives; i++) {
      renderMask(this.putPixel, SHOOTER_MASK, livesX + 4 + i * 8, 4, {
        F: COLORS.shooterBody,
        D: COLORS.shooterDetail,
      });
    }

    this.text(pad(game.highScore, 6), 108, 0, textColor);
  }

  // Row 0 (bottom) is documented as unused during gameplay — left blank
  // here to match, with a small disclaimer only shown outside play.
  private drawFooter(game: Game): void {
    if (game.state === 'ATTRACT' || game.state === 'GAME_OVER') {
      this.centeredText('FAN-MADE - NOT AN ATARI PRODUCT', CANVAS_W / 2, CANVAS_H - 7, COLORS.disclaimer, 1, -1);
    }
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
  private drawMushrooms(game: Game, palette: { body: string; legs: string; eyes: string }): void {
    const custom = getCustomSpriteSheet();
    game.mushrooms.forEach((row, col, cell) => {
      const x = this.px(col);
      const y = this.py(row);

      if (custom?.mapping.mushroom) {
        const stages = custom.mapping.mushroom.stages;
        const stage = stages[Math.min(cell.hits, stages.length - 1)];
        custom.sheet.draw(this.ctx, stage.col, stage.row, x, y, CELL, CELL);
        return;
      }

      const stages = cell.poisoned ? POISONED_MUSHROOM_STAGES : MUSHROOM_STAGES;
      this.drawTileMask(stages[Math.min(cell.hits, stages.length - 1)], x, y, {
        F: palette.body,
        D: cell.poisoned ? palette.legs : palette.eyes,
      });
    });
  }

  // Manual: after a life is lost, poisoned/damaged mushrooms are credited
  // one at a time with a visible flash before being restored. tallyHighlight
  // names the one cell being credited this tick; a solid flash box makes
  // that mushroom pop for the few frames it holds before the next one lights.
  private drawTallyHighlight(cell: { row: number; col: number }): void {
    this.rect(this.px(cell.col), this.py(cell.row), CELL, CELL, COLORS.tallyFlash);
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

    const custom = getCustomSpriteSheet();
    const customFrames = v.isHead ? custom?.mapping.centipedeHead?.frames : custom?.mapping.centipedeBody?.frames;
    if (custom && customFrames && customFrames.length > 0) {
      const frame = pickFrame(customFrames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8, flip);
      return;
    }

    const frames = v.isHead ? CENTIPEDE_HEAD_FRAMES : CENTIPEDE_BODY_FRAMES;
    renderMask(this.putPixel, pickMaskFrame(frames, this.frame), cx, cy, {
      F: bodyColor,
      D: palette.eyes,
      L: palette.legs,
    }, flip);
  }

  private drawSpider(spider: NonNullable<Game['spider']>): void {
    const { cx, cy } = this.center(spider.x, spider.y);

    const custom = getCustomSpriteSheet();
    if (custom?.mapping.spider?.frames.length) {
      const frame = pickFrame(custom.mapping.spider.frames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8);
      return;
    }

    renderMask(this.putPixel, pickMaskFrame(SPIDER_FRAMES, this.frame), cx, cy, {
      F: COLORS.spiderBody,
      D: COLORS.spiderCenter,
      L: COLORS.spiderLeg,
    });
  }

  private drawFlea(flea: NonNullable<Game['flea']>): void {
    const { cx, cy } = this.center(flea.col, flea.y);

    const custom = getCustomSpriteSheet();
    if (custom?.mapping.flea?.frames.length) {
      const frame = pickFrame(custom.mapping.flea.frames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8);
      return;
    }

    renderMask(this.putPixel, FLEA_MASK, cx, cy, { F: COLORS.flea });
    const wingPhase = (this.frame >> 2) % 2 === 0;
    this.rect(cx - 4, cy + (wingPhase ? -1 : 1), 1, 2, COLORS.flea);
    this.rect(cx + 3, cy + (wingPhase ? 1 : -1), 1, 2, COLORS.flea);
  }

  private drawScorpion(scorpion: NonNullable<Game['scorpion']>): void {
    const { cx, cy } = this.center(scorpion.x, scorpion.row);

    const custom = getCustomSpriteSheet();
    if (custom?.mapping.scorpion?.frames.length) {
      const frame = pickFrame(custom.mapping.scorpion.frames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8, scorpion.dir < 0);
      return;
    }

    renderMask(this.putPixel, SCORPION_MASK, cx, cy, { F: COLORS.scorpion, D: COLORS.scorpionTail }, scorpion.dir < 0);
    const pincerDx = scorpion.dir >= 0 ? 5 : -5;
    this.rect(cx + pincerDx, cy - 2, 2, 2, COLORS.scorpion);
  }

  private drawShot(shot: NonNullable<Game['shot']>): void {
    // Rendered at the shooter's exact fractional x from fire time
    // (`visualX`), not the locked integer `col` used for collision — the
    // shooter itself renders at a continuous position (trak-ball glide),
    // so using the rounded column here would visually detach the bullet
    // from the muzzle by up to half a cell whenever the shooter wasn't
    // sitting exactly on a whole column when it fired.
    const cx = Math.round(this.px(shot.visualX) + CELL / 2);
    const cy = Math.round(this.py(shot.row));
    this.rect(cx, cy - 3, 1, 6, COLORS.shot);
  }

  private drawShooter(shooter: Game['shooter'], _color: string): void {
    const { cx, cy } = this.center(shooter.x, shooter.y);

    const custom = getCustomSpriteSheet();
    if (custom?.mapping.shooter) {
      const cell = custom.mapping.shooter;
      custom.sheet.draw(this.ctx, cell.col, cell.row, cx - 8, cy - 4, 16, 8);
      return;
    }

    renderMask(this.putPixel, SHOOTER_MASK, cx, cy, {
      F: COLORS.shooterBody,
      D: COLORS.shooterDetail,
    });
  }

  private drawTileMask(mask: Mask, x: number, y: number, colors: Record<string, string>): void {
    for (let r = 0; r < 8; r++) {
      const row = mask[r];
      for (let c = 0; c < 8; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const color = colors[ch];
        if (color) this.rect(x + c, y + r, 1, 1, color);
      }
    }
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
    // Tall enough to cover every overlaid line down through "CLICK OR
    // PRESS FIRE" (y=218 + an 8px glyph + margin) -- it previously ended
    // at y=210, leaving that last line sitting on the bright mushroom
    // field instead of the dimmed panel like everything above it.
    ctx.fillRect(34, 34, 172, 196);

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

function pickMaskFrame(frames: Mask[], frameCounter: number, stepEveryNFrames = 4): Mask {
  return frames[Math.floor(frameCounter / stepEveryNFrames) % frames.length];
}
