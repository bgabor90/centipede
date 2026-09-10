# Centipede

A from-scratch, browser-based recreation of the 1981 Atari arcade game
*Centipede*, built to be portable (any modern browser on macOS, Windows, or
Linux) and easy to extend with new features. It's implemented as an original
TypeScript codebase with hand-drawn pixel art — no ROM assets or original
code involved.

The gameplay rules are sourced from *The Video Master's Guide to Centipede*
(Dubren, 1982), a contemporary strategy guide (`book_vmg_centipede.txt` in
this repo), and cross-referenced against general knowledge of the arcade
original.

## Running it

```
npm install
npm run dev
```

Then open the printed `localhost` URL. `npm run build` produces a static
`dist/` folder that can be hosted anywhere (or opened as local files with a
static server) — there's no server-side component.

## Controls

| Input | Action |
|---|---|
| Mouse move | Move the Shooter (stands in for the original's Trak-Ball) |
| Click / Space / Z | Fire |
| Arrow keys / WASD | Move the Shooter (alternative to the mouse) |
| P | Pause |
| F | Open/close the feature panel |

Touch works too (drag to move, tap-and-hold to fire) for tablets.

## Architecture

```
src/
  config.ts            All tunable numbers (speeds, scoring, thresholds) and
                        the FeatureFlags interface. Nothing gameplay-related
                        is hard-coded outside this file.
  types.ts              Shared small types.
  core/
    Random.ts            Seedable PRNG used everywhere instead of Math.random.
  entities/              One file per game object: Mushroom(Field), Shooter,
                        Shot, Centipede (Chain/segment model), Spider, Flea,
                        Scorpion. Entities own their own movement/state but
                        know nothing about scoring, audio, or rendering.
  systems/
    Renderer.ts           All canvas drawing (2D canvas, pixel-art scaled up).
    AudioSystem.ts         All sound, synthesized live via Web Audio (no
                        audio files to ship).
    InputSystem.ts         Mouse/touch/keyboard -> game input state.
  Game.ts                The orchestrator: owns every entity, runs the wave/
                        spawn/scoring/collision logic, and exposes a small
                        event stream (GameEvent[]) that Audio and (if you add
                        one) a UI layer can subscribe to.
  main.ts                 Bootstraps everything and runs the fixed-timestep
                        game loop.
```

### Why this shape

- **Config-driven, not code-driven.** Every rule from the manual (mushroom
  hit points, spider zone shrinkage by score, side-feed timing decay, flea
  infield-mushroom thresholds, etc.) is a named constant in `config.ts`. To
  retune difficulty or build a variant ruleset, edit `config.ts` — you
  shouldn't need to touch game logic.
- **Feature flags gate anything non-canonical.** `FeatureFlags` in
  `config.ts` (and the in-game F-panel) is the extension point for new work.
  Every flag must default to reproducing the faithful 1981 game; toggling a
  flag off should always get you back to stock behavior. Add new flags here
  rather than sprinkling ad-hoc booleans through the code.
- **Entities are dumb, `Game` is the brain.** This keeps the collision/
  scoring/spawning rules (which are genuinely intricate — see the centipede
  wave-cycle table and side-feed clock in the manual) in one place instead
  of smeared across entity classes.
- **The centipede's "chain" model.** Rather than hard-coding a follow-the-
  leader snake algorithm, each chain's head runs live obstacle-avoidance
  logic and records its own path history; body segments simply replay that
  history at a one-cell delay. This is why splitting a chain (shooting a
  body segment) "just works" — it's a slice of the history array — and why
  the newly-exposed segment immediately hits the mushroom left behind by its
  dead neighbor, exactly as the manual describes.

## Tuning & extending

- Change any number in `src/config.ts` (`CONFIG`-style exported consts) to
  retune speeds, scoring, thresholds, etc.
- Add a new flag to `FeatureFlags`/`DEFAULT_FEATURES` in `config.ts`, wire a
  checkbox into the panel markup in `index.html`, and branch on
  `game.features.yourFlag` wherever it's relevant. `godMode`, `slowMotion`,
  `showGrid`, and `debugOverlay` already demonstrate the pattern.
- `Game.drainEvents()` gives you a typed feed of every notable moment
  (`spiderHit`, `waveClear`, `extraLife`, ...) — a good hook point for new
  systems (particle effects, a replay recorder, telemetry) without touching
  `Game`'s internals.

## Known simplifications

This is a faithful recreation of the *rules*, not a disassembly-accurate
port of the original ROM:

- **High score entry** is a single numeric high score in `localStorage`,
  not the original's 3-letter vanity-table initials screen.
- **Spider movement** follows the manual's description (diagonal slashes,
  vertical bounce "holding patterns," never reversing net direction,
  deflecting off the centipede) via a randomized state machine — it's a
  faithful approximation of the behavior, not a port of the original's exact
  pseudo-random sequence (which isn't published anywhere).
- **Attack-wave slow/fast alternation** implements the manual's documented
  rule (Table 4: each composition plays once slow, once fast, until 40,000
  points, after which every wave is fast) as precisely as the source
  describes it.
- Art and sound are original work matching the manual's descriptions of each
  character, not extracted ROM graphics/samples.
