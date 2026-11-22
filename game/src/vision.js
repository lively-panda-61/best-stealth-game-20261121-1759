// Line of sight and vision cones for THE BRASS CROW.
// Walls ('#'), crates ('c') and camera mounts ('K') block sight; everything
// else is transparent. Rays march in small steps so a cone hugs the walls.
import { tileAt, TILE } from './levels.js';

const BLOCKERS = new Set(['#', 'c', 'K']);

export function blocksSight(level, col, row) {
  return BLOCKERS.has(tileAt(level, col, row));
}

// True when the straight segment between two points crosses no blocker.
export function losClear(level, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  const oc = Math.floor(x0 / TILE), orr = Math.floor(y0 / TILE);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const col = Math.floor((x0 + dx * t) / TILE);
    const row = Math.floor((y0 + dy * t) / TILE);
    // The ray starts inside its owner's own tile (a camera sits on its
    // wall mount): that tile never blocks its own sight.
    if (col === oc && row === orr) continue;
    if (blocksSight(level, col, row)) return false;
  }
  return true;
}

// Fan polygon of a vision cone: 17 rays fanned across the half-angle, each
// marching until it hits a wall or the range. Points are [x, y] pairs.
export function conePolygon(level, x, y, dir, range, halfAngle) {
  const rays = 16;
  const points = [[x, y]];
  for (let i = 0; i <= rays; i++) {
    const a = dir - halfAngle + (2 * halfAngle * i) / rays;
    const stepX = Math.cos(a), stepY = Math.sin(a);
    let d = 0;
    let ex = x, ey = y;
    while (d < range) {
      d += 6;
      const nx = x + stepX * d, ny = y + stepY * d;
      if (blocksSight(level, Math.floor(nx / TILE), Math.floor(ny / TILE))) break;
      ex = nx; ey = ny;
    }
    points.push([ex, ey]);
  }
  return points;
}

// Is a point inside a guard's cone (angle + range + line of sight)?
export function pointInCone(level, gx, gy, dir, range, halfAngle, px, py) {
  const dx = px - gx, dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 1) return dist < 1;
  let diff = Math.atan2(dy, dx) - dir;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return false;
  return losClear(level, gx, gy, px, py);
}

// Light level at a point, 0 (dark) to 1 (under a lamp). Doused lamps give none.
export function lightAt(level, x, y) {
  let best = 0;
  for (const lamp of level.lamps) {
    if (lamp.doused) continue;
    const d = Math.hypot(x - lamp.x, y - lamp.y);
    const r = 150;
    if (d < r) best = Math.max(best, 1 - d / r);
  }
  return best;
}

// Is the player standing in tall grass?
export function inGrass(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === 'g';
}
