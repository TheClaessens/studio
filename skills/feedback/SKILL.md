---
name: feedback
description: Work the Feedback queue of a Game Project — the markdown items a human pinned in the Studio. Use when asked to "work the feedback", address or triage Feedback, or when renaming an asset, catalogue id, file or heading that Feedback Pins point at.
---

# Feedback

Feedback is a queue of plain markdown files in the Game Project. Each item is one human remark with one Pin (what it points at). You work the queue by reading and editing those files directly; the Studio does not need to be running.

## Find the queue

1. Read `studio.json` at the Game Project root. Its `feedback` key names the folder; with no key, the folder is `feedback/`. A missing folder means an empty queue.
2. Every `*.md` file in that folder is one item, named `<YYYYMMDD-HHMM>-<slug>.md`. Files beside it with the same name and another extension (`.png`, `.jpg`, `.webp`, `.gif`, `.json`) are its attachments.
3. The open items are the files whose frontmatter has `status: open` (e.g. `grep -l '^status: open' feedback/*.md`). That list is your queue.

## The item file

This is an item an agent has just addressed. The Studio wrote everything above `## Resolution`:

```markdown
---
status: addressed
pin:
  kind: "doc"
  path: "DESIGN.md"
  anchor: "combat"
  label: "Combat"
author: "Ada Tester <ada@example.com>"
created: "2026-10-10T09:12:44.512Z"
---

Combat reads too slow, cut a step.

## Resolution

Merged the wind-up and strike steps into one in DESIGN.md#combat. Commit 3f9c2ab.
```

- **Frontmatter** is flat `key: value` lines plus the indented `pin:` map. Every value is JSON (strings double-quoted and escaped, numbers bare, objects inline on one line), except `status`, which is a bare word: `open`, `addressed` or `closed`. Keep that shape when you edit: change only the lines you mean to, and write any new value as JSON.
- `author` comes from git config and `created` is an ISO timestamp; both are the human's, never yours.
- **Body** is the remark. A reopened item carries more: each reopen appends a line `---` and the human's new remark, so the body reads remark, resolution, `---`, new remark, and so on. The last remark is what the human wants now; the earlier ones and their resolutions are history.

## Pins

A Pin is a stable reference, never a Studio URL. Every Pin has `kind` and a `label` (the quoted name of the thing at pin time, so the item stays readable after a rename), plus `path` (relative to the Game Project) or `id` (a catalogue id), and an optional anchor that narrows it. Pins on visual targets reference a screenshot attachment by file name.

| kind | points at | fields |
|---|---|---|
| `asset` | a catalogued asset | `id` alone is the whole asset; `id` + `anchor` (an anchor name from the catalogue: a pose or animation) is one animation; `id` + `anchor` + `t` (number, position within the anchor's range) is one frame. `screenshot` |
| `media` | a file matched by the `media` globs | `path`, plus `t` (seconds into a video) or `region` (`{"x":…,"y":…,"w":…,"h":…}`, a dragged rectangle on an image). `screenshot` |
| `playtest` | one finding in a playtest report | `path` to the report under the `playtests` root (e.g. `design/playtest/round-3/REPORT.md`), `anchor` as `<heading>` or `<heading>/<n>` for the n-th numbered item under that heading (e.g. `top-issues/2`); `label` is the finding's quoted title |
| `doc` | a design doc matched by the `docs` globs | `path`, optional `anchor` (a heading anchor) |
| `play` | a moment in the running game | `path` (the play entry), `screenshot` and `snapshot` (the JSON the game's hooks reported at that moment) |

A **heading anchor** is the GitHub-style slug of the heading text: lowercase, punctuation dropped, spaces to dashes; a repeated heading gets `-1`, `-2` on its later copies (`notes`, `notes-1`).

Attachment fields hold a file name in the same folder: `screenshot: "20261010-0912-combat-reads-too-slow.png"`. Read the screenshot to see what the human saw, and the `snapshot` JSON for the game state.

## Address an item

For each open item:

1. Read the last remark, the Pin, and its attachments. Open the pinned target (the asset's catalogue entry and source, the doc section, the report finding, the media file, the play state) and decide what the remark asks for.
2. Make the change in the Game Project and commit it.
3. Edit the item: set `status: addressed`, then append at the end of the file a `## Resolution` section saying what changed, where, and the commit hash from step 2.
4. Commit the item file.

The item is done when its file says `status: addressed` and ends with a `## Resolution` naming a real commit. Leave it there: `addressed` is the last status you set. The human reviews it in the Studio and closes it, or reopens it with a new remark, which puts it back in your queue as `open`.

If a remark is unclear or asks for something you should not do, leave the item `open` and tell the human why in your reply.

## Keep Pins attached through renames

A Pin stops resolving when its target moves. Whenever you rename or move something, search the feedback folder for Pins on it and update them in the same commit:

- an asset's catalogue `id` → every Pin with that `id`
- an anchor (pose or animation) → every `asset` Pin with that `id` and `anchor`
- a file (doc, report, media, play entry) → every Pin with that `path`
- a heading → every `doc` or `playtest` Pin with that `path` and the old heading anchor; recompute the slug from the new heading, including any `-1` suffixes that shift

Change only the reference fields (`id`, `path`, `anchor`). Leave `label` as it is: it records what the human pinned.
