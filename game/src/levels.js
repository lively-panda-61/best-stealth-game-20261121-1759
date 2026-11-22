// The five heists of THE BRASS CROW.
// Each heist is a 24x16 tile map plus its guards, cameras, lasers and palette.
// Grid legend: # wall | . floor | g tall grass (hide while sneaking)
// c crate (blocks sight) | l lamp (warm light, can be doused) | o loot ($50)
// * the seal (the prize) | X exit hatch | P player start
// G guard spawn | K camera mount (a wall tile with a camera on it)
export const TILE = 40;

export const HEISTS = [
  {
    name: 'THE OLD MINT',
    sub: 'Heist 1 · lift the Mint Seal',
    palette: {
      floor: '#1a2b26', floorAlt: '#16241f', wall: '#2c3e46', wallEdge: '#c9a227',
      lamp: '#ffb84d', accent: '#e8b64c', grass: '#2e6b3a', cone: 'rgba(232,182,76,0.20)',
      coneHot: 'rgba(239,68,68,0.28)', camera: 'rgba(239,120,68,0.22)',
    },
    coins: 5, smoke: 2, par: 90,
    grid: [
      '########################',
      '#P....#......#....o....#',
      '#.....#..l...#.........#',
      '#..g..#......#...*.....#',
      '#.....#..c...#.........#',
      '#.....#......#...l.....#',
      '#..l.....g...#.........#',
      '#.....#......#...o.....#',
      '###.####..#####.########',
      '#.....#..G...#.........#',
      '#..o..#......#...G.....#',
      '#.....#..l...#.........#',
      '#..g..#......#...l.....#',
      '#.....#..c...#...o.....#',
      '#..l....G.........X....#',
      '########################',
    ],
    guards: [
      { spawn: { c: 9, r: 9 }, waypoints: [{ c: 8, r: 9 }, { c: 12, r: 9 }] },
      { spawn: { c: 17, r: 10 }, waypoints: [{ c: 17, r: 10 }, { c: 20, r: 10 }, { c: 20, r: 13 }] },
      { spawn: { c: 8, r: 14 }, waypoints: [{ c: 8, r: 14 }, { c: 14, r: 14 }, { c: 14, r: 11 }] },
    ],
    cameras: [],
    lasers: [],
  },
  {
    name: 'THE GLASSHOUSE',
    sub: 'Heist 2 · lift the Orchid Seal',
    palette: {
      floor: '#14261f', floorAlt: '#10211a', wall: '#234534', wallEdge: '#7fb069',
      lamp: '#ffd27a', accent: '#3ddc84', grass: '#2e7d46', cone: 'rgba(61,220,132,0.18)',
      coneHot: 'rgba(239,68,68,0.28)', camera: 'rgba(239,120,68,0.22)',
    },
    coins: 5, smoke: 2, par: 105,
    grid: [
      '########################',
      '#P...g.......l......o..#',
      '#....g....c....G.......#',
      '#....g............o....#',
      '#..l......####.....l...#',
      '#....g....#..#....g....#',
      '#....g....#*.#....g..K.#',
      '#..o......#..#....g....#',
      '#....g....##..#...o....#',
      '#....g............l....#',
      '#..l......G.....c......#',
      '#....g........o....G...#',
      '#....g.....l......g....#',
      '#..o......g.....g...X..#',
      '#....G.......l.....g...#',
      '########################',
    ],
    guards: [
      { spawn: { c: 14, r: 2 }, waypoints: [{ c: 14, r: 2 }, { c: 19, r: 2 }, { c: 19, r: 5 }] },
      { spawn: { c: 11, r: 10 }, waypoints: [{ c: 11, r: 10 }, { c: 15, r: 10 }, { c: 15, r: 13 }] },
      { spawn: { c: 20, r: 11 }, waypoints: [{ c: 20, r: 11 }, { c: 20, r: 8 }, { c: 16, r: 8 }] },
      { spawn: { c: 5, r: 14 }, waypoints: [{ c: 5, r: 14 }, { c: 9, r: 14 }, { c: 9, r: 11 }] },
    ],
    cameras: [
      { tile: { c: 21, r: 6 }, baseDir: Math.PI, sweep: 1.1, range: 210, speed: 0.5 },
    ],
    lasers: [],
  },
  {
    name: 'THE GRAND HOTEL',
    sub: 'Heist 3 · lift the Brass Key',
    palette: {
      floor: '#241d2e', floorAlt: '#1e1826', wall: '#3a2b45', wallEdge: '#e0a458',
      lamp: '#ffb84d', accent: '#e0a458', grass: '#4a6741', cone: 'rgba(224,164,88,0.20)',
      coneHot: 'rgba(239,68,68,0.28)', camera: 'rgba(239,120,68,0.22)',
    },
    coins: 6, smoke: 3, par: 120,
    grid: [
      '########################',
      '#P....l.....#......o...#',
      '#....g......#..G.......#',
      '#....g..c...#......l.K.#',
      '#....g......#......o...#',
      '#..l....####....####...#',
      '#....g..#......#..*....#',
      '#....g..#..G...#.......#',
      '#....o..#......#..l....#',
      '###.######..####.#######',
      '#......#......#....o...#',
      '#..l...#..G...#....G...#',
      '#K.....#......#....l...#',
      '#..o...#..c...#....o...#',
      '#..l...G......#....X...#',
      '########################',
    ],
    guards: [
      { spawn: { c: 15, r: 2 }, waypoints: [{ c: 15, r: 2 }, { c: 18, r: 2 }, { c: 18, r: 4 }] },
      { spawn: { c: 11, r: 7 }, waypoints: [{ c: 11, r: 7 }, { c: 14, r: 7 }, { c: 14, r: 5 }] },
      { spawn: { c: 12, r: 11 }, waypoints: [{ c: 12, r: 11 }, { c: 16, r: 11 }, { c: 16, r: 13 }] },
      { spawn: { c: 20, r: 11 }, waypoints: [{ c: 20, r: 11 }, { c: 20, r: 13 }, { c: 17, r: 13 }] },
      { spawn: { c: 8, r: 14 }, waypoints: [{ c: 8, r: 14 }, { c: 12, r: 14 }, { c: 12, r: 12 }] },
    ],
    cameras: [
      { tile: { c: 21, r: 3 }, baseDir: Math.PI, sweep: 0.9, range: 200, speed: 0.6 },
      { tile: { c: 1, r: 12 }, baseDir: 0, sweep: 0.9, range: 200, speed: 0.6 },
    ],
    lasers: [],
  },
  {
    name: 'THE OPERA HOUSE',
    sub: 'Heist 4 · lift the Prima Seal',
    palette: {
      floor: '#1c1a2e', floorAlt: '#171528', wall: '#33294d', wallEdge: '#d64570',
      lamp: '#ffc46b', accent: '#d64570', grass: '#3f6b4f', cone: 'rgba(214,69,112,0.18)',
      coneHot: 'rgba(239,68,68,0.30)', camera: 'rgba(239,120,68,0.22)',
    },
    coins: 6, smoke: 3, par: 135,
    grid: [
      '########################',
      '#P..l....#......o...G..#',
      '#...g....#..c...#......#',
      '#...g....#......#..l...#',
      '#...g....#..G...#..o...#',
      '#..l..####..####...#..K#',
      '#......#.......#...#...#',
      '#..o...#...*...#...#...#',
      '#K.....#.......#...#...#',
      '###.######..#####.######',
      '#.....#....G....#......#',
      '#..l..#........#..G....#',
      '#....G#....c...#.......#',
      '#..o..#........#..l..o.#',
      '#..l..G....l...#...X...#',
      '########################',
    ],
    guards: [
      { spawn: { c: 20, r: 1 }, waypoints: [{ c: 20, r: 1 }, { c: 16, r: 1 }, { c: 18, r: 3 }] },
      { spawn: { c: 12, r: 4 }, waypoints: [{ c: 12, r: 4 }, { c: 15, r: 4 }, { c: 14, r: 7 }] },
      { spawn: { c: 11, r: 10 }, waypoints: [{ c: 11, r: 10 }, { c: 15, r: 10 }, { c: 14, r: 12 }] },
      { spawn: { c: 19, r: 11 }, waypoints: [{ c: 19, r: 11 }, { c: 19, r: 13 }, { c: 16, r: 13 }] },
      { spawn: { c: 8, r: 14 }, waypoints: [{ c: 8, r: 14 }, { c: 12, r: 14 }, { c: 12, r: 12 }] },
      { spawn: { c: 5, r: 12 }, waypoints: [{ c: 5, r: 12 }, { c: 5, r: 10 }, { c: 8, r: 10 }] },
    ],
    cameras: [
      { tile: { c: 22, r: 5 }, baseDir: Math.PI, sweep: 1.0, range: 210, speed: 0.7 },
      { tile: { c: 1, r: 8 }, baseDir: 0, sweep: 1.0, range: 210, speed: 0.7 },
    ],
    lasers: [
      { a: { c: 8, r: 9 }, b: { c: 8, r: 0 }, period: 4, on: 2.2 },
      { a: { c: 17, r: 0 }, b: { c: 17, r: 15 }, period: 5, on: 2.6 },
    ],
    // Laser endpoints sit on wall tiles: row 9 col 6 is '#', row 0 is all '#',
    // row 15 is all '#', and row 9 col 17 is '#'.
  },
  {
    name: 'THE ROYAL OBSERVATORY',
    sub: 'Heist 5 · lift the Star Seal',
    palette: {
      floor: '#101a33', floorAlt: '#0d1529', wall: '#1e2c52', wallEdge: '#7cc4ff',
      lamp: '#9fd8ff', accent: '#7cc4ff', grass: '#2c5d6b', cone: 'rgba(124,196,255,0.18)',
      coneHot: 'rgba(239,68,68,0.30)', camera: 'rgba(239,120,68,0.22)',
    },
    coins: 6, smoke: 3, par: 150,
    grid: [
      '########################',
      '#P..l.....#.....o...G..#',
      '#...g.....#..c..#......#',
      '#...g..G..#.....#..l...#',
      '#...g.....#..o..#..K...#',
      '#..l...####..####......#',
      '#.......#......#...*...#',
      '#..o....#..G...#.......#',
      '#.......#......#...l...#',
      '###.#######..####.######',
      '#K.....#.....#....o....#',
      '#..l...#..G..#....G....#',
      '#....G.#.....#....l....#',
      '#..o...#..c..#....o..K.#',
      '#..l...G.....#.....X...#',
      '########################',
    ],
    guards: [
      { spawn: { c: 20, r: 1 }, waypoints: [{ c: 20, r: 1 }, { c: 16, r: 1 }, { c: 18, r: 3 }] },
      { spawn: { c: 8, r: 3 }, waypoints: [{ c: 8, r: 3 }, { c: 11, r: 3 }, { c: 11, r: 1 }] },
      { spawn: { c: 12, r: 7 }, waypoints: [{ c: 12, r: 7 }, { c: 14, r: 7 }, { c: 12, r: 5 }] },
      { spawn: { c: 12, r: 11 }, waypoints: [{ c: 12, r: 11 }, { c: 15, r: 11 }, { c: 15, r: 13 }] },
      { spawn: { c: 20, r: 11 }, waypoints: [{ c: 20, r: 11 }, { c: 20, r: 13 }, { c: 17, r: 13 }] },
      { spawn: { c: 8, r: 14 }, waypoints: [{ c: 8, r: 14 }, { c: 12, r: 14 }, { c: 12, r: 12 }] },
      { spawn: { c: 5, r: 12 }, waypoints: [{ c: 5, r: 12 }, { c: 5, r: 10 }, { c: 8, r: 10 }] },
    ],
    cameras: [
      { tile: { c: 19, r: 4 }, baseDir: Math.PI, sweep: 1.0, range: 210, speed: 0.7 },
      { tile: { c: 21, r: 13 }, baseDir: Math.PI, sweep: 1.0, range: 210, speed: 0.8 },
      { tile: { c: 1, r: 10 }, baseDir: 0, sweep: 1.0, range: 210, speed: 0.7 },
    ],
    lasers: [
      { a: { c: 8, r: 9 }, b: { c: 8, r: 0 }, period: 4, on: 2.2 },
      { a: { c: 17, r: 0 }, b: { c: 17, r: 15 }, period: 5, on: 2.6 },
    ],
  },
];

const SOLID = new Set(['#', 'c', 'K']);

export function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= level.cols || row >= level.rows) return '#';
  return level.grid[row][col];
}

export function isSolid(level, col, row) {
  return SOLID.has(tileAt(level, col, row));
}

// Parse one heist definition into a playable level (pixel coordinates).
export function parseLevel(def) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const level = {
    def, grid: def.grid, cols, rows,
    playerStart: null, exit: null, seal: null,
    loot: [], lamps: [],
    guards: def.guards.map((g) => ({ spawn: g.spawn, waypoints: g.waypoints })),
    cameras: def.cameras.map((c) => ({ ...c })),
    lasers: def.lasers.map((l) => ({ ...l })),
  };
  const center = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = def.grid[r][c];
      if (ch === 'P') level.playerStart = center(c, r);
      else if (ch === 'X') level.exit = center(c, r);
      else if (ch === '*') level.seal = { ...center(c, r), taken: false };
      else if (ch === 'o') level.loot.push({ ...center(c, r), taken: false });
      else if (ch === 'l') level.lamps.push({ ...center(c, r), doused: false });
    }
  }
  return level;
}
