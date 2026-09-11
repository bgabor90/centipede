# Implementation Notes: Reference-Pack Pass

This documents the changes made after cross-checking the implementation
against the authoritative reference pack at
`Documents/Codex/2026-09-10/.../centipede-reference-pack/` (source links,
asset checklist, rights notes — no copyrighted assets included in that
pack). It follows that pack's sign-off checklist format.

## Original assets used

None. All visuals are original hand-drawn pixel art (`src/systems/
Renderer.ts`, `src/systems/BitmapFont.ts`) and all audio is synthesized
live via Web Audio (`src/systems/AudioSystem.ts`). No Atari ROM data,
extracted sprite sheets, or Atari Vault audio files are stored in this
repo.

## Assets that remain manual/legal-acquisition required

Per the reference pack's rules, these can't be fetched or embedded by an
agent — they require the project owner's own legally-obtained copy:

- **Audio**: `Centipede 00.wav` through `Centipede 11.wav` from a
  legally-owned Atari Vault install. **The mapping from those 12 filenames
  to specific game events (which file is the shot sound, which is the
  spider chime, etc.) is not resolved** — it wasn't available in the
  sources checked this session. If you supply the files, they'll need to
  be identified by ear and renamed to match `SAMPLE_MANIFEST` in
  `AudioSystem.ts` (e.g. `shot.wav`, `spider.wav`, `explosion.wav`) and
  dropped into `public/assets/audio/original/` — the game will pick them
  up automatically and stop using the synthesized placeholder for that
  role. Do not commit them to a public repo without rights clearance.
- **Sprites**: the Spriters Resource sheet is a third-party extraction,
  not licensed for redistribution — not used here. The pixel art in this
  project is an original interpretation of the manual's character
  descriptions and the disassembly's documented dimensions/behavior, not
  traced or copied from any ROM/extraction source.

## Behaviors verified against `6502disassembly.com`

Fetched and cross-checked this session (see citations in `config.ts` /
`Palette.ts` comments):

- **Screen & tile geometry**: 240×256px, 30×32 grid of 8×8 tiles, gameplay
  area 30×30 with row 31 (top) for score and row 0 (bottom) unused during
  play. `Renderer.ts` now reproduces this exactly (previously used
  arbitrary 24px/18px header/footer bands).
- **Motion object convention**: 16×8px sprites, horizontal/vertical flip
  flags reused instead of separate mirrored art. Centipede segment
  leg/eye rendering now mirrors by direction the same way.
- **14-wave color palette**: exact DBGR byte table per wave for
  body/mushroom, legs/gun, and eyes/text roles, now driving mushroom cap
  color, centipede body/legs/eyes, and the shooter's color in
  `Palette.ts` (previously a fixed, arbitrarily-chosen palette).
- **Flea fall speed**: 2px/frame under 60,000 points, 3px/frame at/above
  it (converted to 15 / 22.5 cells/sec at this project's 8px cell size).
- **Flea mushroom planting**: a 25%-per-row-passed probability roll
  (previously a pre-planned random count per descent).
- **Bonus-life score thresholds** (10k/12k/15k/20k operator options):
  corroborated the Video Master's Guide's Table 3 already in use.
- **Flea's within-flight hit-once speed escalation**: corrected twice this
  session. First pass replaced an approximated 1.4x multiplier with a
  snap to FALL_SPEED_BASE_HIGH, reasoning from the Video Master's Guide's
  "fast -> very fast" phrasing. Reading `ChkMobjColl` ($2fba-$2fc2)
  directly afterward showed that's still wrong: the ROM sets a hit flea
  to a fixed 4 px/frame (30 cells/sec) — a third tier, not either base
  speed — and only kills it on a second hit if it's already at that
  speed. Now uses the dedicated HIT_ESCALATED_SPEED constant.
- **Scorpion speed, spawn gating, and mushroom-poisoning rules**: read
  `MoveScorpion` directly from the raw disassembly listing (not a
  summarized fetch, after an earlier session correctly distrusted one).
  Speed is the same confirmed 1px/2px-per-frame convention as the
  centipede and spider (7.5 / 15 cells/sec, not the previous 4.5 / 9.5
  guess). A spawn is only even considered once every ~256 frames (~4.27s)
  and succeeds just 25% of the time, and only while the current
  centipede's live segment count is below 11 (NCENT-1) — replacing a
  previous "unlocks after wave 3 of the cycle" approximation. It also only
  poisons a fully-intact mushroom, leaving already-damaged or
  already-poisoned ones alone.
- **Spider movement and speed**: read `MoveSpider`/`InitSpider` directly
  from the raw disassembly listing. Speed is confirmed as the same
  1px/2px-per-frame convention as the centipede and scorpion (7.5 / 15,
  upgraded from "verified by analogy" to verified outright), and the
  1,000/5,000-point difficulty thresholds for going fast early matched
  exactly. Replaced the previous hand-tuned continuous-probability
  diagonal/vertical wander with the ROM's actual mechanism: a fixed
  48-frame (~0.8s) redecision cadence (15-or-47 frames for the first
  check after spawning) driving two independent coin-flips -- one toggles
  between a diagonal slash and a vertical-only hold, the other may
  reverse vertical direction outright, at 75% under the "hard" difficulty
  DIP setting vs. 50% on easy (previously not modeled at all).
- **Spider kill scoring's distance calculation**: `CalcSpdrPts`
  ($2fd6-$2ff2) compares only the *vertical* distance between spider and
  shooter -- horizontal offset plays no part -- with raw thresholds of
  <22 units -> 900, <64 -> 600, else 300 (8px/row -> <2.75 and <8 rows).
  Replaced a 2D Euclidean-distance approximation and 1-row/4-row
  thresholds with a vertical-only distance and 2-row/7-row thresholds.
- **Lone-segment speed rule**: found while reading the segment-advance
  routine ($2994-$29ae) -- once exactly one centipede segment remains
  alive for the wave, its speed is forced to fast from then on,
  regardless of the wave's slow/fast designation. `CentipedeManager`
  previously left a surviving lone segment at whatever speed it already
  had.
- **Per-frame update order and shot-collision tolerance**: `MainLoop`
  ($2031-$2055) calls things in a specific order -- MoveCentipede,
  MovePlayer, MoveSpider, UpdateShot, then MoveScorpion, MoveFlea -- so
  the shot's collision check sees the centipede/spider at their
  already-moved current-frame position but the scorpion/flea at their
  not-yet-moved position from the previous frame. Our `updateShot` ran
  before `updateSpider`, so it always checked a one-frame-stale spider
  position against a freshly-advanced shot -- a real cause of shots
  visibly passing through the spider. Reordered `updatePlaying`/
  `updateAttractDemo` to match, and replaced the flea/scorpion/spider hit
  checks' exact-rounded-position equality with the same 0.6-cell
  proximity tolerance already used for centipede segments, since a
  fast-moving target's true position can otherwise fall between two
  swept rows/columns and never register a hit. Verified with randomized
  simulations tracking true continuous shot-target distance: every case
  where the two genuinely came within tolerance now results in a hit.
- **Player-death hitbox**: `ChkPlyrColl` ($2c9a) isn't a simple radius --
  it's a per-axis pre-filter (reject outright if either axis alone is too
  far) followed by a combined Manhattan-sum threshold, with the spider
  given a wider horizontal allowance ("spider is wide" per the source
  comment). Replaced box/circular/exact-match tolerances (0.55/0.6/exact)
  that were all noticeably tighter than the real hitbox with the verified
  thresholds (horizontal <0.875 cells, <1.25 for the spider; vertical
  <0.875; combined sum <1.5, <1.75 for the spider). Also confirmed the
  scorpion's own movement routine never calls `ChkPlyrColl` at all --
  touching it doesn't kill the player, matching the manual (only the
  spider, flea, and centipede do) and requiring no change there.
- **Mushroom-tally tick rate**: `RestoreShroom` ($2cf3) credits one
  mushroom every 8 frames (`frame_ctr & 7 == 0`, ~0.133s at 60fps). Our
  tally timer was 0.06s -- roughly twice as fast as the real cadence.
- **Side Feed entry row**: `CreateHead`'s `:InitSlot` ($2bf9) sets a new
  head's vertical position with an explicit "row 8" comment; our
  ENTRY_ROW was an unsourced guess of 7. Also cross-confirmed (not
  overridden) the existing "1/8 second per link" decay rate: the ROM
  reduces its cooldown by 8 raw frames per link, matching within
  rounding.
- **Flea's "low mushroom" counting zone**: `MUSHDC`/`MUSHER` ($2b95/
  $2bac) show the ROM's own mushroom-count-for-flea-eligibility spans
  rows 2-11, narrower than the manual's general "infield" zone (rows
  1-12) that `countInfield()` was reusing. Added a dedicated
  `LOW_MUSHROOM_ZONE_MAX_ROW` for the flea check and left the general
  infield zone constant (used for other purposes) untouched.
- **Wave-clear pause**: `:IncSpeed` ($3072) sets a ~64-frame (~1.07s)
  `delay_ctr` pause when the last segment of a wave is destroyed, before
  the next wave's centipede appears (`CreateHead` itself also checks
  `delay_ctr` and won't spawn a new head during it). `onWaveClear()`
  previously called `spawnWave` immediately with no pause at all. Also
  independently re-derived, then found already correctly implemented:
  the manual's "fast waves always repeat the composition of the
  preceding slow wave" pairing rule, and `InitCentipede`'s score-gated
  ($40,000) slow/fast assignment -- both already matched.
- **Extra-life cap gated the wrong quantity**: `AddPoints` ($2dba) caps
  bonus lives by checking *current total lives* (`cmp #6`), not how many
  bonuses have been awarded. `checkExtraLife()` was gating on
  `bonusLivesAwarded < 6`, so with a low starting-lives option a player
  could stack up to startingLives + 6 total lives. Fixed to cap on
  `this.lives < LIVES.MAX_BONUS_LIVES`, while still advancing
  `bonusLivesAwarded` (the next-threshold tracker) every time a threshold
  is crossed regardless of whether the cap blocks the actual life, matching
  the ROM's unconditional threshold-tracker update.
- **Pre-tally death pause**: `ExplodePlayer` ($2cc8) sets a 48-frame
  (~0.8s) pause immediately on death, and `RestoreShroom` explicitly
  refuses to tally mushrooms while the player's explosion sound is still
  playing. `killPlayer()` seeded the tally timer with 0, starting the
  mushroom-credit ticks with no delay at all. Also re-verified (already
  correct, no change) the wave-color palette table byte-for-byte against
  the raw `:colors` listing at $267a.
- **Shot muzzle offset**: `InitPlayer` ($2936) positions the shot exactly
  4 raw units (0.5 cells) above the player's own position ("sticks out
  of gun"). We used 0.4 -- corrected to 0.5.
- **Flea spawn column exclusion**: `InitFlea`'s ($20f4) random column
  picker rejects raw values below 16 ("col 0 is offscreen; retry" plus
  one more rejected value), excluding our columns 1-2 from flea spawns.
  Also checked high-score qualification (8-entry table, strict `>`
  comparison) against `UpdateHS` -- already an exact match.
- **Initial mushroom scatter algorithm**: `InitPlay` ($28e4-$2934) makes
  exactly 46 placement attempts, walking row 27 down to row 2 and
  wrapping back to 27 partway through -- rows 8-27 get two attempts each
  (up to 2 mushrooms), rows 2-7 get one (at most 1), and rows 1 and 28-30
  never get any. A duplicate pick on an occupied cell is a no-op, per the
  source's own comment. Replaced a hand-tuned 28-36-count uniform scatter
  across the full row range with this exact algorithm. Verified across 20
  trials: always 46 mushrooms, rows strictly 2-27, max 2 per row.

## Behaviors kept from the Video Master's Guide (not overridden)

The disassembly excerpts fetched this session were incomplete for these —
rather than replace a complete, unambiguous source with an ambiguous
fragment, these stayed as originally implemented from the 1982 strategy
guide:

- Spider kill-respawn timing (~4s) and zone narrowing by score.
- Per-target point values (centipede head/body, spider, flea, scorpion)
  and the attack-wave composition/speed-alternation table.
- Side-feed timing decay curve.

## Attract mode: continuous demo, not exclusive phases

The attract loop originally cycled through exclusive TITLE / DEMO /
HIGH_SCORES phases (a title card, then blacked-out demo gameplay, then a
high-score table). That's been replaced with the real cabinet's actual
behavior: the high-score table, coin/credit line, and bonus-life reminder
are shown continuously, together, layered over a demo that never stops or
blacks out (`AttractPhase`/`attractPhase`/`ATTRACT_PHASE_SECONDS` removed
from `Game.ts`; `drawTitleCard`/`drawHighScoreTable`/`drawAttract` removed
from `Renderer.ts` in favor of a single `drawAttractOverlay`). The demo
gun can now die mid-loop too (`ChkPlyrColl` runs unconditionally from the
centipede/spider/flea update routines regardless of `attract_mode`) — on a
hit, a ~0.8s pause (`ExplodePlayer`'s `delay_ctr`) then a fresh centipede/
spider/flea respawn, score and the mushroom field untouched, so the same
deterministic run just continues (`attractRespawnTimer`). The initial
mushroom scatter for this mode was also switched from a fixed checkerboard
formula to the same verified `InitPlay` algorithm used for real games
(see the scatter entry above).

Follow-up adjustments after user feedback on the resulting visuals:
- The overlay text render order was moved to *after* the board elements
  (mushrooms/centipede/spider/shot), not before — UI text now draws on
  top of the live demo board rather than getting drawn over by it.
- Per-row rank numbers were dropped from the high-score list ("1  012000
  EJD" -> "012000  EJD"), and the "CLICK OR PRESS FIRE TO START" /
  "MOUSE / TOUCH = TRAK-BALL" lines were removed entirely, matching a
  user-supplied reference screenshot that shows only HIGH SCORES, the
  score/initials rows, 1 COIN 1 PLAY, and BONUS EVERY <n>.
- The dimming backdrop added behind the overlay text (for legibility
  against the busy live board) was removed per request; the text's own
  color contrast against the board carries readability instead, matching
  that same reference.
- The "FAN-MADE - NOT AN ATARI PRODUCT" footer disclaimer (`drawFooter`)
  was removed per request. It existed specifically because we
  deliberately don't display the real "©1980 ATARI" text that occupies
  that screen row on the original hardware — **the game currently shows
  no disclaimer of any kind**, which is worth knowing if that mattered.

## Explicitly approximated (flagged, not verified anywhere)

- POKEY channel-to-sound-effect mapping is transcribed from the reference
  pack, not independently re-confirmed against the disassembly text by
  this session; flea's channel isn't documented anywhere found, so it's
  grouped with the spider channel as a labeled guess.
- Named RGB hex values for each DBGR color (the source names colors, e.g.
  "orange", "reddish magenta" — the specific hex chosen to render each is
  this project's own reasonable interpretation, not a calibrated value).

## Sign-off checklist (from the reference pack)

- [x] All visual assets are original or clearly-labeled placeholders — no
      extracted third-party art is used.
- [x] All audio is synthesized and clearly documented as such; real-sample
      hookup points exist but are unpopulated pending manual acquisition.
- [x] Sprite/tile dimensions (8×8 tiles, 16×8 motion objects, 240×256
      screen) match the documented geometry.
- [x] Rendering uses `image-rendering: pixelated` with all draws
      pixel-snapped — no smoothing.
- [x] Palette behavior is implemented from the disassembly's documented
      per-wave table, not guessed.
- [x] Behavior/timing checked against source/disassembly where available;
      gaps are flagged above rather than silently guessed.
- [x] The reference pack folder itself was not modified.
