import { Game } from './Game';
import { Renderer } from './systems/Renderer';
import { AudioSystem } from './systems/AudioSystem';
import { InputSystem } from './systems/InputSystem';
import { BOMB, type FeatureFlags } from './config';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const featurePanel = document.getElementById('feature-panel') as HTMLDivElement;

const game = new Game();
const renderer = new Renderer(canvas);
const audio = new AudioSystem();
const input = new InputSystem(canvas);

let paused = false;

function tryStartOrRestart(): void {
  audio.unlock();
  if (game.state === 'ATTRACT') {
    game.startNewGame();
  } else if (game.state === 'GAME_OVER') {
    // Lets an impatient click skip the "GAME OVER" wait, but never skips
    // past a deserved high-score entry -- skipGameOverWait() only ever
    // advances to whatever the timer would have led to anyway.
    game.skipGameOverWait();
  }
}
input.onFireEdge = tryStartOrRestart;

// -- feature panel wiring ---------------------------------------------------
featurePanel.querySelectorAll<HTMLInputElement>('input[data-flag]').forEach((box) => {
  const flag = box.dataset.flag as keyof FeatureFlags;
  box.checked = game.features[flag];
  box.addEventListener('change', () => {
    (game.features as any)[flag] = box.checked;
    if (flag === 'muteAudio') audio.setMuted(box.checked);
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'f') {
    featurePanel.classList.toggle('open');
  }
});

// -- bomb levers -------------------------------------------------------------
function wireLever(
  rangeId: string,
  valId: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (v: number) => void,
  decimals: number
): void {
  const range = document.getElementById(rangeId) as HTMLInputElement;
  const val = document.getElementById(valId) as HTMLSpanElement;
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  range.value = String(get());
  val.textContent = get().toFixed(decimals);
  range.addEventListener('input', () => {
    const v = parseFloat(range.value);
    set(v);
    val.textContent = v.toFixed(decimals);
  });
}

wireLever(
  'bombRadiusRange', 'bombRadiusVal',
  BOMB.BLAST_RADIUS_MIN, BOMB.BLAST_RADIUS_MAX, BOMB.BLAST_RADIUS_STEP,
  () => game.bombRadius, (v) => (game.bombRadius = v), 2
);
wireLever(
  'bombSpeedRange', 'bombSpeedVal',
  BOMB.SPEED_MIN, BOMB.SPEED_MAX, BOMB.SPEED_STEP,
  () => game.bombSpeed, (v) => (game.bombSpeed = v), 1
);

window.addEventListener('resize', () => renderer.resizeToFit());
renderer.resizeToFit();

// -- main loop ---------------------------------------------------------------
const FIXED_DT = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1); // guard against tab-switch stalls

  if (input.consumePause()) paused = !paused;
  handleHighScoreEntryInput();

  if (!paused) {
    acc += dt;
    while (acc >= FIXED_DT) {
      step(FIXED_DT);
      acc -= FIXED_DT;
    }
  }

  renderer.render(game, game.features);
  if (paused) renderer.drawPausedBanner();
}

let wasHighScoreEntry = false;

function handleHighScoreEntryInput(): void {
  if (game.state !== 'HIGH_SCORE_ENTRY') {
    wasHighScoreEntry = false;
    return;
  }
  if (!wasHighScoreEntry) {
    // Just entered this state. `firePressed` is a one-shot flag set the
    // instant the fire button goes down and only cleared by
    // consumeFirePress() -- and nothing consumes it during real gameplay,
    // so the shot the player fired right before dying (or the click that
    // dismissed GAME OVER) is often still sitting there unconsumed. Left
    // alone, the very first tick of this state would read that stale press
    // as an immediate "confirm," silently advancing past the first initial
    // before the player has touched anything. Draining it here (without
    // acting on it) requires a fresh press to actually confirm anything.
    input.consumeFirePress();
    input.consumeKeyPress('enter');
    wasHighScoreEntry = true;
    return;
  }
  if (input.consumeKeyPress('arrowleft') || input.consumeKeyPress('a') || input.consumeKeyPress('arrowdown') || input.consumeKeyPress('s')) {
    game.changeInitial(-1);
  }
  if (input.consumeKeyPress('arrowright') || input.consumeKeyPress('d') || input.consumeKeyPress('arrowup') || input.consumeKeyPress('w')) {
    game.changeInitial(1);
  }
  if (input.consumeFirePress() || input.consumeKeyPress('enter')) {
    game.confirmInitial();
  }
}

function step(dt: number): void {
  const inputState = input.computeInput(game.shooter.x, game.shooter.y);
  game.update(dt, inputState);
  const events = game.drainEvents();
  audio.update(dt, game);
  audio.handle(events, game.state);

  // The game just placed the ship at a fixed reset position itself (new
  // game / life respawn) -- re-anchor the mouse-control target there too,
  // or the next frame would instantly snap it to wherever the cursor is
  // still physically resting (see InputSystem.syncPointerTo).
  if (events.some((e) => e.type === 'gameStart' || e.type === 'lifeRespawn')) {
    input.syncPointerTo(game.shooter.x, game.shooter.y);
  }
}

requestAnimationFrame(frame);
