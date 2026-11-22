# SHADOW PROTOCOL — architecture notes

## Idea

A top-down stealth game in the browser, built for make.fun's "Make the best
stealth game" bounty. You are Wren, an infiltrator lifting data cores from a
corporate vault complex. The whole game is static files under `game/` — no
build step, no network request, no assets: all art is canvas vector drawing
and all sound is procedural WebAudio.

## Modules (one clear job each)

| File | Job |
| --- | --- |
| `game/src/random.js` | Seeded RNG (mulberry32) — deterministic runs and screenshots |
| `game/src/geometry.js` | Distances, segment tests, line of sight, vision cones, wall sliding |
| `game/src/level.js` | Three ASCII maps, parsing, BFS reachability checks |
| `game/src/guard.js` | Guard AI: patrol → suspicious → alert → search, detection meter |
| `game/src/player.js` | Movement, sneak vs run, noise radius |
| `game/src/game.js` | State machine: title → playing → won / caught; cores, exit, capture |
| `game/src/render.js` | Canvas: floor, walls, zones, raycast cones, lighting, screens |
| `game/src/input.js` | Keyboard state, click-to-move target |
| `game/src/audio.js` | Procedural sound: footsteps (panned by guard position), stings, chimes |
| `game/src/main.js` | Boot, game loop, HUD, deterministic `?shot=` staging for screenshots |
| `main.ts` | make.fun hand-in: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | Dev static server for `game/` |

## Detection model

A guard sees the player inside its 220 px, 75° vision cone with an
unblocked line of sight (raycast-clipped cone, so walls cut the light). The
meter fills at ~1.25/s up close, ~0.5/s at max range, ×0.35 in shadow, ×0.5
while sneaking, ×1.3 while running, and decays at 0.5/s when hidden. A full
meter raises the alert: the guard chases at 132 px/s (the player runs at
170 px/s, sneaks at 85 px/s). Losing sight for 4 s drops the guard to a
3 s search, then back to patrol. Running is heard within 150 px; sneaking
within 25 px.

## Levels

All three maps are verified by unit tests: every row the same width, every
core, exit and guard spawn reachable from the player start by BFS.

- **The Lobby** — 2 guards, 3 cores. Vertical patrols, open rooms.
- **The Vault Floor** — 3 guards, 3 cores. Three horizontal patrol lanes
  behind a middle wall with three gaps.
- **The Black Site** — 4 guards, 5 cores. Tight corridors, staggered walls,
  shadows as the only cover.

## Screenshots

Taken by the Playwright playtest (`tests/playtest.mjs`) from deterministic
`?shot=` scenes rendered by the game's own code: `1-start.jpg` (title),
`2-play.jpg` (mid-play, two cones), `3-alert.jpg` (red cone, guard about to
close in), `4-win.jpg` (extraction complete). Each is 1280×720 JPEG, under
the 256 KiB gate cap.

## Verification

- `node --test tests/unit.test.js` — 28 unit tests, all passing.
- `node tests/playtest.mjs` — boots the game, moves the player, proves the
  detection meter rises, proves win and caught states, checks for console
  and network errors, retakes the four screenshots.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` twice — byte-identical output
  (deterministic hand-in).
- `node cli/makefun.mjs check --repo <repo> --worktree` from the kit —
  passes competition_open, snapshot, license_osi and entrypoint; the only
  failure is transcripts_present, which the submission step provides.
