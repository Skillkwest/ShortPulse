# AI Studio Pulse Runtime Phase 3: Session Persistence Plan (2026-04-20)

> Archived on 2026-04-26 during docs cleanup because the Pulse runtime program is complete and the active follow-on plan is `docs/planning/ai-studio-standard-vs-pulse-runtime-isolation-execution-plan-2026-04-23.md`.

Status: complete  
Owner: Engineering

## Goal
Persist active Pulse runtime state safely within the AI Studio session snapshot contract.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/logic/sessionSnapshot.ts`
2. `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
3. `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`

## Scope
Phase 3 covers:
1. snapshot schema updates for Pulse runtime state,
2. hydrator compatibility behavior,
3. restore behavior for Pulse mode and active Pulse identity,
4. clear separation between:
   - snapshot runtime state,
   - saved Pulse definitions resolved by id.
5. alignment with the broader AI Studio session-persistence policy and feature flags.

## Required Outputs
1. schema additions for:
   - `expertCreateMode` if needed for restore parity,
   - `activePulseId`,
   - any minimal V1 activation metadata required for restore.
2. compatibility rules for older snapshots that predate Pulse runtime support.
3. restore behavior rules when the saved Pulse definition no longer exists.
4. explicit policy alignment on when Pulse restore is allowed, gated, or off by default.
5. rollback guidance if restore behavior regresses existing non-Pulse session flows.

## Implementation Notes
1. This is a schema evolution task, not a casual field-addition task.
2. Do not serialize entire Pulse definitions into the snapshot.
3. Missing/deleted Pulse definitions on restore must fail soft with explicit fallback behavior.

## Entry Criteria
1. Phase 2 active client runtime state is explicit.
2. The minimal restore contract is understood.

## Exit Criteria
1. Snapshot schema supports Pulse runtime restore.
2. Hydrator compatibility rules are explicit.
3. Restore behavior for missing Pulse definitions is explicit.
4. Pulse restore behavior aligns with the broader AI Studio session-persistence policy.
5. Existing session restore behavior remains protected by fallback rules.

## Validation
1. Confirm a Pulse-activated session can be saved and restored without duplicating saved-definition data.
2. Confirm older snapshots still hydrate safely.
3. Confirm missing Pulse definitions degrade gracefully instead of corrupting restore.

## Rollback Note
If schema compatibility or restore correctness is not stable, disable Pulse restore and keep existing session behavior unchanged.
