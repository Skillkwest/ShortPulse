# Phase 13 Wave D: Autosave Policy Foundation

Date: 2026-03-02  
Status: Pass (engineering slice) / Hold (staging behavior-matrix closeout pending)

## Scope
1. Added durable autosave preference contract (`user_preferences.media_autosave_enabled`).
2. Enforced autosave OFF behavior in shared server recovery execution path.
3. Added shared autosave policy seam for client/server parity.
4. Added client autosave preference and orchestration hooks.
5. Added duplicate-save idempotency handling and generated-video manual save parity.

## Touched Surfaces
1. `frontend/lib/server/falIntegration/recoveryExecution.ts`
2. `frontend/lib/mediaAutosavePolicy.ts`
3. `frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator.ts`
5. `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
6. `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
7. `sql/migrations/043_add_user_preferences_media_autosave_enabled.sql`
8. `sql/create_user_preferences_table.sql`

## Validation Commands
1. `npm -C frontend run test -- --run lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
2. `npm -C frontend run test -- --run lib/__tests__/mediaAutosavePolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioMediaAutosaveOrchestrator.test.ts features/ai-studio/hooks/__tests__/useMediaAutosavePreference.test.ts features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
3. `npm -C frontend run test:adaptive-v2-gate`
4. `npm -C frontend run test:phase11:fal-regression`
5. `npm -C frontend run validate:phase11:fal-regression`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`
9. `npm -C frontend run type-check`
10. `npm -C frontend run lint`
11. `npm -C frontend run build`

## Key Outcomes
1. Recovery execution now settles success without `media_files` writes when autosave preference is OFF.
2. Recovery metadata and decision event telemetry include autosave decision fields.
3. Manual save remains allowed and duplicate insert races resolve as success semantics.
4. Generated video cards expose save action when unsaved.

## Risk Notes
1. Staging behavior matrix (`ON/OFF x generated/upload/paste x image/video`) is pending before wave closeout.
2. Size-budget guard remains warn-only for `frontend/features/ai-studio/hooks/useAiStudioState.ts` (current warn lane: `701 > 650`).

## Rollback Path
1. SQL: apply `sql/migrations/rollback/043_add_user_preferences_media_autosave_enabled_rollback.sql`.
2. Runtime behavior: disable autosave-off branch by reverting the recovery enforcement seam (`recoveryExecution.ts`) in a targeted rollback commit.
3. Client behavior: remove `useMediaAutosavePreference` wiring from `pages/ai-studio.tsx` and fallback to default autosave-on behavior.
