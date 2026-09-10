#!/usr/bin/env python3
"""CENTIPEDE — implemented per the Video Game Master (R. Dubren) official strategy book.

Run:           .venv/bin/python centipede.py
Smoke test:    .venv/bin/python centipede.py --smoke   (headless, ~3s)

Controls:
  Arrows / WASD   move (Shooter's zone, bottom 6 levels)
  Space           fire   (only one bullet on screen at a time)
  Enter           start / restart
  Esc             quit

Rules honored from the book:
  - 30-wide field; Shooter limited to the bottom 6 levels
  - 12-link wave cycle: chain shortens by one link per wave, singles increase
  - Slow/fast wave alternation in cycle 1 (slow waves stop at 40,000 pts)
  - Centipede: drop + reverse on a Mushroom/wall/other link; split rule
    (front keeps going, rear drops one and reverses); bottom retreat loop
    (along bottom, up along walls to level 6, resume descent)
  - Poisoned Mushroom (Scorpion) makes a chain a tumbler that falls straight
    to the bottom; a head hit cures it
  - Side Feed: heads fed from the side at level 7 once a link reaches bottom,
    at an ever-faster rate
  - Spider: enters level 12 one side, exits the other, never reverses
    horizontally, slashes + vertical holding bounces, ricochets off links,
    eats Mushrooms, respawn 4s (killed) / <2s (escaped), points 900/600/300
    by distance, window narrows with score, fast after 5,000 pts
  - Mushrooms: 4 shots to destroy (chips off per shot), +1 when destroyed,
    +5 damaged / +5 poisoned banked and restored when you lose a Shooter
  - Scorpion: wave 3 onward, crosses the outfield poicing Mushrooms, 1,000
  - Flea: one at a time, 2 shots (only after it has passed all Mushrooms of
    its column), plants Mushrooms as it drops, gated by the number of
    infield Mushrooms (5 at start, growing with score), 200
  - Bonus Shooter every 12,000 points
"""