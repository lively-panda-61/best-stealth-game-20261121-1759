// Game state machine for THE BRASS CROW.
// States: title -> playing -> won | failed, with a paused overlay and a
// victory state after the fifth heist. Win a heist by lifting its seal and
// reaching the green exit; get caught three times and the heist fails.
// Score: $50 per loot, $300 for the seal, a time bonus, and +$500 ghost
// bonus for finishing a heist without ever being spotted.
import { HEISTS, parseLevel, TILE } from './levels.js';
import { createGuard, updateGuard, hearNoise, CATCH_DISTANCE } from './guards.js';
import { createPlayer, updatePlayer, noiseRadius } from './player.js';
import { throwCoin, useSmoke, douseLamp, updateGadgets, playerInSmoke } from './gadgets.js';
import { createCamera, updateCamera, laserCrossed } from './hazards.js';
import { makeRng } from './random.js';

const LOOT_VALUE = 50;
const SEAL_VALUE = 300;
const GHOST_BONUS = 500;
const PICKUP_DISTANCE = 28;
const EXIT_DISTANCE = 30;
const MAX_STRIKES = 3;

export function createGame(heistIndex = 0, seed = 1) {
  const game = {
    levelIndex: heistIndex,
    heistIndex,
    seed,
    rng: makeRng(seed),
    state: 'title',
    time: 0,
    score: 0,
    totalScore: 0,
    strikes: 0,
    spotted: 0,
    lootCollected: 0,
    sealTaken: false,
    alert: 0,
    lockdownT: 0,
    level: null,
    player: null,
    guards: [],
    cameras: [],
    lasers: [],
    smokes: [],
    coinsThrown: [],
  };

  function loadHeist(index) {
    game.levelIndex = index;
    game.heistIndex = index;
    const def = HEISTS[index];
    game.level = parseLevel(def);
    game.player = createPlayer(game.level.playerStart.x, game.level.playerStart.y);
    game.player.coins = def.coins;
    game.player.smoke = def.smoke;
    game.guards = game.level.guards.map((g) =>
      createGuard({ x: g.spawn.c * TILE + TILE / 2, y: g.spawn.r * TILE + TILE / 2 }, g.waypoints),
    );
    game.cameras = game.level.cameras.map((c) => createCamera(c));
    game.lasers = game.level.lasers;
    game.smokes = [];
    game.coinsThrown = [];
    game.lootCollected = 0;
    game.sealTaken = false;
    game.alert = 0;
    game.lockdownT = 0;
    game.time = 0;
    game.score = 0;
  }

  game.loadHeist = loadHeist;

  game.start = () => {
    if (game.state === 'title') game.state = 'playing';
  };

  game.restart = () => {
    loadHeist(game.levelIndex);
    game.strikes = 0;
    game.spotted = 0;
    game.state = 'playing';
  };

  game.nextHeist = () => {
    // Bank the finished heist's score before moving on, so the top bar
    // (banked total + current heist score) never double-counts a win.
    game.totalScore += game.score;
    if (game.levelIndex >= HEISTS.length - 1) {
      game.state = 'victory';
      return;
    }
    loadHeist(game.levelIndex + 1);
    game.state = 'playing';
  };

  game.togglePause = () => {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  };

  game.throwCoinAt = (x, y) => {
    if (game.state !== 'playing') return null;
    const coin = throwCoin(game, x, y);
    if (coin) {
      for (const g of game.guards) hearNoise(g, x, y, coin.noiseR);
    }
    return coin;
  };

  game.useSmoke = () => (game.state === 'playing' ? useSmoke(game) : false);
  game.douseLamp = () => (game.state === 'playing' ? douseLamp(game) : false);
  game.tick = (dt, input = {}) => updateGame(game, input, dt);

  loadHeist(heistIndex);
  return game;
}

function nearestGuard(game, x, y) {
  let best = null, bestD = Infinity;
  for (const g of game.guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

export function updateGame(game, input, dt) {
  if (game.state !== 'playing') return game;
  game.time += dt;
  const { level, player } = game;
  const prevX = player.x, prevY = player.y;

  updatePlayer(player, input, level, dt);
  player.inSmoke = playerInSmoke(game, player.x, player.y);

  // Running is loud: every guard in earshot turns toward the noise.
  const noise = noiseRadius(player);
  if (noise > 0) {
    for (const g of game.guards) hearNoise(g, player.x, player.y, noise);
  }

  // Caught: an alerted guard close enough grabs the thief.
  for (const g of game.guards) {
    if (g.state === 'alert' && Math.hypot(g.x - player.x, g.y - player.y) < CATCH_DISTANCE) {
      return caught(game);
    }
  }

  let anyAlert = false;
  for (const g of game.guards) {
    const wasAlert = g.state === 'alert';
    updateGuard(g, player, level, dt, game.rng);
    if (!wasAlert && g.state === 'alert') game.spotted += 1;
    if (g.state === 'alert') anyAlert = true;
  }

  // Cameras: a spot raises the alarm and sends the nearest guard over.
  for (const cam of game.cameras) {
    const was = cam.spotted;
    const seen = updateCamera(cam, player, level, dt, (x, y) => playerInSmoke(game, x, y));
    if (seen) {
      game.alert = Math.min(100, game.alert + 25 * dt);
      if (!was) {
        game.spotted += 1;
        const g = nearestGuard(game, player.x, player.y);
        if (g) {
          g.state = 'alert';
          g.meter = 1;
          g.lastSeen = { x: player.x, y: player.y };
        }
      }
    }
  }

  // Lasers: crossing a lit beam trips the alarm and pulls a guard over.
  for (const lz of game.lasers) {
    if (laserCrossed(lz, prevX, prevY, player.x, player.y, game.time)) {
      game.alert = Math.min(100, game.alert + 25);
      game.spotted += 1;
      const mx = ((lz.a.c + lz.b.c) / 2) * TILE + TILE / 2;
      const my = ((lz.a.r + lz.b.r) / 2) * TILE + TILE / 2;
      const g = nearestGuard(game, mx, my);
      if (g) hearNoise(g, mx, my, 500);
    }
  }

  // The alarm climbs while any guard hunts, and settles while all is calm.
  if (anyAlert) game.alert = Math.min(100, game.alert + 25 * dt);
  else game.alert = Math.max(0, game.alert - 3 * dt);

  // Full alarm: lockdown — every guard converges on the thief for a while.
  if (game.alert >= 100 && game.lockdownT <= 0) {
    game.lockdownT = 5;
    game.alert = 60;
    for (const g of game.guards) {
      g.state = 'alert';
      g.meter = 1;
      g.lastSeen = { x: player.x, y: player.y };
    }
  }
  if (game.lockdownT > 0) game.lockdownT -= dt;

  updateGadgets(game, dt);

  // Lift loot by walking over it.
  for (const loot of level.loot) {
    if (!loot.taken && Math.hypot(player.x - loot.x, player.y - loot.y) < PICKUP_DISTANCE) {
      loot.taken = true;
      game.lootCollected += 1;
      game.score += LOOT_VALUE;
    }
  }

  // Lift the seal.
  if (!game.sealTaken && Math.hypot(player.x - level.seal.x, player.y - level.seal.y) < PICKUP_DISTANCE) {
    game.sealTaken = true;
    game.score += SEAL_VALUE;
  }

  // The exit opens once the seal is lifted.
  if (game.sealTaken && Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < EXIT_DISTANCE) {
    const timeBonus = Math.max(0, Math.round(200 - game.time * 1.5));
    game.score += timeBonus;
    if (game.spotted === 0) game.score += GHOST_BONUS;
    game.state = 'won';
    return game;
  }

  return game;
}

function caught(game) {
  game.strikes += 1;
  if (game.strikes >= MAX_STRIKES) {
    game.state = 'failed';
    return game;
  }
  // Caught once: the thief slips back to the start and the guards reset,
  // but lifted loot and the seal stay lifted — only the ghost is gone.
  const def = HEISTS[game.levelIndex];
  const keptLoot = game.level.loot.map((l) => l.taken);
  const keptSeal = game.sealTaken;
  const keptScore = game.score;
  const keptCount = game.lootCollected;
  game.level = parseLevel(def);
  game.level.loot.forEach((l, i) => { l.taken = keptLoot[i]; });
  game.level.seal.taken = keptSeal;
  game.lootCollected = keptCount;
  game.sealTaken = keptSeal;
  game.score = keptScore;
  game.player.x = game.level.playerStart.x;
  game.player.y = game.level.playerStart.y;
  game.player.inSmoke = false;
  game.guards = game.level.guards.map((g) =>
    createGuard({ x: g.spawn.c * TILE + TILE / 2, y: g.spawn.r * TILE + TILE / 2 }, g.waypoints),
  );
  game.cameras = game.level.cameras.map((c) => createCamera(c));
  game.smokes = [];
  game.coinsThrown = [];
  game.alert = 40;
  game.lockdownT = 0;
  return game;
}
