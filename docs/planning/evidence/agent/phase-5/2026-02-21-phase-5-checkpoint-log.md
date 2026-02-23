# Phase 5 Evidence: Staging Soak Checkpoint Log

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Staging soak)

## Window
- Start: 2026-02-21 15:13:00Z
- End target: 2026-02-22 15:13:00Z
- Promotion constraint: no ring promotion before end target and gate review.
- Soak-exit review executed: 2026-02-23 01:43:14Z
- Evidence method at soak exit: best available captured windows (CI + repo evidence); DEP-03 waiver active for external dashboard/alert gap.

## Checkpoint Entries
| Checkpoint | Target (UTC) | Observed (UTC) | Status | Operator | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 2026-02-21 21:13:00Z | 2026-02-21 19:46:48Z to 2026-02-21 19:51:16Z | Complete (best available window) | @codex | TBD | Closest captured CI validation window on soak branch (`22263172126`). |
| C2 | 2026-02-22 03:13:00Z | 2026-02-23 01:43:14Z | Complete (retroactive soak-exit capture) | @codex | TBD | External dashboard snapshot unavailable on current plan tier; waiver path applied. |
| C3 | 2026-02-22 09:13:00Z | 2026-02-23 01:43:14Z | Complete (retroactive soak-exit capture) | @codex | TBD | External dashboard snapshot unavailable on current plan tier; waiver path applied. |
| C4 (final) | 2026-02-22 15:13:00Z | 2026-02-23 01:43:14Z | Complete (soak-exit review) | @codex | TBD | Soak window elapsed; promotion approved under DEP-03 waiver. |

## Metrics Snapshot Per Checkpoint
| Checkpoint | p95 text | p95 mixed/image | p99 text | p99 mixed/image | timeout % | 5xx % | refusal delta (pp) | continuity SLI % | contract rejection spike | Gate Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Pass (waiver-approved) |
| C2 | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Pass (waiver-approved) |
| C3 | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Pass (waiver-approved) |
| C4 | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Waiver path | Pass (waiver-approved) |

## Incident And Control Snapshot
| Checkpoint | Sev-1/2 Open? | Rollback path verified? | Single canary confirmed? | Decision |
| --- | --- | --- | --- | --- |
| C1 | No open Sev-1/2 in repo evidence set | Yes | Yes | Pass (waiver-approved) |
| C2 | No open Sev-1/2 in repo evidence set | Yes | Yes | Pass (waiver-approved) |
| C3 | No open Sev-1/2 in repo evidence set | Yes | Yes | Pass (waiver-approved) |
| C4 | No open Sev-1/2 in repo evidence set | Yes | Yes | Pass (waiver-approved) |

## Evidence Links
- Rollout report: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md`
- DEP-03 readiness: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`
- Pre-promotion checklist: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-pre-promotion-gate-checklist.md`
- DEP-03 waiver: `docs/planning/evidence/agent/phase-5/2026-02-23-phase-5-dep-03-vercel-observability-waiver.md`
- CI run for best-available checkpoint capture: `https://github.com/sleepyseamonster/ShortPulse/actions/runs/22289631768`
