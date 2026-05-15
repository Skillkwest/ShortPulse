# D-Bug Tools

Purpose: record helper commands, inspection patterns, and validation habits that support D-Bug's debugging workflow.

## Preferred commands

- Fast text search:
  - `rg "<pattern>" frontend docs`
- Fast file discovery:
  - `rg --files frontend docs`
- Targeted type or lint/build checks:
  - `cd frontend && npm run test -- <file-or-pattern>`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
- Frontend startup:
  - `cd frontend && npm run dev`
- D-Bug score computation:
  - `node scripts/d_bug_scorecard.mjs --scope 8 --evidence 9 --validation 7 --stop 8 --communication 8 --learning 9`

## Debugging habits

- Prefer targeted commands over repo-wide sweeps when the failing surface is known.
- Prefer targeted test files or patterns before full-suite reruns when the failing lane is narrow.
- Distinguish observed evidence from root-cause inference in reports.
- Validate the exact failing path when practical instead of relying only on static inspection.

## Standing automation

- Automation name: `D-Bug handoff sweep`
- Automation id: `d-bug-handoff-sweep`
- Cadence: hourly
- Purpose: watch D-Bug handoffs, continue only `open` lanes, and stop when a lane becomes `done`, `blocked`, or `handed_off`
- Checkpoint scoring template: `docs/records/artifacts/agent/d-bug/checkpoint-review-template.md`
- Cumulative training rollup: `docs/records/artifacts/agent/d-bug/overall-training-log.md`
- Scorecard source of truth: `docs/records/artifacts/agent/d-bug/performance-scorecard.md`

## Future additions

- Capture recurring repro commands and focused scripts after real runs establish them.
