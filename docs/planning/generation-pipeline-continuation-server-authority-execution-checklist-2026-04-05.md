# Generation Pipeline Continuation: Server Authority Execution Checklist (2026-04-05)

Last updated: 2026-04-05  
Status: active
Parent subplan: `docs/planning/generation-pipeline-continuation-server-authority-cutover-2026-04-05.md`  
Master plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`

## Purpose
This checklist turns the server-authority bucket into an execution order with concrete file boundaries, cutover gates, and rollback posture.

It is intentionally narrower than a general backend refactor. The goal is to remove the remaining split post-submit authority without disturbing keep-only transport, orchestration, or read-model helpers.

## Scope Lock
In scope:
1. `frontend/lib/server/api/falSubmitProxy.ts`
2. `frontend/lib/server/api/generationSubmitPersistence.ts`
3. `frontend/lib/server/falIntegration/recoveryExecution.ts`
4. `frontend/lib/server/falIntegration/recoveryTransitionService.ts`
5. `frontend/lib/server/api/generationOutputs.ts`
6. `frontend/lib/server/api/generationPublications.ts`
7. `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`
8. `frontend/lib/server/api/generationBilling/settlementService.ts`

Keep-only surfaces:
1. `frontend/lib/server/api/generationQueue/service.ts`
2. `frontend/lib/server/api/generationQueue/dispatch.ts`
3. `frontend/lib/server/api/generationQueue/requestIdRepair.ts`
4. `frontend/lib/server/generationControlPlane/runCycle.ts`
5. `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts`
6. `frontend/lib/server/api/generationProjection.ts`
7. `frontend/lib/server/api/falStatusProxy.ts`

Out of scope:
1. client lifecycle demotion
2. metadata fallback retirement in `falStatusPersistedResults.ts`
3. Reference Grid read-model cleanup
4. broad queue redesign or scheduler redesign

## Execution Order
1. Lock transport/orchestration surfaces as keep-only so the implementation does not widen into queue/control-plane cleanup.
2. Isolate the legacy direct-submit path in `falSubmitProxy.ts` and `generationSubmitPersistence.ts`.
3. Tighten recovery/output persistence/settlement as the only forward-path post-submit authority.
4. Validate that the remaining post-submit work is compatibility retirement, not more server-authority cleanup.

## Slice Checklist
| Slice ID | Goal | Authority Claim | Keep / Cut | User-visible Outcome | Deletion Trigger | File Order | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Rollback Note | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SAE-01` | Lock keep-only boundaries | queue/control-plane/projection must stay transport-orchestration surfaces, not cleanup targets | keep | prevents wasted queue/control-plane churn while authority work is still elsewhere | keep-only list is explicit in active plans and no current slice needs those files for correctness | `generationQueue/service.ts` -> `generationQueue/dispatch.ts` -> `runCycle.ts` -> planning docs only | Parent subplan accepted | Queue/control-plane/projection surfaces are explicitly keep-only for this lane | docs review; authority matrix review | `npm -C frontend run docs:check` | Revert planning doc changes only | Complete |
| `SAE-02` | Isolate legacy direct-submit fallback | submit authority after acceptance must be queue-backed/server-owned, not split with legacy direct submit | compatibility-only -> remove | fewer submit-path disagreements and clearer forward-path ownership | direct-submit callers are no longer needed for forward-path correctness and tests prove queue-backed submit covers current lanes | `falSubmitProxy.ts` -> `generationSubmitPersistence.ts` | `SAE-01` complete; canonical submit path confirmed in repo | Legacy direct submit is explicitly compatibility-only and the forward path stays queue-backed/server-owned | submit-path regression tests; accepted-submit coverage | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert submit-path changes first; preserve tests | In progress |
| `SAE-03` | Confirm recovery/output persistence are the only forward-path post-submit authority | recovery and durable output persistence must be the only server surfaces that settle post-submit state | authoritative | fewer cases where status or recovery depends on legacy write paths instead of durable outputs | recovery/output reads and writes stay green without legacy direct-submit assumptions | `recoveryTransitionService.ts` -> `recoveryExecution.ts` -> `generationOutputs.ts` -> `generationPublications.ts` -> `recoveryMediaPersistence.ts` | `SAE-02` complete; durable output path still canonical | Recovery and durable output persistence no longer depend on legacy direct-submit assumptions | recovery/output persistence regression bundle | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert recovery/output changes separately from submit-path isolation | Planned |
| `SAE-04` | Tighten settlement ownership to canonical request/attempt linkage | billing settlement must follow canonical request/attempt identity instead of broad repair across split identities | compatibility-only -> temporary keep -> remove | fewer ownership-repair surprises in settlement and cleaner replay behavior | canonical request/attempt linkage is complete enough that forward-path settlement no longer needs broad repair logic | `generationBilling/settlementService.ts` | `SAE-03` complete; recovery/output path stable | Settlement no longer needs broad split-identity repair for the forward path | settlement regression coverage; replay edge-case checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert settlement logic separately and keep durable outputs intact | Planned |
| `SAE-05` | Close out the bucket and hand off only true compatibility seams | server authority bucket should stop once remaining work is fallback retirement, not further forward-path authority cleanup | keep / temporary keep / compatibility-only handoff | clearer next-step boundary and less chance of sliding back into broad backend cleanup | remaining server work can be named as compatibility retirement or read-model cleanup with explicit evidence gates | planning docs only plus touched tests/docs | `SAE-02` through `SAE-04` complete | Remaining server-side work is compatibility retirement or read-model cleanup, not authority cleanup | end-to-end flow review; self-audit | `npm -C frontend run docs:check` | Revert closeout docs only | Planned |

## Slice Template
Before editing code for any new server-authority slice, record:
1. authority claim
2. keep/cut classification
3. user-visible outcome
4. deletion trigger
5. targeted validation commands
6. rollback note

After finishing a slice, self-audit against:
1. the canonical server lifecycle still wins after submit
2. compatibility surface is smaller or more explicit
3. no keep-only helper was deleted without a repo-backed reason
4. the user-visible outcome is still true after tests

## Required File-Level Decisions
1. `falSubmitProxy.ts`
Determine the smallest change that makes legacy direct submit an explicit compatibility path instead of a parallel authority path.

2. `generationSubmitPersistence.ts`
Keep only if it is still required to support the legacy direct-submit compatibility seam during migration. Remove or reduce it once direct submit is retired.

3. `recoveryExecution.ts`
Preserve it as the steady-state server reconciler. Do not widen this lane into general control-plane redesign.

4. `generationOutputs.ts` and `generationPublications.ts`
Treat them as durable output authority. Do not fold them back into metadata-first read behavior.

5. `settlementService.ts`
Reduce forward-path repair logic only when canonical request/attempt linkage makes the repair unnecessary. Keep bounded historical fallback behavior for later retirement.

## Validation Bundle
1. `npm -C frontend run lint`
2. `npm -C frontend run build`
3. `npm -C frontend run docs:check`
4. targeted submit/recovery/output/settlement tests for touched seams

## Stop Rules
Stop this checklist when:
1. the next change would primarily remove compatibility reads instead of improving server authority
2. the next change would widen into client demotion or Reference Grid cleanup
3. the remaining work is mostly legacy fallback retirement rather than post-submit authority cleanup

## Exit Condition
This checklist is done when:
1. the forward path after submit is server-owned and singular
2. legacy direct submit is clearly compatibility-only or removed
3. recovery/output persistence/settlement remain the only forward-path post-submit authority
4. the next credible work item is compatibility retirement, not more server-authority cleanup
