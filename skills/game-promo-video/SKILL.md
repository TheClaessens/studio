---
name: game-promo-video
description: Produce a short motion-design promo / trailer / teaser video (MP4 with soundtrack) of a browser game by driving the real game deterministically, frame by frame, with kinetic titles that match the gameplay on screen, encoded in-browser with WebCodecs (no ffmpeg needed). Use this whenever the user wants a promo, trailer, sizzle reel, launch video, gameplay montage, store/social clip, GIF-like feature showcase or "video highlighting the game's features" for a web, JavaScript, canvas, WebGL, Three.js, Phaser, PixiJS or Babylon game, even if they don't say "skill" or name a format.
---

# Game promo video

Make a short (typically 15–30 s) promo where every snappy title is paired with real gameplay that shows exactly that feature. The game itself renders the footage. A small kit makes the game deterministic, steps it frame by frame, draws titles on a 2D canvas over the game canvas, synthesizes a beat-locked soundtrack and encodes an H.264/AAC MP4 in the browser.

Why this approach: screen-recording a live session gives choppy frames, random outcomes and titles that drift from the action. Driving the game on a virtual clock means any frame can be previewed as a still, iterated on, and re-rendered identically, and the titles can react to real game events (kill counts, combos, the exact frame a dodge lands).

## The Studio and the promo Kit

The Studio serves the game and the promo Kit from one origin. The Kit is served, never copied into the project: the promo page imports it from `/__studio/kits/promo/`. You write only the project's promo page, from this skill's `templates/`.

Launch the Studio from the Game Project root, at the version `studio.json` pins (its `"studio"` key, e.g. `1.x`):

```sh
npx github:TheClaessens/studio#semver:1.x .
```

It prints the URL (default `http://localhost:5170`); open `<url>/promo/`. If the session has a preview browser, add that command as the one Studio entry in `.claude/launch.json`. Renders are PUT to the Studio, which writes them to studio.json `out.promo`; add that folder to `media` so the human sees them in the Media Surface:

```json
"out": { "promo": "promo/out" },
"media": ["promo/out"]
```

The Studio serves a complete working promo (it films the mini-arena example game) at `/__studio/examples/promo/`. Read its `promo.js` before writing your first one.

| Kit file (`/__studio/kits/promo/…`) | Role |
|---|---|
| `shims.js` | Classic script loaded before the game: fixed `innerWidth/innerHeight/devicePixelRatio`, virtual `performance.now`/`Date.now`, seeded `Math.random`, optional manual `requestAnimationFrame` and virtual timers. Exposes `window.__promo` (`advance`, `seed`, `pumpRAF`, `realNow`). |
| `renderer.js` | `createRenderer({...})`: shot timeline, sub-stepped ticking, compositor (cut punch/flash, dim, CSS filter, post zoom), `still(t)`, `sheet()`, `render()`/`start()` → MP4 + WAV. Saves via `PUT /__studio/out/promo/<file>` → `out.promo`. |
| `motion.js` | `createMotion({W,H,ink,fonts})`: easing plus title building blocks (`featureTitle`, `wordmark`, `cardSwap`, `lowerThird`, `bigLabel`, `counter`, `chip`, `speedLines`, `ctaPill`, `featureRow`, `bug`, …). |
| `soundtrack.js` | `renderSoundtrack(cue)`: intro slam, groove, cut accents, slow-mo ducks, outro riser from a cue sheet; `createKit(ctx)` for custom arrangements. |
| `verify.js` | `inspectMp4(promo.put, file, { times, fps })`: checks a render in `out.promo` without a `<video>` (box parse + WebCodecs decode), saves `<file>-check.jpg`, returns `{ info, frame0 }`. |
| `templates/index.template.html`, `templates/promo.template.js` (this skill) | Starting points for the page and the adapter. `shims.js` stays a classic `<script src>` in `<head>`, before any game code. |

## Workflow

### 1. Audit the game (read code, don't guess)
Find and note:
- **Entry and loop**: who calls `requestAnimationFrame`, and where `update(dt)` and `render()` live. Can you construct the game without starting its loop? If not, plan to drive its own loop with `PROMO.raf = 'manual'` + `__promo.pumpRAF()`.
- **Canvas**: the canvas you'll sample. Is it WebGL (then render and `drawImage` must happen in the same task, which the renderer already does)?
- **Hidden time and randomness**: `performance.now`, `Date.now`, `Math.random`, `setTimeout`/`setInterval` in gameplay, animation that reads wall-clock time. The shims cover the globals; note anything else (e.g. seeded RNG classes, `crypto.getRandomValues`, worker threads, audio-clock-driven logic).
- **Size**: code that reads `innerWidth`/`innerHeight`/`devicePixelRatio` at build time. The shims pin them to the video size before any module loads.
- **DOM overlays**: damage numbers, HUD, menus, announcements are invisible to a canvas capture. Decide what to hide and what to redraw in the `overlay` hook (e.g. floating combat text, worth keeping for juice).
- **Hooks for staging**: how to start a run/level directly, give abilities, spawn enemies or bosses, force an attack, teleport, make the hero invulnerable, suppress modal screens (level-up, shop, tutorial).
- **Feature list**: README/design docs/menus give the claims worth showing (counts like "4 classes", "6 reactions" make punchy titles).

See `references/determinism.md` for the checklist and fixes.

### 2. Write the beat sheet before any code
Pick a BPM (120 → 0.5 s beats) and put every cut on the grid. A 15 s template:

| Time | Beat |
|---|---|
| 0–1.5 | Cold open: wordmark slam over a beautiful wide shot, one-line genre tagline |
| 1.5–3.5, 3.5–5.5, … | One feature per 2 s (4 beats): title + the gameplay that proves it |
| a 4×0.5 s montage | Roster cut (classes / cars / weapons), one per beat, name swaps on each cut |
| last 2 s | End card: wordmark, hook line, CTA pill, feature row; plate dimmed and blurred |

Title rules: 1–3 words per line, a verb plus an accent line ("SURVIVE / THE HORDE", "FUSE / 10 EVOLVED SPELLS"), numbered kickers (01…06), concrete numbers from the game, and **the gameplay on screen must literally show the claim**. Where possible, bind a live read-out to game state (kill counter, combo/chain, a formula chip that updates on each real reaction event). Only make claims the game supports, and ask the user about distribution or pricing claims ("free", platforms) rather than inventing them. More in `references/beat-sheet.md`.

### 3. Set up the promo folder
```
promo/
  index.html   ← from templates/index.template.html (+ the game's import maps / CSS / required DOM)
  promo.js     ← from templates/promo.template.js: boot, staging API P, createRenderer(...)
  shots.js     ← SHOTS: one object per cut
  titles.js    ← drawTitles(g, f), CUTS, CUE (soundtrack cue sheet)
  out/         ← renders land here (studio.json out.promo)
```
Start the Studio (`npx github:TheClaessens/studio#semver:<pin> .`) and open `<url>/promo/`.

### 4. Build shots with the staging API
Each shot: `{ id, t0, setup(P, shot), step(P, t, shot), speed?(t), dim?(t), filter?(t), zoomPost?(t), cuts?(shot) }`. Keep `setup` fully deterministic: reseed, reset the game, stage, then `warm()` (unrendered simulation) so the shot opens mid-action. `references/staging.md` has recipes for the common pitfalls: enemies dying during warm-up, empty frames, status tints (frozen bosses), number clutter, forcing a boss attack, and slow-motion time ramps synced to a real event.

### 5. Titles and sound
Use `createMotion` building blocks in `titles.js`, driven by global time `f.T` (and `f.shot` / `f.P` for live state). Put cut accents in `CUTS` (`punch` ≈ 0.05–0.08, `flash` ≈ 0.3–0.55). Build the `CUE` from the same timings: major cuts, minor (montage) cuts, accents, slow-mo ducks, outro. When an event's time is emergent (a dodge, a kill), **measure it** from a still render (`P.shot` scratch) and hard-code it in the cue so the sound lands on the exact frame.

### 6. Iterate visually: stills and contact sheets
- `await promo.sheet({ every: 0.25 })` → `promo/out/sheet.jpg`: one pass over the whole cut. Read the image to judge pacing, emptiness and title timing.
- `await promo.still(8.7, 'a.jpg')` → full-res frames of moments that matter. Check text legibility, framing and whether the claim is visible.
Fix, reload the page, repeat. Because everything is deterministic, a still is exactly the final frame.

### 7. Render and verify
- `promo.start()` kicks off the render; poll `promo.job` (long `await`s time out in tool calls). ~1–3 min for 15 s at 1080p60.
- **Keep the tab visible.** A hidden browser pane freezes the page and the render stalls. In an agent browser, front the tab and keep it busy with short `wait` actions while polling.
- Verify the file with the Kit's verifier, not a `<video>` (it never decodes in a hidden pane): `const { inspectMp4 } = await import('/__studio/kits/promo/verify.js'); await inspectMp4(promo.put, 'promo.mp4')`. Check `info` (duration, size, tracks, decoded frames) and Read the saved `promo-check.jpg` grid. To confirm the audio, `decodeAudioData` the file (`fetch('/__studio/out/promo/promo.mp4')`).
- Deliver `promo/out/promo.mp4` (+ `.wav`), say what each beat shows, and point out claims the user should confirm.

## Gotchas (learned the hard way)
- **Warm-up eats the action**: strong builds clear the screen before the shot starts. Raise enemy HP, shorten warm-up, and stream reinforcement waves from off-screen during the shot.
- **Time ramps shift events**: slowing time before a timed mechanic delays it. Trigger actions from game time (`game.time - startT`), not shot time, then measure when the event fires.
- **Pulses scale with slow-mo**: screen flashes/tints that decay on real dt last much longer in slow motion; clamp them when the event fires.
- **Outlined serif numerals** ("I", "II") read as double strokes; fill them.
- **Gradients in transformed space**: create gradients in the local coordinates you draw in (after `translate/scale`).
- **Number clutter**: hide normal damage numbers in busy or boss shots (`texts: 'light'`), keep crits and labels; none on the logo and end card.
- **Hidden-tab timers**: never `setTimeout` to yield in the render loop; the Kit uses `MessageChannel`.
- **Fonts**: `document.fonts.load()` every weight you draw before the first frame (the renderer does this for `fonts: [...]`).

## Reference files
- `references/determinism.md`: audit checklist, what the shims cover, how to drive rAF-loop games.
- `references/staging.md`: shot recipes and fixes, with code.
- `references/beat-sheet.md`: 15 s / 30 s templates, title copy patterns, cue sheet mapping.
- `references/example-riftbound.md`: condensed real adapter (Three.js isometric ARPG) showing P.stage, a shot, titles and the cue sheet.
