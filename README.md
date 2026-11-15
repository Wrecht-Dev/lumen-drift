# lumen-drift

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Wrecht-Dev/lumen-drift/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Wrecht-Dev/lumen-drift/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Lumen Drift is a neon arena survival game: pilot a lone ship through escalating waves of geometric hunters — drifters, darters, weavers, splitters, and the Warden boss every fifth wave. Between waves, draft one of three upgrades (rapid fire, twin mounts, piercing rounds, plating, and more) and push your combo multiplier as high as it will go. Original art drawn in code, synthesized sound, and no build step: it runs offline from static files in any desktop browser.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`.

## Controls

- **WASD / arrows** — fly
- **Mouse** — aim; hold click or Space to fire
- **1 / 2 / 3** — pick an upgrade between waves (or click a card)
- **P** — pause, **M** — mute

## How it plays

- Survive each wave; clearing one pays a bonus and opens the upgrade draft.
- Kills build a combo multiplier (up to ×8) that decays if you stop scoring.
- Gems are worth points; fallen enemies sometimes drop hull repair, a shield, or overdrive.
- Hull is 3 hits. Lose it and the run ends — your best score is kept locally.

---

<sub>Entered on [make.fun](https://make.fun/?ref=es5913gr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
