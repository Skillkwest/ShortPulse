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
4. DEP-03 dashboard/alert artifacts are fully linked and reviewed.

## Promotion Gate Checklist
1. Reliability and latency budgets:
   - [ ] p95 within budget by flow.
   - [ ] p99 within budget by flow.
   - [ ] timeout rate within budget.
   - [ ] 5xx rate within budget.
2. Behavioral safety:
   - [ ] refusal delta within budget.
   - [ ] continuity SLI >= 99.5%.
   - [ ] contract rejection rate stable (no 2x spike).
3. Control readiness:
   - [x] rollback path confirmed for 5% ring.
   - [ ] incident commander/on-call coverage confirmed.
   - [x] single active canary rule confirmed.

## Decision Record
- Decision: `Hold`
- Decision timestamp (UTC): `2026-02-23 01:15:33Z`
- Operator: `@codex`
- Reviewer: `TBD`
- Evidence package links:
  - Rollout report: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md`
  - DEP-03 readiness: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`
  - Dashboard captures: not attached in repo evidence set (blocking)
  - Incident packet (if any): none

## If Hold Or Freeze
1. Record exact failing gate(s).
2. Record owner and ETA for remediation.
3. Re-run this checklist only after remediation evidence is attached.

Soak-exit hold details:
1. Failing gates:
   - DEP-03 external dashboard URLs not attached.
   - DEP-03 external alert policy/escalation URLs not attached.
   - Ring metrics (p95/p99/timeout/5xx/refusal/continuity/contract-rejection) not evidenced via dashboard captures in repo packet.
2. Owner: Ops (`DEP-03`) and AI Platform (`metrics evidence packet assembly`).
3. ETA: before any Production 5% promotion.
