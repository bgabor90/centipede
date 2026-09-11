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
- **Flea's "low mushroom" counting zone**: corrected twice. First pass
  read `MUSHDC`/`MUSHER` ($2b95/$2bac) as spanning rows 2-11 (narrower
  than the manual's general "infield" zone, rows 1-12) and added a
  dedicated `LOW_MUSHROOM_ZONE_MAX_ROW` for it. The Video Master's
  Guide's own dedicated table for this exact mechanic ("Preventing the
  Flea Attack") states plainly: "Mushrooms planted in the infield (i.e.
  levels 2-12) serve the function of terminating the Flea attack" --
  conflicting with that reading, which depended on a row-index-to-row-
  number offset inferred from the raw disassembly, not stated outright.
  Corrected `LOW_MUSHROOM_ZONE_MAX_ROW` to 12, matching the manual and
  making it the same zone as the general infield after all.
- **Investigated and ruled out as a bug**: a "the flea seems to have
  disappeared" report, after the initial-mushroom-scatter port (see
  above) started regularly planting ~14 mushrooms in this same zone at
  the start of a fresh game -- well above the 5-mushroom early-game
  threshold that suppresses flea spawning. Traced `InitPlay`'s own
  scatter loop ($2902-$291c) and confirmed it increments the *same*
  `plyr_low_mush` counter the flea check reads, using the identical zone
  boundary, for every mushroom it plants there. The real arcade's own
  initial scatter produces the same high starting count and the same
  early-game flea suppression -- this is faithful, verified Centipede
  behavior (a well-known strategic element: fleas are suppressed while
  the field is mushroom-dense and start appearing as it's cleared), not
  a regression introduced by the scatter-algorithm port.
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
- **Pre-tally death pause**: corrected twice. First pass gated this on
  `ExplodePlayer`'s `delay_ctr=48` (~0.8s), reasoning from `RestoreShroom`'s
  "player busily exploding?" check. Reading `UpdateExplosions`
  ($2701-$2744) directly afterward showed that's the wrong mechanism:
  `delay_ctr` is a different, unrelated pause (blocks centipede movement/
  new heads); the tally's actual gate is the player's own 8-frame
  explosion picture sequence ($20-$27 at 4 frames each, 32 frames total,
  ~0.53s), which is what initializes the mushroom pointer `RestoreShroom`
  needs to do anything at all. Corrected the seeded tally timer from
  48/60 to 32/60. Also re-verified (already correct, no change) the
  wave-color palette table byte-for-byte against the raw `:colors`
  listing at $267a.
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

## Attract mode is silent, and flea's real sound channel

- **Attract mode is completely silent on real hardware**: `UpdateSound`
  ($3079-$308b) checks `attract_mode` every frame and, when set, zeroes
  all four POKEY channels and returns immediately -- sound only plays
  during real gameplay. `AudioSystem.handle()` previously played every
  event (fire, hits, spawns, death) regardless of state, so the
  continuously-running attract demo was audibly identical to real play.
  Fixed by passing the current `GameStateName` into `handle()` and
  skipping entirely when it's `'ATTRACT'`. Verified directly: 0 sound
  calls for a batch of events dispatched with state `'ATTRACT'`, normal
  playback with state `'PLAYING'`.
- **Flea's sound channel**: `UpdateSound`'s own header comment
  ("1: all explosions / 2: bonus, centipede, flea/scorpion sounds /
  3: shot sound / 4: spider sound") places flea on CH2 with bonus/
  centipede/scorpion, not CH4 with the spider as a prior,
  reference-pack-transcribed guess had it. Corrected the doc comment,
  `SAMPLE_MANIFEST` labels, and event grouping in `AudioSystem.ts`
  (synthesized playback itself is unaffected -- flea and spider already
  used separate synth voices -- this only fixes the channel labeling and
  which role a future real WAV sample should fill).

## Centipede leg-animation rate

`MoveCentipede`'s `:SegAlive` ($296d-$297a) advances a live segment's leg
picture every *other* frame (`frame_ctr & 1 == 0`), twice as fast as the
spider/scorpion's own verified every-4-frames animation rate. `Renderer.
ts`'s `pickMaskFrame`/`pickFrame` default to `stepEveryNFrames = 4` (correct
for spider/scorpion), and the centipede segment draw call was using that
same default instead of passing its own verified `2`. Fixed both the
mask-based and custom-sprite-sheet centipede draw paths.

## Kill flash for centipede/spider/flea/scorpion

`UpdateExplosions` ($2701-$2744) shows a killed enemy doesn't vanish
instantly -- its picture counts down one step per frame from $ff to $f9
(6 steps, ~0.1s at 60fps, no extra gating) before the slot finally
clears. The game previously removed killed entities the same frame with
no visual feedback at all. Added `Game.killFlashes` (spawned at each of
the four kill sites: centipede segment, flea, scorpion, spider) and a
matching `drawKillFlash` in `Renderer.ts` -- a brief solid flash at the
kill cell, reusing the existing tally-flash color rather than new sprite
art for an animation that's under a fifth of a second on real hardware
anyway. Verified directly: flash persists for exactly 6 frames then
clears.

## Spider point-value popup

`EXPLOD`'s `:ExplDone` ($2711-$271f) shows that once the spider's own
kill flash finishes, its motion-object slot gets reused to display the
exact point value earned (300/600/900, from the same distance tiers
`CalcSpdrPts` uses for scoring) at the kill location -- a classic arcade
"floating score" convention this game had entirely missing, for any
entity. Added `Game.spiderPointsPopup`, spawned on spider kill with a
short delay (matching the kill-flash duration, so it appears as the
flash clears rather than overlapping it) and a ~1s display window (the
real hold time -- up to the spider's own ~4s respawn gap -- wasn't
tuned down for a modern display; 1s is a deliberate, undocumented
choice, not a verified value). Scoped to the spider only, matching the
source (centipede/flea/scorpion have fixed, well-known point values with
no documented equivalent display). Verified directly: text and score
match ("900" for a close kill), popup appears after the flash delay and
clears after its own duration.

## Precise shot-vs-target hit thresholds

`ChkMobjColl` ($2f5e-$300e) shows the real shot-vs-target hit test isn't
a single symmetric radius per type -- it's two independent per-axis
checks, verified precisely: vertical distance <5 raw units (0.625 cells)
for everything, except a flea already hit once ("fast") gets a wider
<7 (0.875) to compensate for its much higher fall speed; horizontal
distance <6 (0.75) for the centipede/flea, <10 (1.25) for the
spider/scorpion. A prior pass (fixing visible spider tunneling) had
already moved off exact-position equality but used a flat 0.6-cell
tolerance for every type/axis -- notably narrower than the real spider/
scorpion horizontal window (1.25) and the fast-flea vertical window
(0.875). Replaced with the exact verified per-axis/per-type values in
`Centipede.findSegmentNear()` and the flea/scorpion/spider checks in
`updateShot()`. Verified with the same true-continuous-distance
simulation methodology as the original tunneling fix (isolated per-type
runs, not chained after hundreds of unrelated trials in the same
persistent game object -- that combination was confirmed as a test-
harness artifact, not a collision bug, when a stray wave-clear mid-trial
populated a fresh centipede that intercepted the shot first).

## High-score initials entry: in-table, not a popup dialog

`GetInitials`'s own drawing code targets an output pointer built from
`plyr_hs_init_slot` -- an offset directly into the on-screen high-score
table's tile memory -- rather than a separate screen area. The real
cabinet doesn't show a standalone "enter your initials" dialog box: it
draws "GREAT SCORE" / "ENTER YOUR INITIALS" and edits the new entry
directly inside the same ranked high-score table shown during attract
mode, at whatever rank the score actually earned, with the initial
currently being typed blinking in place while existing lower entries
shift down. `drawHighScoreEntry()` previously rendered a separate dark
popup box with the pending score shown alone (not in ranked context) and
a large standalone initials editor below it. Rewritten to merge the
pending entry into the real table (capped at 8 rows, matching
`drawAttractOverlay`) and blink the in-progress initial in place.

## "GAME OVER" always shows, even for a qualifying score

The game-over branch (~$2457-$248d) draws the literal string 'GAME OVER'
unconditionally whenever the game ends -- `UpdateHS` (the high-score
check) and the "GAME OVER" message draw are separate steps that both
run, not mutually exclusive. The tally-completion code in this project
(reached once the end-of-life mushroom tally finishes) skipped the
GAME_OVER state entirely and jumped straight to `beginHighScoreEntry()`
for a qualifying score, so "GAME OVER" was never shown at all in that
case. Fixed by always entering GAME_OVER first
(recording whether it qualifies) and only branching to high-score entry
or attract mode once the timer -- or an early skip -- finishes. Also
made the existing "click to skip the wait" input handling safe for the
qualifying case: it used to jump straight into a brand new game
unconditionally, which would have silently discarded a deserved
high-score entry for an impatient click; `skipGameOverWait()` now only
ever advances to whatever the timer would have led to anyway. Verified
directly: non-qualifying score -> GAME_OVER -> ATTRACT; qualifying score
-> GAME_OVER -> HIGH_SCORE_ENTRY; qualifying score with an early skip ->
still HIGH_SCORE_ENTRY, never bypassed.

## Colliding entity is destroyed along with the player

`ExplodePlayer` ($2cc8-$2cd2) deactivates whatever the player collided
with in the same moment the player dies (`sta mobj_pict,x` on the
colliding object) -- silently: no score added, and for a centipede
segment, no mushroom left behind (unlike a shot kill, which does both).
`checkShooterCollisions()` previously only killed the player, leaving
the centipede segment/spider/flea that hit them completely untouched.
Added `CentipedeManager.removeSegmentAt()` (splits the chain the same
way a shot would, but skips scoring and mushroom-planting) and wired all
three collision cases to remove the offending entity. Verified directly:
all three cases leave score unchanged, remove the entity (segment count
drops, spider/flea become null), and centipede collisions plant no
mushroom.

## Player-death pause only freezes the centipede, not everything

Only `MoveCentipede` ($2955) and `CreateHead` ($2be1) actually check
`delay_ctr` -- the spider, flea, scorpion, and the shot are not gated by
it at all and keep running on real hardware during the pause after a
death (already correctly modeled this way for the wave-clear pause,
`updateWaveDelay()`, earlier). The `PLAYER_DEATH_ANIMATION` state added
in a separate pass routed through a fully exclusive update path that
froze the entire simulation for its ~32-frame duration instead. Fixed
`updatePlayerDeathAnimation()` to keep updating spider/flea/scorpion
while leaving the centipede untouched. Verified directly: centipede head
position stays frozen through the window while the spider continues
moving normally.

## Spider/flea/scorpion also keep running through the mushroom tally

Following on from the player-death-pause fix above: `ChkDelay`/`CheckEnd`
($2416-$2423) don't even start counting `delay_ctr` down while the
tally is in progress (`mush_ptr` still set) -- it stays at its post-
death value, nonzero, for however long the tally takes. Since only
`MoveCentipede`/`CreateHead` check `delay_ctr` at all, that means only
the centipede stays frozen through the *entire* tally; spider/flea/
scorpion keep running exactly as in normal play. `updateTally()`
previously called nothing but the tally logic itself, freezing
everything for the whole sequence. Fixed by also calling `updateSpider`/
`updateFlea`/`updateScorpion` each tally frame. Verified directly: the
centipede stays frozen mid-tally while the spider keeps moving.

## Explicitly approximated (flagged, not verified anywhere)

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
