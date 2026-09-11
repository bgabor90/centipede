import type { SpriteSheet } from './SpriteSheet';

/**
 * Shape of a cell reference into a `SpriteSheet` — just a grid position,
 * nothing content-specific.
 */
export interface Cell {
  col: number;
  row: number;
}

/**
 * Describes which cells of *some* sprite sheet correspond to which game
 * sprite/animation-frame. This file defines the shape only — it does not
 * ship a filled-in mapping for any particular sheet. To use your own
 * sprite sheet:
 *
 *   1. Drop your image at e.g. `public/assets/sprites/my-sheet.png`.
 *   2. Create a file (not tracked by this repo) that builds a
 *      `SpriteMapping` with your own cell coordinates and calls
 *      `setCustomSpriteSheet(new SpriteSheet(...), yourMapping)` once at
 *      startup (see `main.ts`).
 *
 * Every field is optional — anything left out keeps using this project's
 * built-in hand-drawn art for that sprite, so you can wire things up
 * incrementally.
 */
export interface SpriteMapping {
  mushroom?: {
    /** Cell per damage stage, pristine first (0..HITS_TO_DESTROY-1 hits). */
    stages: Cell[];
  };
  centipedeBody?: {
    /** One or more cells to cycle through for the leg/walk animation. */
    frames: Cell[];
  };
  centipedeHead?: {
    frames: Cell[];
  };
  spider?: {
    frames: Cell[];
  };
  flea?: {
    frames: Cell[];
  };
  scorpion?: {
    frames: Cell[];
  };
  shooter?: Cell;
}

let customSheet: SpriteSheet | null = null;
let customMapping: SpriteMapping | null = null;

/** Call once at startup to opt into a user-supplied sheet + mapping. */
export function setCustomSpriteSheet(sheet: SpriteSheet, mapping: SpriteMapping): void {
  customSheet = sheet;
  customMapping = mapping;
}

export function getCustomSpriteSheet(): { sheet: SpriteSheet; mapping: SpriteMapping } | null {
  if (!customSheet || !customMapping) return null;
  return { sheet: customSheet, mapping: customMapping };
}

/** Picks an animation frame at a fixed cadence, matching the original's ~1/16s frame step. */
export function pickFrame(frames: Cell[], frameCounter: number, stepEveryNFrames = 4): Cell {
  const i = Math.floor(frameCounter / stepEveryNFrames) % frames.length;
  return frames[i];
}
