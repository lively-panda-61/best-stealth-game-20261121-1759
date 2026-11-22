// Unit tests for THE BRASS CROW (TDD).
// Run: npm test   (node --test tests/unit.test.js)
// Every module under game/src is pure logic (no DOM), so Node can import it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HEISTS, parseLevel, tileAt, isSolid, TILE } from '../game/src/levels.js';
import { losClear, conePolygon, pointInCone, lightAt } from '../game/src/vision.js';
import { createGuard, updateGuard, hearNoise, CATCH_DISTANCE } from '../game/src/guards.js';
import { createPlayer, updatePlayer, noiseRadius } from '../game/src/player.js';
import { throwCoin, useSmoke, douseLamp, playerInSmoke } from '../game/src/gadgets.js';
import { createCamera, updateCamera, laserOn, laserCrossed } from '../game/src/hazards.js';
import { createGame } from '../game/src/game.js';
import { makeRng } from '../game/src/random.js';

const rng = makeRng(7);

function bfsReachable(level, from) {
  const seen = new Set([`${from.c},${from.r}`]);
  const q = [from];
  while (q.length) {
    const { c, r } = q.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      const key = `${nc},${nr}`;
      if (!seen.has(key) && !isSolid(level, nc, nr)) { seen.add(key); q.push({ c: nc, r: nr }); }
    }
  }
  return seen;
}

describe('levels: five heists, all valid', () => {
  it('has exactly 5 heists with distinct names', () => {
    assert.equal(HEISTS.length, 5);
    assert.equal(new Set(HEISTS.map((h) => h.name)).size, 5);
  });

  for (let i = 0; i < 5; i++) {
    it(`heist ${i + 1} parses: rectangular 24x16, one start, one seal, one exit`, () => {
      const def = HEISTS[i];
      for (const row of def.grid) assert.equal(row.length, 24, `heist ${i + 1} row "${row}"`);
      assert.equal(def.grid.length, 16);
      const level = parseLevel(def);
      assert.equal(level.cols, 24);
      assert.equal(level.rows, 16);
      assert.ok(level.playerStart, 'player start');
      assert.ok(level.seal, 'seal');
      assert.ok(level.exit, 'exit');
      assert.ok(level.loot.length >= 4, `heist ${i + 1} has ${level.loot.length} loot, want >= 4`);
      assert.ok(level.lamps.length >= 3, 'lamps');
    });

    it(`heist ${i + 1}: guards, cameras and lasers match the grid`, () => {
      const def = HEISTS[i];
      const level = parseLevel(def);
      const gridGuards = def.grid.join('').split('').filter((c) => c === 'G').length;
      assert.equal(level.guards.length, gridGuards, 'guard count matches G tiles');
      for (const g of level.guards) {
        assert.ok(g.waypoints.length >= 2, 'guard has >= 2 waypoints');
        for (const w of g.waypoints) assert.ok(!isSolid(level, w.c, w.r), 'waypoint walkable');
        assert.ok(!isSolid(level, g.spawn.c, g.spawn.r), 'guard spawn walkable');
      }
      const gridCams = def.grid.join('').split('').filter((c) => c === 'K').length;
      assert.equal(level.cameras.length, gridCams, 'camera count matches K tiles');
      for (const cam of level.cameras) assert.equal(tileAt(level, cam.tile.c, cam.tile.r), 'K');
      for (const lz of level.lasers) {
        assert.ok(isSolid(level, lz.a.c, lz.a.r), 'laser endpoint A on a wall');
        assert.ok(isSolid(level, lz.b.c, lz.b.r), 'laser endpoint B on a wall');
      }
    });

    it(`heist ${i + 1}: exit, seal and every loot reachable on foot`, () => {
      const level = parseLevel(HEISTS[i]);
      const start = { c: Math.floor(level.playerStart.x / TILE), r: Math.floor(level.playerStart.y / TILE) };
      const seen = bfsReachable(level, start);
      const at = (p) => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`;
      assert.ok(seen.has(at(level.exit)), 'exit reachable');
      assert.ok(seen.has(at(level.seal)), 'seal reachable');
      for (const l of level.loot) assert.ok(seen.has(at(l)), 'loot reachable');
    });
  }

  it('guard count grows across the campaign and totals 20+', () => {
    const total = HEISTS.reduce((n, h) => n + h.guards.length, 0);
    assert.ok(total >= 20, `total guards ${total}`);
    for (let i = 1; i < 5; i++) assert.ok(HEISTS[i].guards.length >= HEISTS[i - 1].guards.length, 'non-decreasing guards');
  });

  it('cameras and lasers appear from heist 2 on', () => {
    assert.ok(HEISTS[1].cameras.length >= 1, 'heist 2 has a camera');
    assert.ok(HEISTS[3].lasers.length >= 1, 'heist 4 has a laser');
    assert.ok(HEISTS[4].cameras.length + HEISTS[4].lasers.length >= 3, 'heist 5 is the hardest');
  });
});

describe('vision: line of sight and cones', () => {
  const level = parseLevel(HEISTS[0]);
  it('losClear is true across open floor and false through a wall', () => {
    // Top-left room of heist 1 is open: player start to a nearby floor point.
    const p = level.playerStart;
    assert.equal(losClear(level, p.x, p.y, p.x + 80, p.y), true);
    // A long horizontal ray across the whole map must cross walls.
    assert.equal(losClear(level, TILE * 1.5, TILE * 1.5, TILE * 22.5, TILE * 1.5), false);
  });

  it('conePolygon returns a closed fan whose rays stop at walls', () => {
    const poly = conePolygon(level, TILE * 3, TILE * 3, 0, 230, 0.6);
    assert.ok(poly.length >= 6, `polygon has ${poly.length} points`);
    for (const [x, y] of poly) {
      assert.ok(x >= 0 && x <= level.cols * TILE && y >= 0 && y <= level.rows * TILE, 'point in bounds');
    }
  });

  it('pointInCone sees ahead, not behind, and not through a wall', () => {
    const gx = TILE * 3, gy = TILE * 3;
    assert.equal(pointInCone(level, gx, gy, 0, 230, 0.6, gx + 100, gy), true, 'ahead');
    assert.equal(pointInCone(level, gx, gy, 0, 230, 0.6, gx - 100, gy), false, 'behind');
    assert.equal(pointInCone(level, gx, gy, 0, 230, 0.6, gx, gy + 100), false, 'side, outside angle');
  });

  it('lightAt is bright near a lit lamp and dark far away; dousing kills it', () => {
    const lamp = level.lamps[0];
    assert.ok(lightAt(level, lamp.x, lamp.y) > 0.9, 'at the lamp');
    assert.equal(lightAt(level, TILE * 12, TILE * 8) < 0.5, true, 'mid-map is dimmer than the lamp');
    lamp.doused = true;
    assert.equal(lightAt(level, lamp.x, lamp.y), 0, 'doused lamp gives no light');
    lamp.doused = false;
  });
});

describe('guards: patrol, suspicion, alert, search', () => {
  const level = parseLevel(HEISTS[0]);
  it('patrols along waypoints', () => {
    const g = createGuard({ x: TILE * 2, y: TILE * 2 }, [{ c: 2, r: 2 }, { c: 6, r: 2 }]);
    const x0 = g.x;
    updateGuard(g, { x: TILE * 20, y: TILE * 14, sneaking: true, sprinting: false, moving: false }, level, 1, rng);
    assert.ok(g.x !== x0 || g.y !== TILE * 2, 'guard moved along patrol');
    assert.equal(g.state, 'patrol');
  });

  it('hearing a noise turns a guard suspicious and sends it to investigate', () => {
    const g = createGuard({ x: TILE * 2, y: TILE * 2 }, [{ c: 2, r: 2 }, { c: 6, r: 2 }]);
    hearNoise(g, TILE * 5, TILE * 2, 200);
    assert.equal(g.state, 'suspicious');
    assert.ok(g.investigate, 'has an investigate point');
  });

  it('a fully visible player fills the meter and triggers alert', () => {
    const g = createGuard({ x: TILE * 3, y: TILE * 3 }, [{ c: 3, r: 3 }, { c: 6, r: 3 }]);
    // The player stands on the guard's patrol path ahead of it, in the open.
    const player = { x: TILE * 5, y: TILE * 3 + 20, sneaking: false, sprinting: false, moving: true };
    g.dir = 0;
    for (let i = 0; i < 40; i++) updateGuard(g, player, level, 0.1, rng);
    assert.equal(g.state, 'alert', `meter ${g.meter.toFixed(2)}`);
    assert.ok(g.meter >= 1, 'meter full');
  });

  it('the meter decays when the player hides', () => {
    const g = createGuard({ x: TILE * 3, y: TILE * 3 }, [{ c: 3, r: 3 }, { c: 6, r: 3 }]);
    g.meter = 0.8;
    g.state = 'suspicious';
    const far = { x: TILE * 20, y: TILE * 14, sneaking: true, sprinting: false, moving: false };
    for (let i = 0; i < 30; i++) updateGuard(g, far, level, 0.1, rng);
    assert.ok(g.meter < 0.8, `meter decayed to ${g.meter.toFixed(2)}`);
  });
});

describe('player: movement and noise', () => {
  const level = parseLevel(HEISTS[0]);
  it('walks, sneaks slower, sprints faster; walls block movement', () => {
    const p = createPlayer(level.playerStart.x, level.playerStart.y);
    const x0 = p.x;
    updatePlayer(p, { right: true }, level, 1);
    assert.ok(p.x > x0, 'walked right');
    assert.equal(noiseRadius(p), 0, 'walking is silent');
    const s = createPlayer(level.playerStart.x, level.playerStart.y);
    updatePlayer(s, { right: true, sneak: true }, level, 1);
    assert.ok(s.x - level.playerStart.x < p.x - x0, 'sneak is slower than walk');
    const r = createPlayer(level.playerStart.x, level.playerStart.y);
    updatePlayer(r, { right: true, sprint: true }, level, 1);
    assert.ok(r.x - level.playerStart.x > p.x - x0, 'sprint is faster than walk');
    assert.ok(noiseRadius(r) > 0, 'sprinting is loud');
    // Walk into the left wall: x must not cross it.
    const w = createPlayer(TILE * 1 + 15, TILE * 2);
    updatePlayer(w, { left: true }, level, 1);
    assert.ok(w.x >= TILE + 11, `stopped by wall at ${w.x.toFixed(1)}`);
  });
});

describe('gadgets: coins, smoke, lantern douse', () => {
  it('throwCoin spends a coin and makes a noise guards can hear', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    const before = game.player.coins;
    const coin = throwCoin(game, game.player.x + 100, game.player.y);
    assert.ok(coin, 'coin thrown');
    assert.equal(game.player.coins, before - 1, 'one coin spent');
    assert.ok(coin.noiseR >= 150, 'coin landing is loud');
    assert.equal(throwCoin({ ...game, player: { ...game.player, coins: 0 } }, 0, 0), null, 'no coins left');
  });

  it('useSmoke spends a vial and hides the player inside it', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    const before = game.player.smoke;
    assert.equal(useSmoke(game), true);
    assert.equal(game.player.smoke, before - 1, 'one vial spent');
    assert.equal(playerInSmoke(game, game.player.x, game.player.y), true, 'player stands in smoke');
    assert.equal(playerInSmoke(game, game.player.x + 500, game.player.y), false, 'far away is not smoke');
  });

  it('douseLamp snuffs the nearest lit lamp within reach', () => {
    const game = createGame(0, 7);
    const lamp = game.level.lamps[0];
    game.player.x = lamp.x + 30;
    game.player.y = lamp.y;
    assert.equal(lightAt(game.level, lamp.x, lamp.y) > 0.9, true, 'lamp lit before');
    assert.equal(douseLamp(game), true, 'doused');
    assert.equal(lamp.doused, true, 'lamp is out');
    assert.equal(lightAt(game.level, lamp.x, lamp.y), 0, 'no light after dousing');
    assert.equal(douseLamp(game), false, 'nothing left to douse here');
  });
});

describe('hazards: cameras and lasers', () => {
  const level = parseLevel(HEISTS[1]);
  it('a camera sweeps and spots the player in its cone', () => {
    const cam = createCamera(level.cameras[0]);
    const seen0 = updateCamera(cam, { x: TILE * 20, y: TILE * 14, sneaking: false }, level, 0.1, () => false);
    assert.equal(typeof seen0, 'boolean');
    // Put the player 120px in front of the camera, along its sweep centre.
    cam.t = 0;
    const px = cam.x - 120, py = cam.y;
    const seen = updateCamera(cam, { x: px, y: py, sneaking: false }, level, 0.1, () => false);
    assert.equal(seen, true, 'camera spots the player in its cone');
    assert.equal(cam.spotted, true);
  });

  it('lasers pulse on and off; crossing while on is detected', () => {
    const lz = level.lasers[0] || { a: { c: 5, r: 3 }, b: { c: 5, r: 12 }, period: 4, on: 2 };
    const on = laserOn(lz, 0.5);
    const off = laserOn(lz, 3);
    assert.notEqual(on, off, 'laser pulses');
    // A path crossing the beam segment while the laser is on trips it.
    const crossed = laserCrossed(lz, TILE * 4, TILE * 7, TILE * 6, TILE * 7, 0.5);
    assert.equal(crossed, on, 'crossing matches the on-phase');
  });
});

describe('game: win, caught, strikes, score', () => {
  it('collecting the seal then reaching the exit wins the heist', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    game.player.x = game.level.seal.x;
    game.player.y = game.level.seal.y;
    game.tick(0.1, {});
    assert.equal(game.sealTaken, true, 'seal collected');
    game.player.x = game.level.exit.x;
    game.player.y = game.level.exit.y;
    game.tick(0.1, {});
    assert.equal(game.state, 'won', 'reached the exit with the seal');
    assert.ok(game.score > 0, 'score awarded');
  });

  it('the exit stays shut without the seal', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    game.player.x = game.level.exit.x;
    game.player.y = game.level.exit.y;
    game.tick(0.1, {});
    assert.equal(game.state, 'playing', 'no win without the seal');
  });

  it('an alert guard that touches the player costs a strike; three strikes fail the heist', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    for (let strike = 1; strike <= 3; strike++) {
      const guard = game.guards[0];
      guard.state = 'alert';
      guard.meter = 1;
      guard.x = game.player.x + 5;
      guard.y = game.player.y;
      game.tick(0.1, {});
      assert.equal(game.strikes, strike, `strike ${strike}`);
      if (strike < 3) assert.equal(game.state, 'playing', 'respawned after a strike');
    }
    assert.equal(game.state, 'failed', 'three strikes fail the heist');
  });

  it('a ghost run (never spotted) pays the +500 bonus', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    game.spotted = 0;
    game.player.x = game.level.seal.x;
    game.player.y = game.level.seal.y;
    game.tick(0.1, {});
    game.player.x = game.level.exit.x;
    game.player.y = game.level.exit.y;
    game.tick(0.1, {});
    assert.equal(game.state, 'won');
    assert.ok(game.score >= 800, `ghost bonus included, score ${game.score}`);
  });

  it('nextHeist advances the campaign; the fifth win is a victory', () => {
    const game = createGame(4, 7);
    game.state = 'playing';
    game.player.x = game.level.seal.x;
    game.player.y = game.level.seal.y;
    game.tick(0.1, {});
    game.player.x = game.level.exit.x;
    game.player.y = game.level.exit.y;
    game.tick(0.1, {});
    assert.equal(game.state, 'won');
    game.nextHeist();
    assert.equal(game.state, 'victory', 'campaign complete after heist 5');
  });

  it('the alarm rises while a guard is alert and falls when calm', () => {
    const game = createGame(0, 7);
    game.state = 'playing';
    game.guards[0].state = 'alert';
    game.guards[0].meter = 1;
    game.tick(1, {});
    assert.ok(game.alert > 0, `alarm rose to ${game.alert.toFixed(1)}`);
    game.guards[0].state = 'patrol';
    game.guards[0].meter = 0;
    const high = game.alert;
    game.tick(2, {});
    assert.ok(game.alert < high, 'alarm decays when calm');
  });

  it('two games with the same seed play the same way', () => {
    const a = createGame(1, 7);
    const b = createGame(1, 7);
    assert.equal(JSON.stringify(a.level.loot.map((l) => [l.x, l.y])), JSON.stringify(b.level.loot.map((l) => [l.x, l.y])));
    assert.equal(a.guards.length, b.guards.length);
  });
});

describe('random: seeded RNG is deterministic', () => {
  it('same seed, same sequence', () => {
    const a = makeRng(42), b = makeRng(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
    assert.notDeepEqual([makeRng(1)(), makeRng(1)()], [makeRng(2)(), makeRng(2)()]);
  });
});
