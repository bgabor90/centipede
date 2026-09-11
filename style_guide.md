# Centipede Arcade-Style Visual Guide

Goal: make the game read like an 1981 arcade cabinet while keeping this codebase structure.

## Baseline geometry (must not drift)

- Keep logical game geometry at `240x256` and a `30x32` tile grid with `CELL = 8`.
  - `CANVAS_W = 240`
  - `CANVAS_H = 256`
  - Header (score row) = 1 tile
  - Gameplay area = rows 1..30 (30 tiles)
  - Footer (copyright row) = 1 tile
- Preserve hard pixel placement:
  - `Renderer` rounds positions before drawing (`Math.round` in `Renderer.ts`).
  - Canvas context has `imageSmoothingEnabled = false`.
- Keep integer upscaling only (`resizeToFit()`).
  - Never rely on fractional CSS scale for gameplay readability.
- Keep `image-rendering: pixelated` in CSS (`index.html`).

## Palette system (where arcade color comes from)

- Treat colors as three arcade roles:
  - `body` (centipede/mushrooms)
  - `legs` (centipede legs / player gun)
  - `eyes` (text + centipede eyes + UI accents)
- `src/systems/Palette.ts` defines wave 1..14 values from disassembly docs in `DBGR_COLORS` and `WAVE_TABLE_DBGR`.
- If you are implementing an authentic palette pass:
  1. Edit `WAVE_TABLE_DBGR` first (wave rhythm and swaps).
  2. Then refine `DBGR_COLORS` hex values as a second step.
- Current draw path:
  - Mushroom body color uses `palette.body` unless poisoned.
  - Mushroom rim uses `palette.eyes`.
  - Shooter/legs/eyes use `palette` values in `Renderer.ts`.
- Keep poison treatment:
  - Poisoned mushroom uses `capPoison` now (`COLORS.capPoison`).
  - Avoid silently re-tinting poison states unless your new art also encodes that state.

## Sprite geometry and orientation

- Motion object size is effectively `16x8` for moving enemies/shooter (`Renderer.ts` calls).
- Centipede/Scorpion/Flea/Spider art is designed around:
  - `MASK_W = 16`, `MASK_H = 8`
  - Horizontal flip (`flip=true`) to reuse facing art, same as hardware behavior.
- `src/systems/Sprites.ts` is the built-in authoring source (editable by hand):
  - `CENTIPEDE_MASK` (single body sprite) + per-segment draw function.
  - `SPIDER_FRAMES`, `SCORPION_MASK`, `FLEA_MASK`, `SHOOTER_MASK`, `MUSHROOM_STAGES`.
- Keep outlines crisp:
  - Avoid adding antialiased edges in masks.
  - Avoid diagonals with thin 1px bridges that blur when upscaled.

## Mushroom appearance (high-priority visual difference)

The current implementation already supports 2-tone mushroom rendering:
- `F`, `R`, `S` in `MUSHROOM_STAGES` = fill, rim/detail, stem.
- In arcade-like mode, prefer:
  - warm/orange fill on untouched mushrooms
  - green/richer rim/shadow
  - pale stem
- If a sprite sheet is used, map `mushroom.stages` in `SpriteMapping` instead of the masks.

## Attract-mode and HUD style (high-variance area)

Arcade references suggest:
- More uniform top-banner text color on score/high-score screens.
- “HIGH SCORES” block should be central, rank + score + initials dense and readable.
- Footer row should still exist and carry a visible credit line.

Current behavior lives in `Renderer.ts`:
- `drawHeader()`, `drawTitleCard()`, `drawHighScoreTable()`, `drawFooter()`.
- Suggested first pass:
  1. Keep font family as pixel glyph path (`BitmapFont.ts`) rather than canvas text.
  2. Set attract/high-score text to one warm/consistent palette color.
  3. Keep border/box artifacts minimal; preserve scanline style instead.
- Keep score glyph proportions at 5x7.

## How to replace visuals with a full sprite sheet

Use this path when you want true cabinet-like sprites without changing gameplay code.

1. Add a sheet in `public/assets/sprites/` (recommended tile size `16x8`).
2. Build a mapping object matching `SpriteMapping` in `src/systems/spriteMapping.ts`.
3. At startup, call:

```ts
setCustomSpriteSheet(
  new SpriteSheet('/assets/sprites/my-sheet.png', 16, 8),
  {
    centipedeHead: { frames: [{ col: 0, row: 0 }] },
    centipedeBody: { frames: [{ col: 1, row: 0 }, { col: 2, row: 0 }] },
    mushroom: { stages: [{ col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }] },
    // spider/flea/scorpion/shooter optional
  }
);
```

- Drop this call once in `main.ts` after renderer/audio/input are created.
- Any omitted fields remain on mask-based built-ins, so migration can be incremental.
- Use `pickFrame(..., frameCounter, stepEveryNFrames=4)` timing for movement-facing frames.

## CRT and cabinet mood

- `drawCrtOverlay()` provides scanlines only.
- Arcade feel usually comes from:
  - gentle scanline alpha
  - slight brightness bloom around sprites
  - no blur/shadow heavy post effects
- If you add vignetting/noise:
  - keep it additive, subtle, and low opacity.
  - never apply blur filter to gameplay draw pass.

## Safe touchpoints by priority (edit only what is needed)

- `src/systems/Palette.ts`
  - Wave palette and DBGR mapping.
- `src/systems/Sprites.ts`
  - Built-in sprite masks, mushroom stages, animation cycles.
- `src/systems/Renderer.ts`
  - Color table (`COLORS`), overlay pass, HUD colors/layout.
- `src/systems/spriteMapping.ts`
- `src/systems/SpriteSheet.ts`
  - Keep draw logic unchanged unless adding non-grid sheet support.
- `index.html`
  - Base background, canvas shadow, UI typography, note/footer styling.

## Quick visual diff checklist

- [ ] Playfield still reads as 8x8 tiles on a `240x256` canvas.
- [ ] No smoothing/blur anywhere in gameplay pipeline.
- [ ] Enemy/sprite proportions stay in `16x8` motion-object band.
- [ ] Per-wave palette visibly shifts in arcade-like rhythm.
- [ ] Mushrooms show cap + rim contrast.
- [ ] Attract/high-score text is legible and color-consistent.
- [ ] Footer line remains visible and stable.
- [ ] Optional: custom sheet path works in all game states with fallbacks.
