# Phase 2 Evidence - Quality/Refusal Local Baseline And Runtime-Truth Status

Date: 2026-03-20  
Phase: 2  
Status: In progress (local baseline captured; preview/production capture pending)

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
2. Preview/production false-refusal delta remains pending.

## Golden Prompt Quality Delta (Local)
Prompt-quality guard remains green for covered route contracts:
1. Prompt-only action envelope invariants preserved in runtime tests.
2. Prompt sanitization tests remain green.

Current limits:
1. No offline “golden dataset” delta report was executed in this packet.
2. Preview/production quality deltas remain pending.

## Runtime Truth Snapshot Status
| Environment | Snapshot Status | Notes |
| --- | --- | --- |
| local | Captured | Based on local test + type-check bundle in this packet. |
| preview | Pending | Requires environment-level flag/profile snapshot and trace capture. |
| production | Pending | Requires environment-level flag/profile snapshot and trace capture. |

## Remaining Work
1. Add preview runtime truth capture packet.
2. Add production runtime truth capture packet.
3. Attach approved golden dataset + false-refusal comparative report for Phase 2 closeout.
