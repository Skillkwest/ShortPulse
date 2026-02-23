# Phase 5 Evidence: DEP-03 Ops Intake Template

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Progressive Rollout)

## Purpose
Collect the external dashboard and alert artifacts required to close `DEP-03` and allow promotion beyond staging soak.

## Submission Metadata
- Submission timestamp (UTC): 2026-02-23 01:43:14Z
- Submitted by: @codex
- Reviewed by: TBD
- Environment scope: `staging`

## Required Dashboard URLs
1. Latency by stage + flow: NOT PROVIDED (waiver active)
2. Error + timeout rates by ring: NOT PROVIDED (waiver active)
3. Refusal-rate delta versus baseline: NOT PROVIDED (waiver active)
4. Contract rejection rate by reason: NOT PROVIDED (waiver active)
5. Continuity success-rate: NOT PROVIDED (waiver active)

## Required Alert/Policy URLs
1. Sev-2 latency/error/timeout alert policy: NOT PROVIDED (waiver active)
2. Sev-2 continuity SLI alert policy: NOT PROVIDED (waiver active)
3. Sev-3 contract-rejection spike alert policy: NOT PROVIDED (waiver active)
4. On-call escalation target/runbook: `docs/sops/sop_ai_studio_agent_rollout_operations.md` (repo runbook only; external escalation URL still required)

## Evidence Of Validation
1. Screenshot or snapshot timestamp proving each panel is populated: operator-provided Vercel Observability capture indicates plan-tier-gated alerting and no function telemetry in selected range.
2. Alert test or synthetic trigger evidence (if available): NOT AVAILABLE (tooling unavailable on current plan tier).
3. Confirmation that alert routing targets are reachable: MANUAL runbook path available; external policy URL unavailable on current plan tier.

## Acceptance Decision
- DEP-03 decision: `Accepted (Waiver active)`
- Missing items: external dashboard panel URLs and external alert policy/escalation URLs remain pending for waiver retirement.
- Follow-up owner: Ops
- Follow-up due date: before DEP-03 waiver retirement

Waiver reference:
- `docs/planning/evidence/agent/phase-5/2026-02-23-phase-5-dep-03-vercel-observability-waiver.md`
