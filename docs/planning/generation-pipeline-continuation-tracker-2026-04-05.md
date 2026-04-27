# Generation Pipeline Continuation Tracker Index (2026-04-05)

Last updated: 2026-04-09
Status: active  
Master plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`

## Purpose
This index routes execution into one bucket-specific subplan per authority problem.

The old single tracker was too broad for implementation. These subplans keep the work narrow enough to avoid patchwork and make rollback ownership explicit.

## Bucket Subplans
1. [Server Authority Cutover](./generation-pipeline-continuation-server-authority-cutover-2026-04-05.md)
2. [Server Authority Execution Checklist](./generation-pipeline-continuation-server-authority-execution-checklist-2026-04-05.md)
3. [Client Demotion](./generation-pipeline-continuation-client-demotion-2026-04-05.md)
4. [Compatibility Retirement](./generation-pipeline-continuation-compatibility-retirement-2026-04-05.md)
5. [Reference Grid Read-Model Simplification](./generation-pipeline-continuation-reference-grid-read-model-simplification-2026-04-05.md)

## Execution Order
1. Phase 0 contract lock
2. Server authority cutover
3. Client demotion
4. Compatibility retirement
5. Reference Grid read-model simplification
6. Validation and closeout

## Current Status
1. Contract lock: complete
2. Server authority cutover: in progress
3. Client demotion: in progress
4. Compatibility retirement: planned
5. Reference Grid simplification: in progress
6. Validation and closeout: planned

## Done State
Stop the overall continuation job when:
1. server lifecycle is the only post-submit authority
2. persisted status remains canonical-first with no legacy success fallback
3. Reference Grid loading/render no longer treats preview absence as lifecycle truth
4. client recovery remains observational, with only the bounded `submit-start` fail-closed seam left locally
5. store, selector, derivation, and bridge layers are confirmed as read/composition layers only
6. every remaining compatibility seam is explicitly classified and no higher-ROI authority cut remains

## Accepted Residuals
Residuals that do not block closeout:
1. `frontend/lib/server/api/falStatusPersistedResults.ts` legacy terminal-failure fallback as `temporary keep` until projection-backed historical failure coverage is proven sufficient
2. `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` pre-task `submit-start` fail-closed sweep as `temporary keep`
3. `frontend/lib/server/api/falSubmitProxy.ts` and `frontend/lib/server/api/generationSubmitPersistence.ts` legacy direct-submit fallback as `compatibility-only` while the default forward path remains queue-backed and fail-closed without it
4. shared grid/media helper layers audited as `keep`

## Final Stop Rule
Stop instead of continuing when:
1. the next candidate change does not reduce split authority
2. the next candidate change is mainly speculative cleanup
3. the remaining work is classification/status bookkeeping rather than correctness improvement

## Live Execution Rules
Every implementation slice should record these fields before code changes:
1. authority claim
2. keep/cut classification
3. user-visible outcome
4. deletion trigger
5. rollback note

Every completed slice should close with the same checklist:
1. authority reduced
2. compatibility surface smaller or explicitly unchanged
3. no keep-only helper deleted without reason
4. targeted tests passed
5. user-visible outcome stated explicitly

## Live Invariant Checklist
Use this checklist during implementation and self-audit:
1. canonical server lifecycle still wins after submit
2. client does not invent terminal truth
3. grid does not infer settled state from missing preview alone
4. compatibility surface gets smaller or more explicit
5. keep-only shared helpers remain intact unless a new repo-backed reason appears
6. no UI, UX, or interaction-behavior changes are introduced unless a separate lane explicitly authorizes them

## Running Keep / Cut Matrix
Keep:
1. `frontend/lib/server/api/generationQueue/service.ts`
2. `frontend/lib/server/api/generationQueue/dispatch.ts`
3. `frontend/lib/server/generationControlPlane/runCycle.ts`
4. `frontend/lib/server/api/generationProjection.ts`
5. `frontend/features/ai-studio/logic/referenceGridMedia.ts`
6. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
7. `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
8. `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`
9. `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`

Temporary keep:
1. `frontend/lib/server/api/falStatusPersistedResults.ts` legacy terminal-failure fallback until projection-backed failure is proven sufficient
2. `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` submit-start fail-closed sweep until the repo has a better authoritative pre-task-start boundary
3. `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts` as a bounded queue-status scoped compatibility helper until explicit runtime evidence proves it can be removed without hurting convergence

Compatibility-only:
1. legacy direct-submit seam in `frontend/lib/server/api/falSubmitProxy.ts` and `frontend/lib/server/api/generationSubmitPersistence.ts`
2. remaining metadata-era settlement and status repair paths that only exist for historical rows

Remove:
1. client raw-media recovery success path
2. grid success-as-loading heuristic
3. legacy success status fallback in persisted status
4. dead generic stale-timeout fallback in client lifecycle cleanup

## Index Rules
1. Keep this file high level.
2. Put implementation rows in the bucket subplans.
3. Use the master plan for the cross-bucket authority matrix and dependency order.
