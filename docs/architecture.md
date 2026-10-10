# Architecture: the extension seams

Where to plug in a route, a manifest section, a Surface or a Pin kind. Everything else follows from the code.

## Routes

`server/app.ts` holds one ordered `routes` list of `[prefix, handler]`; the first matching prefix wins, so add a route above the `/__studio/` UI catch-all and the `/` Game Project catch-all. A handler is

```ts
(req: IncomingMessage, res: ServerResponse, rest: string, studio: { root, manifest }) => unknown
```

`rest` is the decoded path after the prefix. Reply with `json`, `send` or `serveFile` from `server/static.ts`; a throw becomes a 500. Host, origin and JSON-POST checks (`refused`) run before any handler.

## Project Manifest

`server/schema.ts` is the JSON Schema (served at `/__studio/schema/studio.json`, `additionalProperties: false`); `server/manifest.ts` validates `studio.json` against it on start, adds checks the schema can't express (`feedback` inside the Game Project), and mirrors it in the `Manifest` type. A new section needs all three. A section's presence is its capability: on an absent section the UI shows "not set up" with that section's `examples[0]`, so give every optional section an example.

## Adding a Surface

1. A manifest section (above) and an entry in `surfaceSections` in `server/app.ts`, which feeds `/__studio/surfaces`.
2. Its reads: list and serve only the declared paths. `declared(section)` in `app.ts` does it for a path-or-glob section via `globFiles` (`server/globs.ts`); a Surface with its own layout writes a route module like `server/playtests.ts`.
3. `ui/<surface>.tsx` with its component, and a branch in `SurfaceView` in `ui/main.tsx`.
4. Its routes in the hash, through `ui/hash.ts`: `routeHref(surface, path, anchor)` builds `#<Surface>/<path>#<anchor>`, `splitRoute(route)` decodes it. Assets is the exception, with a `URLSearchParams` route.

## Adding a Pin kind

1. An entry in `pinKinds` in `server/feedback.ts`: `validate` (optional, rejects a malformed create) and `resolve` (does the Pin still point at something). Both live in that one entry.
2. `pinHref[kind]` in `ui/feedback.tsx`: where "go to pin" jumps.
3. A row in the kind table of `skills/feedback/SKILL.md`, so agents can read it.
4. A visual Pin attaches a screenshot: `capture(win, override?)` and `dataUrl` from `ui/capture.ts`, as `ui/assets.tsx` and `ui/play.tsx` do, passed to `PinForm` as `attach`.

## Writes

The Studio writes only into the `out` folders (`server/out.ts`, `PUT /__studio/out/<kind>/<file>`) and the Feedback folder (`server/feedback.ts`). A path built from the Game Project root goes through `inside(root, path)` from `server/static.ts`; `test/guardrails.test.ts` enforces it, with `// guardrail: contained (<why>)` for lines kept inside by other means.

## Tests

`test/harness.ts` is the only test code that touches `server/`: `startStudio` / `runStudio` run `bin/studio.js` as a child process, `tempProject` and `fixture` give Game Projects, `postJson` and `rawRequest` speak HTTP, and `noBrowser` / `openBrowser` (over `server/cdp.ts`) drive a headless browser for `studio check` and UI smoke tests.
