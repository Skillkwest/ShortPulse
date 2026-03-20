# M-14 Canary Thresholds And Rollback Drill Triggers

Date: 2026-03-20  
Tracker Row: `M-14`  
Workstream: `WS-6`  
Owner: Platform Ops  
Environment Scope: Staging-only remediation scope

## Scope
Lock canary threshold and rollback drill governance for compiler-native metrics in remediation lanes.

## Threshold Contract Binding
Canonical threshold source:
1. `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`

This packet binds canary policy to those thresholds for:
1. `schema_failure_rate`
2. `fallback_rate`
3. `false_refusal_rate`
4. `repair_rate`
5. `p95_latency_ms`
6. `error_rate`

## Canary Policy Doc
Canary policy doc updated:
1. `docs/sops/sop_ai_studio_agent_rollout_operations.md`
   - `Compiler-native threshold binding (mandatory for remediation lanes)`
   - `Rollback Drill Checklist (Required Before Ring Promotion)`

## Rollback Drill Checklist Artifact
Checklist artifact:
1. `docs/planning/evidence/agent-pipeline-remediation/master/ws-6/artifacts/2026-03-20/compiler-canary-rollback-drill-checklist.json`

Checklist includes:
1. baseline snapshot precondition,
2. rollback lever sequence,
3. contract + continuity invariant verification,
4. validation command bundle,
5. operator evidence packet requirements.

## Validation
Commands run:
1. `rg -n "Compiler-native threshold binding|Rollback Drill Checklist" docs/sops/sop_ai_studio_agent_rollout_operations.md`
2. `npm -C frontend run docs:check`

Outcome:
1. Threshold contract binding is explicit in rollout SOP.
2. Rollback drill checklist artifact is captured and linked.
3. Documentation checks pass.

## Outcome
`M-14` validation target is satisfied:
1. threshold contract: linked and authoritative.
2. canary policy doc: updated with compiler-native bindings.
3. rollback drill checklist: captured and linked.
