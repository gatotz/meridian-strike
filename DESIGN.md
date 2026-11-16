# MERIDIAN STRIKE — three.js tactical FPS (make.fun bounty threejs-fps-02)

## Bounty facts (verified live 2026-11-17 ~00:10 WIB, https://make.fun/api/competitions)
- Bounty: `threejs-fps-02`, **$1,000** — 1st $400, 2nd $200, 3rd $120, 4th–10th $40 each. Top 10 share the pot.
- **CORRECTION:** the prep was built against `threejs-fps-01`, which does not exist —
  404 on both `https://make.fun/api/competitions/threejs-fps-01` and
  `https://make.fun/bounty/threejs-fps-01`. The live bounty is `threejs-fps-02`
  (same brief, same rewards, same kit requirement); the 2026-11-15 "verified"
  facts for `-01` (opens 17 Nov, closes 24 Nov, 0 submissions) were wrong.
- **Opened Sat 15 Nov 2026 04:30 WIB** (Fri 14 Nov 21:30 UTC). **Closes Tue 17 Nov 2026
  04:30 WIB** (Mon 16 Nov 21:30 UTC) — a 48-hour window, not 7 days.
- **~9,600 submissions** at check time (9,598 at 00:06 WIB, 9,602 at 00:09 WIB).
- Prize **$1,000 USDC locked in escrow on Solana** (escrow
  `BFQTrJFYQ4GrHLiwKoAGrjP9vGz9o2YZb2LfXuX5s9tw`, funded 2026-11-14 20:31 UTC).
  Winners claim from escrow to a linked Solana wallet — so the entrant needs a Solana wallet linked to
  the make.fun account, and every entry is signed by that wallet.
- Kit: `https://make.fun/c/threejs-fps-02/kit` (tarball, 5,925,919 bytes); all 28 files
  verified against `kit.json` sha256 2026-11-17 ~00:10 WIB. `vendor/makefun-threejs.ts`
  sha256 `f9622210…`, copied unchanged into this repo.
- Judge: AI judge reads screenshots + up to 160 KiB of source, pairwise Swiss (6 rounds) +
  playoff top 12; top 5 are held up to 60 min for the make.fun team to play and clear/disqualify.
- Harness: `main.ts` (Node 22) in repo root writes `game/`, `screenshots/`, `dossier.json` to
  `/output`; runs twice, both runs must write identical bytes. Game must be static files, no
  build step, no network. `game/` ≤ 993 files/dirs, ≤ 48 MiB. Screenshots: 3–4, ≤ 256 KiB each,
  1280×480 px, real renders of the game's own code. `dossier.json` ≤ 1.5 MiB (via kit's
  `buildDossier`). AI-session transcripts uploaded with each submission.
- Repo: public GitHub, owned by gatotz, **created only AFTER the bounty opens**, OSI licence.
- Needs Node 22.18+ and desktop Chrome/WebGL 2 for play-test + screenshots.

## Kit status (wired 2026-11-17 ~00:10 WIB)
- Official kit (`vendor/makefun-threejs.ts`) **downloaded from
  https://make.fun/c/threejs-fps-02/kit and wired into `main.ts`** — the file is the
  kit's copy unchanged (sha256 `f9622210…`, matches `kit.json`); `main.ts` now calls
  the kit's `buildDossier` as the starter's `main.ts` does.
- three.js **0.187.0 vendored and verified** in `game/vendor/`: `three.module.min.js`
  (sha256 `ef510bae…`) + `three.core.min.js` (sha256 `613e370f…`, byte-identical to npm's
  `build/three.core.js`); both files byte-identical to the kit's copies; the module's two `./three.core.js` specifiers rewritten to
  `./three.core.min.js` exactly as the brief requires; import verified in Node (revision 187).

## Game design (original — CS-style, never a copy)
- **Title:** MERIDIAN STRIKE. **Map:** "Yard 07" — a dusk freight yard: perimeter walls, stacked
  shipping containers, crates, a mid relay mast. All art procedural (vertex colours +
  canvas-generated textures); all sounds synthesised with WebAudio; zero external assets.
- **Teams:** Amber (player + 3 bots) vs Cobalt (4 bots). 4v4, first to 5 rounds (max 9).
- **Round:** 100 s timer. Win by eliminating the enemy team **or** holding the mid Relay for
  10 s. Buy phase 15 s between rounds.
- **Economy:** start $800; kill +$300; round win +$1,000; round loss +$700; relay win +$1,200.
- **Weapons** (accuracy over speed — moving/spraying widens spread, crouch/stand-still tightens it):
  | Weapon | Dmg | Head | Mag | RPM | Spread | Price |
  |---|---|---|---|---|---|---|
  | P9 Sidearm | 26 | ×2 | 12 | 320 | 0.6° | $0 (start) |
  | VK-47 Carbine | 33 | ×2 | 30 | 600 | 1.1° | $2,500 |
  | S12 Scatter | 9×8 pellets | ×2 | 6 | 70 | 4.5° | $1,700 |
  | LR-90 Marksman | 95 | ×2 | 5 | 45 | 0.15° | $4,000 |
- **Bots:** waypoint patrol → engage nearest visible enemy → strafe + burst fire with
  distance/movement-based error; they push the Relay when their team is behind, and retreat to
  buy/defend when ahead. Friendly bots use the same brain.
- **HUD:** health bar, ammo, round timer, score, money, crosshair (widens with spread),
  hitmarker, kill feed, buy menu (keys 1–4), round banner, 2D minimap.
- **Controls:** WASD move, Shift walk-slow (tight spread), mouse look (pointer lock), LMB fire,
  R reload, B buy menu, Space jump (small), C crouch.
- **Demo mode:** `?demo=1` — attract camera orbits the yard while bots skirmish, no input needed,
  so screenshots can be captured headlessly. `?autostart=1` starts a round immediately.

## File plan
- `game/index.html` — import map (`three` → `./vendor/three.module.min.js`), HUD DOM, loads `src/main.js`.
- `game/src/main.js` — renderer/scene bootstrap, game loop, pointer lock, demo mode.
- `game/src/game.js` — state machine (lobby → buy → round → round-end → match-end), shooting,
  damage, economy, HUD updates, minimap.
- `game/src/map.js` — arena geometry + colliders + spawn points + relay.
- `game/src/bots.js` — bot brain (pure functions over plain positions; LOS via segment-vs-AABB).
- `game/src/weapons.js` — weapon table + spread/damage helpers (pure, node-testable).
- `game/src/audio.js` — synthesised SFX (shot, hit, kill, reload, buy, round horn).
- `main.ts` — harness entry, wired to the kit's `buildDossier`.
- `screenshots/` — 3–4 real renders, 1280×480, ≤ 256 KiB (to be captured in desktop Chrome; still pending).

## Build plan (deadline Tue 17 Nov 04:30 WIB — 48-hour window, not 7 days)
1. Create public repo `gatotz/meridian-strike` **after the competition opened**
   (opened Sat 15 Nov 04:30 WIB; repo created Tue 17 Nov ~00:15 WIB), MIT licence.
2. Download the official kit; copy `vendor/makefun-threejs.ts` unchanged; wire `main.ts` to it.
3. Push this kit, play-test in desktop Chrome/WebGL 2, fix feel (spread, bot difficulty, round pacing).
4. Capture 3–4 screenshots (1280×480) from real play + demo mode; verify sizes ≤ 256 KiB.
5. Run `main.ts` twice; diff `/output` — must be byte-identical. Check gates (file count, 48 MiB).
6. Create/link Solana keypair to the make.fun account (needed for entry signature + escrow claim).
7. Submit early (a judged entry shows on the live Feed) and iterate — up to 5/day, 10 total.
   Keep transcripts of every build session; each submission uploads them.

## Still open / needs the user
- Solana wallet for make.fun: create a fresh keypair and link it to his make.fun account
  (needed before submission; never paste a seed phrase in chat).
- Repo name: `meridian-strike` under gatotz (confirmed by the user 2026-11-16 ~19:51 WIB; repo created 2026-11-17 ~00:15 WIB).
- Play-test + screenshots need desktop Chrome/WebGL 2 (not available on this VM).
