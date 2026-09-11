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

## Behaviors kept from the Video Master's Guide (not overridden)

The disassembly excerpts fetched this session were incomplete for these —
rather than replace a complete, unambiguous source with an ambiguous
fragment, these stayed as originally implemented from the 1982 strategy
guide:

- Spider respawn timing (~4s after a kill, ~2s after an escape), zone
  narrowing by score, and point-by-distance (300/600/900).
- Scorpion behavior and poisoning rules (the disassembly excerpt available
  this session didn't surface scorpion-specific routines).
- Per-target point values (centipede head/body, spider, flea, scorpion)
  and the attack-wave composition/speed-alternation table.
- Side-feed timing decay curve.

## Explicitly approximated (flagged, not verified anywhere)

- Centipede horizontal movement speed in absolute px/frame (two discrete
  tiers are confirmed to exist; the numeric value wasn't in the fetched
  excerpt — tuned by feel instead).
- The flea's within-flight "hit once -> faster" speed multiplier (the
  escalation itself is documented in the strategy guide; the exact factor
  is this project's own choice).
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
