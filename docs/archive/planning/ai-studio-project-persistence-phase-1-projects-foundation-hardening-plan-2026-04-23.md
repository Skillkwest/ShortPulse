> Archived 2026-05-23 during planning cleanup. Reason: dormant future migration phase plan removed from the active planning surface after the workspace-isolation lane became the active execution contract.

# AI Studio Project Persistence Phase 1: Projects Foundation Hardening Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Harden the existing `projects` foundation so the repo has a stable, user-owned project identity surface before AI Studio runtime migration begins.

## Problem This Phase Solves
The repo already contains useful project-foundation work, but it is not yet a clean contract:
1. project lifecycle coverage is incomplete,
2. dashboard saved-project surfaces are still partial,
3. some project-create behavior still bootstraps the old user-global folder model.

If this foundation remains muddy, later phases will build project restore on top of the wrong assumptions.

## Primary Repo Surfaces
1. `sql/migrations/089_add_projects_foundation.sql`
2. `sql/migrations/rollback/089_add_projects_foundation_rollback.sql`
3. `frontend/lib/server/projectsService.ts`
4. `frontend/pages/api/projects/create.ts`
5. `frontend/lib/server/projectApiRoutes/item.ts`
6. `frontend/lib/server/api/protectedApiPaths.ts`
7. `frontend/pages/dashboard.tsx`
8. any new project list/update routes introduced in this phase

## Scope
Phase 1 covers:
1. validating the `projects` table contract,
2. validating create/read ownership boundaries,
3. adding any missing project lifecycle routes required for:
   - list,
   - update,
4. hardening dashboard create/open semantics around project identity,
5. removing or correcting project-create behavior that still carries global-folder assumptions forward.

## Required Outputs
1. one stable `projects` table contract,
2. one stable server-side projects helper surface,
3. authenticated API coverage for:
   - create,
   - read,
   - list,
   - update title,
4. dashboard support for:
   - create project,
   - list/open project,
   - visible project title,
5. tests for ownership and basic project lifecycle behavior.

## Required Corrections
1. Remove or rethink project-create behavior that bootstraps user-global Media Library folder assumptions.
2. Keep project creation focused on project identity, not on seeding the old user-scoped folder domain.
3. Preserve the correct parts of the existing foundation instead of rewriting them unnecessarily.

## Guardrails
1. The current `projects` foundation is directionally correct and should be refined, not discarded.
2. Project APIs must remain authenticated and user-isolated.
3. Phase 1 must not yet make AI Studio restore project-aware.
4. Avoid accidental coupling between project creation and the legacy `media_folders` authority.
5. Do not introduce folder semantics into the `projects` table just because visible folders are planned later.

## Non-Goals
1. No project workspace restore yet.
2. No Media Library folder cutover yet.
3. No `sid` cleanup yet.

## Entry Criteria
1. Phase 0 contract and persistence inventory are explicit.
2. The current `projects` foundation work has been audited.

## Exit Criteria
1. `projects` identity is stable enough to support later runtime hydration work.
2. Project create/read/list/update boundaries are explicit and tested.
3. Dashboard can create and open real projects through project identity.
4. No phase-1 code path still assumes project creation should seed the old user-global folder model.

## Validation
1. API tests for create/read/list/update ownership.
2. Dashboard flow tests for project create and open.
3. Validation that project creation does not mutate user-global folder state in ways later folder cutover would have to unwind.

## Rollback Note
If project identity cannot be made stable without carrying forward legacy folder assumptions, revert to the clean audited foundation boundary and stop before AI Studio runtime changes begin.
