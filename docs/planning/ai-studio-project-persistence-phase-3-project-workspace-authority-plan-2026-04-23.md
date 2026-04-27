# AI Studio Project Persistence Phase 3: Project Workspace Authority Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Introduce one authoritative project-owned workspace persistence surface and move durable restore ownership away from legacy `sid` snapshots.

## Problem This Phase Solves
Even after project identity and title are correct, AI Studio still restores through a fragmented set of authorities:
1. legacy session snapshots,
2. browser-global workflow settings,
3. local runtime restore paths,
4. user-global selected-state seams.

This phase creates a single project-owned workspace authority so saved-project reopen becomes deterministic.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/logic/sessionSnapshot.ts`
2. `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioSessionPersistenceController.ts`
5. `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
6. `frontend/pages/ai-studio.tsx`
7. new `project_workspace_states` migration/service/API surfaces

## Scope
Phase 3 covers:
1. defining the authoritative project workspace snapshot contract,
2. writing new durable project-owned workspace state,
3. hydrating AI Studio from project-owned workspace state,
4. bounding or removing browser-global restore leakage,
5. keeping temporary legacy session reads only where required for migration.

## Required Outputs
1. one `project_workspace_states` contract,
2. one authoritative project restore read path,
3. one authoritative project restore write path,
4. explicit compatibility behavior for old `sid` snapshots,
5. migration rules for browser-global workflow-setting state.

## Required Restore Coverage
The project workspace authority must be able to restore at least:
1. Reference Grid composition,
2. Quick Slot Inventory composition,
3. canvas/workspace state,
4. relevant Create/Edit selected values,
5. any minimal runtime state needed to reopen the project coherently.

## Guardrails
1. This is a durable contract phase, not an ad hoc bucket for every UI value.
2. Do not dump every transient UI property into project workspace snapshots.
3. Keep saved project state separate from true user-global preferences.
4. Browser-global workflow-setting leakage is a priority risk and should be handled early in this phase.
5. This phase defines workspace authority, but not final folder membership semantics or final asset association semantics.

## Non-Goals
1. No project-folder cutover yet.
2. No global asset redesign yet.
3. No full legacy session deletion yet.

## Entry Criteria
1. Phase 0 classification table is complete.
2. Phase 2 project runtime entry is stable enough to resolve project identity before restore.

## Exit Criteria
1. One project-owned workspace snapshot contract exists.
2. New durable writes target the project workspace authority rather than legacy session identity.
3. Restore-critical workflow settings no longer bleed across projects.
4. Temporary legacy session compatibility is explicit and bounded.

## Validation
1. Snapshot/hydration tests for project-owned workspace state.
2. Project-switch tests proving restore state does not bleed between projects.
3. Regression tests for compatibility hydration during the migration window.

## Rollback Note
If project workspace authority is not yet stable, keep legacy session reads as the bounded fallback and do not delete old restore paths prematurely.
