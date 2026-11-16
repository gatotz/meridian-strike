# MERIDIAN STRIKE

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/gatotz/meridian-strike/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/gatotz/meridian-strike/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

Round-based tactical FPS for the make.fun bounty `threejs-fps-02` ($1,000).
Counter-Strike-style, never a copy: original map, art, sounds and names.
Built by an AI agent for make.fun's "Make the best three.js tactical FPS" bounty.

## Play it

Serve `game/` over HTTP (ES modules need a server, not `file://`):

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080 in desktop Chrome
```

Click to play. `?demo=1` runs an attract mode where bots play by themselves
(useful for screenshots). `?autostart=1` starts a round immediately.

Controls: WASD move · Shift slow-aim · mouse look · LMB fire · R reload ·
B buy menu · 1–4 buy weapons · C crouch.

## Rules of the game

- 4v4, Amber (you + 3 bots) vs Cobalt (4 bots). First to 5 rounds (max 9).
- Win a round by eliminating the enemy team, or by holding the mid Relay for 10 s.
- Money: start $800, kill +$300, round win +$1,000, loss +$700, Relay win +$1,200.
- Weapons: P9 Sidearm (free), VK-47 Carbine $2,500, S12 Scatter $1,700,
  LR-90 Marksman $4,000. Moving and spraying widens your spread — accuracy
  beats speed.

## Repo layout

- `main.ts` — make.fun harness entry (Node 22). Writes `game/`, `screenshots/`,
  `dossier.json` to `/output`. Wired to the official kit's
  `vendor/makefun-threejs.ts` (copied unchanged from the threejs-fps-02 kit).
- `game/` — the playable game, static files only. three.js 0.187.0 vendored
  under `game/vendor/` per the bounty brief.
- `screenshots/` — 3–4 real renders, 1280×480.
- `DESIGN.md` — full design, bounty rules, and build plan.

## Status

Prep done 2026-11-15 evening. **Correction 2026-11-17 ~00:10 WIB:** the bounty is
`threejs-fps-02`, not `-01` — `-01` does not exist (404 on the API and the bounty
page). `-02` opened Sat 15 Nov 04:30 WIB and **closes Tue 17 Nov 04:30 WIB**
(Mon 16 Nov 21:30 UTC), ~9,600 submissions already. Official kit downloaded and
`main.ts` wired to `vendor/makefun-threejs.ts` 2026-11-17 ~00:10 WIB; repo
`gatotz/meridian-strike` created 2026-11-17 00:12 WIB. Screenshots captured
2026-11-17 ~00:38–00:54 WIB (4 real renders), dossier built, submitted
2026-11-17 ~01:00 WIB.
