# Issue tracker: GitHub

Issues and specs for this repo are GitHub issues on `TheClaessens/studio`. Use the `gh` CLI.

## Conventions

- A spec is one issue. Implementation tickets are separate issues that link back to it.
- Triage state is a label (see `triage-labels.md`).
- Conversation happens in issue comments.

## When a skill says "publish to the issue tracker"

`gh issue create --repo TheClaessens/studio --title … --body-file … --label …`

## When a skill says "fetch the relevant ticket"

`gh issue view <n> --repo TheClaessens/studio --comments`

## Wayfinding operations

Used by `/wayfinder`.

- **Map**: an issue labelled `wayfinder:map` (Destination / Notes / Decisions so far / Not yet specified / Out of scope).
- **Child ticket**: a native **sub-issue** of the map, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`):
  `gh api -X POST repos/TheClaessens/studio/issues/<map>/sub_issues -F sub_issue_id=<ticket's id, not its number>`
- **Blocking**: native issue dependencies:
  `gh api -X POST repos/TheClaessens/studio/issues/<n>/dependencies/blocked_by -F issue_id=<blocker's id>`
- **Frontier**: the map's open sub-issues that have no assignee and no open blockers, lowest number first.
- **Claim**: `gh issue edit <n> --add-assignee @me`, before any work.
- **Resolve**: post the answer as a comment headed `## Answer`, close the issue, then add a context pointer (name + link + gist) to the map's Decisions so far.
