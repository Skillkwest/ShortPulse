---
title: MVP UI/UX Issue Board
status: Active
owner: Product + Design + Frontend Engineering
created: 2026-02-14
last_updated: 2026-02-14
source_plan: docs/planning/mvp-ui-ux-stabilization-remediation-plan.md
source_tickets: docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md
---

# MVP UI/UX Issue Board

Purpose: provide a single execution board for the UI/UX remediation track with concrete owners, current status, and acceptance evidence links.

## Assignee roster (current)
- `worldbuilder` (acting Product owner)
- `worldbuilder` (acting Design owner)
- `worldbuilder` (acting Frontend owner)
- `worldbuilder` (acting QA owner)
- `worldbuilder` (acting Engineering lead)

Note: this board uses current acting ownership to keep execution unblocked. Replace owners here if responsibilities are delegated.

## Status legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Done`
- `Paused`

## Temporary paused scope (2026-02-14)
- Stripe/subscription pipeline implementation and related subscription cancel/downgrade modal validation are paused.
- Deferred ticket: `UX0-D1`.

## UX-0 active queue

| Ticket ID | Status | Primary owner | Reviewer | Target date | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| `UX0-01` | `Done` | `worldbuilder` | `worldbuilder` | 2026-02-15 | `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md` |
| `UX0-02` | `Done` | `worldbuilder` | `worldbuilder` | 2026-02-15 | `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md` (active-scope keyboard pass complete; subscription modal path moved to deferred paused ticket) |
| `UX0-03` | `Done` | `worldbuilder` | `worldbuilder` | 2026-02-14 | `docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md` |
| `UX0-04` | `Done` | `worldbuilder` | `worldbuilder` | 2026-02-14 | This board + source plan owner assignments |
| `UX0-D1` | `Paused` | `worldbuilder` | `worldbuilder` | TBD (resume later) | Deferred while Stripe/subscription pipeline work is paused |

## Remaining queue (UX-1 to UX-7)

| Ticket ID | Status | Primary owner | Reviewer | Target sprint |
| --- | --- | --- | --- | --- |
| `UX1-01` | `Done` | `worldbuilder` | `worldbuilder` | Sprint A |
| `UX1-02` to `UX1-05` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint A |
| `UX2-01` to `UX2-07` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint B |
| `UX3-01` to `UX3-04` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint B |
| `UX4-03` | `Done` | `worldbuilder` | `worldbuilder` | Sprint C |
| `UX4-01`, `UX4-02`, `UX4-04`, `UX4-05` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint C |
| `UX5-04` | `Done` | `worldbuilder` | `worldbuilder` | Sprint C |
| `UX5-01` to `UX5-03` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint C |
| `UX6-01` to `UX6-04` | `Done` | `worldbuilder` | `worldbuilder` | Sprint A/B |
| `UX7-01` to `UX7-04` | `Not Started` | `worldbuilder` | `worldbuilder` | Sprint C |

Evidence for `UX1-01`: `frontend/pages/_app.tsx`, `frontend/styles/viewport-lock.css`, plus post-change capture rerun via `/tmp/ux0_baseline_capture.js` and `/tmp/ux0_keyboard_full.js`.
Evidence for `UX4-03`: `frontend/styles/foundation.css`.
Evidence for `UX5-04`: `docs/styles-structure.md`, `frontend/styles/globals.css`.
Evidence for `UX6-01` through `UX6-04`: `frontend/eslint.config.mjs`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, and `docs/change_log.md` (2026-02-14 reliability + tooling entries).
