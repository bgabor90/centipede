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

/**
 * Spider walk cycle.
 *
 * The local reference sheet shows the spider as a low, wide 16x8 motion
 * object: pale legs arcing around a red/green center, alternating between
 * high-arched and flattened leg poses. These are original redraws built for
 * this mask system from that silhouette and cadence.
 */
export const SPIDER_FRAMES: Mask[] = [
  [
    'L....L....L....L',
    'LL...L....L...LL',
    '.L..LDDDDDDL..L.',
    'LL..DDFDDFDD..LL',
    '...DDFFFFFDD....',
    'LL..DDFDDFDD..LL',
    '.L..LLFFFFLL..L.',
    'L....L....L....L',
  ],
  [
    '................',
    'LLL..L....L..LLL',
    'L..LLDDDDDDLL..L',
    '...DDFDDFDD.....',
    'LL.DDFFFFFDD.LL.',
    '...DDFDDFDD.....',
    'L..LLFFFFFLL..L.',
    'LLL..L....L..LLL',
  ],
  [
    'L..............L',
    'LLL..L....L..LLL',
    '..LLLDDDDDLLL...',
    'L..DDFDDFDD..L..',
    'LL.DDFFFFFDD.LL.',
    '...DDFDDFDD.....',
    '..LLLFFFFLLL....',
    'L..............L',
  ],
  [
    '................',
    '....LL....LL....',
    'LLL..DDDDDD..LLL',
    '...DDFDDFDD.....',
    'L..DDFFFFFDD..L.',
    'LL.DDFDDFDD.LL..',
    '..LLLFFFFLLL....',
    '....LL....LL....',
  ],
  [
    'L....L....L....L',
    'LL...L....L...LL',
    '.L..LDDDDDDL..L.',
    'LL..DDFDDFDD..LL',
    '...DDFFFFFDD....',
    'LL..DDFDDFDD..LL',
    '.L..LLFFFFLL..L.',
    'L....L....L....L',
  ],
  [
    '................',
    'LLL..L....L..LLL',
    'L..LLDDDDDDLL..L',
    '...DDFDDFDD.....',
    'LL.DDFFFFFDD.LL.',
    '...DDFDDFDD.....',
    'L..LLFFFFFLL..L.',
    'LLL..L....L..LLL',
  ],
  [
    '....L......L....',
    '..LLL......LLL..',
    'LL..LDDDDDDL..LL',
    'L..DDFDDFDD..L..',
    '...DDFFFFFDD....',
    'L..DDFDDFDD..L..',
    'LL..LFFFFFL..LL.',
    '..LLL......LLL..',
  ],
  [
    '................',
    '..LLL......LLL..',
    'LL..LDDDDDDL..LL',
    '....DDFDDFDD....',
    'L..DDFFFFFDD..L.',
    'LL.DDFDDFDD.LL..',
    '..LLLFFFFLLL....',
    '................',
  ],
];

export const SPIDER_MASK: Mask = SPIDER_FRAMES[0];

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

/**
 * Shooter / player "bug blaster".
 *
 * The reference sheet stores this as the lower half of the upper-left
 * player/shot cell: a narrow pale body with red face/cowl detail. It is
 * static in the sheet, so the renderer uses this single mask as the built-in
 * fallback when no custom shooter cell is configured.
 */
export const SHOOTER_MASK: Mask = [
  '.......F........',
  '......FFF.......',
  '.....DDFDD......',
  '....FDDFDDF.....',
  '....FFFFFFF.....',
  '.....FFFFF......',
  '......FFF.......',
  '......FFF.......',
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
