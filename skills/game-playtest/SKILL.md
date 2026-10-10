---
name: game-playtest
description: Run a round of simulated playtesting on a browser game. Spawn a panel of AI playtester personas (casual, hardcore, newcomer, challenge seeker, accessibility, balance analyst, completionist and more), each with a focus domain. They play the real game sped up through a small driver kit: bot "hands" do the motor work while the persona makes every decision. Each persona writes a structured report, and the orchestrator verifies the top claims in-engine and synthesises a ranked report for future development. Use this whenever the user wants playtesting, playtesters, player feedback, a fun/balance/UX/readability review, "simulate players", persona testing, a balance pass driven by bot runs, or "what would different kinds of players think" for a web, JavaScript, canvas, WebGL, Three.js, Phaser, PixiJS or Babylon game. This includes action, roguelite, survivors-like, tower defense, puzzle, card and turn-based games, even if the user doesn't say "skill" or "persona".
---

# Simulated game playtesting

A round of AI playtesting has three steps:
1. You build a thin **adapter** so the game can be played programmatically and much faster than real time.
2. A panel of **persona subagents** plays it in parallel, each through its own browser tab, and each writes a report.
3. You **verify** the strongest claims in-engine and **synthesise** one ranked report.

Each persona plays as a *brain with bot hands*:
- **Hands:** a small bot does movement, aiming and dodging at a chosen skill level (casual / average / expert). Turn-based games need no hands.
- **Brain:** the LLM persona chooses everything a player chooses (class, upgrades, cards, shop, routes). It looks at the game through screenshots, on-screen text and an event digest that names what happened and what hurt it.

This split is the point. LLMs can't twitch, but they judge choices, clarity, feel and fairness well. The simulation runs synchronously inside each tool call, so a 10-minute run takes seconds to a minute.

## The Studio and the playtest Kit

The Studio serves the game and the playtest Kit from one origin. The Kit is served, never copied into the project: the adapter imports it from `/__studio/kits/playtest/`. The only file you write is the Game Adapter, `playtest/adapter.js`, from this skill's `templates/adapter.template.js`.

Launch the Studio from the Game Project root, at the version `studio.json` pins: read its `"studio"` key (e.g. `1.x`) and put it in place of `<pin>`:

```sh
npx github:TheClaessens/studio#semver:<pin> .
```

It prints the Studio's URL, `http://localhost:<port>/__studio/` (port 5170 unless it is taken); the game itself is served at the root, `http://localhost:<port>/`. If the session has a preview browser, add that command as the one Studio entry in `.claude/launch.json` and start it from there, not from a shell. The project needs a `studio.json`; the playtest parts are:

```json
"play": { "entry": "index.html", "adapter": "playtest/adapter.js" },
"playtests": "playtest",
"out": { "playtest": "playtest/out" }
```

`playtests` is the folder that holds `PERSONAS.md`, `BRIEF.md`, the persona portraits and the rounds (`rounds/round-N/`); the Studio finds a `round-N` folder anywhere under it, and leaves the `out` folders to Media. `PT.shot` PUTs screenshots to the Studio, which writes them to `out.playtest`; read them from disk there. Set the adapter's `outDir` to the same folder.

| Kit file | Role |
|---|---|
| `/__studio/kits/playtest/playtest-core.js` | `createPlaytest(adapter)` → `PT`. Owns the loop (`play` with stop reasons), decisions (`decision`/`choose`), the per-call digest (`window` tallies + event log), the per-persona **localStorage sandbox**, canvas screenshots (`shot`), on-screen text (`ui`), background **batches** (`batch` / `batchWait` / `batchResult`, safe in hidden tabs), and adapter extras exposed as `PT.<action>`. |
| `/__studio/kits/playtest/hands-topdown.js` | `createTopdownHands(cfg)`: bot hands for real-time top-down/isometric/2D action. Threat avoidance, projectile sidestep, telegraph-zone escape, dash-through, calm-time pickups, boss orbit, aim. Skill levels `casual`/`average`/`expert` (`HAND_LEVELS`). |
| `templates/adapter.template.js` (this skill) | The per-game adapter to fill in: reach the game, step one tick, status, state, decisions hook, event → digest, end/abandon, canvas/projection, meta progression, extra actions, batch policy. |

The Studio serves **mini-arena** at `/__studio/examples/mini-arena/`: a ~150-line 2D canvas survival game plus a complete ~90-line adapter (`/__studio/examples/mini-arena/adapter.js`). It covers pixel units, a custom choice UI, a named-damage digest, a custom stop, batches and a sandboxed save. Read it before writing your first adapter. It is also the Kit's **self-test**: `PT.init → PT.start → PT.play → PT.choose → PT.shot → PT.batch`. The expected result is that `expert` hands usually survive the 90 s and `casual` hands usually don't.

`npx github:TheClaessens/studio#semver:<pin> check .` runs that self-test against *your* adapter (`play.adapter`, loaded on `play.entry`) in headless Chrome and names the step that fails.

## Workflow

### 1. Audit the game and write the adapter
Read the code; don't guess. Find:
- the loop and a synchronous `update(dt)`;
- the run start;
- win/lose state;
- every function that **asks the player to choose** (level-up, shop, reward, route, card);
- the event bus;
- what damages the player (and the player-facing names of those sources);
- telegraph functions;
- the canvas and the camera;
- persisted save keys;
- out-of-run progression.

Fill in `adapter.template.js`. Rules that matter:
- **Wrap choice UIs, don't auto-resolve them.** Call `ctx.offer({ kind, options, pick })` and *still show the real modal*, so `PT.ui()` reads what a player reads.
- **Name things like a player would.** Use "Goblin Shaman", not `spitter`, and "enemy projectile", not `EnemyBullet`. Personas copy these names into reports.
- **Hook telegraphs into `hands.zone(...)`** so the bot can dodge what a player could see coming.
- Keep `state()` compact. It is returned on every call and costs tokens.

Engine recipes and edge cases (no exposed step function, turn-based games, DOM games, Phaser/Pixi/Babylon) are in `references/adapter-guide.md`.

### 2. Smoke test and calibrate (you, before any persona)
Run `studio check` first (above). Then, with the Studio running, open the game in one tab and check each part of the API by hand:
1. `PT.init` → `PT.start` → `PT.play` → `PT.decision` → `PT.choose`.
2. `await PT.shot('x')`, then Read the PNG.
3. `PT.ui()`.
4. A short `PT.batch(...)`.

Then **calibrate the hands**: batch-run each skill level and note how far they get and what kills them. Write the result into the brief, because personas must know how much "I died" means. In the reference build, every level usually died in Act I–II. That made deaths weak evidence, while *what* hurt and *whether it was visible* stayed strong evidence.

Fix harness noise now: layout reads every tick, stale menus after a save swap, and hidden-tab timers. See `references/gotchas.md`.

### 3. Choose the panel
Pick 5–8 personas from `references/personas.md`. The defaults are the user's own personas plus enough others to cover:
- onboarding,
- moment-to-moment feel,
- build/strategy depth,
- fairness/difficulty,
- readability/accessibility,
- numbers/balance,
- the long-term/meta loop.

Each persona gets **one focus domain**, a hands level, a save profile (fresh, or everything unlocked) and a model:
- **Sonnet** where judging screenshots or feel matters.
- **Haiku** where the work is numeric or text-centric with an exact brief (balance batches, completionist ledgers).
- Avoid Opus playtesters unless the user asks; the orchestrator is the expensive model in the loop.

Write `PERSONAS.md` at the playtests root in the format in `references/personas.md`: `kind: personas` frontmatter, an archetype table, then a section per persona that opens with its `persona` block (id, archetype, quote, colour, sigil, voice, hands, save, model, look, portrait) and lists its play plan and the questions it must answer. Take colours, sigils and voices from the identity table there.

**Portraits, once.** When a persona first joins the project's panel, draw its portrait; keep it for every later round and never redraw it. A portrait is a 32 × 32 pixel-art bust in the house style: head and shoulders, front three-quarter view, a hard 1-px outline in the persona's colour darkened, at most 8 colours, no anti-aliasing, flat lighting from the upper left, on a flat ground of the persona's tint. The `look` line says what the persona wears and carries; the mood comes from their quote. Write the 32 rows as palette keys in a JSON file and run this skill's `templates/portrait.mjs` to save `personas/<id>.png` under the playtests root:

```sh
node <skill>/templates/portrait.mjs mila.json playtest/personas/mila.png
```

Read the PNG back to check it before you move on. The Studio shows the portrait at 32, 64 or 128 px and falls back to the sigil while there is none.

### 4. Write the shared brief
Copy `references/brief-template.md` to the project as `BRIEF.md` and fill in:
- the game blurb;
- the URL and import line;
- the adapter's extra verbs;
- calibration results;
- content-review crutches (assist / jump), if any;
- the report path.

The brief carries the **report template**, including a machine-readable findings JSON block, and the evidence tags **[seen] [data] [read] [inferred] [assisted] [jumped]**.

### 5. Launch the panel
Spawn every persona in **one message**, in the background, with the model per persona. Use the launch prompt in `references/protocol.md`. Each persona:
- uses its **own tab**: it creates one, passes its `tabId` everywhere, and never touches other tabs;
- edits nothing but its report;
- reads no source code;
- finishes with a ≤ 15-line summary.

Keep concurrency at or below the browser's tab limit; about 7 worked. Don't poll the agents; their completion notifications arrive on their own. Relay each summary to the user in a few lines as it lands.

### 6. Verify before you synthesise
A persona report is a claim. For the top issues, especially "blocker", "bug", "stuck" or "impossible" claims, reproduce them in-engine yourself and classify each:
- **real bug**: find the line;
- **design flaw**: the code does what it says, and that is the problem;
- **harness artefact**: fix the adapter (or report a Kit bug against the Studio);
- **bot limitation**: the hands can't do what a human would.

In the reference round this caught all three kinds:
- a "boss stall" that was a real barrier bug;
- a "+0 rewards" end screen that was a harness artefact (a frozen-rAF count-up);
- boss fights that bots made longer by kiting.

### 7. Synthesise the report
Write `rounds/round-N/REPORT.md` with the template in `references/protocol.md`. It contains:
1. An executive summary.
2. A persona scorecard.
3. A verified-claims table.
4. Top issues, ranked by severity × number of personas × pillar impact.
5. What to keep.
6. **Design tensions**: persona disagreements are decisions for the team, not noise.
7. A now / next / later backlog.
8. Harness caveats, plus improvements for the next round.

Publish or share it the way the user wants. Save non-obvious harness lessons to memory.

### Human sessions
A human's playtest goes through the same format, so the synthesis weighs it like any persona report and the Studio marks it as human, never as an AI persona. When the user passes on a human tester's notes (chat, a call, a form), write them up as `rounds/round-N/00-human.md` (`00-human-<name>.md` when there are several) from `references/human-session-template.md`: their words quoted, each finding tagged with its area, a severity only where the tester's words support one, and the findings JSON block. Don't add scores or a verdict the tester didn't give.

### 8. Next rounds
Re-run the same panel after changes and diff the findings JSON blocks. Re-run the analyst's batches with n ≥ 8 per cell to confirm balance moves. Avoid tuning on fewer runs: single runs are anecdotes.

## Gotchas (learned the hard way)
- **Tool calls time out at ~45 s.** Keep `PT.play` chunks short (≤ 60 s of game time, ~20–40 s late-game). Run long work as a background batch and poll it with `await PT.batchWait(35000)`.
- **Hidden tabs throttle `setTimeout` to ~1/min.** The kit yields with `MessageChannel`. Never wait on timers inside the page.
- **Reading layout (`offsetParent`, `innerText`) every tick** cut sim speed by an order of magnitude. Sample it every N ticks with `ctx.every`.
- **Freezing `requestAnimationFrame` freezes rAF-driven UI** (count-ups, tweens). Personas will report "+0 gold". Tell them to trust `PT.end()` numbers.
- **Save swaps leave stale menus.** Re-render the title/menu after `onInit` and after meta purchases.
- **The shared browser:** one tab per agent, always with an explicit `tabId`. Omitting it acts on whichever tab is in front, which may belong to another agent.
- **The bot's ceiling is low and uneven between classes/builds.** Never let a persona conclude "too hard" from bot deaths alone. Ask for the damage-source breakdown and visibility instead.
- **Content-review crutches** (damage `assist`, `jump` to a later act or boss) are fine for seeing content, but findings made with them must be tagged and never used for difficulty claims.

More in `references/gotchas.md`.

## Reference files
- `references/personas.md`: a library of 14 personas with domains, hands levels, models, play plans and questions, plus panel recipes per genre.
- `references/brief-template.md`: the shared playtester brief, the harness how-to and the report template.
- `references/human-session-template.md`: the write-up of a human tester's session.
- `templates/portrait.mjs`: writes a persona's 32 × 32 portrait PNG from palette rows.
- `references/protocol.md`: the launch prompt, the verification routine, the synthesis REPORT template and cost notes.
- `references/adapter-guide.md`: an audit checklist and adapter recipes per engine and genre, plus calibration.
- `references/gotchas.md`: the full list with fixes.
- `references/example-riftbound.md`: the reference adapter (Three.js isometric ARPG) and round-1 outcomes as a benchmark.
