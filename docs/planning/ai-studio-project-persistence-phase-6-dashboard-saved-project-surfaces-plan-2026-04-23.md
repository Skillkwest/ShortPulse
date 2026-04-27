# AI Studio Project Persistence Phase 6: Dashboard Saved-Project Surfaces Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Make the dashboard the canonical create/open surface for saved projects by replacing the current placeholder session area with real project cards.

## Problem This Phase Solves
Even after project identity and restore exist, the dashboard still needs to represent the saved-project model clearly:
1. users need a visible list of saved projects,
2. opening a project from the dashboard must route into the correct restore path,
3. the dashboard must stop implying that persistence is “coming soon”.

This phase makes the project model visible and usable from the surface where the product starts.

## Primary Repo Surfaces
1. `frontend/pages/dashboard.tsx`
2. `frontend/styles/workspace-dashboard.css`
3. project list/open APIs and helpers
4. project title surfaces from earlier phases

## Scope
Phase 6 covers:
1. dashboard project listing,
2. project open behavior,
3. recent or last-updated ordering,
4. visible project identity on the dashboard,
5. continuity between dashboard open behavior and AI Studio restore behavior.

## Required Outputs
1. one real dashboard saved-project surface,
2. one project-card contract for:
   - title,
   - last updated,
   - open action,
3. one open-project path that routes into AI Studio with stable project identity and restore behavior.

## Guardrails
1. The dashboard should stop presenting project persistence as a placeholder once this phase is done.
2. Avoid overloading this phase with archive/delete/share workflows unless they are explicitly opened as a separate scope.
3. The critical user story is:
   - create project,
   - leave project,
   - reopen project,
   - get the same restored session.

## Non-Goals
1. No archive/share/deletion scope unless separately opened.
2. No redesign of unrelated dashboard surfaces.
3. No new persistence model changes beyond dashboard consumption of already-built project restore.

## Entry Criteria
1. Earlier phases have established stable project create/open identity and restore behavior.
2. Dashboard project list/open surfaces exist server-side.

## Exit Criteria
1. Dashboard shows real saved projects.
2. Opening a project from the dashboard restores that project.
3. The dashboard no longer treats project persistence as “coming soon”.

## Validation
1. Dashboard create/open flow tests.
2. Recent-ordering or last-updated display tests if that behavior ships.
3. Manual or automated reopen tests proving dashboard open restores the same project session.

## Rollback Note
If dashboard listing is not stable, keep the create flow but do not replace the placeholder session area until saved-project open behavior is reliable.
