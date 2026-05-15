# Beeper Performance Scorecard

Purpose: define a stable scoring system for Beeper's supervised testing performance so each substantive run can be rated consistently out of 10.

This score is meant to be earned over time through better real-user coverage, cleaner evidence, stronger handoffs, and fewer repeated process mistakes.

## Scoring Method

Score each category from `0.0` to the category maximum.

Total possible: `10.0`

## Categories

### 1. Real-user fidelity (`2.0`)

- `2.0`: followed believable user flow, avoided debugger shortcuts, and tested the experience the way a real user would.
- `1.0`: mixed real-user behavior with too many artificial shortcuts.
- `0.0`: mostly debugger behavior, weak UX evidence.

### 2. Coverage expansion (`1.5`)

- `1.5`: expanded into a meaningfully new route, control set, or create/edit/save action.
- `0.75`: touched something new but shallowly.
- `0.0`: mostly repeated already-covered work without new evidence.

### 3. Evidence quality (`2.0`)

- `2.0`: findings backed by clear repro, usable screenshots or packet data, and trustworthy captures.
- `1.0`: evidence exists but is incomplete, noisy, or partially ambiguous.
- `0.0`: weak evidence or evidence not preserved.

### 4. Issue identification and triage (`1.5`)

- `1.5`: correctly separated blockers, functional issues, UI/UX notes, and positives, with good severity judgment.
- `0.75`: mostly correct classification with some ambiguity.
- `0.0`: poor classification or unreliable severity calls.

### 5. Code/handoff usefulness (`1.5`)

- `1.5`: narrowed likely code surfaces and produced a useful handoff when needed.
- `0.75`: some technical narrowing, but still broad.
- `0.0`: no meaningful debugging handoff value.

### 6. Training/logging discipline (`1.0`)

- `1.0`: notes, retained report, summary, coverage update, and training updates all completed cleanly.
- `0.5`: one required artifact missing or weak.
- `0.0`: multiple required artifacts missing.

### 7. Operational discipline (`0.5`)

- `0.5`: followed startup contract, used the right tools, avoided unsafe assumptions, and corrected mistakes quickly.
- `0.25`: minor process drift.
- `0.0`: material process miss.

## Interpretation

- `9.0 - 10.0`: strong supervised run, high reuse value
- `8.0 - 8.9`: good run, useful but with one clear improvement lane
- `7.0 - 7.9`: mixed run, valuable but inefficient or incomplete
- `below 7.0`: weak run, training correction needed before repeating the pattern

## Earning Rule

Beeper does not "get" a permanent score from one good run.

Beeper earns a stronger operating score by:

- raising the average quality of substantive runs,
- validating deeper end-to-end user workflows,
- reducing repeated mistakes,
- increasing true route/control/action coverage,
- and turning misses into durable process improvements.

The operating score should be judged from:

- the most recent substantive run scores,
- the current average of recent runs,
- and whether the weakest category is actually improving.

## Promotion Thresholds

- `9.0+` average across the latest `5` substantive runs: Beeper is operating strongly
- `8.0+` average across the latest `5` substantive runs: Beeper is useful but still has one or two systemic weak spots
- below `8.0` average across the latest `5` substantive runs: training is still paying off, but the workflow needs correction before scale

## Ledger Rule

Each substantive run should append a row to `docs/records/artifacts/agent/beeper/performance-ledger.md` with:

- the run name,
- the total score,
- the score breakdown,
- the weakest category,
- and the smallest improvement that would raise the next run

## Current Meta Assessment - 2026-05-15

- Current Beeper operating score: `8.2 / 10`
- Reason:
  - strong production issue yield
  - useful handoffs and evidence
  - real-user behavior improved the findings
  - too much meta-process logging relative to app coverage depth
  - some routes still only have shallow coverage
  - one viewport mistake required correction before the evidence was safe to trust

## Improvement Rule

When a substantive run scores below `9.0`, Beeper should record:

- the weakest category,
- the smallest mechanical improvement that would raise it,
- and whether the fix belongs in a helper, checklist, SOP, or training note.
