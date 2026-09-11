/**
 * Original pixel-art sprite masks for this project's Centipede recreation.
 *
 * These are hand-authored here — not extracted, traced, or copied from the
 * original arcade ROM, any emulator capture, or any third-party sprite rip.
 * They're sized to the "motion object" convention documented by the
 * disassembly reference (16 pixels wide x 8 tall, i.e. two 8x8 tiles side
 * by side) so the silhouettes read at roughly the right proportions, and
 * support the same horizontal-flip-instead-of-separate-art convention the
 * original hardware used (see `flip` in `renderMask`).
 *
 * Mask legend: '.' = transparent, any other character is a color-role key
 * looked up in the `colors` map passed to `renderMask` (so the same mask
 * can be recolored per wave-palette, poison state, etc.).
 */

export type Mask = string[];

/**
 * Centipede body/head segment — a rounded bead held to a consistent ~8px
 * width (matching the mushroom tile's 8x8 scale) rather than flaring out
 * to fill the full 16px motion-object slot. Segments step exactly one grid
 * cell (8px) apart, so an 8px-wide body sits edge-to-edge with its
 * neighbors — connected, but each link still individually visible —
 * instead of overlapping into one undifferentiated tube. Legs and eyes
 * are drawn separately so they can animate.
 */
export const CENTIPEDE_MASK: Mask = [
  '................',
  '................',
  '.....FFFFFF.....',
  '....FFFFFFFF....',
  '....FFFFFFFF....',
  '....FFFFFFFF....',
  '.....FFFFFF.....',
  '................',
];

/** Spider — a bulbous rounded body; the spindly legs are drawn separately. */
export const SPIDER_MASK: Mask = [
  '................',
  '......FFFF......',
  '....FFFFFFFF....',
  '...FFFFFFFFFF...',
  '...FFFFFFFFFF...',
  '....FFFFFFFF....',
  '......FFFF......',
  '................',
];

/**
 * Scorpion — elongated body with a curled tail (D) at the back and small
 * tail-fin nubs. Body width trimmed to ~10px (was flaring to 14px) so it
 * reads closer to the mushroom/grid scale instead of oversized.
 */
export const SCORPION_MASK: Mask = [
  '...DD...........',
  '..D..D..........',
  '...FFFFFFFFFF...',
  '..FFFFFFFFFFFF..',
  '..FFFFFFFFFFFF..',
  '...FFFFFFFFFF...',
  '....FF....FF....',
  '................',
];

/** Flea — a narrow bomb/capsule shape, since it drops straight down rather than moving horizontally. */
export const FLEA_MASK: Mask = [
  '......FF........',
  '.....FFFF.......',
  '.....FFFF.......',
  '....FFFFFF......',
  '....FFFFFF......',
  '.....FFFF.......',
  '.....FFFF.......',
  '......FF........',
];

export const MASK_W = 16;
export const MASK_H = 8;

/**
 * Draws a mask centered on (cx, cy) via `putPixel`, which the caller wires
 * up to its own pixel-snapped fill routine. `flip` mirrors horizontally —
 * the same trick the original hardware used instead of storing separate
 * left/right art.
 */
export function renderMask(
  putPixel: (x: number, y: number, color: string) => void,
  mask: Mask,
  cx: number,
  cy: number,
  colors: Record<string, string>,
  flip = false
): void {
  const left = cx - MASK_W / 2;
  const top = cy - MASK_H / 2;
  for (let r = 0; r < MASK_H; r++) {
    const row = mask[r];
    for (let c = 0; c < MASK_W; c++) {
      const ch = row[flip ? MASK_W - 1 - c : c];
      if (ch === '.') continue;
      const color = colors[ch];
      if (!color) continue;
      putPixel(left + c, top + r, color);
    }
  }
}
