# AI Studio Project Persistence Phase 2: Project Runtime Entry And Title Authority Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Make AI Studio boot through owned project identity first and move visible project-title ownership off session-era state and onto the real project record.

## Problem This Phase Solves
The repo can create project rows, but AI Studio still behaves as if the page is fundamentally `sid`-owned:
1. page identity is still `sid`-first,
2. the visible project name is still derived from session-era state,
3. project URL entry is not yet the clear boot authority.

Without fixing boot order and title authority, later restore phases would still be running through the wrong identity surface.

## Primary Repo Surfaces
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/hooks/useAiStudioSessionIdentity.ts`
3. `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
4. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
5. `frontend/lib/server/projectApiRoutes/item.ts`
6. any project update route introduced in Phase 1

## Scope
Phase 2 covers:
1. project-aware AI Studio entry,
2. owned-project resolution before restore,
3. visible project-title read/write migration,
4. temporary coexistence of `projectId` and `sid`,
5. invalid-project failure behavior.

## Required Outputs
1. one project-aware AI Studio entry contract,
2. one clear boot order:
   - authenticate,
   - resolve owned project,
   - load project metadata,
   - hydrate runtime,
   - apply bounded fallback only if still required during migration,
3. project title reads from `projects.title`,
4. project title updates write to the project authority rather than to session-only local state.

## Required Decisions
1. Exact failure UX when `projectId` is missing, invalid, or unauthorized.
2. Whether plain `/ai-studio` without `projectId` remains legal during the migration window or redirects into project creation flows.
3. What bounded compatibility behavior remains for old session-title fallback while title migration is incomplete.

## Guardrails
1. `sid` may coexist temporarily, but project title must stop depending on `sid`.
2. The visible “Project name” field in Media Library is part of the durable project domain after this phase.
3. Failure modes must fail closed on ownership.
4. Do not yet solve the full restore model in this phase; solve project entry and title authority first.

## Non-Goals
1. No full workspace restore yet.
2. No project-folder cutover yet.
3. No legacy session cleanup yet.

## Entry Criteria
1. Phase 1 project identity surfaces are stable.
2. The current session-title ownership path is mapped and accepted as obsolete.

## Exit Criteria
1. AI Studio resolves the owned project record before using restore state.
2. The visible project title is server-backed by the project record.
3. Invalid or cross-user project ids fail closed.
4. Session-title logic no longer acts as the primary project-name authority.

## Validation
1. Page-entry tests for valid, invalid, and unauthorized `projectId`.
2. Title read/write tests proving the visible title comes from `projects.title`.
3. Regression tests proving `sid` coexistence does not strip `projectId` during the migration window.

## Rollback Note
If project-aware entry breaks AI Studio boot behavior, preserve the project URL handoff but keep title authority unchanged until the boot order can be corrected safely.
