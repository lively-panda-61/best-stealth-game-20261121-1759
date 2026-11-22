// Hazards for THE BRASS CROW: sweeping security cameras and pulsing lasers.
// A camera that sees the thief raises the alarm and points a guard at them.
// A laser trips the alarm when the thief crosses its beam while it is lit;
// lasers pulse, so a patient thief crosses in the dark gap.
import { pointInCone } from './vision.js';
import { TILE } from './levels.js';

export const CAMERA_RANGE = 210;
export const CAMERA_HALF_ANGLE = 0.55;

export function createCamera(def) {
  return {
    x: def.tile.c * TILE + TILE / 2,
    y: def.tile.r * TILE + TILE / 2,
    baseDir: def.baseDir,
    sweep: def.sweep,
    range: def.range,
    speed: def.speed,
    dir: def.baseDir,
    t: 0,
    spotted: false,
  };
}

export function updateCamera(cam, player, level, dt, inSmoke) {
  cam.t += dt;
  cam.dir = cam.baseDir + Math.sin(cam.t * cam.speed) * cam.sweep;
  const seen =
    !inSmoke(player.x, player.y) &&
    pointInCone(level, cam.x, cam.y, cam.dir, cam.range, CAMERA_HALF_ANGLE, player.x, player.y);
  cam.spotted = seen;
  return seen;
}

// Lasers pulse: lit for `on` seconds of each `period`.
export function laserOn(laser, t) {
  return (t % laser.period) < laser.on;
}

// Did the segment (x0,y0)-(x1,y1) cross the laser's beam while it was lit?
export function laserCrossed(laser, x0, y0, x1, y1, t) {
  if (!laserOn(laser, t)) return false;
  const ax = laser.a.c * TILE + TILE / 2, ay = laser.a.r * TILE + TILE / 2;
  const bx = laser.b.c * TILE + TILE / 2, by = laser.b.r * TILE + TILE / 2;
  return segmentsCross(x0, y0, x1, y1, ax, ay, bx, by);
}

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = orient(x3, y3, x4, y4, x1, y1);
  const d2 = orient(x3, y3, x4, y4, x2, y2);
  const d3 = orient(x1, y1, x2, y2, x3, y3);
  const d4 = orient(x1, y1, x2, y2, x4, y4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  // Collinear touches count too: walking along the beam trips it.
  if (d1 === 0 && onSegment(x3, y3, x1, y1, x4, y4)) return true;
  if (d2 === 0 && onSegment(x3, y3, x2, y2, x4, y4)) return true;
  if (d3 === 0 && onSegment(x1, y1, x3, y3, x2, y2)) return true;
  if (d4 === 0 && onSegment(x1, y1, x4, y4, x2, y2)) return true;
  return false;
}

function orient(ax, ay, bx, by, cx, cy) {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : -1;
}

function onSegment(ax, ay, px, py, bx, by) {
  return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
}
