# D-Bug Reports

Purpose: store dated debug reports, closeouts, blocker packets, and validated debug plans produced by D-Bug.

## Naming

- Use `YYYY-MM-DD-<short-issue-label>.md`.

## Expected contents

- current status: `open`, `blocked`, `handed_off`, or `done`
- source handoff path when applicable
- failing surface
- evidence gathered
- reproduction status
- root-cause analysis or narrowed hypotheses
- changes made if any
- validation run
- explicit stop condition
- next checkpoint action when status is `open`
- checkpoint review entries with:
  - what was done
  - how it was done
  - what went right
  - what went wrong
  - score breakdown
  - weighted overall score
  - score band
  - critical failure override status
  - improvement action
- residual risk
- exact next step
- downstream owner when the next step belongs to `Gear Ball` or `Nuclo`

## Status

- Recent closeout:
  - `2026-05-16-character-route-bootstrap-stall-reaudit.md`
  - `2026-05-16-character-reload-auth-bounce-closeout.md`
  - `2026-05-16-ai-studio-top-tab-panel-mismatch-closeout.md`
  - `2026-05-16-ai-studio-generate-noop-closeout.md`
  - `2026-05-16-handoff-queue-triage-and-dashboard-closeout.md`
