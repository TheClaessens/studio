# Studio

A local app where a human uses a game project's Tools: play the game, view assets, read playtest reports, browse media and docs, and leave Feedback for agents to pick up.

Status: **being built**. Read the [Studio v1 spec](https://github.com/TheClaessens/studio/issues/12) and the [wayfinder map](https://github.com/TheClaessens/studio/issues/1) that led to it. The Tools came from [Riftbound](https://github.com/TheClaessens/Riftbound).

## Use

Needs Node >= 26.

```sh
npx github:TheClaessens/studio#<tag> <game-dir>     # or: npm i -g github:TheClaessens/studio, then studio <game-dir>
```

It validates `<game-dir>/studio.json` (schema at `/__studio/schema/studio.json`) and prints the URL to open. `--port N` picks the port (default 5170, any free one if taken).

`studio check <game-dir>` runs the playtest Kit self-test (`PT.init → start → play → choose → shot → batch`) in headless Chrome, Chromium or Edge (`STUDIO_BROWSER=<executable>` to pick one). It opens `play.entry`, imports the Game Adapter module named by `play.adapter`, saves the shot in `out.playtest`, then reopens `play.entry` and takes a screenshot (`play.hooks`' `capture` if declared, else the largest canvas). With an `assets` section it first loads the catalogue and screenshots its first asset's view (`assets.capture` if declared, else the largest canvas); a project with `assets` but no `play.adapter` runs only those steps. It exits non-zero naming the step that failed:

```json
"play": { "entry": "index.html", "adapter": "playtest/adapter.js" },
"out": { "playtest": "playtest/out" }
```

## Skills

`skills/` holds six agent skills: `game-playtest`, `game-promo-video`, `game-design`, `orchestrated-game-dev`, `crazygames-release` and `feedback`. Install them as a Claude Code plugin (this repo is its own marketplace):

```
/plugin marketplace add TheClaessens/studio
/plugin install studio@studio
```

or for any agent with `npx skills add TheClaessens/studio`. Skills import Kits from the running Studio (`/__studio/kits/…`) and launch it with `npx github:TheClaessens/studio#semver:<pin> .`, `<pin>` being `studio.json`'s `"studio"`. Starter code a skill hands over (the portal platform layer) is copied into the game, which owns it.

`package.json`, `.claude-plugin/plugin.json` and its `marketplace.json` entry carry one version; bump all three together; CI tags `v<version>` when it lands on `main` so `#semver:` pins resolve. The npm package leaves `skills/` out: both installers read this git repo.

## Develop

`npm install` builds the UI (`prepare`); `npm test` runs the seam-1 tests (`test/`), which start `studio <fixture>` and assert over HTTP.

- `server/`: TypeScript run by Node's type-stripping, no build. Routes in `server/app.ts`, manifest schema in `server/schema.ts`.
- `ui/`: React + Vite, built to `dist/ui`, served at `/__studio/`.

## Map

- `GLOSSARY.md`: the domain vocabulary
- `docs/design/`: the tool inventory, the blast-radius table, the native-engine research and the throwaway Assets + Feedback prototype (it iframes Riftbound's viewer: copy it to Riftbound's `dev/` and serve the Riftbound root to run it)
