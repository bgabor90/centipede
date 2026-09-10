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

import os
import random
import sys
import time
from collections import deque
from math import sin

import pygame

# ---------------------------------------------------------------- layout
COLS = 30
ROWS = 30                      # level 1 = bottom
CELL = 14
HUD_H = 48
W = COLS * CELL                # 420
H = HUD_H + ROWS * CELL        # 864

PLAYER_MIN_ROW = ROWS - 6      # level 6  (y = 13*CELL)
PLAYER_MAX_ROW = ROWS - 1      # level 1  (y = 19*CELL)
INFIELD_MIN_ROW = ROWS - 12    # level 12 (y = 7*CELL)
SIDE_FEED_ROW = ROWS - 7       # level 7
SPIDER_ENTRY_ROW = ROWS - 12   # level 12

DARK = (10, 10, 18)
WHITE = (235, 235, 240)
GRAY = (150, 150, 160)
HEAD_RED = (230, 60, 60)
LINK_GREEN = (90, 200, 100)
BULLET_YELLOW = (255, 230, 120)
SPIDER_MAGENTA = (230, 90, 225)
SPIDER_DARK = (140, 40, 140)
SCORPION_YELLOW = (250, 200, 70)
FLEA_BLUE = (120, 160, 255)
PLAYER_CYAN = (90, 200, 255)

MUSHROOM_HITS = 4
POISON_GREEN = (70, 200, 90)


def row_center_y(row):
    return HUD_H + row * CELL + CELL // 2


def cell_rect(col, row):
    return pygame.Rect(col * CELL, HUD_H + row * CELL, CELL, CELL)


def spider_max_level(score):
    if score < 80_000:
        return 12
    for band, lvl in ((100_000, 11), (120_000, 10), (140_000, 9), (160_000, 8)):
        if score < band:
            return lvl
    if score < 860_000:
        return 7
    return 12


def flea_threshold(score):
    table = [(20_000, 5), (120_000, 9), (140_000, 15), (160_000, 16),
             (180_000, 17), (200_000, 18), (220_000, 19), (240_000, 20),
             (260_000, 21), (280_000, 22), (300_000, 23)]
    for cap, n in table:
        if score <= cap:
            return n
    return 23 + (score - 300_000) // 20_000


# ---------------------------------------------------------------- entities
class Bullet:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def circle(self):
        return self.x, self.y, 3


class Centipede:
    """cells[0] is the head. mode: 'down' or 'up'. speed in px/s."""

    def __init__(self, cells, dirx, speed, poisoned=False, mode="down"):
        self.cells = deque(cells)
        self.dirx = dirx
        self.speed = speed
        self.poisoned = poisoned
        self.mode = mode
        self.step_t = random.uniform(0.0, 0.15)

    @property
    def head(self):
        return self.cells[0]

    def step(self, game):
        col, row = self.head[0], self.head[1]
        if self.poisoned:
            # tumbler: straight down ignoring mushrooms
            if row >= ROWS - 1:
                self.poisoned = False
                self._retreat_step(game)
                return
            if row + 1 >= ROWS - 1:
                self._trigger_side_feed(game)
                self.poisoned = False
            self._move_to(col, row + 1)
            return
        self._descend_or_retreat(game)

    def _des