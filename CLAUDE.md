# Studio

Read `GLOSSARY.md` before changing anything. The spec is [Studio v1](https://github.com/TheClaessens/studio/issues/12).

Node 26 required: `nvm use` before `npm test`/`npm run check`. `npm run check` (tsc + tests) must pass before a commit.

Adding a Surface, route or Pin kind → `docs/architecture.md`.

Reviewing a change → `CODING_STANDARDS.md`.

## Agent skills

### Issue tracker

GitHub issues on `TheClaessens/studio`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as GitHub labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
