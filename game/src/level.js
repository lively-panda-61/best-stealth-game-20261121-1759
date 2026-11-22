// Level definitions and parsing for SHADOW PROTOCOL.
// Maps are ASCII grids, 24 x 15 tiles, tile size 40 px:
//   # wall   . floor   s shadow (slow detection)   B bush (hide while still)
//   P player start   C data core   E exit   1-4 guard spawns (patrols below)

export const TILE = 40;

export const LEVELS = [
  {
    name: 'The Lobby',
    briefing: 'Lift 3 data cores, then slip out the east exit. Two guards walk the floor.',
    map: ['########################',
      '#P....#......#.........#',
      '#.....#..s........C....#',
      '#..B..#......#.........#',
      '#............#.##......#',
      '#..s..#..C...#....#....#',
      '#.....#......#....#...##',
      '###.#####.####....#.####',
      '#......#......#...#....#',
      '#..C...#..s...#...#..E.#',
      '#.............#...#....#',
      '#..B...#......#...#....#',
      '#......#......#........#',
      '#..1...#...2......B....#',
      '########################'],
    patrols: {
      1: [[3, 12], [3, 8], [3, 4]],
      2: [[11, 13], [11, 9]],
    },
  },
  {
    name: 'The Vault Floor',
    briefing: 'Four cores behind three patrol lanes. Cross the middle wall through its gaps.',
    map: ['########################',
      '#P....#.....#.....#..C.#',
      '#..s..#..B..#..s..#....#',
      '#...........#.....#....#',
      '#.##..#..#..#..##.#....#',
      '#.....#...........#..#.#',
      '#..C..#.....#..C..#....#',
      '#####.#######.#####.##.#',
      '#.....#.....#.....#....#',
      '#..B..#..s..#..B.....E.#',
      '#...........#.....#....#',
      '#..1..#..2..#..3..#....#',
      '#.....#...........#....#',
      '#..s..#.....#..s.......#',
      '########################'],
    patrols: {
      1: [[1, 11], [5, 11]],
      2: [[7, 11], [11, 11]],
      3: [[13, 11], [17, 11]],
    },
  },
  {
    name: 'The Black Site',
    briefing: 'Five cores, four guards, tight corridors. Shadows are your only friends.',
    map: ['########################',
      '#P..#....C....#....#...#',
      '#...#..s......#..s.#...#',
      '#........#....#....#...#',
      '#.B.#....#..C.#.B..#.C.#',
      '#...#..............#...#',
      '#...#..1.#....#..2.#...#',
      '##.###.###.#####.###.#.#',
      '#....#....#....#....#..#',
      '#..C.#..s.#..C...s..#E.#',
      '#.........#....#....#..#',
      '#..3.#....#.4..#.......#',
      '#....#.........#..B.#..#',
      '#....#....#....#....#..#',
      '########################'],
    patrols: {
      1: [[5, 6], [8, 6]],
      2: [[15, 6], [18, 6]],
      3: [[1, 11], [4, 11]],
      4: [[11, 11], [14, 11]],
    },
  },
];

export function tileCenter(tx, ty, tile = TILE) {
  return { x: tx * tile + tile / 2, y: ty * tile + tile / 2 };
}

function isFloorChar(ch) {
  return ch !== '#';
}

// Parse a level definition into runtime data: wall rectangles, shadow and
// bush zones, spawn points, cores, exit and guard patrol routes.
export function parseLevel(def) {
  const rows = def.map;
  const height = rows.length;
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) throw new Error(`${def.name}: rows differ in width`);
  }
  const level = {
    name: def.name,
    briefing: def.briefing,
    tile: TILE,
    width: width * TILE,
    height: height * TILE,
    cols: width,
    rows: height,
    walls: [],
    shadows: [],
    bushes: [],
    cores: [],
    guards: [],
    playerStart: null,
    exit: null,
    grid: rows.map((row) => row.split('')),
  };
  const guardSpawns = {};
  rows.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      const c = tileCenter(tx, ty);
      if (ch === '#') {
        level.walls.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE });
      } else if (ch === 's') {
        level.shadows.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE });
      } else if (ch === 'B') {
        level.bushes.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE });
      } else if (ch === 'P') {
        level.playerStart = { x: c.x, y: c.y, tx, ty };
      } else if (ch === 'C') {
        level.cores.push({ x: c.x, y: c.y, tx, ty, taken: false });
      } else if (ch === 'E') {
        level.exit = { x: c.x, y: c.y, tx, ty };
      } else if (ch >= '1' && ch <= '9') {
        guardSpawns[ch] = { x: c.x, y: c.y, tx, ty };
      }
    });
  });
  if (!level.playerStart) throw new Error(`${def.name}: map has no player start (P)`);
  if (!level.exit) throw new Error(`${def.name}: map has no exit (E)`);
  for (const [digit, spawn] of Object.entries(guardSpawns)) {
    const waypoints = (def.patrols[digit] || [[spawn.tx, spawn.ty]]).map(([tx, ty]) =>
      tileCenter(tx, ty),
    );
    level.guards.push({ spawn, waypoints });
  }
  return level;
}

// Tile walkability for the reachability check (walls block, everything else passes).
export function walkable(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.cols || ty >= level.rows) return false;
  return isFloorChar(level.grid[ty][tx]);
}

// Breadth-first search: true when `to` can be reached from `from` on foot.
export function reachable(level, from, to) {
  const start = { tx: Math.floor(from.x / level.tile), ty: Math.floor(from.y / level.tile) };
  const goal = { tx: Math.floor(to.x / level.tile), ty: Math.floor(to.y / level.tile) };
  const seen = new Set([`${start.tx},${start.ty}`]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.tx === goal.tx && cur.ty === goal.ty) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && walkable(level, nx, ny)) {
        seen.add(key);
        queue.push({ tx: nx, ty: ny });
      }
    }
  }
  return false;
}

// True when the point sits inside one of the rectangles.
export function insideAny(x, y, rects) {
  return rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
