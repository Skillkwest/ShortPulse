# Phase 5 Evidence: DEP-03 Vercel Observability Waiver

Date: 2026-02-23  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Progressive Rollout)  
Owner: @sleepyseamonster

## Decision

`DEP-03` external dashboard/alert URL completion is waived as a promotion blocker due current Vercel plan-tier observability limits.

## Why

1. Project is on Vercel Hobby plan where advanced observability/alerts are plan-gated (`Upgrade to Pro` surfaced in Observability UI).
2. Functions view showed no available telemetry in the selected production window (`No data in this time range`) despite healthy deploy/CI posture.
3. Waiting for full panel/policy URLs would create non-actionable schedule blockage with no runtime regression evidence.

## Scope of waiver

1. Allowed:
   - Promotion decisions may proceed without external dashboard/policy URLs when all compensating controls below are satisfied.
   - This waiver applies to current Phase 5 rollout progression and production capability decisions.
2. Required compensating controls:
   - Required CI checks are green on rollout SHA.
   - Contract, disable-path, and continuity suites stay green per ring.
   - Manual `/admin` incident/event review is recorded at ring checkpoints.
   - Vercel runtime-log verification and deployment health are reviewed each ring.
   - Rollback-first posture remains active; freeze triggers are unchanged.
3. Not allowed:
   - Marking DEP-03 as technically complete while external dashboards/alerts remain unavailable.

## Production capability posture

Under this waiver, DEP-03 remains a hardening follow-up item, not a production blocker.

## Exit criteria to retire waiver

1. Observability tooling is available (Vercel plan upgrade or equivalent external platform).
2. Dashboard links exist for latency, error/timeout, refusal delta, contract rejection, and continuity.
3. Alert policy/escalation links exist for Sev-2/Sev-3 gates and on-call routing.

## Evidence snapshot

1. Operator-provided Vercel Observability screenshot (2026-02-23 collaboration capture) showed:
   - `Upgrade to Pro` banner for advanced observability/alerts.
   - No Functions data in selected window.
2. Latest required CI evidence remained green on rollout branch:
   - `https://github.com/sleepyseamonster/ShortPulse/actions/runs/22289631768`

## Related artifacts

- `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`
- `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-ops-intake-template.md`
- `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-pre-promotion-gate-checklist.md`
- `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-5pct-promotion-decision-packet.md`
- `docs/sops/sop_ai_studio_agent_rollout_operations.md`
