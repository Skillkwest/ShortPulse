# AI Studio Project Persistence Phase 0: Contract And Persistence Inventory Plan (2026-04-23)

Status: Planned  
Owner: Engineering

## Goal
Lock the project-persistence contract and produce the persistence inventory required to implement Projects without dragging hidden session-era or browser-global assumptions into later phases.

## Problem This Phase Solves
The repo currently persists AI Studio state through multiple competing authorities:
1. `sid` snapshots,
2. runtime state,
3. browser storage,
4. `user_preferences`,
5. user-global media and generated-output reads.

Without a full inventory, later phases would migrate only the obvious surfaces and still leak state across projects.

## Primary Repo Surfaces
1. `docs/archive/planning/ai-studio-project-persistence-master-plan-2026-04-23.md`
2. `frontend/pages/ai-studio.tsx`
3. `frontend/features/ai-studio/logic/sessionSnapshot.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
5. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
6. `frontend/pages/api/media/list.ts`
7. `frontend/pages/api/media/prompts/list.ts`
8. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
9. any hook using `sessionStorage`, `localStorage`, or `user_preferences` for AI Studio restore-relevant values

## Scope
Phase 0 covers:
1. locking the project-persistence contract,
2. classifying all persisted AI Studio state as:
   - `project-scoped`,
   - `user-global`,
   - `ephemeral`,
3. identifying every active persistence authority,
4. identifying the current cross-project bleed paths,
5. defining the exact minimum restore story for:
   - `new project opens empty`,
   - `open saved project restores coherently`.

## Required Outputs
1. one accepted product contract aligned with the master plan,
2. one field-by-field persistence classification table,
3. one implementation map of current persistence authorities, including:
   - `sid` snapshot,
   - generated output hydration,
   - Media Library folder state,
   - browser storage,
   - `user_preferences`,
   - any server-owned persistence already in play,
4. one leak-path list with concrete repo owners and migration priority,
5. one explicit definition of the minimum restore envelope for a saved project.

## Required Decisions
1. Which Create/Edit selected values are truly project-scoped.
2. Which user-level preferences remain in `user_preferences`.
3. Which AI Studio values are restore-critical versus purely transient.
4. What minimum state must exist for `new project opens empty`.
5. What minimum state must exist for `saved project reopens exactly`.

## Guardrails
1. Treat the master plan as the contract authority for this phase.
2. Do not change runtime behavior in this phase.
3. Do not invent new persistence tables in this phase.
4. Be explicit about current contradictions, especially:
   - `sid` still being primary,
   - project title still being session-scoped,
   - user-global folder authority,
   - user-global generated-output hydration,
   - browser-global workflow settings.
5. Every claim in the inventory must be traceable to concrete repo code, not to architecture inference alone.

## Non-Goals
1. No behavior changes.
2. No schema changes.
3. No attempt to “fix” persistence in the same step as inventorying it.

## Entry Criteria
1. The master plan is accepted as the active program contract.
2. Repo audit findings on project identity, session persistence, and Media Library scope are current enough to trust.

## Exit Criteria
1. Every significant persisted AI Studio value is classified.
2. Every active persistence authority is mapped.
3. The program has one exact `empty new project` definition.
4. The program has one exact `saved project reopen` definition.
5. There is no remaining ambiguity about which current surfaces are user-global versus project-owned.

## Validation
1. Reconcile the classification table against:
   - `frontend/pages/ai-studio.tsx`,
   - session snapshot logic,
   - Media Library APIs,
   - workflow-setting hooks,
   - generated output hydration.
2. Confirm the classification table matches the locked product contract in the master plan.
3. Confirm each identified leak path is a concrete repo path with a named owner and later-phase destination.

## Rollback Note
If Phase 0 cannot produce a clean persistence inventory, stop the program and do not begin behavior-changing implementation.
