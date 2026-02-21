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
   - [ ] rollback path confirmed for 5% ring.
   - [ ] incident commander/on-call coverage confirmed.
   - [ ] single active canary rule confirmed.

## Decision Record
- Decision: `Promote to 5%` | `Hold` | `Freeze/Rollback`
- Decision timestamp (UTC):
- Operator:
- Reviewer:
- Evidence package links:
  - Rollout report:
  - DEP-03 readiness:
  - Dashboard captures:
  - Incident packet (if any):

## If Hold Or Freeze
1. Record exact failing gate(s).
2. Record owner and ETA for remediation.
3. Re-run this checklist only after remediation evidence is attached.
