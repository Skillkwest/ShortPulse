# Generation Pipeline Continuation Tracker Index (2026-04-05)

Last updated: 2026-04-05  
Status: Active  
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

## Running Keep / Cut Matrix
Keep:
1. `frontend/lib/server/api/generationQueue/service.ts`
2. `frontend/lib/server/api/generationQueue/dispatch.ts`
3. `frontend/lib/server/generationControlPlane/runCycle.ts`
4. `frontend/lib/server/api/generationProjection.ts`
5. `frontend/features/ai-studio/logic/referenceGridMedia.ts`
6. `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
7. `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`
8. `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`

Temporary keep:
1. `frontend/lib/server/api/falStatusPersistedResults.ts` legacy terminal-failure fallback until projection-backed failure is proven sufficient
2. `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` submit-start fail-closed sweep until the repo has a better authoritative pre-task-start boundary

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
