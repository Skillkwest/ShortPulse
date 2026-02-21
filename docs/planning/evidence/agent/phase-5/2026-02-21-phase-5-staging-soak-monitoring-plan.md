# Phase 5 Evidence: Staging Soak Monitoring Plan

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Staging soak control window)

## Soak Window
- Ring: Staging soak 24h
- Start: 2026-02-21 15:13:00Z
- Target end: 2026-02-22 15:13:00Z
- Promotion constraint: do not promote before target end and full gate review.

## Checkpoint Cadence (UTC)
| Checkpoint | Target Time | Status | Operator | Notes |
| --- | --- | --- | --- | --- |
| C1 | 2026-02-21 21:13:00Z | Pending | TBD | |
| C2 | 2026-02-22 03:13:00Z | Pending | TBD | |
| C3 | 2026-02-22 09:13:00Z | Pending | TBD | |
| C4 (final) | 2026-02-22 15:13:00Z | Pending | TBD | Final gate decision checkpoint |

## Metrics To Capture Per Checkpoint
1. p95 and p99 latency by flow (`text`, `mixed/image`).
2. Timeout rate and 5xx rate.
3. Refusal-rate delta versus baseline.
4. Continuity SLI (reload continuity success).
5. Contract rejection rate by reason.

## Gate Thresholds (must pass)
1. p95 text <= 1800 ms; mixed/image <= 4500 ms.
2. p99 text <= 3500 ms; mixed/image <= 8000 ms.
3. Timeout rate <= 0.3% text and <= 0.8% mixed/image (hard fail > 1.0% any 30-minute window).
4. 5xx rate <= 0.5% text and <= 0.8% mixed/image (hard fail > 1.0% any 30-minute window).
5. Refusal delta <= +1.5pp (hard fail > +2.0pp).
6. Continuity SLI >= 99.5%.

## Freeze And Rollback Triggers
1. Any hard-fail threshold breach above.
2. Sev-1 or Sev-2 issue attributable to agent rollout.
3. Missing rollback verification evidence for next ring.

## Evidence Links
- Rollout report: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md`
- DEP-03 readiness: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`
- Rollout SOP: `docs/sops/sop_ai_studio_agent_rollout_operations.md`

## Completion Criteria
1. All four checkpoints recorded.
2. No unresolved gate failures at final checkpoint.
3. Final decision logged in rollout report and tracker ring table.
