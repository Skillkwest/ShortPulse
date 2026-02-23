# Phase 5 Evidence: DEP-03 Ops Intake Template

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Progressive Rollout)

## Purpose
Collect the external dashboard and alert artifacts required to close `DEP-03` and allow promotion beyond staging soak.

## Submission Metadata
- Submission timestamp (UTC): 2026-02-23 01:15:33Z
- Submitted by: @codex
- Reviewed by: TBD
- Environment scope: `staging`

## Required Dashboard URLs
1. Latency by stage + flow: NOT PROVIDED (blocking)
2. Error + timeout rates by ring: NOT PROVIDED (blocking)
3. Refusal-rate delta versus baseline: NOT PROVIDED (blocking)
4. Contract rejection rate by reason: NOT PROVIDED (blocking)
5. Continuity success-rate: NOT PROVIDED (blocking)

## Required Alert/Policy URLs
1. Sev-2 latency/error/timeout alert policy: NOT PROVIDED (blocking)
2. Sev-2 continuity SLI alert policy: NOT PROVIDED (blocking)
3. Sev-3 contract-rejection spike alert policy: NOT PROVIDED (blocking)
4. On-call escalation target/runbook: `docs/sops/sop_ai_studio_agent_rollout_operations.md` (repo runbook only; external escalation URL still required)

## Evidence Of Validation
1. Screenshot or snapshot timestamp proving each panel is populated: NOT PROVIDED
2. Alert test or synthetic trigger evidence (if available): NOT PROVIDED
3. Confirmation that alert routing targets are reachable: NOT PROVIDED

## Acceptance Decision
- DEP-03 decision: `Needs follow-up`
- Missing items: all external dashboard panel URLs, all external alert policy URLs, external on-call escalation target URL, validation screenshots, alert-routing verification artifacts.
- Follow-up owner: Ops
- Follow-up due date: before any Production 5% promotion decision
