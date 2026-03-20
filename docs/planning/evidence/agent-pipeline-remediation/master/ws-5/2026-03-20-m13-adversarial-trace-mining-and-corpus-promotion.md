# M-13 Adversarial Trace Mining And Corpus Promotion Rules

Date: 2026-03-20  
Tracker Row: `M-13`  
Workstream: `WS-5`  
Owner: AI Platform  
Environment Scope: Staging-only remediation scope

## Scope
Define the production-trace-style mining loop contract for adversarial corpus expansion and promotion, using staging telemetry in this phase scope.

## Lifecycle SOP Contract
Lifecycle runbook is now codified in:
1. `docs/sops/sop_ai_studio_agent_chat_ops.md`
   - section: `Adversarial Corpus Lifecycle (Staging Scope)`

Key lifecycle controls:
1. intake sources restricted to remediation telemetry lanes,
2. deterministic dedupe fingerprint,
3. explicit promotion/demotion rules,
4. artifact storage namespace under `master/ws-5/artifacts`.

## Sample Packet Review
Sample review packet:
1. `docs/planning/evidence/agent-pipeline-remediation/master/ws-5/artifacts/2026-03-20/adversarial-corpus-lifecycle-sample-packet.json`

Packet includes:
1. intake source contract,
2. promotion-rule contract,
3. dedupe fingerprint fields,
4. reviewed representative samples for:
   - expected refusal lane,
   - infra fallback guard lane.

## Validation
Commands run:
1. `rg -n "adversarial|corpus|trace|promotion" docs/sops/sop_ai_studio_agent_chat_ops.md docs/planning/evidence/agent-pipeline-remediation/master/ws-5 -g '*.md' -g '*.json'`
2. `npm -C frontend run docs:check`

Outcome:
1. Corpus lifecycle SOP exists and is linked.
2. Sample packet review artifact exists and is linked.
3. Documentation validation checks pass.

## Outcome
`M-13` validation target is satisfied:
1. corpus lifecycle SOP: complete.
2. sample packet review: complete.
