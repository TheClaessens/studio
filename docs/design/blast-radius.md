# Blast-radius table (2026-10-10)

Asset for [Blast-radius table](https://github.com/TheClaessens/studio/issues/9). Riftbound line counts are `wc -l` today. Lines for other stacks are **paper estimates** (marked ≈), based on the [Game Adapter contract](https://github.com/TheClaessens/studio/issues/7) and the [native engine research](https://github.com/TheClaessens/studio/issues/3).

Stacks: **Web** = another browser engine (Babylon, Phaser, PixiJS, plain canvas). **Unity** = Unity WebGL build. **Unreal** = Pixel Streaming (absolute `play.entry`, cross-origin).

Kit = owned by the Studio repo ([Kit ownership](https://github.com/TheClaessens/studio/issues/6)). Per-game = the game writes and owns it.

## 1. Kit lines per stack

| Kit | Lines | Web | Unity | Unreal |
|---|---|---|---|---|
| Playtest core (`playtest-core.js`) | 302 | kept, 0 changed | kept, 0 changed (adapter `step` pumps rAF via promo shims, **unverified**) | unused |
| Top-down hands (`hands-topdown.js`) | 187 | kept, 0 changed (2D: `{x, z: y}` + `unit`) | kept, 0 changed | unused |
| Promo renderer + motion + shims + soundtrack | 976 | kept, 0 changed | kept, 0 changed (Emscripten loop runs on rAF, so `raf: 'manual'` should step it, **unverified**) | unused |
| Kit servers (`.mjs/.ps1/.py` × 2) | 420 | deleted for every stack: the Studio server replaces them (a Kit ownership decision, not a stack cost) | ← | ← |
| **Total Kit lines changed** | 1465 | **0** | **0** | **0** (Kits don't apply) |

Kits never change per stack. They are genre-bound, not engine-bound: `hands-topdown` serves top-down/isometric action only. A platformer or card game needs a new hands Kit, whatever the engine.

## 2. Per-game part per Tool

What Riftbound has today vs what a game on another stack writes. *Kept* = Riftbound keeps it as is under the Studio. *Rewritten* = every new game writes its own.

| Tool | Riftbound per-game (lines, of which Three.js) | Web game writes | Unity game writes | Unreal game writes |
|---|---|---|---|---|
| Asset view (creature viewer) | `viewer.js` 192 + `creatures.html` 28 (T ≈120), kept, +≈10 for `play=1` (permitted) | nothing with `view: "gltf"`; or own viewer page + URL template | nothing: editor export to `.glb` (`view: "gltf"`) | nothing: glTF export (`view: "gltf"`) |
| Asset catalogue (new) | `dev/studio/catalogue.js` ≈40 (walks `defineCreature` + `HEROES`) | `catalogue.json` or ≈20–50 module | C# editor batch export, catalogue.json + `.glb`: ≈80–150 | Python glTF export: ≈50–100 (headless **unverified**) |
| Play hooks (new) | `dev/studio/hooks.js` ≈30 (`snapshot`, `capture`) | ≈20–40 | `hooks.js` ≈30 + `.jslib` / C# state mirror ≈60–100 | none possible (cross-origin) |
| Project Manifest (new) | `studio.json` ≈20 | ≈20 | ≈20 | ≈15 (no `play.hooks`, `out`) |
| Shot helper | `shot.js` 113 (T ≈25), kept; its `upload` moves to `/__studio/out/` | default canvas grab, or a `capture` | default canvas grab (needs same-task read or `preserveDrawingBuffer`) | label + pasted image only |
| Playtest adapter | `adapter.js` 492 (T ≈20), kept | rewritten, ≈300–500 | rewritten, ≈300–500 + C# `SendMessage` receivers; sketch, not v1 | none |
| Promo video | `promo.js`/`stage.js`/`shots.js`/`titles.js` 643 (T ≈30), kept | rewritten, ≈400–650 | rewritten, ≈400–650 + C# staging receivers; **unverified** | none: Movie Render Queue output lands in a `media` folder |
| Store assets | `store.js` + `shots.js` 324, kept; `verify.js` 94 is web-generic | rewritten ≈300; `verify.js` reusable | same as promo | static covers only, made outside the Studio |
| Playtest reports, design docs, changelog, shot archives | documents, kept | 0 | 0 | 0 |
| Riftbound-only dev pages (`sim.js` 287, `uishots.js` 296, `icons.html` 53, `ui-kit.html` 59) | stay in the game, not Studio Tools | — | — | — |
| CrazyGames packager | 213 (+ skill `package-portal.ps1`), web build only | reusable for any web build | Unity WebGL builds can ship to portals, own packaging | n/a |

## 3. Surface capability per stack

| Surface | Riftbound (Three.js) | Web | Unity WebGL | Unreal (Pixel Streaming) |
|---|---|---|---|---|
| **Assets** | works (URL template + `capture`) | works | works (`gltf`) | works (`gltf`) |
| **Feedback** | works, all Pin kinds | works | works | **degraded**: asset Pins work; play Pins get no snapshot and no auto-screenshot |
| **Play** | works, hooks + snapshot | works | works with a `.jslib` mirror; without it, embed only | **degraded**: embed only, no hooks |
| **Playtests** (view rounds) | works | works | works | works (reports are documents) |
| Playtest Kit (agents play) | works | works after an adapter | **degraded**: sketch, unverified | **absent** |
| **Media** | works | works | works | works (files rendered elsewhere) |
| Promo Kit (render video) | works | works after a stage | **degraded**: unverified rAF stepping | **absent** |
| **Docs** | works | works | works | works |

## 4. Totals

| | Web | Unity | Unreal |
|---|---|---|---|
| Kit lines changed | 0 / 1465 | 0 / 1465 | 0 (Kits unused) |
| New per-game code for Surfaces only (manifest, catalogue, hooks) | ≈40–110 | ≈190–300 (most of it C#) | ≈65–115 |
| Per-game Kit adapters, if wanted | ≈700–1150 | ≈700–1150 + C# receivers, unverified | n/a |
| Riftbound itself (Three.js) | ≈100 new (`studio.json`, `catalogue.js`, `hooks.js`, `play=1`); 0 existing lines changed except `shot.js` upload path | | |

## Takeaways for the v1 cut

- The seam holds: switching stack changes **0 Kit lines**. All cost is per-game, and most of it sits in optional Kit adapters, not in Surfaces.
- Assets, Playtests (viewing), Media and Docs work on every stack with data alone. Feedback and Play degrade on Unreal only.
- The Unity Kit story rests on one unverified assumption: that the shims' manual rAF pump can step a Unity WebGL build. If that fails, Unity's Playtest and Promo Kits drop to absent too. A spike decides it, but only if v1 promises Unity Kits.
- `promo/store/verify.js` (94 lines, web-generic) is a Kit candidate sitting in per-game code.
