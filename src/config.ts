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
  // VERIFIED (MoveScorpion's :CreateScorp, $2e7c-$2e86 in the Rev4
  // disassembly): the scorpion's spawn row is a POKEY_RANDOM byte masked
  // to a multiple of 8 then offset by $70, which the disassembler's own
  // comment states outright resolves to "row 15-29" -- not the previous
  // unsourced 13-30 (borrowed from the unrelated general "outfield" zone
  // boundary).
  SCORPION_MIN_ROW: 15,
  SCORPION_MAX_ROW: 29,
  MUSHROOM_MIN_ROW: 2, // Mushrooms never occupy row 1
} as const;

export const LIVES = {
  STARTING_OPTIONS: [2, 3, 4, 5],
  STARTING_DEFAULT: 3,
  MAX_BONUS_LIVES: 6,
  // VERIFIED (Video Master's Guide Table 3, cross-confirmed by
  // 6502disassembly.com's bonus_score_tbl: $0100/$0120/$0150/$0200 BCD).
  EXTRA_LIFE_SCORE_OPTIONS: [10_000, 12_000, 15_000, 20_000],
  EXTRA_LIFE_SCORE_DEFAULT: 12_000,
};

export const SCORING = {
  // VERIFIED (":CalcSpdrPts", $2fd6 in the Rev4 disassembly, read from the
  // raw listing): compares only the *vertical* distance between spider and
  // shooter (mobj_vert_spdr - mobj_vert_plyr) -- horizontal offset plays no
  // part, unlike the previous 2D Euclidean-distance approximation. Raw
  // thresholds are <22 units -> 900, <64 -> 600, else 300 (8px/row -> <2.75
  // and <8 rows), replacing the previous 1/4-row guesses.
  SPIDER_CLOSE: 900, // within ~2 rows of shooter (vertically)
  SPIDER_MEDIUM: 600, // within ~7 rows (vertically)
  SPIDER_FAR: 300, // farther than 7 rows (vertically)
  SPIDER_CLOSE_ROWS: 2,
  SPIDER_MEDIUM_ROWS: 7,
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
} as const;

export const CENTIPEDE_SPEED = {
  // VERIFIED (6502disassembly.com/va-centipede): centipede movement uses
  // two discrete arcade speeds, 1px/frame and 2px/frame. At 60fps on the
  // original 8px tile grid, those are 7.5 and 15 cells/sec.
  SLOW: 7.5,
  FAST: 15,
  // Vertical drop takes the same per-cell duration as a horizontal step.
} as const;

export const FLEA = {
  // VERIFIED (InitFlea, $2104-$2110 in the Rev4 disassembly): base fall
  // speed is 2 px/frame below 60,000 points, 3 px/frame at/above it (60fps,
  // 8px/cell -> 15 and 22.5 cells/sec).
  FALL_SPEED_SCORE_THRESHOLD: 60_000,
  FALL_SPEED_BASE_LOW: 15,
  FALL_SPEED_BASE_HIGH: 22.5,
  // VERIFIED (ChkMobjColl, $2fba-$2fc2, read from the raw listing): a
  // corrected reading of this mechanic. The Video Master's Guide's "fast ->
  // very fast" phrasing previously led this project to snap a hit flea's
  // speed to FALL_SPEED_BASE_HIGH (the same tier already used for scores
  // >= 60,000), but the actual ROM sets a hit flea's speed to a fixed 4
  // px/frame (30 cells/sec) -- a third tier, faster than either base
  // speed, and distinct regardless of which base tier it started at. A
  // flea already at that speed (i.e. hit once already) dies on the next
  // hit instead of re-escalating.
  HIT_ESCALATED_SPEED: 30,
  SHOTS_TO_KILL: 2,
  // VERIFIED (Video Master's Guide, Table 5 / "Preventing the Flea
  // Attack"): "Mushrooms planted in the infield (i.e. levels 2-12) serve
  // the function of terminating the Flea attack." A prior reading of
  // MUSHDC/MUSHER ($2b95/$2bac) inferred rows 2-11 instead, from a row-
  // index-to-row-number offset that isn't fully certain from the raw
  // disassembly alone -- the manual's plain, directly-topical statement
  // is preferred here. This also means it's the same zone as the
  // general "infield" (ZONES.INFIELD_MAX_ROW), not a narrower one.
  LOW_MUSHROOM_ZONE_MAX_ROW: 12,
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
  // VERIFIED (6502disassembly.com): mushroom planting is a per-row-passed
  // probability roll ("AND #$03" against the low 2 bits -> 1-in-4 chance),
  // not a pre-planned count for the whole descent as earlier assumed.
  PLANT_CHANCE_PER_ROW: 0.25,
  RELEASE_DELAY_AFTER_ESCAPE_MS: [600, 1400] as [number, number],
} as const;

export const SPIDER = {
  // VERIFIED (MoveSpider/InitSpider, $2202/$21c7 in the Rev4 disassembly,
  // read directly from the raw listing): speed is literally 1 (slow) or 2
  // (fast) in mobj_vvel_spdr/mobj_hvel_spdr, the same 1px/2px-per-frame
  // convention already confirmed for the centipede and scorpion (60fps,
  // 8px/cell -> 7.5 / 15 cells/sec) -- no longer just an analogy.
  SPEED_SLOW: 7.5,
  SPEED_FAST: 15,
  // VERIFIED (InitSpider, $21cf-$21d9): the DIP-switch difficulty flag
  // selects which score threshold ($10=1,000 hard / $50=5,000 easy) makes
  // the spider start fast rather than slow -- matches these values exactly.
  SPEEDUP_SCORE_EASY: 5_000,
  SPEEDUP_SCORE_HARD: 1_000,
  RESPAWN_AFTER_KILL_MS: 4_000,
  // A prior pass here cited "check again in 48 frames (~3/4 sec)" for the
  // spider's post-escape respawn -- that 48-frame constant turned out
  // (reading MoveSpider's :Offscreen, $22f6-$22f9, directly) to be
  // something else entirely: the unrelated steady-state direction-
  // redecision cadence, already correctly used elsewhere as
  // SPIDER.DIRECTION_CHECK_FRAMES. :Offscreen actually jumps straight to
  // InitSpider with no delay at all -- Game.ts's natural on-screen-exit
  // path now spawns immediately instead of arming this timer. This value
  // remains in use only for the unrelated "player just respawned after a
  // death" spider-cooldown reuse, which hasn't been independently
  // verified against the ROM and is kept as the Video Master's Guide had
  // it.
  RESPAWN_AFTER_ESCAPE_MS: 800,
  // VERIFIED (MoveSpider's :ScoreAdj, $22b0-$22ce in the Rev4
  // disassembly): the max row is 12 minus an adjustment computed from the
  // score's ten/hundred-thousands BCD digit pair -- `(digitPair - 6)`,
  // right-shifted once, clamped to 0-5, each unit worth one row. Working
  // through the actual byte arithmetic band-by-band reproduces exactly
  // the 79,999/99,999/119,999/139,999/159,999 breakpoints already here,
  // but the adjustment permanently clamps at 5 (row 7) once the digit
  // pair reaches $16 (160,000+) -- there is no further change in this
  // formula at any higher score. The previous 859,999/Infinity split that
  // widened the zone back to row 12 at high score doesn't come from this
  // routine (nothing here ever un-clamps the adjustment) and produced the
  // opposite of the intended difficulty curve at very high scores.
  ZONE_BY_SCORE: [
    { upTo: 79_999, maxRow: 12 },
    { upTo: 99_999, maxRow: 11 },
    { upTo: 119_999, maxRow: 10 },
    { upTo: 139_999, maxRow: 9 },
    { upTo: 159_999, maxRow: 8 },
    { upTo: Infinity, maxRow: 7 },
  ] as const,
  // VERIFIED (MoveSpider $2231-$2266, read in full this time -- an earlier
  // session saw only a fragment of this and correctly declined to trust
  // it): direction is reconsidered on a fixed 48-frame (~0.8s) cadence,
  // not the previous hand-tuned continuous-probability wander. Each tick
  // is two independent coin-flips: one toggles between a diagonal "slash"
  // and a vertical-only hold (resuming diagonal if already holding), the
  // other may reverse vertical direction outright -- at 75% under the
  // "hard" difficulty DIP setting vs. 50% on easy, previously not modeled
  // at all. Right after spawning, the first check comes sooner -- a 50/50
  // pick between 15 and 47 frames (~0.25s / ~0.78s) -- before settling
  // into the steady 48-frame cadence.
  DIRECTION_CHECK_FRAMES: 48,
  RESPAWN_FIRST_CHECK_FRAMES: [15, 47] as [number, number],
  VERTICAL_REVERSAL_CHANCE_EASY: 0.5,
  VERTICAL_REVERSAL_CHANCE_HARD: 0.75,
} as const;

export const SCORPION = {
  // VERIFIED (6502disassembly.com/va-centipede/Centipede_rev4.html,
  // MoveScorpion's :CreateScorp at $2e3a, read directly from the raw
  // listing rather than a summarized fetch -- an earlier session flagged
  // a "2px/3px at 60,000" answer as an untrustworthy summarizer echo of
  // the flea's own values, and rightly discarded it, but this is the
  // actual scorpion-speed code: below 20,000 points speed is always $01;
  // at/above it, a 1-in-4 roll keeps $01 and 3-in-4 sets $02. Same 1px/2px-
  // per-frame convention already confirmed for the centipede and spider
  // (60fps, 8px/cell -> 7.5 / 15 cells/sec) -- not a coincidental match
  // with flea's numbers, an independently-confirmed instance of the same
  // hardware convention.
  SPEED_SLOW: 7.5,
  SPEED_FAST: 15,
  FAST_SPEED_UNLOCK_SCORE: 20_000,
  FAST_SPEED_CHANCE_AFTER_UNLOCK: 0.75,
  // VERIFIED: :CreateScorp only runs when frame_ctr==0 (once every 256
  // frames, ~4.27s at 60fps) and even then bails 75% of the time (`and
  // #$03; bne :Jmp_Return`), so a spawn is checked roughly every 4.27s but
  // only succeeds on average every ~17s (geometric, so still highly
  // variable run to run) -- much rarer than the previous 4-9s tunable
  // guess.
  SPAWN_CHECK_INTERVAL_SECONDS: 256 / 60,
  SPAWN_CHANCE_PER_CHECK: 0.25,
  // VERIFIED: gated behind `cmp #NCENT-1; bcs :Jmp_Return` (NCENT=12) --
  // a scorpion can only be created while the *current* centipede's live
  // segment count is below 11, i.e. only once the wave's chain has already
  // taken at least one hit (or started partially split). This replaces a
  // previous "unlocks after wave 3 of the cycle" approximation, which was
  // a reasonable guess but not what the ROM actually checks.
  MAX_ELIGIBLE_CENTIPEDE_LENGTH: 11,
} as const;

export const SIDE_FEED = {
  // VERIFIED (CreateHead's :InitSlot, $2bf9 in the Rev4 disassembly): sets
  // the new head's vertical position to raw $40, with an explicit comment
  // "row 8" -- our own bottom-up row numbering convention matches this
  // directly (value/8 = row). Corrected from an unsourced guess of 7.
  ENTRY_ROW: 8,
  FIRST_INTERVAL_MS: 3000,
  // VERIFIED-BY-ANALOGY: CreateHead reduces its cooldown by a raw 8 units
  // (frames) per new head, down to a floor of $60 (96 frames, "~1.5
  // seconds" per the source's own comment) -- 8/60s is ~0.133s, closely
  // matching the guide's precise "1/8 second" (0.125s) figure already
  // used here, so this is corroboration rather than a source of new values.
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
  // VERIFIED (UpdateShot's :MoveShot, $2f16-$2f23 in the Rev4
  // disassembly): the shot's vertical position is unconditionally
  // advanced by a raw 7 pixels every single frame while in flight
  // ("lda #$07 ;shot moves 7 pixels each time"), no gating -- 7px/frame
  // * 60fps / 8px-per-cell = 52.5 cells/sec, not the previous unsourced 46.
  SHOT_SPEED: 52.5, // cells/second, straight up
  // VERIFIED (AttractMove, $215d-$217a in the Rev4 disassembly, read in
  // full): the demo gun's own call into MovePlyrHorz/MovePlayerVert always
  // passes exactly +-1 (raw pixel) as the distance argument -- the *only*
  // gating is the caller's own bit-7 "active half of the cycle" check
  // (already modeled separately, via attractFrame, as the condition under
  // which this speed is even applied for that frame's dt). 1 raw pixel
  // per active-gated frame call, 60fps, 8px/cell -> 7.5 cells/sec exactly
  // -- not a tuned guess, and not the previous 8.
  ATTRACT_MOVE_SPEED: 7.5, // cells/second, demo-mode bounce movement only
} as const;

export const AUDIO = {
  MASTER_VOLUME: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Bomb — a non-arcade feature (see FEATURES.bombs below). Double-tapping fire
// lobs a bomb that flies up like a shot; pressing fire again while it's in
// flight detonates it early, and it also auto-detonates on mushroom contact.
// Detonation clears mushrooms and enemies in a radius around the blast.
// ---------------------------------------------------------------------------
export const BOMB = {
  /** Bombs available per life; double-tapping fire spawns one if any remain. */
  MAX_STOCK: 3,
  /** Max gap between two fire presses, in ms, to register as the double-tap that spawns a bomb. */
  DOUBLE_TAP_WINDOW_MS: 300,
  /** Default radius (grid cells) of the blast: mushrooms/enemies within this distance of the detonation point are destroyed. Live-tunable via Game.bombRadius. */
  BLAST_RADIUS: 2,
  BLAST_RADIUS_MIN: 0.5,
  BLAST_RADIUS_MAX: 20,
  BLAST_RADIUS_STEP: 0.25,
  /** Default bomb flight speed, cells/second -- same as the regular shot. Live-tunable via Game.bombSpeed. */
  SPEED: SHOOTER.SHOT_SPEED,
  SPEED_MIN: 15,
  SPEED_MAX: 90,
  SPEED_STEP: 2.5,
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
  /** Double-tap fire to lob a bomb (see BOMB above); press fire again or hit a mushroom to detonate it. */
  bombs: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  crtFilter: true,
  debugOverlay: false,
  twoPlayerAlternating: false,
  godMode: false,
  slowMotion: false,
  showGrid: false,
  muteAudio: false,
  bombs: false,
};
