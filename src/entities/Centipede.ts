import { CENTIPEDE_SPEED, GRID, SCORING, ZONES } from '../config';
import type { Direction } from '../types';
import { MushroomField } from './Mushroom';

export interface StepState {
  row: number;
  col: number;
  dir: Direction;
  poisoned: boolean;
}

export interface SegmentView {
  chainId: number;
  index: number; // 0 = head
  row: number; // interpolated
  col: number; // interpolated
  dir: Direction;
  poisoned: boolean;
  isHead: boolean;
}

let nextChainId = 1;

/**
 * A single connected run of centipede segments (a "chain" or lone "link").
 *
 * Movement model: only the head (index 0) runs live obstacle-avoidance
 * logic. Every step the head fully completes (one grid cell of travel), its
 * resulting state is pushed onto `history`. Follower segment `i` simply
 * displays `history[i]` (interpolated against `history[i+1]` using the same
 * per-tick progress the head is using toward its own next step). Because
 * every segment in real Centipede obeys identical movement rules and is
 * spaced exactly one cell apart, a follower always traces the exact path
 * the head took — no separate "chase" logic is needed, and splitting a
 * chain is just slicing this history array.
 */
export class Chain {
  readonly id = nextChainId++;
  length: number;
  speed: number; // cells/second for non-poisoned legs
  history: StepState[]; // index 0 = newest (head's current settled cell)
  progress = 0; // 0..1 fraction of the way through the current leg
  verticalDir: 1 | -1 = -1; // -1 descending, +1 ascending (retreat loop)
  poisoned: boolean;
  private poisonedPhase: 'h' | 'v' = 'h';
  private atBottom = false; // true while "resting" at row 1 (suppresses repeat side-feed triggers)

  constructor(initial: StepState, length: number, speed: number, verticalDir: 1 | -1 = -1) {
    this.length = length;
    this.speed = speed;
    this.verticalDir = verticalDir;
    this.poisoned = initial.poisoned;
    this.atBottom = initial.row === 1;
    // Pre-fill history so a freshly spawned/split chain starts fully
    // "stacked" at its entry point and strings out as it moves.
    this.history = Array.from({ length: length + 1 }, () => ({ ...initial }));
  }

  get headState(): StepState {
    return this.history[0];
  }

  /** True once every segment has been destroyed. */
  get isEmpty(): boolean {
    return this.length <= 0;
  }

  update(dt: number, world: CentipedeWorld): void {
    if (this.isEmpty) return;
    this.progress += this.speed * dt;
    let safety = 0;
    while (this.progress >= 1 && safety++ < 8) {
      this.progress -= 1;
      this.advanceOneLeg(world);
    }
  }

  private advanceOneLeg(world: CentipedeWorld): void {
    const cur = this.history[0];
    let row = cur.row;
    let col = cur.col;
    let dir = cur.dir;

    if (this.poisoned) {
      if (this.poisonedPhase === 'h') {
        let newCol = col + dir;
        if (newCol < 1 || newCol > GRID.COLS) {
          dir = (dir * -1) as Direction;
          newCol = col + dir;
        }
        col = newCol;
        this.poisonedPhase = 'v';
      } else {
        if (row === 1) {
          this.poisoned = false;
          this.verticalDir = 1;
          row = 2;
        } else {
          row = row - 1;
        }
        dir = (dir * -1) as Direction;
        this.poisonedPhase = 'h';
      }
    } else {
      const targetCol = col + dir;
      const blocked = this.isBlocked(world, row, targetCol);
      if (!blocked) {
        col = targetCol;
        this.atBottom = row === 1;
      } else if (targetCol >= 1 && targetCol <= GRID.COLS && world.mushrooms.isPoisoned(row, targetCol)) {
        // Poisoned from the side: begin the tumble.
        this.poisoned = true;
        if (row === 1) {
          this.verticalDir = 1;
          row = 2;
          this.poisoned = false;
        } else {
          row = row - 1;
        }
        dir = (dir * -1) as Direction;
        this.poisonedPhase = 'h';
      } else if (this.verticalDir === -1 && row === 1) {
        // Sliding along the floor, hit a wall/segment: turn upward.
        this.verticalDir = 1;
        row = 2;
        dir = (dir * -1) as Direction;
        this.atBottom = false;
      } else if (this.verticalDir === 1 && row === ZONES.SHOOTER_MAX_ROW) {
        // Reached the ceiling of the retreat loop: turn back down.
        this.verticalDir = -1;
        row = row - 1;
        dir = (dir * -1) as Direction;
      } else {
        const prevRow = row;
        row = row + this.verticalDir;
        dir = (dir * -1) as Direction;
        if (row === 1 && prevRow !== 1 && !this.atBottom) {
          this.atBottom = true;
          world.onReachBottom(this);
        }
      }
    }

    const newState: StepState = { row, col, dir, poisoned: this.poisoned };
    this.history.unshift(newState);
    if (this.history.length > this.length + 1) this.history.length = this.length + 1;
  }

  private isBlocked(world: CentipedeWorld, row: number, col: number): boolean {
    if (col < 1 || col > GRID.COLS) return true;
    if (world.mushrooms.isBlocking(row, col)) return true;
    if (world.isOccupiedByOtherChain(row, col, this.id)) return true;
    return false;
  }

  /** Interpolated view of every live segment, head first. */
  getSegmentViews(): SegmentView[] {
    const views: SegmentView[] = [];
    for (let i = 0; i < this.length; i++) {
      const at = this.history[i];
      const from = this.history[i + 1] ?? at;
      const t = this.progress;
      views.push({
        chainId: this.id,
        index: i,
        row: lerp(from.row, at.row, t),
        col: lerp(from.col, at.col, t),
        dir: at.dir,
        poisoned: at.poisoned,
        isHead: i === 0,
      });
    }
    return views;
  }

  /** Discrete (non-interpolated) cell for segment i — used for shot targeting. */
  cellOf(i: number): { row: number; col: number } {
    const s = this.history[i];
    return { row: s.row, col: s.col };
  }

  /**
   * Destroys segment `index`. Returns the resulting new chain (the
   * detached tail), if any, plus whether this chain became empty.
   */
  destroySegmentAt(
    index: number,
    newHeadSpeed = CENTIPEDE_SPEED.FAST
  ): { newChain: Chain | null; destroyedCell: { row: number; col: number } } {
    const destroyedCell = this.cellOf(index);
    const tailLen = this.length - 1 - index;
    let newChain: Chain | null = null;
    if (tailLen > 0) {
      const tailHistory = this.history.slice(index + 1); // length === tailLen + 1
      newChain = Chain.fromHistory(tailHistory, tailLen, newHeadSpeed, this.verticalDir);
    }
    if (index === 0) {
      this.length = 0; // this chain is fully consumed; caller removes it
    } else {
      this.length = index;
      this.history.length = index + 1;
    }
    return { newChain, destroyedCell };
  }

  private static fromHistory(history: StepState[], length: number, speed: number, verticalDir: 1 | -1): Chain {
    const chain = Object.create(Chain.prototype) as Chain;
    (chain as any).id = nextChainId++;
    chain.length = length;
    chain.speed = speed;
    chain.history = history;
    chain.progress = 0;
    chain.verticalDir = verticalDir;
    chain.poisoned = history[0].poisoned;
    (chain as any).poisonedPhase = 'h';
    (chain as any).atBottom = history[0].row === 1;
    return chain;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface CentipedeWorld {
  mushrooms: MushroomField;
  isOccupiedByOtherChain(row: number, col: number, exceptChainId: number): boolean;
  onReachBottom(chain: Chain): void;
}

export interface HitResult {
  points: number;
  cell: { row: number; col: number };
  wasHead: boolean;
  chainRemoved: boolean;
}

/** Owns every live chain and coordinates spawning/splitting/collision. */
export class CentipedeManager {
  chains: Chain[] = [];

  get totalSegments(): number {
    return this.chains.reduce((sum, c) => sum + c.length, 0);
  }

  get isWaveClear(): boolean {
    return this.chains.length === 0;
  }

  clear(): void {
    this.chains = [];
  }

  spawnChain(row: number, col: number, dir: Direction, length: number, speed: number, verticalDir: 1 | -1 = -1): void {
    const chain = new Chain({ row, col, dir, poisoned: false }, length, speed, verticalDir);
    this.chains.push(chain);
  }

  update(dt: number, world: CentipedeWorld): void {
    for (const chain of this.chains) chain.update(dt, world);
    this.chains = this.chains.filter((c) => !c.isEmpty);
    // VERIFIED ($2994-$29ae in the Rev4 disassembly): once exactly one
    // centipede segment remains alive for the wave, its speed is forced to
    // fast from then on, regardless of the wave's slow/fast designation.
    if (this.totalSegments === 1) {
      this.chains[0].speed = CENTIPEDE_SPEED.FAST;
    }
  }

  getAllSegmentViews(): SegmentView[] {
    const out: SegmentView[] = [];
    for (const chain of this.chains) out.push(...chain.getSegmentViews());
    return out;
  }

  isOccupiedByOtherChain(row: number, col: number, exceptChainId: number): boolean {
    for (const chain of this.chains) {
      for (let i = 0; i < chain.length; i++) {
        const cell = chain.cellOf(i);
        if (cell.row === row && cell.col === col) {
          if (chain.id !== exceptChainId) return true;
        }
      }
    }
    return false;
  }

  /** Finds the frontmost (by render order) segment occupying a cell, for shot collision. */
  // VERIFIED (ChkMobjColl, $2f5e-$300e): the real shot-vs-target hit test
  // is two independent per-axis thresholds, not a single symmetric
  // radius -- vertical distance <5 raw units (0.625 cells), horizontal
  // <6 (0.75 cells) for a centipede segment specifically.
  findSegmentNear(row: number, col: number, rowTolerance = 5 / 8, colTolerance = 6 / 8): { chain: Chain; index: number } | null {
    for (const chain of this.chains) {
      const views = chain.getSegmentViews();
      for (const v of views) {
        if (Math.abs(v.col - col) < colTolerance && Math.abs(v.row - row) < rowTolerance) {
          return { chain, index: v.index };
        }
      }
    }
    return null;
  }

  /** Applies a shot hit to segment `index` of `chain`; plants a mushroom; may split the chain. */
  destroySegment(chain: Chain, index: number, mushrooms: MushroomField): HitResult {
    const wasHead = index === 0;
    const { newChain, destroyedCell } = chain.destroySegmentAt(index, CENTIPEDE_SPEED.FAST);
    mushrooms.plant(destroyedCell.row, destroyedCell.col, { force: true });
    if (chain.isEmpty) {
      this.chains = this.chains.filter((c) => c !== chain);
    }
    if (newChain) this.chains.push(newChain);
    return {
      points: wasHead ? SCORING.CENTIPEDE_HEAD : SCORING.CENTIPEDE_BODY,
      cell: destroyedCell,
      wasHead,
      chainRemoved: chain.isEmpty,
    };
  }

  /** True if any live segment currently occupies (row, col) — used by shooter collision & spider deflection. */
  collidesWithCell(row: number, col: number, tolerance = 0.5): boolean {
    for (const chain of this.chains) {
      for (const v of chain.getSegmentViews()) {
        if (Math.abs(v.row - row) <= tolerance && Math.abs(v.col - col) <= tolerance) return true;
      }
    }
    return false;
  }
}
