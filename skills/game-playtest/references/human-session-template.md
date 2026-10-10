# Human session template

A human tester's session, in the same shape as a persona report so the synthesis can weigh it like one. Write it as `rounds/round-N/00-human.md` (`00-human-<name>.md` when several humans tested the round). Keep the tester's own words; translate if needed and say so. Add no scores, verdict or severity the tester didn't give: a human's "this is annoying" is a finding, not a "major".

The frontmatter tells the Studio this is a human, so it shows the human mark and never an AI persona's look. `tester` is how they want to be named, or leave it out.

```markdown
---
kind: human-session
round: N
tester: <name, optional>
---
# Human playtester — <what they played> · playtest round N
Source: <where the notes came from: chat, call, form>, <date>. <Translated from … if so.> Weighted like any persona report in the synthesis.

**In their words.** <one or two lines that sum up the session, quoted> Fun: x/10 · Would play again tomorrow: yes/no/maybe   ← only if they said so

## Findings
1. **<short title>** — "<their words>" (area: <feel / balance / bug / onboarding / …>) · Severity: <only if their words support one>

## Findings (machine-readable)
```json
[{ "area": "feel", "type": "issue", "severity": "minor", "finding": "…", "evidence": "human session", "recommendation": "" }]
```
```

In the synthesis, list the human session in the scorecard with what they gave (leave missing scores empty) and count them in `Raised by` as `human`.
