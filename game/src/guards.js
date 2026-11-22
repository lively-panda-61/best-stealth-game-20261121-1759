// Guard AI for THE BRASS CROW.
// States: patrol (walk the waypoints) -> suspicious (heard or glimpsed
// something: go look) -> alert (meter full: chase the player) -> search
// (lost the player: sweep the last-seen spot, then back to patrol).
// The detection meter fills while the player is visible in the cone and
// drains while hidden; lamplight, distance and running all speed it up,
// shadow and sneaking slow it down.
import { pointInCone, lightAt, inGrass, losClear } from './vision.js';
import { isSolid, TILE } from './levels.js';

export const CATCH_DISTANCE = 16;
export const CONE_RANGE = 230;
export const CONE_HALF_ANGLE = 0.6;

const PATROL_SPEED = 55;
const SUSPICIOUS_SPEED = 85;
const ALERT_SPEED = 128;
const SEARCH_SPEED = 80;

export function createGuard(spawn, waypoints) {
  return {
    x: spawn.x,
    y: spawn.y,
    dir: 0,
    state: 'patrol',
    meter: 0,
    wp: 0,
    waypoints: waypoints.map((w) => ({ x: w.c * TILE + TILE / 2, y: w.r * TILE + TILE / 2 })),
    investigate: null,
    lastSeen: null,
    searchT: 0,
    loseT: 0,
    stuckT: 0,
    stepT: 0,
  };
}

function moveToward(g, tx, ty, speed, level, dt) {
  const dx = tx - g.x, dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  // Substep so a long step never tunnels through a wall.
  const n = Math.max(1, Math.ceil(step / 8));
  for (let i = 0; i < n; i++) {
    const sx = (dx / d) * (step / n);
    const sy = (dy / d) * (step / n);
    const r = 11;
    if (!hitsWall(level, g.x + sx, g.y, r)) g.x += sx;
    if (!hitsWall(level, g.x, g.y + sy, r)) g.y += sy;
  }
  g.dir = Math.atan2(dy, dx);
  return d <= step + 1;
}

function hitsWall(level, x, y, r) {
  for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    if (isSolid(level, Math.floor(cx / TILE), Math.floor(cy / TILE))) return true;
  }
  return false;
}

// A noise at (x, y) inside the radius pulls a patrolling guard to look.
export function hearNoise(g, x, y, radius) {
  if (g.state === 'alert') return;
  const d = Math.hypot(x - g.x, y - g.y);
  if (d > radius) return;
  g.state = 'suspicious';
  g.investigate = { x, y };
  g.meter = Math.max(g.meter, 0.45);
}

export function updateGuard(g, player, level, dt, rng) {
  const dist = Math.hypot(player.x - g.x, player.y - g.y);
  const inSmoke = player.inSmoke === true;
  const seen =
    !inSmoke &&
    pointInCone(level, g.x, g.y, g.dir, CONE_RANGE, CONE_HALF_ANGLE, player.x, player.y) &&
    !(inGrass(level, player.x, player.y) && player.sneaking);

  if (seen) {
    // How fast the meter fills: light, distance and the player's pace.
    const light = lightAt(level, player.x, player.y);
    const lightF = 0.5 + 1.1 * light;
    const distF = dist < 80 ? 1 : 1 - 0.65 * Math.min(1, (dist - 80) / (CONE_RANGE - 80));
    const paceF = player.sprinting ? 1.4 : player.sneaking ? 0.6 : 1;
    g.meter = Math.min(1, g.meter + dt * 1.6 * lightF * distF * paceF);
    g.lastSeen = { x: player.x, y: player.y };
    g.loseT = 0;
    if (g.meter >= 1 && g.state !== 'alert') {
      g.state = 'alert';
      g.investigate = null;
    } else if (g.state === 'patrol' || g.state === 'search') {
      g.state = 'suspicious';
    }
  } else {
    g.meter = Math.max(0, g.meter - dt * 0.5);
    if (g.state === 'alert') {
      g.loseT += dt;
      if (g.loseT > 3) {
        g.state = 'search';
        g.searchT = 0;
        g.investigate = g.lastSeen;
      }
    } else if (g.state === 'suspicious' && g.meter <= 0) {
      g.state = 'patrol';
      g.investigate = null;
    }
  }

  const prevX = g.x, prevY = g.y;
  if (g.state === 'patrol') {
    const target = g.waypoints[g.wp];
    if (moveToward(g, target.x, target.y, PATROL_SPEED, level, dt)) {
      g.wp = (g.wp + 1) % g.waypoints.length;
      const next = g.waypoints[g.wp];
      moveToward(g, next.x, next.y, PATROL_SPEED, level, dt);
    }
  } else if (g.state === 'suspicious' && g.investigate) {
    if (moveToward(g, g.investigate.x, g.investigate.y, SUSPICIOUS_SPEED, level, dt)) {
      // Arrived: look around, then give up and go back to the route.
      g.dir += dt * 1.5;
      g.searchT += dt;
      if (g.searchT > 2.5) {
        g.state = 'patrol';
        g.investigate = null;
        g.searchT = 0;
        // Resume from the nearest waypoint instead of backtracking.
        let best = 0, bestD = Infinity;
        g.waypoints.forEach((w, i) => {
          const d = Math.hypot(w.x - g.x, w.y - g.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        g.wp = best;
      }
    }
  } else if (g.state === 'alert') {
    const target = g.lastSeen || { x: player.x, y: player.y };
    moveToward(g, target.x, target.y, ALERT_SPEED, level, dt);
  } else if (g.state === 'search' && g.investigate) {
    if (moveToward(g, g.investigate.x, g.investigate.y, SEARCH_SPEED, level, dt)) {
      g.dir += dt * 2;
      g.searchT += dt;
      if (g.searchT > 4) {
        g.state = 'patrol';
        g.investigate = null;
        g.searchT = 0;
        let best = 0, bestD = Infinity;
        g.waypoints.forEach((w, i) => {
          const d = Math.hypot(w.x - g.x, w.y - g.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        g.wp = best;
      }
    }
  }

  // Stuck against a wall while chasing: give up the chase and search.
  if (g.state === 'alert' && Math.hypot(g.x - prevX, g.y - prevY) < 1) {
    g.stuckT += dt;
    if (g.stuckT > 2) {
      g.state = 'search';
      g.searchT = 0;
      g.stuckT = 0;
      g.investigate = g.lastSeen;
    }
  } else {
    g.stuckT = 0;
  }

  // Footstep timer for the audio: guards step as they walk.
  g.stepT += dt;
  if (g.stepT > 0.45) g.stepT = 0;
  return g;
}
