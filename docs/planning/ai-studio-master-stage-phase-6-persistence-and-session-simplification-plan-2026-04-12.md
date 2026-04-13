# AI Studio Master Stage Phase 6: Persistence And Session Simplification Plan (2026-04-12)

Status: In Progress  
Owner: Engineering

## Goal
Reduce stage/session persistence to a clear durable contract centered on the document.

## Problem
Current persistence carries more control-plane and rollout scaffolding than the rebuilt stage should own.

The rebuild target is:
1. durable document/artboard/layer state,
2. durable tool content only where required,
3. optional camera persistence only if product value is proven,
4. no unnecessary transient session ownership in durable snapshots.

## Primary Files To Simplify
1. `frontend/features/ai-studio/logic/sessionPersistencePolicy.ts`
2. `frontend/features/ai-studio/logic/sessionShadowPersistence.ts`
3. `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
4. `frontend/features/ai-studio/components/edit/expertEditSessionState.ts`
5. `frontend/features/ai-studio/components/edit/useExpertEditSessionHostSync.ts`

## Scope
1. define the new durable stage snapshot shape,
2. reduce or remove rollout-only persistence branches,
3. keep backward readability only where needed for migration,
4. align docs and tests with the new persistence contract.

## Explicit Non-Goals
1. No new editing behavior.
2. No expansion of persistence scope beyond the document contract.
3. No reintroduction of removed dual-stage systems.

## Entry Criteria
1. the stage export boundary is stable,
2. the document and artboard contracts are already final enough to snapshot.

## Exit Criteria
1. the rebuilt stage persists one clear document-centered contract,
2. obsolete persistence branches are removed or bypassed,
3. compatibility hydration for older sessions is explicit and bounded,
4. session ownership is simpler to reason about than the current control plane.

## Validation
1. focused persistence/hydration tests,
2. confirm session reload restores the intended document state,
3. confirm removed rollout branches are reflected in docs and tests.

## Current Focus
Phase 6 now starts from the stable Phase 5 export boundary and should target the first persistence-simplification lane:
1. identify the remaining session payload written by the canonical edit path,
2. separate durable document/artboard state from transient interaction/runtime state,
3. keep backward-compatible hydration for older snapshots while slimming new writes,
4. avoid widening into Phase 7 deletions until the persistence contract is explicit.

## Completed Slice On 2026-04-12
1. Slimmed `frontend/features/ai-studio/components/edit/expertEditSessionState.ts` so new Expert Edit session writes persist only durable layer state, current markup strokes, and the current inpaint mask snapshot.
2. Removed full markup and inpaint undo/redo stacks from new persistence writes in `frontend/features/ai-studio/components/edit/useExpertEditSessionHostSync.ts`, which keeps transient runtime history out of durable session payloads.
3. Kept backward-compatible hydration in `frontend/features/ai-studio/components/edit/expertEditLayerSessionUtils.ts` by restoring current markup strokes and the current inpaint mask from older `history.present` payloads when legacy session snapshots are loaded.
4. Updated focused restore/persistence coverage in `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx` so the canonical edit path now asserts:
   - durable writes carry markup strokes instead of full history,
   - durable writes carry an inpaint snapshot instead of full history,
   - older history-based snapshots still hydrate correctly,
   - remount restores current stage content without restoring transient undo/redo stacks.
5. Added an optional Expert Edit snapshot extension to the canonical page/session bridge in:
   - `frontend/features/ai-studio/logic/sessionSnapshotExpertEdit.ts`
   - `frontend/features/ai-studio/logic/sessionSnapshot.ts`
   - `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioSessionPersistenceController.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
6. Wired the page-level restore path in `frontend/pages/ai-studio.tsx` so the canonical session snapshot can now rehydrate slim durable Expert Edit state back into `expertEditSessionState`.
7. Added focused snapshot/hydration bridge coverage for the new Expert Edit payload in:
   - `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
   - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
8. Removed the dead page-level canvas hydration branch from the shared session-persistence controller and restore hook now that the canonical `/ai-studio` page no longer passes a canvas restore adapter:
   - `frontend/features/ai-studio/hooks/useAiStudioSessionPersistenceController.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
   - focused controller-hook tests updated accordingly.

## Next Slice
1. Audit the generic page snapshot payload for other editor-only state that should move behind dedicated optional extensions or be removed entirely from durable writes.
2. Keep older session hydration readable during the migration window, but normalize new writes to the slimmer durable contract only.

## Rollback Note
If snapshot migration causes unacceptable restore regressions, keep a read-only compatibility adapter for older snapshots while continuing to write only the new snapshot format.
