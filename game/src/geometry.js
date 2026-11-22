// 2D geometry helpers: distances, segment tests, line of sight through
// axis-aligned wall rectangles, and vision-cone tests. Pure functions,
// no DOM, fully unit-tested.

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function orientation(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (v === 0) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(ax, ay, bx, by, cx, cy) {
  return (
    bx <= Math.max(ax, cx) &&
    bx >= Math.min(ax, cx) &&
    by <= Math.max(ay, cy) &&
    by >= Math.min(ay, cy)
  );
}

// True when segments (a,b) and (c,d) touch or cross (endpoints included).
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

// True when the segment (x1,y1)-(x2,y2) touches the rectangle.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h) return true;
  const { x, y, w, h } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, x, y, x + w, y) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x, y + h, x, y)
  );
}

// True when nothing blocks the straight line between the two points.
export function lineOfSight(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

// True when (px,py) sits inside the vision cone of a guard at (gx,gy)
// facing `dir` radians, within `range` and `halfFov` radians of the axis.
export function pointInCone(px, py, gx, gy, dir, range, halfFov) {
  const d = distance(gx, gy, px, py);
  if (d > range) return false;
  if (d < 1) return true;
  let delta = angleTo(gx, gy, px, py) - dir;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return Math.abs(delta) <= halfFov;
}

// Smallest absolute turn from angle `from` toward angle `to` (radians).
export function angleDelta(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

// Move a circle (x, y, radius) by (dx, dy) against axis-aligned wall rects,
// sliding along walls: try the full move, then each axis alone.
export function slideMove(x, y, radius, dx, dy, walls) {
  const hits = (nx, ny) =>
    walls.some(
      (w) =>
        nx + radius > w.x &&
        nx - radius < w.x + w.w &&
        ny + radius > w.y &&
        ny - radius < w.y + w.h,
    );
  let nx = x + dx;
  let ny = y + dy;
  if (hits(nx, ny)) {
    if (!hits(nx, y)) ny = y;
    else if (!hits(x, ny)) nx = x;
    else {
      nx = x;
      ny = y;
    }
  }
  return { x: nx, y: ny };
}
