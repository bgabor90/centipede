# Arcade Accuracy To-Do

Status: **all items originally raised here are resolved.** Kept as a
record of what the original gap analysis found and how it was closed;
see `IMPLEMENTATION_NOTES.md` for the much larger, disassembly-cited
verification pass done after this doc was written.

## Original source

A ~2-minute segment (roughly 7:33–9:33) of a silent arcade-cabinet
capture of *Centipede* ("Centipede (Arcade)", Nenriki Gaming Channel,
youtube.com/watch?v=JSYIw9_o5mw), landing on the attract-mode / high-score
table screen. Notes below are original observations of what's on screen,
described in this project's own words; no video frames or verbatim
on-screen text are reproduced here.

## What the reference screen showed

A high-score table display: a numeric score readout at the top, a "HIGH
SCORES" heading, a ranked list of scores paired with 3-letter initials, a
"1 COIN 1 PLAY" line, a "BONUS EVERY [threshold]" line, and small
copyright text at the very bottom, all overlaid on a scattered mushroom
field with a small idle shooter and shot visible — indicating the table
sits on top of a running (or paused) attract-mode demo rather than being
its own separate screen.

## Findings and resolution

1. **No high-score table screen at all.** Resolved: attract mode now runs
   a continuous demo with the high-score table, coin/credit line, and
   bonus-life reminder layered on top of it the whole time (previously an
   exclusive title → demo → table cycle that blacked out the field for
   stretches; later reworked again into the current continuous-overlay
   design, matching real cabinet tile-layer behavior more closely). The
   vanity-table initials-entry flow flagged as missing is also built.
2. **Mushroom color/two-tone cap.** Resolved: mushroom masks render a
   distinct fill (`F`) and rim/detail (`D`) using the per-wave palette's
   body/eyes (or legs, when poisoned) roles, not a flat single color.
3. **HUD text wasn't one consistent color.** Resolved: the live-play
   header renders the score, lives, and high score in a single palette
   color (no more separate fixed-cyan "HIGH SCORE" label), and the
   attract overlay uses one consistent color for its own text block.
4. **Bottom copyright row.** The original finding was that this row is
   really used on real hardware and that reusing it for a fan-made
   disclaimer was the right call. That disclaimer has since been removed
   at the project owner's request — **the row is currently blank**, not
   occupied by either the real Atari copyright text or a substitute.

## Still open, if picked back up

- No live-gameplay reference clip (centipede descending through a
  mushroom field, a spider crossing, a flea drop) has been used to verify
  movement *feel* at normal speed — everything since this doc was written
  has instead been verified against the ROM disassembly directly, which
  is a stronger source where it's available. A gameplay video pass would
  only be useful now for whatever the disassembly didn't cover (see
  `IMPLEMENTATION_NOTES.md`'s "explicitly approximated" list).
