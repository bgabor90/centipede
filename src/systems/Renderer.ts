import { GRID } from '../config';
import { BOMB_EXPLOSION_SECONDS, KILL_FLASH_SECONDS, type Game } from '../Game';
import type { SegmentView } from '../entities/Centipede';
import type { FeatureFlags } from '../config';
import { GLYPH_W, drawBitmapText, measureText } from './BitmapFont';
import { getWavePalette } from './Palette';
import {
  BOMB_FRAMES,
  BOMB_MASK,
  CENTIPEDE_BODY_FRAMES,
  CENTIPEDE_HEAD_FRAMES,
  FLEA_FRAMES,
  MUSHROOM_STAGES,
  POISONED_MUSHROOM_STAGES,
  SCORPION_FRAMES,
  SCORPION_EXPLOSION_FRAMES,
  SHOOTER_MASK,
  SPIDER_FRAMES,
  PLAYER_DEATH_EXPLOSION_FRAMES,
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
  // Sampled from the reference sheet's flea row.
  fleaBody: '#fffdc8',
  fleaHead: '#ea3323',
  fleaLeg: '#75fb4c',
  // Sampled from the reference sheet's scorpion row.
  scorpionBody: '#fffdc8',
  scorpionPincer: '#ea3323',
  // Bomb power-up: poison-purple sac (matches poisonedSeg) with a red
  // core, cream highlight/spike, and a toxic-lime spore accent for the
  // drifting particles unique to this sprite.
  bombBody: '#a64bff',
  bombCore: '#ea3323',
  bombHighlight: '#fffdc8',
  shot: '#ff3333',
  bomb: '#ffaa00',
  bombBlast: '#ffcc44',
  tallyFlash: '#ffffff',
  // Sampled from the reference sheet's explosion-burst row.
  explosionSpark: '#75fb4c',
  explosionCore: '#ea3323',
  explosionHighlight: '#fffdc8',
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
    if (features.bombs) this.drawBombHud(game);
    if (features.showGrid) this.drawGrid();

    this.drawMushrooms(game, palette);
    if (game.state === 'LIFE_LOST_TALLY' && game.tallyHighlight) this.drawTallyHighlight(game.tallyHighlight);
    this.drawCentipede(game, palette);
    if (game.spider) this.drawSpider(game.spider);
    if (game.flea) this.drawFlea(game.flea);
    if (game.scorpion) this.drawScorpion(game.scorpion);
    if (game.shot) this.drawShot(game.shot);
    if (game.bomb) this.drawBomb(game.bomb);
    if (game.bombExplosion) this.drawBombExplosion(game.bombExplosion);
    for (const flash of game.killFlashes) this.drawKillFlash(flash);
    if (game.spiderPointsPopup && game.spiderPointsPopup.delay <= 0) this.drawSpiderPointsPopup(game.spiderPointsPopup);
    if (game.state === 'PLAYER_DEATH_ANIMATION') {
      this.drawPlayerExplosion(game);
    }
    if (game.state === 'PLAYING' || game.state === 'ATTRACT' || game.state === 'HIGH_SCORE_ENTRY' || game.state === 'GAME_OVER') {
      this.drawShooter(game.shooter, palette.legs);
    }

    // The high-score table, coin/credit line, and bonus-life reminder read
    // as illegible noise if the live demo's board (mushrooms, centipede,
    // spider) renders on top of them, so this draws last -- UI text always
    // wins over board elements here, not the other way around.
    if (game.state === 'ATTRACT') this.drawAttractOverlay(game);

    if (features.crtFilter) this.drawCrtOverlay();
    if (game.state === 'GAME_OVER') this.drawGameOver();
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

  // VERIFIED (UpdateExplosions, $2701-$2744): a killed centipede segment/
  // spider/flea/scorpion doesn't just vanish -- its picture counts down
  // through a handful of frames before the slot clears. A brief solid
  // flash at the kill cell reproduces that pop for segments/spider/flea,
  // which don't have dedicated multi-frame kill art here; the scorpion
  // does (SCORPION_EXPLOSION_FRAMES, traced from the reference sheet), so
  // it gets the real dissolving-burst animation instead.
  private drawKillFlash(flash: { row: number; col: number; timer: number; kind: 'default' | 'scorpion' }): void {
    if (flash.kind === 'scorpion') {
      const { cx, cy } = this.center(flash.col, flash.row);
      const elapsed = 1 - Math.max(0, Math.min(1, flash.timer / KILL_FLASH_SECONDS));
      const frames = SCORPION_EXPLOSION_FRAMES;
      const frameIndex = Math.min(frames.length - 1, Math.floor(elapsed * frames.length));
      renderMask(this.putPixel, frames[frameIndex], cx, cy, {
        F: COLORS.explosionSpark,
        D: COLORS.explosionCore,
        H: COLORS.explosionHighlight,
      });
      return;
    }
    this.rect(this.px(flash.col), this.py(flash.row), CELL, CELL, COLORS.tallyFlash);
  }

  // VERIFIED (EXPLOD's :ExplDone, $2711-$271f): once the spider's own kill
  // flash finishes, its motion-object slot is reused to display the exact
  // point value earned (300/600/900) at the kill location.
  private drawSpiderPointsPopup(popup: { row: number; col: number; text: string }): void {
    const { cx, cy } = this.center(popup.col, popup.row);
    this.centeredText(popup.text, cx, cy - 3, '#ffffff');
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
      // VERIFIED (MoveCentipede's :SegAlive, $296d-$297a): leg picture
      // advances every other frame, not the default every-4-frames rate.
      const frame = pickFrame(customFrames, this.frame, 2);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8, flip);
      return;
    }

    const frames = v.isHead ? CENTIPEDE_HEAD_FRAMES : CENTIPEDE_BODY_FRAMES;
    // VERIFIED (MoveCentipede's :SegAlive, $296d-$297a): the leg picture
    // advances every OTHER frame (frame_ctr & 1 == 0), twice as fast as
    // the spider/scorpion's own verified every-4-frames rate that this
    // helper's default matches.
    renderMask(this.putPixel, pickMaskFrame(frames, this.frame, 2), cx, cy, {
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

    renderMask(this.putPixel, pickMaskFrame(FLEA_FRAMES, this.frame), cx, cy, {
      H: COLORS.fleaBody,
      D: COLORS.fleaHead,
      F: COLORS.fleaLeg,
    });
  }

  private drawScorpion(scorpion: NonNullable<Game['scorpion']>): void {
    const { cx, cy } = this.center(scorpion.x, scorpion.row);

    const custom = getCustomSpriteSheet();
    if (custom?.mapping.scorpion?.frames.length) {
      const frame = pickFrame(custom.mapping.scorpion.frames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8, scorpion.dir < 0);
      return;
    }

    // Traced as-is (unflipped), the reference art's pincers lead on the
    // left with the tail trailing right -- i.e. it's drawn facing left, the
    // opposite of the shot/centipede/flea convention of "unflipped faces
    // right". So this mirrors on rightward movement instead of leftward.
    renderMask(
      this.putPixel,
      pickMaskFrame(SCORPION_FRAMES, this.frame),
      cx,
      cy,
      { H: COLORS.scorpionBody, D: COLORS.scorpionPincer },
      scorpion.dir >= 0
    );
  }

  private drawPlayerExplosion(game: Game): void {
    const pos = game.playerDeathPosition;
    if (!pos) return;

    const { cx, cy } = this.center(pos.x, pos.y);
    const custom = getCustomSpriteSheet();
    if (custom?.mapping.explosion?.frames.length) {
      const frame = pickFrame(custom.mapping.explosion.frames, this.frame);
      custom.sheet.draw(this.ctx, frame.col, frame.row, cx - 8, cy - 4, 16, 8);
      return;
    }

    // Plays once, largest to smallest, keyed to the death timer's own
    // progress rather than the free-running animation clock `this.frame`
    // used elsewhere -- a looping/cyclic pick would show a random frame at
    // the moment of death and could visibly wrap mid-shrink.
    const frames = PLAYER_DEATH_EXPLOSION_FRAMES;
    const frameIndex = Math.min(frames.length - 1, Math.floor(game.playerDeathProgress * frames.length));
    renderMask(this.putPixel, frames[frameIndex], cx, cy, {
      F: COLORS.explosionSpark,
      D: COLORS.explosionCore,
      H: COLORS.explosionHighlight,
    });
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

  // FEATURES.bombs: the poison-sac sprite, so the in-flight bomb reads
  // distinctly from the shot's thin line. Rendered at the same fractional
  // muzzle x as the shot for the same anti-detachment reason (see
  // drawShot). The mask is half-size (see BOMB_FRAMES), so its two frames
  // just blink the highlight for a subtle pulse rather than animating a
  // drift.
  private drawBomb(bomb: NonNullable<Game['bomb']>): void {
    const cx = Math.round(this.px(bomb.visualX) + CELL / 2);
    const cy = Math.round(this.py(bomb.row));
    renderMask(this.putPixel, pickMaskFrame(BOMB_FRAMES, this.frame, 8), cx, cy, {
      F: COLORS.bombBody,
      D: COLORS.bombCore,
      H: COLORS.bombHighlight,
    });
  }

  private drawBombExplosion(explosion: NonNullable<Game['bombExplosion']>): void {
    const { cx, cy } = this.center(explosion.col, explosion.row);
    const elapsed = 1 - Math.max(0, Math.min(1, explosion.timer / BOMB_EXPLOSION_SECONDS));
    const radius = Math.round(explosion.radius * CELL * elapsed);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - elapsed);
    ctx.strokeStyle = COLORS.bombBlast;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Same convention as the header's lives readout (drawHeader): the real
  // sprite/colors instead of a generic glyph, so the reminder that bombs
  // are in play reads as an actual bomb icon rather than a "B3" label. No
  // count is drawn here -- just the icon, top-right of the header row.
  private drawBombHud(_game: Game): void {
    renderMask(this.putPixel, BOMB_MASK, CANVAS_W - 8, 4, {
      F: COLORS.bombBody,
      D: COLORS.bombCore,
      H: COLORS.bombHighlight,
    });
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

  // Ports the always-on-screen attract text from ChkGameStart/
  // DrawBonusText/ShowScores: the high-score table, coin/credit line, and
  // bonus-life reminder are shown continuously, together, over the live
  // demo rather than cycling through exclusive splash/table screens.
  private drawAttractOverlay(game: Game): void {
    this.centeredText('HIGH SCORES', CANVAS_W / 2, 10, COLORS.attractText);
    game.highScores.forEach((entry, i) => {
      const row = `${pad(entry.score, 6)}  ${entry.initials}`;
      this.centeredText(row, CANVAS_W / 2, 20 + i * 9, COLORS.attractText);
    });

    this.centeredText('1 COIN 1 PLAY', CANVAS_W / 2, 176, COLORS.attractText);
    this.centeredText(`BONUS EVERY ${game.options.extraLifeScore}`, CANVAS_W / 2, 188, COLORS.attractText);
  }

  // Ports GetInitials ($2745-...): the real cabinet doesn't pop up a
  // separate dialog for this -- it draws "GREAT SCORE" / "ENTER YOUR
  // INITIALS" and edits the new entry directly inside the same
  // high-score table drawn during attract mode, at whatever rank it
  // actually earned, with the initial currently being typed blinking in
  // place. Existing lower entries shift down and the table stays capped
  // at 8 rows, exactly like `drawAttractOverlay`'s table.
  private drawHighScoreEntry(game: Game): void {
    const pendingScore = game.getPendingInitialScore();
    const pendingInitials = game.initials.join('');
    const existing = game.highScores;
    let insertAt = existing.findIndex((e) => pendingScore > e.score);
    if (insertAt === -1) insertAt = existing.length;

    const rows: Array<{ score: number; initials: string; pending: boolean }> = [
      ...existing.slice(0, insertAt).map((e) => ({ ...e, pending: false })),
      { score: pendingScore, initials: pendingInitials, pending: true },
      ...existing.slice(insertAt).map((e) => ({ ...e, pending: false })),
    ].slice(0, 8);

    this.centeredText('HIGH SCORES', CANVAS_W / 2, 10, COLORS.attractText);
    rows.forEach((entry, i) => {
      const row = `${pad(entry.score, 6)}  ${entry.initials}`;
      const y = 20 + i * 9;
      const rowX = CANVAS_W / 2 - measureText(row) / 2;
      drawBitmapText(this.ctx, row, rowX, y, COLORS.attractText);
      if (entry.pending && (this.frame >> 4) % 2 === 0) {
        // Blink the initial currently being typed, in place, rather than
        // drawing a separate standalone editor with its own cursor.
        const cursorX = rowX + (6 + 2 + game.initialIndex) * GLYPH_W;
        this.rect(cursorX, y + GLYPH_W, GLYPH_W, 1, '#ffffff');
      }
    });

    this.centeredText('GREAT SCORE', CANVAS_W / 2, 176, COLORS.attractText);
    this.centeredText('ENTER YOUR INITIALS', CANVAS_W / 2, 188, COLORS.attractText);
  }

  drawPausedBanner(): void {
    this.centeredText('PAUSED', CANVAS_W / 2, CANVAS_H / 2, '#ffffff', 2);
  }

  private drawDebug(game: Game): void {
    const flea = game.fleaDiagnostics;
    const lines = [
      `${game.state} WAVE ${game.waveNumber}`,
      `SEGS ${game.centipede.totalSegments} CHAINS ${game.centipede.chains.length}`,
      `SHOOTER ${game.shooter.x.toFixed(1)} ${game.shooter.y.toFixed(1)}`,
      `FLEA LOW ${flea.lowZoneCount}/${flea.required} WAVE0 ${flea.blockedByWave ? 1 : 0} SCORP ${flea.blockedByScorpion ? 1 : 0} OK ${flea.eligible ? 1 : 0}`,
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
