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

## Rollback Note
If snapshot migration causes unacceptable restore regressions, keep a read-only compatibility adapter for older snapshots while continuing to write only the new snapshot format.
