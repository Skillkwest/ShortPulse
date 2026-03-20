# Phase 2 Evidence - Quality/Refusal Local Baseline And Runtime-Truth Status

Date: 2026-03-20  
Phase: 2  
Status: Updated (local baseline captured; staging comparative captured; production deferred by owner directive)

## Objective
Capture a local baseline for:
1. Safety scope and refusal behavior.
2. Route parity for field-mode override behavior.
3. Runtime truth status across local/preview/production.

## Local Validation Bundle
Commands executed:
1. `npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts tests/api/studio-agent.runtime.test.ts tests/api/generate-prompt.sanitization.test.ts`
2. `npm -C frontend run test -- features/agent-runtime/__tests__/studioAgentSafetyInputPrecheck.test.ts features/ai-agent/__tests__/useAiAgent.test.ts`
3. `npm -C frontend run type-check`

Observed outcomes:
1. Targeted route/runtime suites passed.
2. Scope enforcement/refusal lanes remained deterministic in local corpus.
3. Field-mode override coverage passed on:
   - `studio-agent`
   - `generate-prompt`
   - Fal submit precheck parity route

## False-Refusal Delta (Local Corpus)
Local regression corpus does not show a net increase in unexpected refusals in covered tests.

Current limits:
1. Corpus is test-suite based (not full production replay).
2. Production false-refusal delta is deferred for this phase scope.

## Golden Prompt Quality Delta (Local)
Prompt-quality guard remains green for covered route contracts:
1. Prompt-only action envelope invariants preserved in runtime tests.
2. Prompt sanitization tests remain green.

Current limits:
1. No offline “golden dataset” delta report was executed in this packet.
2. Production quality delta is deferred for this phase scope.

## Runtime Truth Snapshot Status
| Environment | Snapshot Status | Notes |
| --- | --- | --- |
| local | Captured | Based on local test + type-check bundle in this packet. |
| staging | Captured | Linked in `2026-03-20-phase-2-runtime-truth-staging-packet.md`. |
| production | Deferred | Owner directive on 2026-03-20 scopes Phase 2 closeout to staging runtime truth. |

## Remaining Work
1. Attach staging-scoped closeout packet and tracker completion update.
2. Keep production runtime-truth capture as deferred follow-up work item (outside this phase scope).
