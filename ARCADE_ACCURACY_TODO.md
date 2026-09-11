# Arcade Accuracy To-Do

Source: a ~2-minute segment (roughly 7:33–9:33) of a silent arcade-cabinet
capture of *Centipede* ("Centipede (Arcade)", Nenriki Gaming Channel,
youtube.com/watch?v=JSYIw9_o5mw). That window turned out to land on the
game's idle **attract-mode / high-score table screen** rather than active
play — which is actually a good screen to study, since it's static and
text/color-dense. Notes below are my own observations of what's on
screen, described in my own words; no video frames or verbatim on-screen
text are reproduced here.

## What the reference screen actually shows

A high-score table display: a numeric score readout at the very top, a
"HIGH SCORES" heading, a ranked list of scores each paired with a
3-letter initials entry, a "1 COIN 1 PLAY" line, a "BONUS EVERY [point
threshold]" line, and small copyright text at the very bottom. Behind/
around all of that text, a scattered field of mushrooms fills the rest
of the screen, and there's a small rotating white arc/spinner graphic
roughly in the middle of the table. A tiny sprite and a short vertical
line near the bottom of the field look like an idle shooter and a shot
in flight, suggesting this table is overlaid on top of a running (or
paused) attract-mode demo rather than being its own separate screen.

## Corrections this points to

1. **We don't have a high-score table screen at all.** Our attract state
   currently just shows a logo, a "click or press fire" prompt, and a
   control hint. The real cabinet shows a proper ranked table (score +
   3-letter initials) with the coin/credit and bonus-life text, likely
   layered over a live demo. Building this (including the initials-entry
   flow already flagged as missing in `IMPLEMENTATION_NOTES.md`) is the
   single biggest gap between our attract mode and the original.

2. **Mushroom color doesn't match.** On this screen, mushroom caps read
   as a warm red/orange with a distinct darker green ring where the cap
   meets the stem — a two-tone cap, not the flat single-color cap we
   draw now (currently solid green for wave 1, from the per-wave
   palette's "body/mushroom" role). Two possibilities, and I'd want to
   confirm against footage of actual wave-1 *gameplay* (not attract mode)
   before changing the core palette mapping:
   - The attract/high-score screen uses its own fixed color set,
     separate from the live per-wave gameplay palette, in which case only
     the attract-screen mushrooms need a dedicated color, not the
     in-game ones.
   - Our "body" vs "eyes" role assignment from the disassembly table is
     backwards for mushrooms specifically (the source's column header
     was "Eyes/Mushroom-O/Text" — "Mushroom-O" plausibly means the cap's
     outline, not its fill).
   Either way, the mushroom sprite should probably become two-tone
   (fill + rim) instead of flat-colored — that's a visual improvement
   worth making regardless of which color goes where.

3. **HUD text isn't one consistent color.** Every piece of text on this
   screen — the score, "HIGH SCORES", the table rows, the coin/bonus
   lines — reads as the same warm red/orange. We currently render "HIGH
   SCORE" in a fixed cyan while the score digits use the per-wave "eyes"
   color (red for wave 1) — an inconsistency this screen suggests
   shouldn't be there, at least for the attract/high-score presentation.

4. **Bottom copyright row is really used.** We already deliberately leave
   this row blank during play and show our own "fan-made" disclaimer
   there instead of Atari's copyright text (a legal choice, not a
   layout one) — this screen confirms that row is exactly where the
   original puts that line, so our layout choice to reuse it for a
   disclaimer is the right call, just worth keeping.

## Suggested next steps, in priority order

1. Build a real attract-mode sequence: logo/title → live or canned demo
   gameplay → high-score table (rank, score, 3-letter initials, coin/
   bonus text) → loop. This also unlocks the vanity-table initials-entry
   flow already noted as missing.
2. Redesign the mushroom sprite as a two-tone cap (fill + rim) rather
   than flat-colored, and decide the fill/rim colors from an actual
   in-game wave-1 frame rather than the attract screen.
3. Make attract/high-score text use one consistent color rather than
   mixing a fixed cyan with the per-wave palette.
4. To go further than this one screen supports: capture a short clip of
   *live gameplay* (not attract mode) — ideally showing a centipede
   descending through a mushroom field, a spider crossing, and a flea
   drop — to verify movement speed/feel, spider/flea silhouette and
   animation, and whether the per-wave palette really does recolor
   mushrooms and the centipede together the way `Palette.ts` assumes.
