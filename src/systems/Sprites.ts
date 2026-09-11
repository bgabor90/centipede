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
 * Mushroom hit stages, sampled from the local reference sheet's mushroom
 * cells. `F` is the wave-colored cap/body and `D` is the second mushroom
 * color. The renderer chooses one stage per mushroom hit count before
 * destruction.
 */
export const MUSHROOM_STAGES: Mask[] = [
  [
    '.DFFFFD.',
    'DFFFFFFD',
    'DFFFFFFD',
    'DDDDDDDD',
    '..DFFD..',
    '..DFFD..',
    '..DDDD..',
    '........',
  ],
  [
    '.DFFFFD.',
    'DFFFFFFD',
    'DFFFFFFD',
    'D.DDDDDD',
    '..DFFD..',
    '...F....',
    '........',
    '........',
  ],
  [
    '.DFFFFD.',
    'DFFFFFFD',
    'DFFFFFFD',
    'D.D.D.D.',
    '..D.....',
    '........',
    '........',
    '........',
  ],
  [
    '.DFFFFD.',
    'DFF.FFFD',
    'D.F.F.FD',
    '........',
    '........',
    '........',
    '........',
    '........',
  ],
];

/** Poisoned mushroom stages use the second row from the same mushroom sheet. */
export const POISONED_MUSHROOM_STAGES: Mask[] = [
  [
    '..FFFF..',
    '.FDDDDF.',
    'FDDDDDDF',
    'FDDDDDDF',
    'FFFFFFFF',
    '..FDDF..',
    '..FDDF..',
    '..FFFF..',
  ],
  [
    '..FFFF..',
    '.FDDDDF.',
    'FDDDDDDF',
    'FDDDDDDF',
    'F.FFFFFF',
    '..FDDF..',
    '...D....',
    '........',
  ],
  [
    '..FFFF..',
    '.FDDDDF.',
    'FDDDDDDF',
    'FDDDDDDF',
    'F.F.F.F.',
    '..F.....',
    '........',
    '........',
  ],
  [
    '..FFFF..',
    '.FDDDDF.',
    'FDD.DDDF',
    'F.D.D.DF',
    '........',
    '........',
    '........',
    '........',
  ],
];
/**
 * Centipede head animation, sampled from the red-detail eight-frame row in
 * the centipede reference sheet. `F` is the body, `D` is the red/eye detail,
 * and `L` is the pale leg/highlight that marches across the frames.
 */
export const CENTIPEDE_HEAD_FRAMES: Mask[] = [
  [
    '.......L........',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '.......L........',
  ],
  [
    '........L.......',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '........L.......',
  ],
  [
    '.........L......',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '.........L......',
  ],
  [
    '........L.......',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '........L.......',
  ],
  [
    '.......L........',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '.......L........',
  ],
  [
    '......L.........',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '......L.........',
  ],
  [
    '.....L..........',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '.....L..........',
  ],
  [
    '......L.........',
    '.....DDFF.......',
    '....FDDFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FDDFFF......',
    '.....DDFF.......',
    '......L.........',
  ],
];

/**
 * Centipede body animation, sampled from the matching no-red eight-frame row
 * in the centipede reference sheet.
 */
export const CENTIPEDE_BODY_FRAMES: Mask[] = [
  [
    '.......L........',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '.......L........',
  ],
  [
    '........L.......',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '........L.......',
  ],
  [
    '.........L......',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '.........L......',
  ],
  [
    '........L.......',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '........L.......',
  ],
  [
    '.......L........',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '.......L........',
  ],
  [
    '......L.........',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '......L.........',
  ],
  [
    '.....L..........',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '.....L..........',
  ],
  [
    '......L.........',
    '.....FFFF.......',
    '....FFFFFF......',
    '....FFFFFFF.....',
    '....FFFFFFF.....',
    '....FFFFFF......',
    '.....FFFF.......',
    '......L.........',
  ],
];

export const CENTIPEDE_FRAMES: Mask[] = CENTIPEDE_BODY_FRAMES;
export const CENTIPEDE_MASK: Mask = CENTIPEDE_BODY_FRAMES[0];

/**
 * Spider walk cycle.
 *
 * Sampled from the spider row in the local reference sheet: a low, wide
 * 16x8 motion object with pale legs arcing around a red/green center.
 */
export const SPIDER_FRAMES: Mask[] = [
  [
    '..L.........L...',
    '.L.L.......L.L..',
    'L...L..F..L...L.',
    '.....LDFDL......',
    '..L..DDFDD..L...',
    '.L.L.FFFFF.L.L..',
    'L...LFDDDFL...L.',
    '......FDF.......',
  ],
  [
    '................',
    '.LLL.......LLL..',
    'L...L..F..L...L.',
    '.....LDFDL......',
    '.....DDFDD......',
    '.LLL.FFFFF.LLL..',
    'L...LFDDFFL...L.',
    '......FDF.......',
  ],
  [
    '................',
    '................',
    '..LLL..F..LLL...',
    '.L...LDFDL...L..',
    'L....DDFDD....L.',
    '..LL.FFFFF.LL...',
    '.L..LFFDDFL..L..',
    'L.....FDF.....L.',
  ],
  [
    '................',
    '................',
    '.......F........',
    '...LLLDFDLLL....',
    '..L..DDFDD..L...',
    '.L..LFFFFFL..L..',
    'L...LFFDFFL...L.',
    '..LL..FDF..LL...',
  ],
  [
    '................',
    '................',
    '..LLL..F..LLL...',
    '.L...LDFDL...L..',
    'L....DDFDD....L.',
    '..LL.FFFFF.LL...',
    '.L..LFDDDFL..L..',
    'L.....FDF.....L.',
  ],
  [
    '................',
    '.LLL.......LLL..',
    'L...L..F..L...L.',
    '.....LDFDL......',
    '.....DDFDD......',
    '.LLL.FFFFF.LLL..',
    'L...LFDDFFL...L.',
    '......FDF.......',
  ],
  [
    '...L.......L....',
    '...L.......L....',
    '..L.L..F..L.L...',
    '.L...LDFDL...L..',
    'L..L.DDFDD.L..L.',
    '...L.FFFFF.L....',
    '..L.LFFDDFL.L...',
    '.L....FDF....L..',
  ],
  [
    '....L.....L.....',
    '....L.....L.....',
    '...LL..F..LL....',
    '..L..LDFDL..L...',
    '.L...DDFDD...L..',
    'L..L.FFFFF.L..L.',
    '...LLFFDFFLL....',
    '..L...FDF...L...',
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
