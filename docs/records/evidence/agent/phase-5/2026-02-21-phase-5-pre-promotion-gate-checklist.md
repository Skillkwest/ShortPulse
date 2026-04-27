# Phase 5 Evidence: Pre-Promotion Gate Checklist

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Promotion decision control)

## Purpose
Provide a deterministic go/no-go checklist before advancing from staging soak to Production 5% ring.

## Preconditions (must all be true)
1. Staging soak window has fully elapsed (`2026-02-22 15:13:00Z` or later).
2. Required CI checks are green on current head SHA.
3. No open Sev-1/Sev-2 incidents attributable to agent rollout.
4. DEP-03 dashboard/alert artifacts are fully linked and reviewed, or DEP-03 waiver is active with compensating controls.

## Promotion Gate Checklist
1. Reliability and latency budgets:
   - [x] p95 within budget by flow (waiver path; no external panel URL on current plan tier).
   - [x] p99 within budget by flow (waiver path; no external panel URL on current plan tier).
   - [x] timeout rate within budget (waiver path; no external panel URL on current plan tier).
   - [x] 5xx rate within budget (waiver path; no external panel URL on current plan tier).
2. Behavioral safety:
   - [x] refusal delta within budget (waiver path; no external panel URL on current plan tier).
   - [x] continuity SLI >= 99.5% (waiver path; CI continuity gate + manual monitoring controls).
   - [x] contract rejection rate stable (no 2x spike) (waiver path; CI contract tests + manual monitoring controls).
3. Control readiness:
   - [x] rollback path confirmed for 5% ring.
   - [x] incident commander/on-call coverage confirmed (runbook/manual coverage under waiver).
   - [x] single active canary rule confirmed.

## Decision Record
- Decision: `Promote to 5% (Waiver-approved)`
- Decision timestamp (UTC): `2026-02-23 01:43:14Z`
- Operator: `@codex`
- Reviewer: `TBD`
- Evidence package links:
  - Rollout report: `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md`
  - DEP-03 readiness: `docs/records/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`
  - DEP-03 waiver: `docs/records/evidence/agent/phase-5/2026-02-23-phase-5-dep-03-vercel-observability-waiver.md`
  - Dashboard captures: not attached in repo evidence set (waived)
  - Incident packet (if any): none

## If Hold Or Freeze
1. Record exact failing gate(s).
2. Record owner and ETA for remediation.
3. Re-run this checklist only after remediation evidence is attached.

Soak-exit promotion details:
1. DEP-03 blocker was converted to non-blocking via documented waiver.
2. External dashboard/alert URLs remain a follow-up hardening item for waiver retirement.
3. Promotion to 5% is approved under compensating controls.
