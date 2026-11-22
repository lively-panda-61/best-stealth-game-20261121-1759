// The thief: movement, pace and noise for THE BRASS CROW.
// Walk is the default, sneak is slow and quiet (and hides in tall grass),
// sprint is fast and loud enough for every guard nearby to hear.
import { isSolid, TILE } from './levels.js';

export const WALK_SPEED = 130;
export const SNEAK_SPEED = 70;
export const SPRINT_SPEED = 210;
const RADIUS = 11;

export function createPlayer(x, y) {
  return {
    x, y, dir: 0,
    sneaking: false, sprinting: false, moving: false,
    coins: 5, smoke: 2,
  };
}

function hitsWall(level, x, y) {
  for (const [cx, cy] of [[x - RADIUS, y - RADIUS], [x + RADIUS, y - RADIUS], [x - RADIUS, y + RADIUS], [x + RADIUS, y + RADIUS]]) {
    if (isSolid(level, Math.floor(cx / TILE), Math.floor(cy / TILE))) return true;
  }
  return false;
}

export function updatePlayer(p, input, level, dt) {
  let dx = 0, dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  p.sneaking = !!input.sneak;
  p.sprinting = !!input.sprint && !p.sneaking;
  p.moving = dx !== 0 || dy !== 0;
  if (!p.moving) return p;
  const len = Math.hypot(dx, dy);
  const speed = p.sprinting ? SPRINT_SPEED : p.sneaking ? SNEAK_SPEED : WALK_SPEED;
  // Substep so a long step never tunnels through a wall.
  const totalX = (dx / len) * speed * dt;
  const totalY = (dy / len) * speed * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(totalX, totalY) / 8));
  for (let i = 0; i < n; i++) {
    const stepX = totalX / n;
    const stepY = totalY / n;
    if (!hitsWall(level, p.x + stepX, p.y)) p.x += stepX;
    if (!hitsWall(level, p.x, p.y + stepY)) p.y += stepY;
  }
  p.dir = Math.atan2(totalY, totalX);
  return p;
}

// How far this pace can be heard: sprinting carries, walking is silent.
export function noiseRadius(p) {
  if (p.sprinting && p.moving) return 170;
  return 0;
}
