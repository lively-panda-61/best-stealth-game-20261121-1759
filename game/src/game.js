// Game state machine for SHADOW PROTOCOL.
// States: title -> playing -> won | caught. The player lifts every data core
// and then reaches the exit; a guard that catches the player while alerted
// ends the run. One instance per level; nextLevel() advances the campaign.

import { LEVELS, parseLevel } from './level.js';
import { createGuard, updateGuard, hearNoise, CATCH_DISTANCE } from './guard.js';
import { createPlayer, updatePlayer, noiseRadius } from './player.js';
import { distance } from './geometry.js';
import { makeRng } from './random.js';

const CORE_PICKUP_DISTANCE = 28;
const EXIT_DISTANCE = 30;

export function createGame(levelIndex = 0, seed = 1) {
  const game = {
    levelIndex,
    seed,
    rng: makeRng(seed),
    state: 'title',
    time: 0,
    coresCollected: 0,
    alertLevel: 0,
    level: null,
    player: null,
    guards: [],
  };

  function loadLevel(index) {
    game.levelIndex = index;
    game.level = parseLevel(LEVELS[index]);
    game.player = createPlayer(game.level.playerStart.x, game.level.playerStart.y);
    game.guards = game.level.guards.map((g) =>
      createGuard({ x: g.spawn.x, y: g.spawn.y, waypoints: g.waypoints }),
    );
    for (const core of game.level.cores) core.taken = false;
    game.coresCollected = 0;
    game.alertLevel = 0;
    game.time = 0;
  }

  game.loadLevel = loadLevel;

  game.restart = () => {
    loadLevel(game.levelIndex);
    game.state = 'playing';
  };

  game.nextLevel = () => {
    loadLevel(Math.min(game.levelIndex + 1, LEVELS.length - 1));
    game.state = 'playing';
  };

  game.start = () => {
    if (game.state === 'title') game.state = 'playing';
  };

  game.tick = (dt, input = {}) => updateGame(game, input, dt);

  loadLevel(levelIndex);
  return game;
}

export function updateGame(game, input, dt) {
  if (game.state !== 'playing') return game;
  game.time += dt;
  const { level, player } = game;

  updatePlayer(player, input, level, dt);

  // Running is loud: every guard in earshot turns toward the noise.
  const noise = noiseRadius(player);
  if (noise > 0) {
    for (const guard of game.guards) hearNoise(guard, player.x, player.y, noise);
  }

  let maxMeter = 0;
  for (const guard of game.guards) {
    updateGuard(guard, player, level, dt, game.rng);
    maxMeter = Math.max(maxMeter, guard.meter);
  }
  game.alertLevel = maxMeter;

  // Pick up a data core by walking over it.
  for (const core of level.cores) {
    if (!core.taken && distance(player.x, player.y, core.x, core.y) < CORE_PICKUP_DISTANCE) {
      core.taken = true;
      game.coresCollected += 1;
    }
  }

  // The exit opens once every core is lifted.
  const allCores = game.coresCollected >= level.cores.length;
  if (allCores && distance(player.x, player.y, level.exit.x, level.exit.y) < EXIT_DISTANCE) {
    game.state = 'won';
    return game;
  }

  // Caught: an alerted guard closes the distance.
  for (const guard of game.guards) {
    if (guard.state === 'alert' && distance(guard.x, guard.y, player.x, player.y) < CATCH_DISTANCE) {
      game.state = 'caught';
      return game;
    }
  }
  return game;
}
