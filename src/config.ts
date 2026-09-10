/**
 * CENTIPEDE — Tunable configuration.
 *
 * Every numeric rule from the original arcade game lives here, sourced from
 * "The Video Master's Guide to Centipede" (Dubren, 1982). Nothing gameplay-
 * related should be hard-coded elsewhere — if a system needs a number, it
 * should read it from CONFIG so the whole game can be re-tuned (or turned
 * into a variant) without touching logic code.
 *
 * FEATURES below gates anything that is *not* part of the faithful 1981
 * recreation. The base game must play identically with every flag in
 * FEATURES set to false/off.
 */

export const GRID = {
  COLS: 30,
  ROWS: 30, // rows numbered 1 (bottom) .. 30 (top), matching the manual
} as const;

export const ZONES = {
  SHOOTER_MAX_ROW: 6, // Shooter zone: rows 1-6
  INFIELD_MAX_ROW: 12, // Infield: rows 1-12
  OUTFIELD_MIN_ROW: 13, // Outfield: rows 13-30
  SPIDER_MAX_ROW_DEFAULT: 12, // Spider zone ceiling before score narrows it
  SCORPION_MIN_ROW: 13,
  MUSHROOM_MIN_ROW: 2, // Mushrooms never occupy row 1
} as const;

export const LIVES = {
  STARTING_OPTIONS: [2, 3, 4, 5],
  STARTING_DEFAULT: 3,
  MAX_BONUS_LIVES: 6,
  EXTRA_LIFE_SCORE_OPTIONS: [10_000, 12_000, 15_000, 20_000],
  EXTRA_LIFE_SCORE_DEFAULT: 12_000,
};

export const SCORING = {
  SPIDER_CLOSE: 900, // within ~1 row of shooter
  SPIDER_MEDIUM: 600, // within ~4 rows
  SPIDER_FAR: 300, // farther than 4 rows
  SPIDER_CLOSE_ROWS: 1,
  SPIDER_MEDIUM_ROWS: 4,
  FLEA: 200,
  SCORPION: 1000,
  CENTIPEDE_HEAD: 100,
  CENTIPEDE_BODY: 10,
  MUSHROOM_DESTROYED: 1,
  MUSHROOM_POISONED_CREDIT: 5, // paid out during end-of-life mushroom tally
  MUSHROOM_DAMAGED_CREDIT: 5, // paid out during end-of-life mushroom tally
  MAX_SCORE: 999_999,
} as const;

export const MUSHROOM = {
  HITS_TO_DESTROY: 4,
} as const;

/** Attack-wave composition cycle (Table 4). Index 0 == "wave 1" of a cycle. */
export const WAVE_CYCLE = {
  LENGTH: 12,
  chainLengthForIndex(index0: number): number {
    // index0: 0..11 -> chain length 12..1
    return 12 - (index0 % WAVE_CYCLE.LENGTH);
  },
  singleHeadsForIndex(index0: number): number {
    return (index0 % WAVE_CYCLE.LENGTH);
  },
  SLOW_FAST_STOPS_AT_SCORE: 40_000,
  SCORPION_UNLOCKS_AFTER_WAVE_INDEX0: 2, // "cannot appear until after 3rd wave of a cycle" (index0 2 == wave 3)
} as const;

export const CENTIPEDE_SPEED = {
  // Cells per second, along a row. Poisoned links move at the FAST rate
  // regardless of the wave's nominal speed (they're rushing to the bottom).
  SLOW: 4.2,
  FAST: 8.4,
  // Vertical drop takes the same per-cell duration as a horizontal step.
} as const;

export const FLEA = {
  DROP_SPEED_FAST: 10,
  DROP_SPEED_VERY_FAST: 16,
  SHOTS_TO_KILL: 2,
  MIN_INFIELD_MUSHROOMS_BY_SCORE: [
    { upTo: 20_000, count: 5 },
    { upTo: 120_000, count: 9 },
    { upTo: 140_000, count: 15 },
    { upTo: 160_000, count: 16 },
    { upTo: 180_000, count: 17 },
    { upTo: 200_000, count: 18 },
    { upTo: 220_000, count: 19 },
    { upTo: 240_000, count: 20 },
    { upTo: 260_000, count: 21 },
    { upTo: 280_000, count: 22 },
    { upTo: 300_000, count: 23 },
  ] as const,
  MUSHROOMS_NEEDED_INCREMENT_SCORE_STEP: 20_000, // beyond 300,000: +1 per 20,000
  PLANT_MIN: 2,
  PLANT_MAX: 6,
  RELEASE_DELAY_AFTER_ESCAPE_MS: [600, 1400] as [number, number],
} as const;

export const SPIDER = {
  SPEED_SLOW: 5.5,
  SPEED_FAST: 10.5,
  SPEEDUP_SCORE_EASY: 5_000,
  SPEEDUP_SCORE_HARD: 1_000,
  RESPAWN_AFTER_KILL_MS: 4_000,
  RESPAWN_AFTER_ESCAPE_MS: 1_900,
  // Table 6: max row the spider may rise to, keyed by score threshold.
  ZONE_BY_SCORE: [
    { upTo: 79_999, maxRow: 12 },
    { upTo: 99_999, maxRow: 11 },
    { upTo: 119_999, maxRow: 10 },
    { upTo: 139_999, maxRow: 9 },
    { upTo: 159_999, maxRow: 8 },
    { upTo: 859_999, maxRow: 7 },
    { upTo: Infinity, maxRow: 12 },
  ] as const,
  BOUNCE_MIN_HOLD_MS: 150,
  BOUNCE_MAX_HOLD_MS: 500,
} as const;

export const SCORPION = {
  SPEED_SLOW: 4.5,
  SPEED_FAST: 9.5,
  FAST_SPEED_UNLOCK_SCORE: 20_000,
  FAST_SPEED_CHANCE_AFTER_UNLOCK: 0.75,
  // The manual gives eligibility rules but not an exact crossing frequency;
  // this range is a tunable approximation of a "lurking" cadence.
  SPAWN_INTERVAL_MIN_MS: 4000,
  SPAWN_INTERVAL_MAX_MS: 9000,
} as const;

export const SIDE_FEED = {
  ENTRY_ROW: 7,
  FIRST_INTERVAL_MS: 3000,
  INTERVAL_DECREASE_STAGE1_MS: 125, // "1/8 second" per link, first ~12 links
  STAGE1_LINK_COUNT: 12,
  STAGE2_MIN_INTERVAL_MS: 1375, // "one every 1-3/8 seconds" floor before stage 2 grinds slower
  STAGE2_DECREASE_PER_10K_MS: 50, // "1/20 of a second" per 10,000 points
  STAGE2_SCORE_STEP: 10_000,
  ABSOLUTE_MIN_INTERVAL_MS: 200,
  CYCLE_RESET_SCORE_SPAN: 300_000, // clock rewinds roughly every 300k points
} as const;

export const SHOOTER = {
  START_ROW: 1,
  START_COL: 15, // center-ish of 30 columns (1-indexed)
  MOVE_SPEED: 40, // cells/second under keyboard control
  SHOT_SPEED: 46, // cells/second, straight up
} as const;

export const AUDIO = {
  MASTER_VOLUME: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Difficulty presets — mirrors the real cabinet's operator DIP-switch options
// (Table 3), exposed here instead of hidden inside logic.
// ---------------------------------------------------------------------------
export interface OperatorOptions {
  startingLives: number;
  extraLifeScore: number;
  spiderSpeedupScore: number; // 1000 ("hard") or 5000 ("easy")
}

export const DEFAULT_OPERATOR_OPTIONS: OperatorOptions = {
  startingLives: LIVES.STARTING_DEFAULT,
  extraLifeScore: LIVES.EXTRA_LIFE_SCORE_DEFAULT,
  spiderSpeedupScore: SPIDER.SPEEDUP_SCORE_EASY,
};

// ---------------------------------------------------------------------------
// Feature flags — anything NOT part of the faithful 1981 recreation.
// Every flag here must default to a value that reproduces the original game.
// This is the extension point for future work; add new flags here rather
// than branching on ad-hoc booleans scattered through the codebase.
// ---------------------------------------------------------------------------
export interface FeatureFlags {
  /** Draw a CRT scanline/vignette overlay on top of the game canvas. */
  crtFilter: boolean;
  /** Show an on-screen FPS/debug HUD. */
  debugOverlay: boolean;
  /** Allow a second player to play in alternating turns (cocktail-style). */
  twoPlayerAlternating: boolean;
  /** God mode: shooter cannot be killed (debug aid). */
  godMode: boolean;
  /** Slow-motion toggle for debugging movement/collision (0.25x speed). */
  slowMotion: boolean;
  /** Draw the 30x30 logical grid coordinates over the playfield. */
  showGrid: boolean;
  /** Mute all audio. */
  muteAudio: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  crtFilter: true,
  debugOverlay: false,
  twoPlayerAlternating: false,
  godMode: false,
  slowMotion: false,
  showGrid: false,
  muteAudio: false,
};
