# Coding standards

Judgement calls for review. Mechanical rules live in `tsc` and `test/guardrails.test.ts`; `npm run check` runs both.

## Tests check external behaviour

A test asserts on what the Studio does from outside: HTTP responses, files on disk, and the Kits' console APIs (`PT.*`, `promo.*`). It never asserts on React component internals or server module structure.

- **Seam 1 (primary)**: start `studio <fixture>` through `test/harness.ts`, make requests, assert on responses and files. The UI uses this same API, so Surface behaviour shows up here, e.g. as Feedback files.
- **Seam 2**: `studio check` in a real browser, running the Kit self-test against a real Game Adapter.
- UI smoke tests (`openBrowser`) assert on what a user sees on the page, and stay few. There are no UI component tests: the thin Surfaces are viewers, and their effects are already covered by seam 1.

## Glossary terms, exactly

Code, comments, docs, UI text and test names use the `GLOSSARY.md` terms and none of their _Avoid_ words: Project Manifest, never "config"; Surface, never "tab" or "page"; Feedback, never "comment" or "note". **Pin** means only a Feedback Pin; the `studio` field of `studio.json` is the "version pin", always with "version".

## One Pin kind, one entry

A Pin kind's server rules (validation and resolution) live together in its one `pinKinds` entry in `server/feedback.ts`, never split across `invalid()` or the routes. Its UI and agent sides follow the checklist in `docs/architecture.md`.
