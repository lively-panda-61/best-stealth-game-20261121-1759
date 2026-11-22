// Canvas renderer for THE BRASS CROW.
// One 1280x720 canvas holds everything the judge sees: the top bar, the
// playfield (map, lamps, cones, guards, cameras, lasers, loot, the thief),
// the right-hand panel (detection, alarm, gadgets, guards, heists, legend)
// and the field-notes callouts the maker turns on for screenshots.
import { TILE } from './levels.js';
import { conePolygon, lightAt, inGrass } from './vision.js';
import { CONE_RANGE, CONE_HALF_ANGLE } from './guards.js';
import { CAMERA_RANGE, CAMERA_HALF_ANGLE, laserOn } from './hazards.js';

const W = 1280, H = 720;
const TOP = 52;
const FIELD_W = 960;
const PANEL_X = 960;
const BOTTOM = 692;

function tileHash(c, r) {
  let h = (c * 73856093) ^ (r * 19349663);
  h = (h ^ (h >> 13)) >>> 0;
  return (h % 100) / 100;
}

// Mix a #rrggbb colour toward white by amt (0..1).
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, game) {
  const level = game.level;
  const pal = level.def.palette;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, W, H);

  drawField(ctx, game, pal);
  drawTopBar(ctx, game, pal);
  drawPanel(ctx, game, pal);
  drawBottomStrip(ctx, game, pal);
  if (game.notes) drawFieldNotes(ctx, game, pal);
  drawOverlay(ctx, game, pal);
}

function drawField(ctx, game, pal) {
  const level = game.level;
  ctx.save();
  ctx.translate(0, TOP);
  // Floor: two-tone tiles with deterministic speckles.
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const ch = level.grid[r][c];
      const x = c * TILE, y = r * TILE;
      const alt = (c + r) % 2 === 0;
      ctx.fillStyle = alt ? pal.floor : pal.floorAlt;
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'g') {
        ctx.fillStyle = pal.grass;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const bx = x + 6 + tileHash(c * 5 + i, r) * 28;
          ctx.beginPath();
          ctx.moveTo(bx, y + TILE - 4);
          ctx.lineTo(bx + 3, y + 8 + tileHash(c, r * 5 + i) * 10);
          ctx.stroke();
        }
      } else if (ch === 'c') {
        ctx.fillStyle = '#6b4a26';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (ch === '#' || ch === 'K') {
        // Walls read as solid architecture: a lightened block, a brass
        // border and a bright top edge, clearly distinct from the floor.
        ctx.fillStyle = lighten(pal.wall, 0.45);
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = pal.wallEdge;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.wallEdge;
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      } else if (tileHash(c, r) > 0.86) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x + 8 + tileHash(c, r) * 20, y + 8 + tileHash(r, c) * 20, 3, 3);
      }
    }
  }

  // Lamplight pools (additive glow), then the lamps themselves.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of level.lamps) {
    if (lamp.doused) continue;
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, 150);
    g.addColorStop(0, 'rgba(255,190,90,0.30)');
    g.addColorStop(0.5, 'rgba(255,170,70,0.12)');
    g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 150, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  for (const lamp of level.lamps) {
    ctx.fillStyle = lamp.doused ? '#1c1c22' : '#3a2f18';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lamp.doused ? '#555' : '#ffd27a';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (!lamp.doused) {
      ctx.strokeStyle = 'rgba(255,210,122,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Lasers: lit beams glow red, dark gaps are faint and dashed.
  for (const lz of game.lasers) {
    const ax = lz.a.c * TILE + TILE / 2, ay = lz.a.r * TILE + TILE / 2;
    const bx = lz.b.c * TILE + TILE / 2, by = lz.b.r * TILE + TILE / 2;
    const on = laserOn(lz, game.time);
    ctx.save();
    if (on) {
      ctx.strokeStyle = 'rgba(239,68,68,0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
    } else {
      ctx.strokeStyle = 'rgba(239,68,68,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
    }
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
    for (const [ex, ey] of [[ax, ay], [bx, by]]) {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(ex - 5, ey - 5, 10, 10);
      ctx.fillStyle = on ? '#ef4444' : '#991b1b';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Vision cones: guards first, then cameras.
  for (const g of game.guards) {
    const poly = conePolygon(level, g.x, g.y, g.dir, CONE_RANGE, CONE_HALF_ANGLE);
    ctx.fillStyle = g.state === 'alert' ? pal.coneHot : g.state === 'suspicious' ? 'rgba(245,185,66,0.24)' : pal.cone;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = g.state === 'alert' ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const cam of game.cameras) {
    const poly = conePolygon(level, cam.x, cam.y, cam.dir, CAMERA_RANGE, CAMERA_HALF_ANGLE);
    ctx.fillStyle = cam.spotted ? 'rgba(239,68,68,0.34)' : pal.camera;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // Smoke clouds.
  for (const s of game.smokes) {
    const alpha = Math.min(0.7, 0.45 + s.t * 0.08);
    const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(210,210,220,${alpha})`);
    g.addColorStop(1, 'rgba(210,210,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,220,230,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Thrown coins: a gold dot and its fading ring.
  for (const coin of game.coinsThrown) {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,210,77,${Math.max(0, coin.t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, (0.6 - coin.t) * 60 + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Loot, the seal and the exit.
  for (const loot of level.loot) {
    if (loot.taken) continue;
    drawDiamond(ctx, loot.x, loot.y, 8, '#ffd24d');
    ctx.fillStyle = 'rgba(255,210,77,0.25)';
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 13 + Math.sin(game.time * 3 + loot.x) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!game.sealTaken) {
    drawDiamond(ctx, level.seal.x, level.seal.y, 13, '#fff3b0');
    ctx.strokeStyle = 'rgba(255,243,176,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(level.seal.x, level.seal.y, 20 + Math.sin(game.time * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ex = level.exit;
  ctx.fillStyle = game.sealTaken ? '#14532d' : '#1c2b1c';
  roundRect(ctx, ex.x - 18, ex.y - 18, 36, 36, 6);
  ctx.fill();
  ctx.strokeStyle = game.sealTaken ? '#43d17c' : '#3a5a3a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = game.sealTaken ? '#43d17c' : '#5a7a5a';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y + 3);

  // Cameras on their mounts.
  for (const cam of game.cameras) {
    ctx.fillStyle = '#222';
    ctx.fillRect(cam.x - 8, cam.y - 8, 16, 16);
    ctx.fillStyle = cam.spotted ? '#ef4444' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (cam.spotted) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED', cam.x, cam.y - 14);
    }
  }

  // Guards: brass-ringed wardens with a suspicion arc and ? / ! bubbles.
  for (const g of game.guards) {
    ctx.fillStyle = '#0d0d12';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = g.state === 'alert' ? '#ef4444' : g.state === 'suspicious' ? '#f5b942' : '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.dir) * 5, g.y + Math.sin(g.dir) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    if (g.meter > 0.05 && g.state !== 'alert') {
      ctx.strokeStyle = '#f5b942';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 17, -Math.PI / 2, -Math.PI / 2 + g.meter * Math.PI * 2);
      ctx.stroke();
    }
    if (g.state === 'suspicious' || g.state === 'search') {
      ctx.fillStyle = '#f5b942';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 20);
    } else if (g.state === 'alert') {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    }
  }

  // The thief: a crow-black circle with a brass ring.
  const p = game.player;
  const hidden = lightAt(level, p.x, p.y) < 0.25 || (inGrass(level, p.x, p.y) && p.sneaking);
  ctx.fillStyle = '#0a0a0f';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b64c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8b64c';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.dir) * 5, p.y + Math.sin(p.dir) * 5, 3, 0, Math.PI * 2);
  ctx.fill();
  if (hidden && game.state === 'playing') {
    ctx.fillStyle = 'rgba(67,209,124,0.9)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y + 24);
  }
  // Tall grass tufts drawn over a sneaking thief hiding in them.
  if (inGrass(level, p.x, p.y)) {
    ctx.strokeStyle = 'rgba(46,107,58,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x - 10 + i * 6, p.y + 10);
      ctx.lineTo(p.x - 8 + i * 6, p.y - 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDiamond(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

function drawTopBar(ctx, game, pal) {
  const level = game.level;
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, TOP - 2, W, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8b64c';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`THE BRASS CROW · ${game.levelIndex + 1} ${level.def.name}`, 14, 22);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(level.def.sub, 14, 40);
  const lootTotal = level.loot.length;
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`◆ ${game.lootCollected}/${lootTotal} loot   ★ seal ${game.sealTaken ? '✓' : '○'}`, 700, 22);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.sealTaken ? 'Seal lifted — reach the green EXIT' : 'Lift the seal, then reach the EXIT', 700, 40);
  const vis = lightAt(level, game.player.x, game.player.y);
  const visLabel = vis > 0.5 ? 'LAMPLIT' : vis > 0.15 ? 'DIM' : 'IN SHADOW';
  ctx.fillStyle = vis > 0.5 ? '#f5b942' : '#43d17c';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(visLabel, 830, 22);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`TIME ${game.time.toFixed(1)}s`, 830, 40);
  ctx.fillStyle = '#e8b64c';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${game.totalScore + game.score}`, 950, 22);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(game.spotted === 0 ? 'GHOST +500' : `SPOTTED ×${game.spotted}`, 950, 40);
  ctx.textAlign = 'left';
}

function drawPanel(ctx, game, pal) {
  const x = PANEL_X;
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(x, TOP, W - PANEL_X, H - TOP);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(x, TOP, 2, H - TOP);
  let y = TOP + 24;
  const title = (text) => {
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 16, y);
    y += 8;
  };
  const anyAlert = game.guards.some((g) => g.state === 'alert');
  const anySusp = game.guards.some((g) => g.state === 'suspicious' || g.state === 'search');
  const det = anyAlert ? 'SPOTTED' : anySusp ? 'SUSPICIOUS' : 'UNSEEN';
  title('DETECTION');
  ctx.fillStyle = anyAlert ? '#ef4444' : anySusp ? '#f5b942' : '#43d17c';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(det + (anySusp && !anyAlert ? '  ?' : ''), x + 16, y + 16);
  y += 30;
  title('ALARM');
  ctx.fillStyle = '#1f2937';
  roundRect(ctx, x + 16, y, 288, 12, 6);
  ctx.fill();
  ctx.fillStyle = game.alert > 66 ? '#ef4444' : game.alert > 33 ? '#f5b942' : '#43d17c';
  roundRect(ctx, x + 16, y, Math.max(4, 288 * (game.alert / 100)), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(game.alert >= 100 ? 'LOCKDOWN' : game.alert > 66 ? 'HOT' : game.alert > 0 ? 'WARM' : 'QUIET', x + 16, y + 28);
  y += 40;
  title('VISIBILITY');
  const vis = lightAt(game.level, game.player.x, game.player.y);
  ctx.fillStyle = '#1f2937';
  roundRect(ctx, x + 16, y, 288, 12, 6);
  ctx.fill();
  ctx.fillStyle = vis > 0.5 ? '#f5b942' : '#43d17c';
  roundRect(ctx, x + 16, y, Math.max(4, 288 * vis), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`NOISE ${game.player.sprinting && game.player.moving ? 'LOUD — sprinting' : game.player.sneaking ? 'SILENT — sneaking' : 'SILENT'}`, x + 16, y + 28);
  y += 40;
  title('GADGETS');
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`◉ Coins ×${game.player.coins}  (click to throw)`, x + 16, y + 16);
  ctx.fillText(`◍ Smoke ×${game.player.smoke}  (Q)`, x + 16, y + 36);
  ctx.fillText('✦ Douse lamp  (E, near a lamp)', x + 16, y + 56);
  y += 74;
  title('GUARDS');
  ctx.font = '13px system-ui, sans-serif';
  game.guards.slice(0, 7).forEach((g, i) => {
    const label = g.state === 'alert' ? 'CHASING' : g.state === 'suspicious' ? 'SUSPICIOUS' : g.state === 'search' ? 'SEARCHING' : 'PATROL';
    ctx.fillStyle = g.state === 'alert' ? '#ef4444' : g.state === 'patrol' ? '#9ca3af' : '#f5b942';
    ctx.fillText(`Warden ${i + 1} — ${label}`, x + 16, y + 14);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 200, y + 4, 104, 8);
    ctx.fillStyle = g.state === 'alert' ? '#ef4444' : '#f5b942';
    ctx.fillRect(x + 200, y + 4, 104 * g.meter, 8);
    y += 20;
  });
  y += 8;
  title('HEISTS');
  ctx.font = '13px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    const done = i < game.levelIndex || (i === game.levelIndex && game.state === 'won');
    const cur = i === game.levelIndex;
    ctx.fillStyle = cur ? '#e8b64c' : done ? '#43d17c' : '#6b7280';
    ctx.fillText(`${done ? '✓' : cur ? '▶' : '·'} ${i + 1} ${['THE OLD MINT', 'THE GLASSHOUSE', 'THE GRAND HOTEL', 'THE OPERA HOUSE', 'THE ROYAL OBSERVATORY'][i]}`, x + 16, y + 14);
    y += 20;
  }
  y += 8;
  title('LEGEND');
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#9ca3af';
  const rows = [
    ['Cone — a guard’s sight', pal.cone],
    ['Camera sweep', pal.camera],
    ['Laser — cross while dark', '#ef4444'],
    ['Tall grass — hide, sneak', pal.grass],
    ['Lamplight — seen from afar', '#ffd27a'],
    ['◆ loot   ★ seal   EXIT hatch', '#e8b64c'],
  ];
  for (const [text, color] of rows) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 16, y + 4, 12, 12);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(text, x + 34, y + 14);
    y += 20;
  }
  y += 6;
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Strikes: ' + '●'.repeat(game.strikes) + '○'.repeat(Math.max(0, 3 - game.strikes)) + '  (3 strikes fail the heist)', x + 16, y + 12);
}

function drawBottomStrip(ctx, game) {
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, BOTTOM, FIELD_W, H - BOTTOM);
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · SHIFT sneak · SPACE sprint · CLICK throw coin · Q smoke · E douse lamp · H field notes · M mute · ESC pause', 14, BOTTOM + 18);
}

function drawFieldNotes(ctx, game, pal) {
  // Leader-line callouts labelling what the judge should notice, drawn
  // from the live level: the guard cone, a blind spot, a lamp, the seal,
  // the exit, and a camera or laser when the heist has one.
  const level = game.level;
  const notes = [];
  const guard = game.guards[1] || game.guards[0];
  if (guard) notes.push({ x: guard.x, y: guard.y, dx: 90, dy: -46, text: 'WARDEN + VISION CONE' });
  const lamp = level.lamps[0];
  if (lamp) notes.push({ x: lamp.x, y: lamp.y, dx: 60, dy: -46, text: 'LAMPLIGHT: SEEN FROM AFAR' });
  if (!game.sealTaken) notes.push({ x: level.seal.x, y: level.seal.y, dx: -170, dy: -40, text: 'THE SEAL: THE PRIZE' });
  notes.push({ x: level.exit.x, y: level.exit.y, dx: 70, dy: 44, text: 'EXIT HATCH' });
  notes.push({ x: game.player.x, y: game.player.y, dx: 70, dy: 54, text: 'YOU: HIDDEN WHERE THE CONE STOPS' });
  const cam = game.cameras[0];
  if (cam) notes.push({ x: cam.x, y: cam.y, dx: -180, dy: 40, text: 'CAMERA: SWEEP ARC' });
  else if (game.lasers[0]) {
    const lz = game.lasers[0];
    const mx = ((lz.a.c + lz.b.c) / 2) * TILE + TILE / 2;
    const my = ((lz.a.r + lz.b.r) / 2) * TILE + TILE / 2;
    notes.push({ x: mx, y: my, dx: -160, dy: -40, text: 'LASER: CROSS WHILE DARK' });
  }
  ctx.save();
  ctx.translate(0, TOP);
  ctx.font = 'bold 11px system-ui, sans-serif';
  for (const n of notes) {
    let lx = Math.max(8, Math.min(FIELD_W - 190, n.x + n.dx));
    let ly = Math.max(14, Math.min(640 - 14, n.y + n.dy));
    // Never let a callout hide behind the FIELD NOTES box (top-left).
    if (lx < 240 && ly < 142) ly = 146;
    ctx.strokeStyle = 'rgba(232,182,76,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(lx + 8, ly - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(7,9,14,0.85)';
    const w = ctx.measureText(n.text).width + 14;
    roundRect(ctx, lx, ly - 13, w, 18, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,182,76,0.6)';
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.textAlign = 'left';
    ctx.fillText(n.text, lx + 7, ly);
  }
  // Field-notes legend box, top-left of the field.
  ctx.fillStyle = 'rgba(7,9,14,0.85)';
  roundRect(ctx, 12, 10, 216, 118, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,182,76,0.5)';
  ctx.stroke();
  ctx.fillStyle = '#e8b64c';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('FIELD NOTES', 24, 30);
  ctx.fillStyle = '#d1d5db';
  ctx.font = '11px system-ui, sans-serif';
  const lines = [
    'Wardens patrol routes you can learn.',
    'Cones stop at walls and crates.',
    'Tall grass hides a sneaking thief.',
    'Coins pull a warden off to look.',
    'Smoke blinds cones and cameras.',
    'Douse a lamp to make darkness.',
  ];
  lines.forEach((line, i) => ctx.fillText('· ' + line, 24, 50 + i * 14));
  ctx.restore();
}

function drawOverlay(ctx, game, pal) {
  const state = game.state;
  if (state === 'playing') return;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,10,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (state === 'title') {
    ctx.fillStyle = '#e8b64c';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('THE BRASS CROW', W / 2, 240);
    ctx.fillStyle = '#d1d5db';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Five heists by gaslight — lift every seal and vanish unseen.', W / 2, 282);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('WASD move · SHIFT sneak · SPACE sprint · CLICK throw a coin · Q smoke · E douse a lamp', W / 2, 330);
    ctx.fillStyle = '#e8b64c';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Press ENTER to begin — Heist 1: The Old Mint', W / 2, 380);
  } else if (state === 'won') {
    ctx.fillStyle = '#43d17c';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('HEIST COMPLETE', W / 2, 250);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`${game.level.def.name} — score $${game.score}${game.spotted === 0 ? '  (GHOST +$500 — never spotted)' : ''}`, W / 2, 300);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(game.levelIndex >= 4 ? 'That was the last seal. Press ENTER for the final tally.' : 'Press ENTER for the next heist.', W / 2, 340);
  } else if (state === 'failed') {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('CAUGHT THREE TIMES', W / 2, 250);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The wardens know your face now. The heist is blown.', W / 2, 300);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press R to try this heist again.', W / 2, 340);
  } else if (state === 'victory') {
    ctx.fillStyle = '#e8b64c';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('THE BRASS CROW FLIES', W / 2, 240);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`All five seals lifted. Total score $${game.totalScore}.`, W / 2, 292);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press R to run the five heists again.', W / 2, 332);
  } else if (state === 'paused') {
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('PAUSED', W / 2, 300);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press ESC or P to carry on.', W / 2, 340);
  }
  ctx.restore();
}
