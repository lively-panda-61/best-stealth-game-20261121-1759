// Guard AI for SHADOW PROTOCOL.
// States: patrol -> suspicious -> alert -> search -> patrol.
// A guard sees the player inside its vision cone with a clear line of
// sight; the detection meter fills faster up close, slower when the player
// sneaks or stands in shadow, and decays when the player is hidden.

import { angleDelta, angleTo, distance, lineOfSight, pointInCone, slideMove } from './geometry.js';
import { insideAny } from './level.js';

export const VISION_RANGE = 220;
export const VISION_HALF_FOV = 0.65; // ~37 degrees each side
export const PATROL_SPEED = 55;
export const SUSPICIOUS_SPEED = 78;
export const ALERT_SPEED = 132;
export const TURN_SPEED = 3.4; // radians per second
export const CATCH_DISTANCE = 26;

export function createGuard({ x, y, dir = 0, waypoints }) {
  const points = waypoints && waypoints.length > 0 ? waypoints : [{ x, y }];
  return {
    x,
    y,
    dir: angleTo(x, y, points[0].x, points[0].y),
    radius: 13,
    waypoints: points,
    waypointIndex: 0,
    state: 'patrol',
    meter: 0,
    speed: PATROL_SPEED,
    lastSeen: null,
    investigate: null,
    loseSightFor: 0,
    pauseTimer: 0,
    searchTimer: 0,
  };
}

// True when the guard can currently see the player: inside the vision cone
// with an unblocked line of sight. Bushes hide a still player entirely.
export function guardSeesPlayer(guard, player, level) {
  if (!pointInCone(player.x, player.y, guard.x, guard.y, guard.dir, VISION_RANGE, VISION_HALF_FOV)) {
    return false;
  }
  if (!lineOfSight(guard.x, guard.y, player.x, player.y, level.walls)) return false;
  if (!player.moving && insideAny(player.x, player.y, level.bushes)) return false;
  return true;
}

// Detection fill rate per second while the guard sees the player.
export function detectionRate(guard, player, level) {
  const d = distance(guard.x, guard.y, player.x, player.y);
  const proximity = 1.25 - (d / VISION_RANGE) * 0.75; // 1.25 close, 0.5 far
  let rate = proximity;
  if (insideAny(player.x, player.y, level.shadows)) rate *= 0.35;
  if (player.sneaking) rate *= 0.5;
  if (player.running) rate *= 1.3;
  return rate;
}

// A loud noise pulls a patrolling or suspicious guard toward the sound.
export function hearNoise(guard, x, y, radius) {
  if (guard.state === 'alert') return;
  if (distance(guard.x, guard.y, x, y) > radius) return;
  guard.state = 'suspicious';
  guard.investigate = { x, y };
}

function moveToward(guard, target, speed, level, dt) {
  const d = distance(guard.x, guard.y, target.x, target.y);
  if (d < 4) return true;
  const step = Math.min(d, speed * dt);
  const nx = guard.x + ((target.x - guard.x) / d) * step;
  const ny = guard.y + ((target.y - guard.y) / d) * step;
  const moved = slideMove(guard.x, guard.y, guard.radius, nx - guard.x, ny - guard.y, level.walls);
  guard.x = moved.x;
  guard.y = moved.y;
  const want = angleTo(guard.x, guard.y, target.x, target.y);
  guard.dir += Math.max(-TURN_SPEED * dt, Math.min(TURN_SPEED * dt, angleDelta(guard.dir, want)));
  return d - step < 4;
}

export function updateGuard(guard, player, level, dt, rng) {
  const seen = guardSeesPlayer(guard, player, level);
  if (seen) {
    guard.meter = Math.min(1, guard.meter + detectionRate(guard, player, level) * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightFor = 0;
    if (guard.meter >= 1 && guard.state !== 'alert') {
      guard.state = 'alert';
    }
  } else {
    guard.meter = Math.max(0, guard.meter - 0.5 * dt);
    if (guard.state === 'alert') {
      guard.loseSightFor += dt;
      if (guard.loseSightFor > 4) {
        guard.state = 'search';
        guard.searchTimer = 3;
      }
    }
  }

  switch (guard.state) {
    case 'patrol': {
      guard.speed = PATROL_SPEED;
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.dir += Math.sin(guard.pauseTimer * 2) * 0.4 * dt;
        break;
      }
      const target = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, target, PATROL_SPEED, level, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = 0.8;
      }
      break;
    }
    case 'suspicious': {
      guard.speed = SUSPICIOUS_SPEED;
      const target = guard.investigate || guard.lastSeen || { x: guard.x, y: guard.y };
      if (seen) {
        // Keep watching the player while visible.
        guard.dir += Math.max(
          -TURN_SPEED * dt,
          Math.min(TURN_SPEED * dt, angleDelta(guard.dir, angleTo(guard.x, guard.y, player.x, player.y))),
        );
      } else if (moveToward(guard, target, SUSPICIOUS_SPEED, level, dt)) {
        guard.investigate = null;
        guard.state = 'patrol';
        guard.pauseTimer = 1.2;
      }
      break;
    }
    case 'alert': {
      guard.speed = ALERT_SPEED;
      const target = seen ? { x: player.x, y: player.y } : guard.lastSeen;
      if (target) moveToward(guard, target, ALERT_SPEED, level, dt);
      break;
    }
    case 'search': {
      guard.speed = SUSPICIOUS_SPEED;
      guard.searchTimer -= dt;
      if (guard.searchTimer > 0) {
        // Sweep the cone around the last known position.
        guard.dir += 1.6 * dt;
      } else {
        guard.state = 'patrol';
        guard.meter = Math.max(0, guard.meter - 0.4);
      }
      break;
    }
    default:
      break;
  }
  // Keep the guard inside the level bounds.
  guard.x = Math.max(guard.radius, Math.min(level.width - guard.radius, guard.x));
  guard.y = Math.max(guard.radius, Math.min(level.height - guard.radius, guard.y));
  return guard;
}
