// Entrypoint for THE BRASS CROW.
// Boots the game, runs the loop, wires keyboard and mouse, plays procedural
// sound, stages deterministic ?shot= scenes for screenshots, and exposes
// the game on window.__crowGame for playtests.
//
// URL parameters (the maker uses these for screenshots; players just open
// the page): ?heist=0..4 picks the heist, ?seed=N seeds the run,
// ?shot=cover|play|alert|win stages a frozen scene, ?notes=1 turns on the
// field-notes callouts.
import { createGame } from './game.js';
import { createInput, bindKeyboard } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { TILE } from './levels.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);
const heist = Math.max(0, Math.min(4, Number(params.get('heist') || 0)));
const shot = params.get('shot');
const game = createGame(heist, seed);
const input = createInput();
const audio = createAudio();

game.notes = params.get('notes') === '1';

// Debug handle for the automated playtest (and for players poking around).
window.__crowGame = game;

let lastStepAt = 0;
let lastGuardStepAt = 0;
let lastAlertStingAt = -10;
let lastState = game.state;

function announce() {
  if (game.state === lastState) return;
  lastState = game.state;
  const lines = {
    title: 'The Brass Crow. Press Enter to begin the first heist.',
    playing: `Heist ${game.levelIndex + 1}: ${game.level.def.name}. Lift the seal, then reach the exit.`,
    paused: 'Paused.',
    won: 'Heist complete.',
    failed: 'Caught three times. The heist failed.',
    victory: 'All five seals lifted. The Brass Crow flies.',
  };
  statusEl.textContent = lines[game.state] || '';
}

function onAction(code) {
  audio.ensure();
  if (code === 'Enter') {
    if (game.state === 'title') game.start();
    else if (game.state === 'won') game.nextHeist();
    else if (game.state === 'victory') restartCampaign();
    announce();
  } else if (code === 'KeyR') {
    if (game.state === 'failed' || game.state === 'won') game.restart();
    else if (game.state === 'victory') restartCampaign();
    announce();
  } else if (code === 'Space') {
    if (game.state === 'title') game.start();
  } else if (code === 'KeyQ') {
    if (game.state === 'playing' && game.useSmoke()) audio.smokeHiss();
  } else if (code === 'KeyE') {
    if (game.state === 'playing' && game.douseLamp()) audio.douse();
  } else if (code === 'KeyH') {
    game.notes = !game.notes;
  } else if (code === 'KeyM') {
    audio.muted = !audio.muted;
  } else if (code === 'Escape' || code === 'KeyP') {
    game.togglePause();
    announce();
  }
}

function restartCampaign() {
  game.loadHeist(0);
  game.strikes = 0;
  game.spotted = 0;
  game.totalScore = 0;
  game.state = 'playing';
}

bindKeyboard(input, onAction);

canvas.addEventListener('click', (event) => {
  audio.ensure();
  if (game.state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY - 52; // the top bar is 52px
  if (x < 0 || x > 960 || y < 0 || y > 640) return;
  if (game.throwCoinAt(x, y)) audio.coinClink();
});

// Stage a deterministic scene for screenshots. Real renders of the game's
// own code, with the state set up by hand: the cover frame (guard cones,
// a camera, the loot target and the alarm meter in one view), a mid-play
// frame in the Glasshouse, an alert chase with smoke, and the win screen.
function stageShot(name) {
  const level = game.level;
  const guard0 = game.guards[0];
  const guard1 = game.guards[1] || guard0;
  if (name === 'cover') {
    game.state = 'playing';
    game.time = 24.6;
    game.notes = true;
    const loot = level.loot[1] || level.loot[0];
    game.player.x = loot.x - 130;
    game.player.y = loot.y + 90;
    game.player.sneaking = true;
    guard1.x = loot.x + 60;
    guard1.y = loot.y - 30;
    guard1.dir = Math.atan2(game.player.y - guard1.y, game.player.x - guard1.x);
    guard1.state = 'suspicious';
    guard1.meter = 0.5;
    guard1.investigate = { x: game.player.x, y: game.player.y };
    guard0.dir = Math.PI;
    level.loot[0].taken = true;
    game.lootCollected = 1;
    game.score = 50;
    game.alert = 35;
  } else if (name === 'play') {
    game.state = 'playing';
    game.time = 18.2;
    game.notes = true;
    // Stand in the tall-grass tile nearest the middle of the map,
    // sneaking, near a patrol route — and clear of the notes box.
    let best = null, bestD = Infinity;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (level.grid[r][c] === 'g') {
          const d = Math.hypot(c * TILE + TILE / 2 - 480, r * TILE + TILE / 2 - 320);
          if (d < bestD) { bestD = d; best = { c, r }; }
        }
      }
    }
    if (best) {
      game.player.x = best.c * TILE + TILE / 2;
      game.player.y = best.r * TILE + TILE / 2;
    }
    game.player.sneaking = true;
    guard0.dir = Math.PI / 2;
    game.alert = 12;
  } else if (name === 'alert') {
    game.state = 'playing';
    game.time = 41.3;
    const loot = level.loot[2] || level.loot[0];
    game.player.x = loot.x;
    game.player.y = loot.y;
    guard0.x = game.player.x + 90;
    guard0.y = game.player.y - 40;
    guard0.dir = Math.atan2(game.player.y - guard0.y, game.player.x - guard0.x);
    guard0.state = 'alert';
    guard0.meter = 1;
    guard0.lastSeen = { x: game.player.x, y: game.player.y };
    game.smokes.push({ x: game.player.x - 30, y: game.player.y + 20, r: 90, t: 2.5 });
    game.alert = 72;
    game.spotted = 1;
    level.loot[0].taken = true;
    game.lootCollected = 1;
    game.score = 50;
  } else if (name === 'win') {
    for (const loot of level.loot) loot.taken = true;
    game.lootCollected = level.loot.length;
    game.sealTaken = true;
    game.player.x = level.exit.x;
    game.player.y = level.exit.y;
    game.time = 96.4;
    game.score = level.loot.length * 50 + 300 + Math.max(0, Math.round(200 - game.time * 1.5)) + 500;
    game.totalScore = 0;
    game.state = 'won';
  }
}

if (shot) stageShot(shot);

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (game.state === 'playing' && !shot) {
    const prevLoot = game.lootCollected;
    const prevSeal = game.sealTaken;
    const prevState = game.state;
    const prevStrikes = game.strikes;
    game.tick(dt, input);
    if (game.lootCollected > prevLoot) audio.pickup();
    if (game.sealTaken && !prevSeal) audio.seal();
    if (game.state === 'won' && prevState === 'playing') audio.win();
    if (game.strikes > prevStrikes) audio.caught();
    if (game.alert >= 99 && now / 1000 - lastAlertStingAt > 2) {
      audio.alertSting();
      lastAlertStingAt = now / 1000;
    }
    // Footsteps: the thief's own, and the nearest guard's, panned by side.
    if (game.player.moving && now - lastStepAt > (game.player.sneaking ? 520 : 300)) {
      lastStepAt = now;
      audio.playerStep(game.player.sneaking);
    }
    let nearest = null, nearestD = Infinity;
    for (const guard of game.guards) {
      const d = Math.hypot(guard.x - game.player.x, guard.y - game.player.y);
      if (d < nearestD) { nearestD = d; nearest = guard; }
    }
    if (nearest && nearestD < 350 && now - lastGuardStepAt > 450) {
      lastGuardStepAt = now;
      const pan = Math.max(-1, Math.min(1, (nearest.x - game.player.x) / 300));
      audio.guardStep(pan, nearestD);
    }
    announce();
  }

  render(ctx, game);
  requestAnimationFrame(frame);
}

console.log(`[brass-crow] booted heist ${heist + 1}, seed ${seed}${shot ? `, shot=${shot}` : ''}`);
requestAnimationFrame(frame);
