# Tool inventory (Riftbound, 2026-10-10)

Asset for [Tool inventory](https://github.com/TheClaessens/studio/issues/2). Line counts are `wc -l`. Coupling layers:
**G** generic (any stack), **W** web-generic (any browser game), **T** Three.js-specific, **R** Riftbound-specific.

## Tools

| Tool | Entry point / how run | Inputs | Outputs | Coupling (≈ lines) | Reaches into the game for |
|---|---|---|---|---|---|
| **Creature & hero viewer** | `dev/creatures.html` (28) → `src/dev/viewer.js` (192); `node serve.js` :8080, URL params `set, ids, poses, zoom, yaw, bg, t, glow, rim` | creature module name, pose list | live grid of posed models + labels; PNG via `shot.js` upload | T ~120 (camera, grid, labels) · R ~70 (sets, pose grammar, bg presets) | `Engine`, `CreatureRenderer`, `HEROES`, `newHeroState` imports; creature def modules by name |
| **Icon sheet** | `dev/icons.html` (53) | — | live sheet of every icon id, skills, relics | W ~25 · R ~28 | `src/ui/icons`, skills registry, relics |
| **UI kit** | `dev/ui-kit.html` (59) | — | live page of UI components at UI scale | W ~30 · R ~29 | `src/ui/scale.js`, `src/ui/icons` |
| **Shot helper** | `src/dev/shot.js` (113), imported by viewer + playtest; served by promo kit server :8097 (`-Out dev/shots`) | `stage({classId, act, zoom, boss…})`, `castAt`, `step` | PNG via `PUT /__promo/out/<name>.png` | W ~45 (pinSize, upload) · T ~25 · R ~45 (stage, castAt) | `window.__game` |
| **Balance sim** | `src/dev/sim.js` (287), console `runSim({classId, seconds, obelisks})` | class, duration, pact lanes | timeline JSON in console; feeds `design/*-sims*.md` | R ~287 | game loop via `window.__game`, skills registry |
| **UI shots** | `src/dev/uishots.js` (296) | — | screenshots of UI states | R ~296 (W helpers inside) | classes, relics, skills, `sim.js` |
| **Playtest kit** | `playtest/adapter.js` (492) + `playtest/kit/` (core 302, hands 187, servers ~210); server :8098; console `PT.init/start/play/choose/shot/batch` | persona, skill, class, tier | `playtest/out/*.png`; persona reports written by agents into `design/playtest/round-N/` | G/W core+hands ~490 · servers W ~210 · adapter R ~470 + T ~20 | `window.__game`, meta, classes, skills registry, `shot.js` |
| **Playtest rounds (reports)** | `design/playtest/round-{1,2,3}/`: `NN-<persona>.md`, `REPORT.md`, `ROUND.md`/`NEXT.md`, data JSON; round 3 includes `00-human.md` | — | markdown + JSON | G (pure documents) | — |
| **Promo video** | `promo/index.html` + `promo.js` (39), `stage.js` (178), `shots.js` (220), `titles.js` (206) + `promo/kit/` (motion 410, renderer 243, soundtrack 240, shims 83, servers ~210); server :8096; console `promo.still/sheet/start` | shot list, titles, cue sheet | `out/riftbound-promo.mp4`, `.wav`, `still.jpg`, `sheet.jpg` | kit W ~976 (+ servers) · stage R ~150 + T ~30 · shots/titles R ~426 | `src/core/engine`, `input`, `game`, `acts`, `bosses`, `enemies`, skills registry |
| **Store assets** | `promo/store/index.html` (42) + `store.js` (173), `shots.js` (151), `verify.js` (94) | portal sizes in URL | covers, 18 s silent preview MP4s, check grids in `out/` | verify W ~94 · store/shots R ~324 | `stage.js`, `brand.js` |
| **CrazyGames packager** | `tools/package-crazygames.ps1`; skill kit `package-portal.ps1`, `platform.js`, `verify-mp4.js` | repo | `dist/crazygames/` | W (packager) · R (paths) | file layout |
| **Design docs** | `DESIGN.md`, `ARCHITECTURE.md`, `design/*.md` (passes, ART, HEROES, VFX, UI, RAID, SHARD, REVIEW), `design/research/01–13`, sims `design/*-sims*.md` | — | markdown | G | — |
| **Shot archives** | `design/shots-v4/` (+ `README.md` naming scheme: `base-*` before / others after) | — | PNG | G | — |
| **Changelog** | `changelog/index.html` (511) | — | static page | W ~ (one HTML file, content R) | — |
| **Project skills** | `.claude/skills/{game-design, game-playtest, game-promo-video, orchestrated-game-dev, crazygames-release}` | — | the generic kits above + `adapter.template.js`, `promo.template.js`, `examples/mini-arena` | G/W | — |

## Facts later tickets depend on

- **Seam already exists twice.** The playtest kit (`createPlaytest(adapter)`, `adapter.template.js`) and the promo kit (`createRenderer({source, shots, tick, render, overlay})`) are both "generic kit + per-game adapter". Their adapters are the Riftbound-specific bulk (~470 and ~580 lines).
- **Three.js coupling is thin.** Roughly 200 lines across viewer, shot helper, playtest adapter and promo stage. Most code is either web-generic kit or Riftbound-specific game knowledge.
- **The asset catalogue is code, not data.** Viewable models = `defineCreature` exports per module in `src/game/creatures/` + the `HEROES` registry; poses are a URL grammar in `viewer.js`. No manifest lists them.
- **Outputs land in ad hoc folders**: `playtest/out/`, `out/` (promo + store), `dev/shots/`, `design/shots-v4/`, `design/playtest/round-N/`. Saving is always a same-origin `PUT` to a kit server (`/__promo/out/`, `/__playtest/out/`).
- **Six launch configs, five ports** (`.claude/launch.json`: 8080 game, 8094 alt, 8095 crazygames dist, 8096 promo, 8097 shots, 8098 playtest). Servers exist in `.mjs`, `.ps1` and `.py` copies.
- **Kits are byte-identical** to the skill copies today (`playtest/kit` = `game-playtest/kit`, `promo/kit` = `game-promo-video/kit`, 12/12 files). The sync is manual.
- **Live hooks**: `window.__game` (`src/main.js:22`), `player.botMove` / `botDash` (sim harness), `?unlockall` URL flag.
- **Human feedback already has a slot**: `design/playtest/round-3/00-human.md` sits next to persona reports.
