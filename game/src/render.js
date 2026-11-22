// Canvas renderer for SHADOW PROTOCOL.
// Top-down view: tiled floor, raised walls, shadow zones and bushes, guards
// with raycast-clipped vision cones, a lit player in the dark, and full
// title / win / caught screens. Everything is drawn from the game state;
// no image assets are loaded.

import { VISION_RANGE, VISION_HALF_FOV } from './guard.js';
import { TILE } from './level.js';

const CONE_COLORS = {
  patrol: '245, 185, 66',
  suspicious: '245, 133, 60',
  alert: '239, 68, 68',
  search: '245, 133, 60',
};

function pointInWall(x, y, walls) {
  for (const w of walls) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  }
  return false;
}

// Raycast the guard's vision cone against the walls: 26 rays, each stopping
// at the first wall it hits, so the cone hugs corners like real light.
export function conePolygon(guard, level) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = 26;
  for (let i = 0; i <= rays; i++) {
    const a = guard.dir - VISION_HALF_FOV + (2 * VISION_HALF_FOV * i) / rays;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    let d = VISION_RANGE;
    for (let r = 14; r <= VISION_RANGE; r += 8) {
      if (pointInWall(guard.x + cos * r, guard.y + sin * r, level.walls)) {
        d = r;
        break;
      }
    }
    points.push({ x: guard.x + cos * d, y: guard.y + sin * d });
  }
  return points;
}

function drawCone(ctx, guard, level) {
  const color = CONE_COLORS[guard.state] || CONE_COLORS.patrol;
  const points = conePolygon(guard, level);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = `rgba(${color}, 0.30)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${color}, 0.55)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFloor(ctx, level) {
  ctx.fillStyle = '#12161f';
  ctx.fillRect(0, 0, level.width, level.height);
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = 0; tx < level.cols; tx++) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = '#161b26';
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= level.width; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, level.height);
    ctx.stroke();
  }
  for (let y = 0; y <= level.height; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(level.width, y);
    ctx.stroke();
  }
}

function drawZones(ctx, level) {
  for (const s of level.shadows) {
    ctx.fillStyle = 'rgba(8, 12, 28, 0.55)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(90, 120, 200, 0.25)';
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  }
  for (const b of level.bushes) {
    ctx.fillStyle = '#16301f';
    ctx.beginPath();
    ctx.arc(b.x + 12, b.y + 14, 11, 0, Math.PI * 2);
    ctx.arc(b.x + 28, b.y + 10, 12, 0, Math.PI * 2);
    ctx.arc(b.x + 20, b.y + 28, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e4a2b';
    ctx.beginPath();
    ctx.arc(b.x + 14, b.y + 12, 5, 0, Math.PI * 2);
    ctx.arc(b.x + 28, b.y + 24, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, level, time, allCores) {
  const e = level.exit;
  const pulse = 0.5 + 0.3 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.35;
  ctx.fillStyle = allCores ? '#43d17c' : '#5a6b52';
  ctx.beginPath();
  ctx.arc(e.x, e.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = allCores ? '#43d17c' : '#7a8a72';
  ctx.fillRect(e.x - 14, e.y - 16, 28, 32);
  ctx.fillStyle = '#0d1a12';
  ctx.fillRect(e.x - 8, e.y - 10, 16, 20);
  ctx.fillStyle = allCores ? '#b8ffd4' : '#9aa89a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(allCores ? 'EXIT' : 'LOCK', e.x, e.y - 26);
}

function drawCores(ctx, level, time) {
  for (const core of level.cores) {
    if (core.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4 + core.x);
    ctx.save();
    ctx.translate(core.x, core.y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.fillStyle = '#37e0d8';
    ctx.fillRect(-14, -14, 28, 28);
    ctx.restore();
    ctx.save();
    ctx.translate(core.x, core.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#a5fffa';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

function drawWalls(ctx, level) {
  for (const w of level.walls) {
    ctx.fillStyle = '#2c3444';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#3d4a61';
    ctx.fillRect(w.x, w.y, w.w, 5);
    ctx.fillStyle = '#232a38';
    ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
  }
}

function drawGuard(ctx, guard, time) {
  const color =
    guard.state === 'alert' ? '#ef4444' : guard.state === 'patrol' ? '#f5b942' : '#f5853c';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, guard.radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#1a1206';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.dir) * (guard.radius + 7), guard.y + Math.sin(guard.dir) * (guard.radius + 7));
  ctx.strokeStyle = '#fff7e0';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Detection meter arc over the guard.
  if (guard.meter > 0.02) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.radius + 8, -Math.PI / 2, -Math.PI / 2 + guard.meter * Math.PI * 2);
    ctx.strokeStyle = guard.meter >= 1 ? '#ef4444' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // State marker.
  if (guard.state === 'suspicious' || guard.state === 'search') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', guard.x, guard.y - guard.radius - 12);
  } else if (guard.state === 'alert') {
    const bob = Math.sin(time * 10) * 2;
    ctx.fillStyle = '#ff5b5b';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', guard.x, guard.y - guard.radius - 12 + bob);
  }
}

function drawPlayer(ctx, player, time) {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(45, 212, 191, 0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2dd4bf';
  ctx.fill();
  ctx.strokeStyle = '#0b3b35';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hood point in the facing direction.
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.dir) * 4, player.y + Math.sin(player.dir) * 4);
  ctx.lineTo(player.x + Math.cos(player.dir) * (player.radius + 6), player.y + Math.sin(player.dir) * (player.radius + 6));
  ctx.strokeStyle = '#e6fffa';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Sneak ripple.
  if (player.sneaking && player.moving) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 8 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawDarkness(ctx, level, player) {
  const gradient = ctx.createRadialGradient(
    player.x, player.y, 70,
    player.x, player.y, 330,
  );
  gradient.addColorStop(0, 'rgba(4, 6, 12, 0)');
  gradient.addColorStop(0.55, 'rgba(4, 6, 12, 0.34)');
  gradient.addColorStop(1, 'rgba(4, 6, 12, 0.52)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, level.width, level.height);
}

function drawAlertVignette(ctx, level, alertLevel) {
  if (alertLevel <= 0.02) return;
  const gradient = ctx.createRadialGradient(
    level.width / 2, level.height / 2, level.height * 0.35,
    level.width / 2, level.height / 2, level.height * 0.75,
  );
  gradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
  gradient.addColorStop(1, `rgba(239, 68, 68, ${0.35 * alertLevel})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, level.width, level.height);
}

function drawPanel(ctx, level, lines, accent) {
  const w = 560;
  const h = 92 + lines.length * 26;
  const x = (level.width - w) / 2;
  const y = (level.height - h) / 2;
  ctx.fillStyle = 'rgba(8, 11, 18, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  return { x, y, w, h };
}

export function render(ctx, game) {
  const { level, player } = game;
  ctx.clearRect(0, 0, level.width, level.height);
  drawFloor(ctx, level);
  drawZones(ctx, level);
  const allCores = game.coresCollected >= level.cores.length;
  drawExit(ctx, level, game.time, allCores);
  drawCores(ctx, level, game.time);
  drawWalls(ctx, level);
  // Cones shine through the darkness, so they are drawn after it.
  drawDarkness(ctx, level, player);
  for (const guard of game.guards) drawCone(ctx, guard, level);
  for (const guard of game.guards) drawGuard(ctx, guard, game.time);
  drawPlayer(ctx, player, game.time);
  drawAlertVignette(ctx, level, game.alertLevel);

  if (game.state === 'title') {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
    ctx.fillRect(0, 0, level.width, level.height);
    const panel = drawPanel(ctx, level, ['', '', '', '', ''], '#2dd4bf');
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText('SHADOW PROTOCOL', level.width / 2, panel.y + 52);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Level ${game.levelIndex + 1}: ${level.name} — ${level.briefing}`, level.width / 2, panel.y + 96);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('WASD / arrows to move · Shift to sneak · click to walk there', level.width / 2, panel.y + 126);
    ctx.fillText('Lift every data core, then reach the exit unseen.', level.width / 2, panel.y + 152);
    ctx.fillStyle = '#f5b942';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText('Press Enter to begin', level.width / 2, panel.y + 186);
  } else if (game.state === 'won') {
    ctx.fillStyle = 'rgba(4, 12, 8, 0.55)';
    ctx.fillRect(0, 0, level.width, level.height);
    const panel = drawPanel(ctx, level, ['', '', ''], '#43d17c');
    ctx.fillStyle = '#43d17c';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText('EXTRACTION COMPLETE', level.width / 2, panel.y + 52);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px system-ui, sans-serif';
    const last = game.levelIndex >= 2;
    ctx.fillText(
      `${level.cores.length} cores lifted in ${game.time.toFixed(1)}s — unseen.`,
      level.width / 2,
      panel.y + 96,
    );
    ctx.fillStyle = '#f5b942';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(
      last ? 'All levels cleared — press R to play again' : 'Press Enter for the next level',
      level.width / 2,
      panel.y + 130,
    );
  } else if (game.state === 'caught') {
    ctx.fillStyle = 'rgba(12, 4, 4, 0.55)';
    ctx.fillRect(0, 0, level.width, level.height);
    const panel = drawPanel(ctx, level, ['', '', ''], '#ef4444');
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('CAUGHT', level.width / 2, panel.y + 52);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('A guard closed in while the alarm was up.', level.width / 2, panel.y + 96);
    ctx.fillStyle = '#f5b942';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText('Press R to retry this level', level.width / 2, panel.y + 130);
  }
}
