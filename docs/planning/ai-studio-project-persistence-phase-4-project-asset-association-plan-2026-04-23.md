# AI Studio Project Persistence Phase 4: Project Asset Association Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Define and implement how a project durably references the media and prompts required to restore that project without turning the whole asset inventory into a project-local system.

## Problem This Phase Solves
After project workspace authority exists, restore still cannot be correct unless the workspace can resolve the right assets:
1. generated outputs still hydrate from user-global projection data,
2. save/autosave flows are not yet project-aware,
3. project reopen can otherwise fall back to scanning the user’s entire asset inventory.

This phase gives the project a durable asset-association seam that matches the locked product contract.

## Primary Repo Surfaces
1. `frontend/pages/api/media/list.ts`
2. `frontend/pages/api/media/prompts/list.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioState.ts`
4. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
5. `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
6. `frontend/features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator.ts`
7. new project-asset association migrations/services/routes

## Scope
Phase 4 covers:
1. project association to durable media assets,
2. project association to durable prompt assets,
3. generated/uploaded/save-flow association to the active project,
4. removal of current user-global restore leakage from generated outputs,
5. durable asset references needed by project workspace restore.

## Required Outputs
1. one project asset-association model,
2. one explicit rule for how generated assets become part of a project,
3. one explicit rule for how saved prompts become part of a project,
4. one restore path that can resolve project-owned assets without scanning all user assets,
5. one migration plan for current user-global generated-output hydration.

## Guardrails
1. Reuse user-global `media_files` and `media_prompts` as the master inventory where possible.
2. Prefer association tables over asset duplication.
3. Do not broaden this phase into global library redesign.
4. Generated-output hydration is the biggest cross-project bleed path and should be treated as a first-class closure target here.
5. This phase is about durable asset association, not about replacing the visible folder UX.

## Non-Goals
1. No project-folder cutover yet.
2. No left-rail library redesign.
3. No legacy session deletion yet.

## Entry Criteria
1. Phase 3 project workspace authority is explicit.
2. The current generated-output and save/autosave leak paths are mapped.

## Exit Criteria
1. Projects can durably reference the assets they need to reopen.
2. Generated assets no longer hydrate purely from user-global projection data for project restore.
3. Save/autosave flows can associate restore-relevant assets with the active project.
4. Project restore can resolve needed assets without scanning the full user inventory.

## Validation
1. Tests proving generated assets attach to the active project when they are restore-relevant.
2. Tests proving project reopen only restores the associated assets for that project.
3. Regression tests for manual save and autosave behavior under project scope.

## Rollback Note
If project asset association is not yet robust, keep restore limited rather than silently pulling user-global assets into the wrong project.
