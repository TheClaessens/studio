# Studio

A local app where a human uses a game project's Tools: play the game, view assets, read playtest reports, browse media and docs, and leave Feedback for agents to pick up.

Status: **being built**. Read the [Studio v1 spec](https://github.com/TheClaessens/studio/issues/12) and the [wayfinder map](https://github.com/TheClaessens/studio/issues/1) that led to it. The Tools came from [Riftbound](https://github.com/TheClaessens/Riftbound).

## Use

Needs Node >= 26.

```sh
npx github:TheClaessens/studio#<tag> <game-dir>     # or: npm i -g github:TheClaessens/studio, then studio <game-dir>
```

It validates `<game-dir>/studio.json` (schema at `/__studio/schema/studio.json`) and prints the URL to open. `--port N` picks the port (default 5170, any free one if taken).

## Develop

`npm install` builds the UI (`prepare`); `npm test` runs the seam-1 tests (`test/`), which start `studio <fixture>` and assert over HTTP.

- `server/`: TypeScript run by Node's type-stripping, no build. Routes in `server/app.ts`, manifest schema in `server/schema.ts`.
- `ui/`: React + Vite, built to `dist/ui`, served at `/__studio/`.

## Map

- `GLOSSARY.md`: the domain vocabulary
- `docs/design/`: the tool inventory, the blast-radius table, the native-engine research and the throwaway Assets + Feedback prototype (it iframes Riftbound's viewer: copy it to Riftbound's `dev/` and serve the Riftbound root to run it)
