// Browser playtest for SHADOW PROTOCOL (TDD, Red phase).
// Serves game/ locally, drives it with Playwright, proves the game loads,
// the player moves, detection works, win/lose trigger, and captures the
// four screenshots that ship in screenshots/.
// Run: node tests/playtest.mjs
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';

// Playwright lives in the shared tools dir, not in this repo (no node_modules
// is committed with the entry).
const { chromium } = await import(
  `${process.env.HOME}/workspace/makefun/tools/pw/node_modules/playwright-core/index.mjs`,
);

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8901;
const SHOTS = [
  { name: '1-start.jpg', url: `/?shot=start&seed=7` },
  { name: '2-play.jpg', url: `/?shot=play&seed=7` },
  { name: '3-alert.jpg', url: `/?shot=alert&seed=7` },
  { name: '4-win.jpg', url: `/?shot=win&seed=7` },
];

function fail(message) {
  console.error(`[playtest] FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  console.log('[playtest] starting static server on port', PORT);
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));
  await new Promise((r) => setTimeout(r, 1200));

  const browser = await chromium.launch({
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
    });

    // 1. The game loads and exposes its debug handle.
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    const boot = await page.evaluate(() => {
      const g = window.__shadowGame;
      return g ? { state: g.state, level: g.levelIndex, title: document.title } : null;
    });
    if (!boot) fail('window.__shadowGame is missing — the game did not boot');
    console.log('[playtest] boot OK:', JSON.stringify(boot));
    if (boot.state !== 'title') fail(`expected title state, got ${boot.state}`);

    // 2. The player moves with the keyboard.
    await page.keyboard.press('Enter'); // title -> playing
    await new Promise((r) => setTimeout(r, 300));
    const before = await page.evaluate(() => window.__shadowGame.player.x);
    await page.keyboard.down('KeyD');
    await new Promise((r) => setTimeout(r, 700));
    await page.keyboard.up('KeyD');
    const after = await page.evaluate(() => window.__shadowGame.player.x);
    console.log(`[playtest] player moved ${before.toFixed(1)} -> ${after.toFixed(1)}`);
    if (!(after > before + 20)) fail('player did not move right with KeyD');

    // 3. Detection: keep the player in front of a guard's cone and watch the meter rise.
    const meter = await page.evaluate(() => {
      const g = window.__shadowGame;
      const guard = g.guards[0];
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          g.player.x = guard.x + Math.cos(guard.dir) * 120;
          g.player.y = guard.y + Math.sin(guard.dir) * 120;
          g.player.sneaking = false;
          g.player.moving = true;
        }, 100);
        setTimeout(() => {
          clearInterval(timer);
          resolve(window.__shadowGame.guards[0].meter);
        }, 1500);
      });
    });
    console.log('[playtest] guard meter after exposure:', meter.toFixed(2));
    if (!(meter > 0.2)) fail('guard detection meter did not rise when the player stood in its cone');

    // 4. Win and lose states are reachable through the debug hooks.
    const winState = await page.evaluate(() => {
      const g = window.__shadowGame;
      g.restart(); // fresh patrol state: no alert guard can interfere
      for (const c of g.level.cores) { g.player.x = c.x; g.player.y = c.y; g.tick(0.1); }
      g.player.x = g.level.exit.x; g.player.y = g.level.exit.y; g.tick(0.1);
      return g.state;
    });
    if (winState !== 'won') fail(`expected won state, got ${winState}`);
    console.log('[playtest] win state OK');
    const loseState = await page.evaluate(() => {
      const g = window.__shadowGame;
      g.restart();
      const guard = g.guards[0];
      guard.state = 'alert';
      guard.x = g.player.x + 5; guard.y = g.player.y;
      g.tick(0.1);
      return g.state;
    });
    if (loseState !== 'caught') fail(`expected caught state, got ${loseState}`);
    console.log('[playtest] caught state OK');

    // 5. No console errors and no failed requests during play.
    if (errors.length > 0) fail(`console/network errors: ${errors.join(' | ')}`);
    console.log('[playtest] no console or network errors');

    // 6. Deterministic staged screenshots (real renders of the game's own code).
    for (const shot of SHOTS) {
      await page.goto(`http://localhost:${PORT}${shot.url}`, { waitUntil: 'networkidle' });
      await new Promise((r) => setTimeout(r, 700));
      const path = `${ROOT}screenshots/${shot.name}`;
      await page.screenshot({ path, type: 'jpeg', quality: 82 });
      const bytes = statSync(path).size;
      console.log(`[playtest] shot ${shot.name}: ${bytes} bytes`);
      if (bytes > 262144) fail(`${shot.name} is ${bytes} bytes, over the 256 KiB gate cap`);
    }
    console.log('[playtest] ALL PLAYTEST CHECKS PASSED');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('[playtest] crashed:', err.message);
  process.exit(1);
});
