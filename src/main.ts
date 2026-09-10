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
  if (game.state === 'ATTRACT' || game.state === 'GAME_OVER') {
    game.startNewGame();
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

  if (!paused) {
    acc += dt;
    while (acc >= FIXED_DT) {
      step(FIXED_DT);
      acc -= FIXED_DT;
    }
  }

  renderer.render(game, game.features);
  if (paused) drawPausedBanner();
}

function step(dt: number): void {
  const inputState = input.computeInput(game.shooter.x, game.shooter.y);
  game.update(dt, inputState);
  audio.update(dt, game);
  audio.handle(game.drainEvents());
}

function drawPausedBanner(): void {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = '#fff';
  const text = 'PAUSED';
  ctx.fillText(text, canvas.width / 2 - ctx.measureText(text).width / 2, canvas.height / 2);
  ctx.restore();
}

requestAnimationFrame(frame);
