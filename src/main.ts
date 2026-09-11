import { Game } from './Game';
import { Renderer } from './systems/Renderer';
import { AudioSystem } from './systems/AudioSystem';
import { InputSystem } from './systems/InputSystem';
import type { FeatureFlags } from './config';

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

function handleHighScoreEntryInput(): void {
  if (game.state !== 'HIGH_SCORE_ENTRY') return;
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
  audio.update(dt, game);
  audio.handle(game.drainEvents(), game.state);
}

requestAnimationFrame(frame);
