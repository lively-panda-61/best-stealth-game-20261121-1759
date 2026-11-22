# THE BRASS CROW — architecture

A top-down stealth game: five heists by gaslight. The player learns warden
patrols, slips through vision cones, throws coins to pull guards off their
route, smokes cameras, douses lamps, lifts each heist's seal and reaches the
green exit unseen. Static files only — no build step, no network requests.

## Layout

- `main.ts` — the entry program. Copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
  It empties the output directory's contents but never removes the
  directory itself.
- `serve.ts` — a tiny static server for `game/` (development only).
- `game/index.html` — the page: a 1280×720 canvas plus a live status region.
- `game/src/main.js` — boot and the animation loop; reads the URL params
  (`?heist=`, `?seed=`, `?shot=`, `?notes=`); exposes `window.__crowGame`
  for the playtest.
- `game/src/game.js` — the rules: heist state, win/caught/strikes, score,
  alarm, loot and seal pickup, lockdown, next-heist banking.
- `game/src/levels.js` — the five heist maps (24×16 tile grids), palettes,
  and the parser (`parseLevel`, `tileAt`, `isSolid`).
- `game/src/vision.js` — line of sight, vision-cone polygons, point-in-cone
  tests, lamplight levels, tall grass.
- `game/src/guards.js` — warden AI: patrol → suspicious → alert → search,
  hearing, and substepped movement that cannot tunnel through walls.
- `game/src/player.js` — walk / sneak / sprint speeds and noise radius.
- `game/src/gadgets.js` — coins (thrown, clink pulls guards), smoke vials
  (blind cones and cameras), dousing a lamp (make darkness).
- `game/src/hazards.js` — sweeping cameras and pulsing lasers.
- `game/src/render.js` — everything drawn: field, cones, lamplight, HUD
  (top bar, right panel, bottom strip), field notes, and overlays.
- `game/src/input.js` — keyboard and click handling.
- `game/src/audio.js` — procedural WebAudio: footsteps panned by guard
  position, pickups, alerts, gadget and win/caught sounds.
- `vendor/makefun-game.ts` — the make.fun library, copied from the kit
  starter unchanged.
- `tests/unit.test.js` — 40 unit checks (levels, vision, guards, gadgets,
  hazards, game flow).
- `tests/playtest.mjs` — Playwright: boot, movement, detection, win/caught,
  zero console/network errors, and the four screenshots.

## The five heists

1. THE OLD MINT — 3 wardens, 4 loot.
2. THE GLASSHOUSE — 4 wardens, 6 loot, 1 camera.
3. THE GRAND HOTEL — 5 wardens, 6 loot, 2 cameras.
4. THE OPERA HOUSE — 6 wardens, 5 loot, 2 cameras, 2 lasers.
5. THE ROYAL OBSERVATORY — 7 wardens, 6 loot, 3 cameras, 2 lasers.

25 wardens and 27 loot in all. Each heist allows 3 strikes: being caught
respawns the thief at the start keeping lifted loot, the seal and the score;
the third strike fails the heist. A heist finished without ever being spotted
pays a $500 ghost bonus.
