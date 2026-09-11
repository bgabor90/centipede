/** Shared types used across the game systems. */

export type Direction = -1 | 1; // -1 = moving left (toward col 1), 1 = moving right (toward col 30)

export interface GridPos {
  /** 1-indexed column, 1..30, left to right. */
  col: number;
  /** 1-indexed row, 1..30, bottom to top. */
  row: number;
}

/** A continuous playfield position (fractional cells allowed) for smooth rendering. */
export interface Vec2 {
  x: number; // column-space, 1..30 (fractional)
  y: number; // row-space, 1..30 (fractional)
}

export type GameStateName =
  | 'ATTRACT'
  | 'PLAYING'
  | 'PLAYER_DEATH_ANIMATION'
  | 'LIFE_LOST_TALLY'
  | 'WAVE_CLEAR'
  | 'GAME_OVER'
  | 'HIGH_SCORE_ENTRY';

export interface Bounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}
