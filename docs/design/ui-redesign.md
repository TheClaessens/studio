# UI redesign: from foundation to platform (2026-10-10)

The design for turning the Studio's boilerplate UI into a usable, readable platform, and **every change the codebase needs to get there**. Nothing here is dropped: items that need a decision before they can be built are listed under [Open decisions](#open-decisions), not removed.

Design canvas (private until shared): https://claude.ai/code/artifact/3df46e94-3d54-4eaa-b32b-ed143376635f. Rounds 1–7 on the canvas record how each decision below was reached; the Round 5 component sheet and the Round 6–7 pages are the source of truth for visuals.

Vocabulary follows `GLOSSARY.md` (Surface, Pin, Feedback, Game Project, Kit…). Text in `[brackets]` on the canvas marks a placeholder, not a design decision.

## Decisions

| # | Decision | Context |
|---|---|---|
| D1 | **Layout C, theme B.** Dark ink top bar (project name, one link per Surface, ⌘K), paper body, Surface-specific left rail, content column, right rail ("On this page", Feedback). | Round 1 explored A Workbench, B Reading Room, C Mission Board. |
| D2 | **Atomic design.** Tokens → atoms → molecules → organisms → pages; the component sheet is the contract. | Round 5. |
| D3 | **Markdown via TanStack Markdown** (`@tanstack/markdown`, React adapter) with Studio extensions that turn known conventions into components. | Replaces `marked`. See [Markdown](#markdown). |
| D4 | **Files declare their kind in frontmatter.** We own the skills that write playtest files, so recognition is explicit, not guessed. | `kind: playtest-report \| persona-report \| human-session \| round-addendum \| design-spec …` |
| D5 | **Human testing goes through the same skill and format** as AI personas (`kind: human-session`). Riftbound round 3 already has `00-human.md`. | A human tester gets a distinct mark so they're never mistaken for an AI persona. |
| D6 | **Personas are recognisable beyond their name**: generated pixel-art portrait, sigil, colour, voice, play plan, own questions. | Rounds 3–4. |
| D7 | **Portraits are 32 × 32 pixel art, generated once** when a persona joins the panel, by the skill (the Studio only displays the file). No regenerate / variants in the Studio. | Shown only at whole multiples (32, 64, 128) with `image-rendering: pixelated` and stepped corners; under 32 px the sigil is used. |
| D8 | **Game imagery sits on ink, reading sits on paper.** Asset stage, Play frame, media thumbnails and the lightbox are dark. | Round 7. |
| D9 | The **pending / shimmer** pattern is a general one for running work (e.g. a playtest round in progress, `studio check`), not for portraits. | See open decision O2. |

## Tokens

**Colour — surface and ink**

| Token | Value | Use |
|---|---|---|
| `ink` | `#1d1b17` | text, top bar, primary buttons, dark stages |
| `ink-2` | `#3a362f` | secondary text |
| `dim` | `#6b665c` | labels, meta |
| `line-strong` | `#d9d3c6` | control borders |
| `line` | `#e0dbd0` | card borders, dividers |
| `sunken` | `#ede9e1` | left rail, chips, tags |
| `paper` | `#f5f2ec` | page ground |
| `raised` | `#fbf9f5` | cards, panels |
| `accent` | `#b4441c` | current Surface marker, "waiting for you", focus of attention |
| `stage` | `#141310` | lightbox ground (ink variant) |

**Colour — severity** (fill / text, both ≥ 4.5:1; badge also carries 1–4 bars so it never relies on colour)

| Severity | Fill | Text |
|---|---|---|
| blocker | `#f6d9cf` | `#8a2410` |
| major | `#f3e4c2` | `#6e4f0c` |
| minor | `#dbe7f3` | `#244a72` |
| polish | `#e8e4dc` | `#4a463e` |

**Colour — verdict** (protocol's five verdicts; each also has a shape)

| Verdict | Fill / text | Shape |
|---|---|---|
| Real bug | blocker pair | circle |
| Design flaw | major pair | triangle |
| Harness artefact | minor pair | square |
| Bot limitation | polish pair | bar |
| Unverified | dashed outline, `#4a463e` | ring |

**Colour — Feedback status**: Open (outline `#8f897e`), Waiting for you (`accent` fill), Closed (polish pair), Pin not found (dashed `#8a2410`).

**Colour — personas** (from `PERSONAS.md`; colour / mid / tint). Defaults for the core panel:

| Persona | Colour | Mid | Tint | Sigil |
|---|---|---|---|---|
| Mila | `#b0446a` | `#e2a9bd` | `#f6e1e8` | crescent moon |
| Viktor | `#5b3fa8` | `#bfb0e4` | `#e8e2f5` | stacked blocks |
| Noor | `#1f6d77` | `#9cc8cd` | `#dcecee` | compass |
| Rhea | `#8f1f2e` | `#d99ca4` | `#f3dcdf` | crosshair |
| Ilse | `#8a6100` | `#dcc28a` | `#f3e8cf` | eye |
| Dex | `#2f5486` | `#a6bcdc` | `#dde6f2` | bars |
| Sam | `#3f6b2c` | `#aac899` | `#e1ecd9` | open book |

Extended-library personas need colours and sigils chosen the same way (distinct shape first, colour second).

**Type**

| Role | Face | Size / weight |
|---|---|---|
| display | Newsreader | 48–56 / 500 |
| title | Newsreader | 34–44 / 500 |
| heading | Newsreader | 28 / 500 |
| finding | Newsreader | 20 / 500 |
| body | Geist | 14 / 400 |
| label | Geist | 12 / 600 |
| code, paths | Geist Mono | 12 |
| annotation | Caveat | 24–26 / 600 |

**Space** 4 8 12 16 20 24 32 40 56. **Radius** 8 control, 12 card, 16 panel, pill; pixel-step for portraits.

## Components

**Atoms**: button (primary / secondary / ghost / disabled), pin button (empty / with count), segmented control (Rendered / Source; pin scope), filter pill, severity badge, verdict tag, Feedback status chip, tag (evidence, domain, meta), sigil, portrait (32 / 64 / 128, generated or sigil fallback), meter (score bar, hands meter), pending shimmer, Surface link and ⌘K search (on ink), kbd.

**Molecules**: finding (number, title, severity, "raised by" portrait stack, pin), score tiles, callout (info / tip / warning), tension card (side A vs side B by persona, resolution), backlog lanes (Now / Next / Later), pin form, Feedback card (status, pin target, remark, agent resolution, close / reopen), persona card, sidebar rows (file, persona), persona quote (in the persona's voice), annotated shot.

**Organisms**: top bar, Surface left rail (rounds with persona rows; doc tree; catalogue; inbox filters; media folders), right rail (outline, panel, Feedback on this file), persona header (portrait, name, quote, verdict, scores, "How she played"), scorecard, findings explorer, asset stage + transport, play frame, media grid, lightbox.

## Markdown

TanStack Markdown parses once into a serialisable tree; Studio extensions (`transformDocument`, `parseBlock`, `inlineParser`) turn conventions into component nodes, and the React `components` map renders them. The docs extensions supply callouts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`) and frontmatter.

| Written in the file | Recognised by | Rendered as |
|---|---|---|
| frontmatter `kind` | parser (frontmatter) | chooses the block set and page template |
| persona H1 + `Fun: n/10 · Would play again tomorrow: … · Domain score: n/10` | `transformDocument` | persona header: verdict + score tiles |
| `Severity: blocker\|major\|minor\|polish`; a `Sev.` column | `inlineParser` / table transform | severity badge |
| `[evidence tag]` (bracket, not a link) | `inlineParser` | evidence tag |
| `(shot: \`file.png\`)` (+ optional caption, position — K4) | `inlineParser` | shot thumbnail / annotated shot, opens Media |
| top-level ordered item with a bold lead | existing finding rule | finding (pinnable, `section/n`) |
| `> [!NOTE]` etc. | docs extension | callout |
| table with a `Verdict` column | table transform | verdict tags |
| table under a `Scorecard` heading | table transform | scorecard with persona portraits, bars, Mean footer |
| table with `Side A` / `Side B` columns | table transform | tension cards |
| bold `Now` / `Next` / `Later` under a backlog heading | `transformDocument` | backlog lanes |
| `json` fence of `{area, type, severity, finding, …}` | code transform | findings explorer (filters, raw toggle) |
| `(LOCKED)` in a design-spec title | `transformDocument` | Locked badge, lock in the doc tree |
| `## 1. Pillars` numbered list | `transformDocument` | pillar cards |
| run-structure stage table | table transform | act timeline with boss markers |
| inline-code formulas in the scaling section | code transform | formula chips |
| class comparison table | table transform | comparison table, classes as columns |
| difficulty tiers range | `transformDocument` | stepped tier scale |
| everything else | standard renderer | house typography |

**Constraint — Pin anchors must not change.** Existing Pins store anchors from `server/slug.ts`: GitHub-style heading slugs (`-1`, `-2` for repeats) and `heading/n` finding anchors counted over top-level ordered items and numbered table rows. The new renderer must produce exactly these ids (override TanStack's heading ids), or existing Feedback stops resolving. Add a test that renders the fixtures with both and compares anchors.

## Pages

| Page | Canvas artboard | Key parts |
|---|---|---|
| Playtests · synthesis | `SynthesisPage` | header + stat strip with panel portraits; executive summary findings with verdict tags, persona quotes, "raised by"; scorecard per persona; verified table; tensions; backlog lanes; caveats callout; persona report cards |
| Playtests · persona report | `PersonaPage` | persona header (128 px portrait + sigil badge, quote, verdict in the persona's voice, scores, "How she played"); pain points with annotated shots and links to the synthesis; her questions answered; session log; findings explorer; panel in the right rail |
| Docs | `DocsPage` | doc tree with lock for locked specs; spec blocks (above); "Mentioned in playtests" |
| Feedback inbox | `FeedbackPage` | status + Surface filters; "Waiting for you" as full cards with the agent's resolution; Open as compact rows; Unresolved pins; Closed collapsed |
| Assets | `AssetsPage` | catalogue with filter and counts; dark stage; animation chips; transport (play, frame step, scrubber, Feedback markers on frames); pin scope (asset / animation / frame) |
| Play | `PlayPage` | dark frame (16:9), entry path, hooks badge, reload, fullscreen; "Pin this moment" with label, screenshot / snapshot hint, paste |
| Media | `MediaPage` | folders; "taken by" persona filter; type filter; tiles on ink with persona portrait and pin count |
| Media lightbox | `MediaLightbox` | region drag, prev / next, Esc; taken by, used in, pin form with cropped preview |
| Not set up | — | restyle of today's "add a `section` to `studio.json`" state, in the same shell |

## Changes needed

Status today: the data model and every Pin kind already exist; most of the work is UI, plus new parsing and skill-format changes. IDs are for issues.

### U — UI only (data already served)

- **U1** Tokens as CSS custom properties; replace `ui/studio.css` and `ui/assets.css`.
- **U2** Bundle fonts locally (Newsreader, Geist, Geist Mono, Caveat; all OFL) via npm packages. The Studio is local and must not depend on Google Fonts.
- **U3** Atoms and molecules as React components (one file each, or one folder per level), matching the component sheet.
- **U4** App shell: ink top bar with Game Project name (`manifest.name`), one link per Surface from `/__studio/surfaces` (not-set-up Surfaces dimmed), Feedback count badge ("waiting for you").
- **U5** Rendered / Source toggle on every markdown view (raw text is already fetched).
- **U6** "On this page" outline from rendered headings.
- **U7** Feedback counts everywhere a Pin can go: pin buttons on findings and headings, asset tree counts (exist), scrubber markers for frame Pins, media tile counts, top-bar badge. All from `/__studio/feedback`.
- **U8** Feedback inbox redesign: status groups, filter by Pin kind, cards vs rows, split the agent's `## Resolution` out of the item body (reopens append `---` + remark; render history in order).
- **U9** Assets: catalogue filter, animation chips, transport with frame step, scope segmented control (logic exists in `NewFeedback`).
- **U10** Play: frame chrome (entry, hooks badge, reload, fullscreen); existing pin form.
- **U11** Media: type filter, tiles on ink, lightbox prev / next, side panel layout.
- **U12** "Not set up" state in the new shell.
- **U13** Responsive: rails stack under the content at phone width; wide tables scroll in their own box.

### S — New work in the Studio (server or parsing)

- **S1** Replace `marked` with TanStack Markdown; port the finding / anchor rules (constraint above), then add the extensions in [Markdown](#markdown).
- **S2** Personas: parse `PERSONAS.md` (persona frontmatter: `id, color, sigil, portrait, look`, plus archetype, quote, hands, save, model, play plan, questions) and serve it (e.g. `GET /__studio/personas`); map report files to personas by `NN-<id>.md` and frontmatter `persona`.
- **S3** Render loose playtest markdown: `server/playtests.ts` marks only round layout files as markdown, so `BRIEF.md` and `PERSONAS.md` at the playtests root show raw.
- **S4** Shot index: collect `(shot: …)` references across reports, resolve them to Media paths, serve "taken by" / "used in" per media file. Check first that report shot paths line up with the `media` globs.
- **S5** Cross-references: render explicit links between synthesis findings ↔ persona findings and playtests ↔ doc sections (written by the skills, K2); serve "mentioned in" for docs.
- **S6** ⌘K command palette: jump to Surface, file, heading, finding, persona; needs a content index (headings per file).
- **S7** Scorecard / stats parsing from the synthesis and persona reports (Fun, Again tomorrow, Domain score, Testers line) — client or server side.
- **S8** Human sessions: render `kind: human-session` with the human mark; already matches `NN-<name>.md` (e.g. `00-human.md`).
- **S9** Portrait files: serve persona portraits (they live under the playtests root, so `playtestFiles` already lists them); sigil fallback when missing.

### K — Skill and format changes (`skills/`)

- **K1** Frontmatter on every file the skills write: `kind`, `round`, `persona` (persona reports), `build` (synthesis). Update `brief-template.md`, `protocol.md` (REPORT template) and `game-design` spec template.
- **K2** Explicit links instead of prose: each synthesis finding links the persona findings it came from; findings that touch the design spec link the doc section.
- **K3** Machine-readable "raised by": the Top issues `Raised by` column lists persona ids.
- **K4** Shot references may carry a caption and a position: `(shot: \`x.png\` · caption: "…" · at: 0.42,0.55)`.
- **K5** `PERSONAS.md` persona frontmatter (D6) and **portrait generation once** per persona in `game-playtest` (D7): house-style line (32 × 32 pixel-art bust, limited palette), `look`, mood from the quote, flat tint ground; saved as `playtest/personas/<id>.png`.
- **K6** Human testing (D5): a template for human sessions in the same shape as persona reports, and how the skill files it.
- **K7** Persona voice and colour for the extended library (Kai … Remy): sigils and colours.
- **K8** `feedback` skill: unchanged format; document that the Studio shows `## Resolution` as the agent's resolution.

## Open decisions

Kept, not dropped; each needs an answer before it is built.

- **O1 Project switcher.** The design shows a project switcher in the top bar, but one Studio process opens one Game Project. Options: show the name only; list recently opened projects and relaunch; one Studio serving several projects (a bigger change to `bin/studio.js`, routes and the manifest).
- **O2 Pending / running state.** The Studio reads files and has no live process state or file watching. A "round in progress" or "check running" state needs a source: file watching (new files appear as personas finish), a status file the skill writes, or the Studio launching the work itself.
- **O3 Portrait house style line.** Pixel art is decided; the exact shared style line (palette size, framing, lighting) is not.
- **O4 Docs ↔ playtests links.** Written by the skills (K2) only, or also inferred by the Studio from heading names.
- **O5 Extended-library persona identities** (K7): who picks colours and sigils, and whether a game can override them.

## Suggested order

1. U1–U3 tokens, fonts, components; U4 shell; U12 not-set-up.
2. S1 TanStack swap with the anchor-compatibility test, rendering exactly what `marked` renders today.
3. U5–U8, U13.
4. K1, K3 in the skills; S1 extensions for playtest blocks; S7.
5. K5 + S2, S3, S9 personas and portraits; S8, K6 human sessions.
6. U9–U11 game-facing Surfaces.
7. K2, K4 + S4, S5 cross-links, shot index, annotations.
8. S6 ⌘K; O1–O5 as decided.

## Progress

- **Step 1 (2026-10-10):** U1 tokens (`ui/design/tokens.css`), U2 local fonts (`@fontsource-variable/*`), U3 atoms (`ui/design/atoms.tsx`, `ui/design/personas.ts`; molecules follow with the Surfaces that use them), U4 shell (`ui/shell.tsx`, `GET /__studio/project`), U12 "not set up". Existing Surfaces restyled in place through `ui/studio.css` and `ui/assets.css` so they stay usable until their own redesign items.
- **Step 2 (2026-10-10):** S1 renderer swap. `ui/markdown.tsx` renders with TanStack Markdown (`marked` removed), plus two Studio extensions for what TanStack leaves out: setext headings and indented code. Anchors now come from the server's `headingAnchors`, so every anchor the page offers resolves as a Pin (UI smoke test over a document of edge cases). This fixed one old mismatch: a heading inside a quote used to reset the finding numbering on the page but not on the server. `headingAnchors` now skips a leading frontmatter block (feedback test), ready for K1. Studio blocks (the rest of S1) build on this.
