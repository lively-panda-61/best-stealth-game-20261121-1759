# best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/lively-panda-61/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/lively-panda-61/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

THE BRASS CROW — five heists by gaslight. A top-down stealth game: learn the wardens' patrols, slip through their vision cones, douse the lamps, throw coins to pull guards off their route, smoke the cameras, lift each heist's seal and reach the green exit unseen. Five heists (The Old Mint, The Glasshouse, The Grand Hotel, The Opera House, The Royal Observatory), 25 wardens, sweeping cameras, pulsing lasers, three gadgets, an alarm meter, strikes, and a $500 ghost bonus for finishing a heist without ever being spotted.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: game/ is plain static files.

WASD move · SHIFT sneak · SPACE sprint (loud) · CLICK throw a coin · Q smoke vial · E douse a lamp · H field notes · M mute · ESC pause · ENTER start / next heist · R retry.

## Tests

```sh
npm test        # unit tests (40 checks: levels, vision, guards, gadgets, hazards, game flow)
npm run playtest  # Playwright: boot, movement, detection, win/caught, screenshots
```

## Hand in

```sh
node main.ts    # copies game/ + screenshots/ to /output and writes dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=q85rcyn4&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
