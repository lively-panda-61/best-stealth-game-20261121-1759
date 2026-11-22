// Player movement for SHADOW PROTOCOL.
// WASD / arrows move; holding Shift sneaks (slow, quiet, harder to spot).
// Running is fast but loud: guards hear it from far away.

import { slideMove } from './geometry.js';

export const RUN_SPEED = 170;
export const SNEAK_SPEED = 85;
export const PLAYER_RADIUS = 12;

export function createPlayer(x, y) {
  return {
    x,
    y,
    radius: PLAYER_RADIUS,
    dir: 0,
    sneaking: false,
    running: false,
    moving: false,
  };
}

// How far a guard can hear this player right now (0 when still).
export function noiseRadius(player) {
  if (!player.moving) return 0;
  if (player.sneaking) return 25;
  return 150;
}

export function updatePlayer(player, input, level, dt) {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  player.sneaking = Boolean(input.sneak);
  player.moving = dx !== 0 || dy !== 0;
  player.running = player.moving && !player.sneaking;
  if (!player.moving) return player;
  const len = Math.hypot(dx, dy);
  const speed = player.sneaking ? SNEAK_SPEED : RUN_SPEED;
  const stepX = (dx / len) * speed * dt;
  const stepY = (dy / len) * speed * dt;
  const moved = slideMove(player.x, player.y, player.radius, stepX, stepY, level.walls);
  player.x = moved.x;
  player.y = moved.y;
  player.dir = Math.atan2(stepY, stepX);
  player.x = Math.max(player.radius, Math.min(level.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(level.height - player.radius, player.y));
  return player;
}
