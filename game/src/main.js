// Entrypoint for SHADOW PROTOCOL.
// Boots the game, runs the loop, wires keyboard/mouse, updates the HUD,
// stages deterministic ?shot= scenes for screenshots, and exposes the game
// on window.__shadowGame for playtests.

import { createGame } from './game.js';
import { createInput, bindKeyboard, inputFromClickTarget, anyMovementKey } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { distance } from './geometry.js';
import { TILE } from './level.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const hudLevel = document.getElementById('hud-level');
const hudCores = document.getElementById('hud-cores');
const hudAlert = document.getElementById('hud-alert');
const hudTime = document.getElementById('hud-time');
const hudObjective = document.getElementById('hud-objective');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');
const game = createGame(0, seed);
const input = createInput();
const audio = createAudio();

// Debug handle for the automated playtest (and for players poking around).
window.__shadowGame = game;

let lastStepAt = 0;
let lastAlertStingAt = -10;

function updateHud() {
  const level = game.level;
  hudLevel.textContent = `Level ${game.levelIndex + 1} · ${level.name}`;
  const total = level.cores.length;
  hudCores.textContent = `◆ ${game.coresCollected}/${total} cores`;
  const alertPct = Math.round(game.alertLevel * 100);
  hudAlert.textContent = game.alertLevel > 0.02 ? `⚠ Detected ${alertPct}%` : '○ Unseen';
  hudAlert.style.color = game.alertLevel > 0.6 ? '#ef4444' : game.alertLevel > 0.02 ? '#f5b942' : '#43d17c';
  hudTime.textContent = `${game.time.toFixed(1)}s`;
  hudObjective.textContent =
    game.coresCollected >= total
      ? 'All cores lifted — reach the green EXIT'
      : `Lift ${total - game.coresCollected} more core${total - game.coresCollected === 1 ? '' : 's'}, then reach the exit`;
}

function onAction(code) {
  audio.ensure();
  if (code === 'Enter') {
    if (game.state === 'title') {
      game.start();
      statusEl.textContent = 'Game started.';
    } else if (game.state === 'won') {
      if (game.levelIndex >= 2) game.restart();
      else game.nextLevel();
    }
  } else if (code === 'KeyR') {
    if (game.state === 'caught' || game.state === 'won') game.restart();
  } else if (code === 'Space') {
    if (game.state === 'title') game.start();
  }
}

bindKeyboard(input, onAction);

canvas.addEventListener('click', (event) => {
  audio.ensure();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  input.clickTarget = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
});

// Stage a deterministic scene for screenshots. These are real renders of
// the game's own code, with the state set up by hand: title, mid-play,
// a guard about to spot the player, and the win screen.
function stageShot(name) {
  const level = game.level;
  if (name === 'start') {
    game.state = 'title';
  } else if (name === 'play') {
    game.state = 'playing';
    game.time = 12.4;
    game.player.x = 10 * TILE + 20;
    game.player.y = 8 * TILE + 20;
    const guard = game.guards[1] || game.guards[0];
    guard.x = 13 * TILE + 20;
    guard.y = 8 * TILE + 20;
    guard.dir = Math.PI;
    guard.state = 'patrol';
    guard.meter = 0.15;
    game.alertLevel = 0.15;
    level.cores[0].taken = true;
    game.coresCollected = 1;
  } else if (name === 'alert') {
    game.state = 'playing';
    game.time = 34.7;
    game.alertLevel = 0.85;
    game.player.x = 11 * TILE + 20;
    game.player.y = 8 * TILE + 20;
    const guard = game.guards[1] || game.guards[0];
    guard.x = 13 * TILE + 20;
    guard.y = 8 * TILE + 20;
    guard.dir = Math.PI;
    guard.state = 'alert';
    guard.meter = 0.85;
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    level.cores[0].taken = true;
    game.coresCollected = 1;
  } else if (name === 'win') {
    for (const core of level.cores) core.taken = true;
    game.coresCollected = level.cores.length;
    game.player.x = level.exit.x;
    game.player.y = level.exit.y;
    game.time = 74.3;
    game.state = 'won';
  }
}

if (shot) stageShot(shot);

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (game.state === 'playing' && !shot) {
    if (!anyMovementKey(input) && input.clickTarget) {
      inputFromClickTarget(input, game.player);
    }
    const prevCores = game.coresCollected;
    const prevState = game.state;
    game.tick(dt, input);
    if (game.coresCollected > prevCores) audio.pickup();
    if (game.state === 'caught' && prevState === 'playing') audio.caught();
    if (game.state === 'won' && prevState === 'playing') audio.win();
    if (game.alertLevel >= 1 && now / 1000 - lastAlertStingAt > 1.5) {
      audio.alertSting();
      lastAlertStingAt = now / 1000;
    }
    // Footsteps: the nearest guard's steps, panned by relative position.
    if (game.player.moving && now - lastStepAt > (game.player.sneaking ? 520 : 300)) {
      lastStepAt = now;
      audio.playerStep(game.player.sneaking);
    }
    let nearest = null;
    let nearestD = Infinity;
    for (const guard of game.guards) {
      const d = distance(guard.x, guard.y, game.player.x, game.player.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = guard;
      }
    }
    if (nearest && nearestD < 420 && nearest.state !== 'patrol') {
      const pan = Math.max(-1, Math.min(1, (nearest.x - game.player.x) / 300));
      audio.guardStep(pan, nearestD);
    }
  }

  render(ctx, game);
  updateHud();
  requestAnimationFrame(frame);
}

console.log('[shadow-protocol] booted level 1, seed', seed, shot ? `shot=${shot}` : '');
requestAnimationFrame(frame);
