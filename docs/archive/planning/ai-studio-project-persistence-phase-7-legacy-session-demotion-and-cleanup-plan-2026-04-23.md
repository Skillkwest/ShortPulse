> Archived 2026-05-23 during planning cleanup. Reason: dormant future migration phase plan removed from the active planning surface after the workspace-isolation lane became the active execution contract.

# AI Studio Project Persistence Phase 7: Legacy Session Demotion And Cleanup Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Retire or sharply demote the old session-persistence remnant once project-owned restore is authoritative and safe.

## Problem This Phase Solves
By the time earlier phases are complete, the repo can still be confusing and risky if legacy session paths remain conceptually primary:
1. developers can keep writing to the wrong authority,
2. docs can still describe the old model,
3. compatibility code can become permanent accidental architecture.

This phase closes the migration so Projects become the clear durable model.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/logic/sessionPersistencePolicy.ts`
2. `frontend/features/ai-studio/logic/sessionSnapshot.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioSessionPersistenceController.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreCandidate.ts`
5. `frontend/features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts`
6. `frontend/features/ai-studio/logic/sessionApiClient.ts`
7. associated tests and docs that still describe session persistence as the primary model

## Scope
Phase 7 covers:
1. deletion or demotion of legacy session persistence as the primary user-facing authority,
2. bounded compatibility read strategy,
3. cleanup of obsolete flags and docs,
4. final project-model validation and closeout.

## Required Outputs
1. one explicit statement of what legacy session behavior remains and why,
2. one bounded compatibility window if needed,
3. deletion or demotion of no-longer-needed session-era code paths,
4. docs and tests aligned with the project model as the primary persistence model.

## Guardrails
1. Do not start deleting legacy session code until project restore is clearly authoritative.
2. Keep compatibility reads only as long as they are needed for safe migration.
3. Remove stale docs that still present `sid`-centric session persistence as the user-facing save/open model.
4. This phase is complete only when the repo no longer conceptually treats Projects as a thin layer on top of the old session model.

## Non-Goals
1. No new project features.
2. No broad architecture redesign outside retiring obsolete session-era persistence.
3. No deletion of compatibility reads before restore safety is proven.

## Entry Criteria
1. Project identity, restore authority, asset association, folder cutover, and dashboard open behavior are stable.
2. The remaining legacy session paths are explicitly mapped.

## Exit Criteria
1. Project restore is the clear primary user-facing persistence model.
2. Legacy session persistence is no longer the main durable user-facing authority.
3. Compatibility reads are either removed or clearly bounded.
4. Tests and docs validate and describe the project model rather than the session model.

## Validation
1. End-to-end restore tests proving Projects remain correct after session-path cleanup.
2. Regression tests for any remaining compatibility read windows.
3. Docs audit confirming stale session-persistence claims are removed or updated.

## Rollback Note
If project restore is not yet robust enough, keep legacy session compatibility in a bounded read-only role and do not delete it prematurely.
