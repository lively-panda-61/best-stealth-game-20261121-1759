// The thief's three gadgets for THE BRASS CROW.
// Coins: thrown at a spot, they clink and pull nearby guards to investigate.
// Smoke vials: a cloud that blinds every cone and camera inside it.
// Lantern douse: snuff the nearest lit lamp to make a pocket of darkness.
import { lightAt } from './vision.js';

export const COIN_NOISE_RADIUS = 200;
export const SMOKE_RADIUS = 90;
export const SMOKE_DURATION = 3;
export const DOUSE_RANGE = 70;

// Throw a coin at (tx, ty). Returns the thrown coin or null when out of coins.
export function throwCoin(game, tx, ty) {
  if (game.player.coins <= 0) return null;
  game.player.coins -= 1;
  const coin = { x: tx, y: ty, noiseR: COIN_NOISE_RADIUS, t: 0.6 };
  game.coinsThrown.push(coin);
  return coin;
}

// Pop a smoke vial at the thief's feet. Returns false when out of vials.
export function useSmoke(game) {
  if (game.player.smoke <= 0) return false;
  game.player.smoke -= 1;
  game.smokes.push({ x: game.player.x, y: game.player.y, r: SMOKE_RADIUS, t: SMOKE_DURATION });
  return true;
}

// Snuff the nearest lit lamp within reach. Returns true when a lamp went out.
export function douseLamp(game) {
  let best = null, bestD = DOUSE_RANGE;
  for (const lamp of game.level.lamps) {
    if (lamp.doused) continue;
    const d = Math.hypot(lamp.x - game.player.x, lamp.y - game.player.y);
    if (d < bestD) { bestD = d; best = lamp; }
  }
  if (!best) return false;
  best.doused = true;
  return true;
}

// Is a point inside any live smoke cloud?
export function playerInSmoke(game, x, y) {
  for (const s of game.smokes) {
    if (Math.hypot(x - s.x, y - s.y) < s.r) return true;
  }
  return false;
}

export function updateGadgets(game, dt) {
  for (const s of game.smokes) s.t -= dt;
  game.smokes = game.smokes.filter((s) => s.t > 0);
  for (const c of game.coinsThrown) c.t -= dt;
  game.coinsThrown = game.coinsThrown.filter((c) => c.t > 0);
}

export { lightAt };
