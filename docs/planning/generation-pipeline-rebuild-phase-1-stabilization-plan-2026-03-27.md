# Generation Pipeline Rebuild Phase 1 Stabilization Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Summary
Phase 1 was the minimum runtime hardening required before schema-level rebuild work.

This phase is intentionally narrow:
1. remove direct-submit fail-open behavior
2. require durable accepted-submit tracking
3. require durable generation identity for generated-media save paths

It did not attempt schema cutover or Reference Grid read migration.

## Scope
In scope:
1. `frontend/lib/server/api/falSubmitProxy.ts`
2. `frontend/lib/server/api/generationSubmitPersistence.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
4. `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
5. `frontend/pages/api/media/copy-from-url.ts`
6. directly related tests and SOP/docs updates

Out of scope:
1. new generation tables
2. large Reference Grid contract changes
3. queue-status redesign
4. full provider adapter refactor

## Slice Tracker
| Slice ID | Goal | Primary Surfaces | Exit Gate | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| `GPR-P1-S1` | Remove direct-submit admission fail-open behavior | `falSubmitProxy.ts` | submit returns bounded failure when admission evaluation errors | `npx vitest run tests/api/fal-submit-proxy.test.ts` | Completed |
| `GPR-P1-S2` | Fail closed when accepted submit cannot durably persist generation tracking | `falSubmitProxy.ts`, `generationSubmitPersistence.ts` | accepted submit does not return success unless billing linkage and generation persistence are both durable | `npx vitest run tests/api/fal-submit-proxy.test.ts tests/api/fal-status-proxy.test.ts` | Completed |
| `GPR-P1-S3` | Require durable generation identity for generated-media save paths | `useAiStudioPersistenceActions.ts`, `mediaLibraryPersistence.ts`, `copy-from-url.ts` | generated save/download copy flows reject missing generation identity instead of patching around it | `npx vitest run frontend/tests/api/media-copy-from-url.test.ts` | Completed |
| `GPR-P1-S4` | Close docs/SOP drift for the Phase 1 contract | docs and SOP surfaces touched by `S1`..`S3` | docs describe the strict accepted-submit and save-linkage behavior on this branch | `npm -C frontend run docs:check` | Completed |

## Delivered Beyond Initial Scope
The branch also completed several supporting hardening slices immediately after the original Phase 1 exit gates:
1. `generationId` is backfilled during submit/orchestration lifecycle paths.
2. status and recovery payloads carry `generationId` so polling reinforces durable identity.
3. generated download/reference flows no longer repair from `taskId`.
4. generated autosave waits for durable identity instead of speculating from `taskId`.
5. Reference Grid and detail actions hide generated save/download affordances when durable identity or storage-backed authority is missing.

## Constraints
1. Keep queue dispatch and recovery behavior unchanged unless a submit-path fix requires a minimal adjacent adjustment.
2. Do not add new client fallback linkage logic.
3. Prefer failing closed over preserving silent drift.
4. Keep diffs scoped to the contract being tightened.

## Validation Bundle
1. `npx vitest run tests/api/fal-submit-proxy.test.ts`
2. `npx vitest run tests/api/fal-status-proxy.test.ts`
3. `npx vitest run tests/api/fal-webhook-route.test.ts`
4. `npx vitest run tests/api/internal-generation-recovery-run.test.ts`
5. `npx vitest run tests/api/fal-queue-status.test.ts`
6. `npx vitest run tests/api/admin-generation-recovery-replay.test.ts`
7. `npx vitest run lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
8. `npm -C frontend run docs:check`

## Exit Criteria
1. Direct submit no longer proceeds on admission evaluation failure.
2. Accepted submit cannot return success without durable generation tracking.
3. Generated-media save paths require durable generation identity.
4. Updated docs describe the new fail-closed behavior accurately.

## Closeout
Phase 1 is complete on `generation-pipeline-rebuild`.

The next planned work is tracked separately in `generation-pipeline-rebuild-phase-2-read-authority-plan-2026-03-27.md`.
