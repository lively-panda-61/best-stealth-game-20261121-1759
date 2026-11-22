// Unit tests for SHADOW PROTOCOL — written FIRST (TDD, Red phase).
// Pure logic modules only: random, geometry, level, guard, player, game.
// Run: node --test tests/unit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32, makeRng } from '../game/src/random.js';
import {
  distance,
  segmentsIntersect,
  segmentHitsRect,
  lineOfSight,
  pointInCone,
  angleTo,
} from '../game/src/geometry.js';
import { LEVELS, parseLevel, tileCenter, reachable } from '../game/src/level.js';
import { createGuard, updateGuard, guardSeesPlayer } from '../game/src/guard.js';
import { createPlayer, updatePlayer, noiseRadius } from '../game/src/player.js';
import { createGame, updateGame } from '../game/src/game.js';

// ---------- random ----------
test('rng: same seed gives the same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('rng: different seeds diverge', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());
});

test('rng: values stay in [0, 1)', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1);
  }
  assert.ok(rng.int(5, 10) >= 5 && rng.int(5, 10) < 10);
  assert.ok(['a', 'b', 'c'].includes(rng.pick(['a', 'b', 'c'])));
});

// ---------- geometry ----------
test('geometry: distance is euclidean', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});

test('geometry: segments intersect', () => {
  assert.ok(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0));
  assert.ok(!segmentsIntersect(0, 0, 10, 0, 0, 5, 10, 5));
  assert.ok(!segmentsIntersect(0, 0, 2, 0, 5, 0, 9, 0)); // collinear, disjoint
});

test('geometry: segmentHitsRect detects a crossing', () => {
  assert.ok(segmentHitsRect(0, 5, 20, 5, { x: 8, y: 0, w: 4, h: 10 }));
  assert.ok(!segmentHitsRect(0, 5, 20, 5, { x: 8, y: 20, w: 4, h: 10 }));
  assert.ok(segmentHitsRect(5, 5, 5, 5, { x: 0, y: 0, w: 10, h: 10 })); // point inside
});

test('geometry: lineOfSight is blocked by a wall between the points', () => {
  const walls = [{ x: 100, y: 0, w: 20, h: 200 }];
  assert.ok(!lineOfSight(0, 100, 200, 100, walls));
  assert.ok(lineOfSight(0, 100, 50, 100, walls));
  assert.ok(lineOfSight(0, 300, 200, 300, walls));
  assert.ok(lineOfSight(0, 0, 500, 500, []));
});

test('geometry: pointInCone honours direction, range and fov', () => {
  // guard at origin facing east (0 rad), range 220, half-fov ~37.5deg
  assert.ok(pointInCone(100, 0, 0, 0, 0, 220, 0.65));
  assert.ok(pointInCone(100, 40, 0, 0, 0, 220, 0.65));
  assert.ok(!pointInCone(-100, 0, 0, 0, 0, 220, 0.65)); // behind
  assert.ok(!pointInCone(300, 0, 0, 0, 0, 220, 0.65)); // out of range
  assert.ok(!pointInCone(100, 150, 0, 0, 0, 220, 0.65)); // outside fov
});

test('geometry: angleTo points the right way', () => {
  assert.equal(angleTo(0, 0, 10, 0), 0);
  assert.ok(Math.abs(angleTo(0, 0, 0, 10) - Math.PI / 2) < 1e-9);
});

// ---------- level ----------
test('level: three levels exist, each with player, exit, cores and guards', () => {
  assert.equal(LEVELS.length, 3);
  for (const def of LEVELS) {
    const level = parseLevel(def);
    assert.ok(level.playerStart, `${def.name}: player start`);
    assert.ok(level.exit, `${def.name}: exit`);
    assert.ok(level.cores.length >= 3, `${def.name}: at least 3 cores`);
    assert.ok(level.guards.length >= 2, `${def.name}: at least 2 guards`);
    assert.ok(level.walls.length > 0, `${def.name}: walls`);
  }
});

test('level: every row has the same width', () => {
  for (const def of LEVELS) {
    const widths = new Set(def.map.map((row) => row.length));
    assert.equal(widths.size, 1, `${def.name}: rows differ in width`);
  }
});

test('level: every core and the exit are reachable from the player start', () => {
  for (const def of LEVELS) {
    const level = parseLevel(def);
    for (const core of level.cores) {
      assert.ok(reachable(level, level.playerStart, core), `${def.name}: core unreachable`);
    }
    assert.ok(reachable(level, level.playerStart, level.exit), `${def.name}: exit unreachable`);
    for (const g of level.guards) {
      assert.ok(reachable(level, level.playerStart, g.spawn), `${def.name}: guard spawn unreachable`);
    }
  }
});

test('level: tileCenter maps tiles to pixels', () => {
  assert.deepEqual(tileCenter(0, 0, 40), { x: 20, y: 20 });
  assert.deepEqual(tileCenter(2, 3, 40), { x: 100, y: 140 });
});

test('level: parse rejects a map with no exit', () => {
  assert.throws(() => parseLevel({ name: 'bad', map: ['###', '#P#', '###'] }), /exit/);
});

// ---------- guard ----------
function flatLevel() {
  return {
    walls: [],
    shadows: [],
    bushes: [],
    width: 960,
    height: 600,
    tile: 40,
  };
}

function guardAt(x, y, dir = 0) {
  return createGuard({ x, y, dir, waypoints: [{ x: x + 200, y }, { x, y }] });
}

test('guard: patrol moves the guard toward its next waypoint', () => {
  const level = flatLevel();
  const guard = guardAt(100, 100);
  const startX = guard.x;
  updateGuard(guard, { x: 900, y: 500, sneaking: false, running: false }, level, 1, makeRng(1));
  assert.ok(guard.x > startX, 'guard should advance along patrol');
  assert.equal(guard.state, 'patrol');
});

test('guard: sees the player standing in its cone with clear line of sight', () => {
  const level = flatLevel();
  const guard = guardAt(100, 100, 0);
  const player = { x: 200, y: 100, sneaking: false, running: false };
  assert.ok(guardSeesPlayer(guard, player, level));
});

test('guard: does not see the player behind a wall', () => {
  const level = flatLevel();
  level.walls = [{ x: 140, y: 0, w: 20, h: 200 }];
  const guard = guardAt(100, 100, 0);
  const player = { x: 200, y: 100, sneaking: false, running: false };
  assert.ok(!guardSeesPlayer(guard, player, level));
});

test('guard: detection rises while seen and decays when hidden', () => {
  const level = flatLevel();
  const guard = guardAt(100, 100, 0);
  const seen = { x: 200, y: 100, sneaking: false, running: false };
  updateGuard(guard, seen, level, 0.5, makeRng(1));
  assert.ok(guard.meter > 0, 'meter should rise while seen');
  const risen = guard.meter;
  const hidden = { x: 900, y: 500, sneaking: false, running: false };
  updateGuard(guard, hidden, level, 1, makeRng(1));
  assert.ok(guard.meter < risen, 'meter should decay when hidden');
});

test('guard: a sneaking player in shadow is detected far slower', () => {
  const level = flatLevel();
  const openGuard = guardAt(100, 100, 0);
  const shadowGuard = guardAt(100, 100, 0);
  const player = { x: 200, y: 100, sneaking: true, running: false };
  const open = { x: 200, y: 100, sneaking: false, running: false };
  level.shadows = [{ x: 180, y: 80, w: 40, h: 40 }];
  updateGuard(openGuard, open, level, 0.5, makeRng(1));
  updateGuard(shadowGuard, player, level, 0.5, makeRng(1));
  assert.ok(shadowGuard.meter < openGuard.meter, 'shadow+sneak must slow detection');
});

test('guard: full meter triggers alert, and alert chases the player', () => {
  const level = flatLevel();
  const guard = guardAt(100, 100, 0);
  const player = { x: 200, y: 100, sneaking: false, running: false };
  guard.meter = 0.99;
  updateGuard(guard, player, level, 0.5, makeRng(1));
  assert.equal(guard.state, 'alert');
  assert.ok(guard.speed > 100, 'alert chase must be fast');
});

test('guard: alert decays to search after losing sight', () => {
  const level = flatLevel();
  const guard = guardAt(100, 100, 0);
  guard.state = 'alert';
  guard.lastSeen = { x: 200, y: 100 };
  guard.loseSightFor = 0;
  const far = { x: 900, y: 500, sneaking: false, running: false };
  for (let i = 0; i < 10; i++) updateGuard(guard, far, level, 0.5, makeRng(1));
  assert.notEqual(guard.state, 'alert', 'guard should leave alert after losing sight');
});

// ---------- player ----------
test('player: moves with input and is slower while sneaking', () => {
  const level = flatLevel();
  const run = createPlayer(100, 100);
  updatePlayer(run, { up: false, down: false, left: false, right: true, sneak: false }, level, 1);
  const runX = run.x;
  const sneak = createPlayer(100, 100);
  updatePlayer(sneak, { up: false, down: false, left: false, right: true, sneak: true }, level, 1);
  assert.ok(runX > sneak.x, 'running must cover more ground than sneaking');
  assert.ok(runX > 100 && sneak.x > 100);
});

test('player: a wall blocks movement', () => {
  const level = flatLevel();
  level.walls = [{ x: 130, y: 80, w: 20, h: 40 }];
  const player = createPlayer(100, 100);
  for (let i = 0; i < 20; i++) {
    updatePlayer(player, { up: false, down: false, left: false, right: true, sneak: false }, level, 0.1);
  }
  assert.ok(player.x + player.radius <= 130, 'player must not pass through the wall');
});

test('player: noise radius grows when running', () => {
  const quiet = createPlayer(0, 0);
  quiet.moving = true;
  quiet.sneaking = true;
  const loud = createPlayer(0, 0);
  loud.moving = true;
  loud.sneaking = false;
  loud.running = true;
  assert.ok(noiseRadius(loud) > noiseRadius(quiet));
  const still = createPlayer(0, 0);
  assert.equal(noiseRadius(still), 0);
});

// ---------- game ----------
test('game: collecting every core then reaching the exit wins', () => {
  const game = createGame(0, 1);
  game.state = 'playing';
  const core = game.level.cores[0];
  game.player.x = core.x;
  game.player.y = core.y;
  updateGame(game, {}, 0.1);
  assert.equal(game.coresCollected, 1);
  for (const c of game.level.cores) {
    game.player.x = c.x;
    game.player.y = c.y;
    updateGame(game, {}, 0.1);
  }
  assert.equal(game.coresCollected, game.level.cores.length);
  game.player.x = game.level.exit.x;
  game.player.y = game.level.exit.y;
  updateGame(game, {}, 0.1);
  assert.equal(game.state, 'won');
});

test('game: reaching the exit without all cores does not win', () => {
  const game = createGame(0, 1);
  game.state = 'playing';
  game.player.x = game.level.exit.x;
  game.player.y = game.level.exit.y;
  updateGame(game, {}, 0.1);
  assert.notEqual(game.state, 'won');
});

test('game: a guard touching the player while alerted means caught', () => {
  const game = createGame(0, 1);
  game.state = 'playing';
  const guard = game.guards[0];
  guard.state = 'alert';
  guard.x = game.player.x + 5;
  guard.y = game.player.y;
  updateGame(game, {}, 0.1);
  assert.equal(game.state, 'caught');
});

test('game: next level loads after a win', () => {
  const game = createGame(0, 1);
  game.state = 'won';
  assert.ok(game.levelIndex === 0);
  game.nextLevel();
  assert.equal(game.levelIndex, 1);
  assert.equal(game.state, 'playing');
  assert.equal(game.coresCollected, 0);
});
