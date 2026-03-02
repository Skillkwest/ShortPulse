# Phase 13 Wave E Pass 13: Staged Restore Agent-Hydration Gate

Date: 2026-03-02  
Owner: Engineering  
Status: Pass

## Scope
1. Added an independent gate for agent transcript/input hydration during session restore apply:
   - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` (`true` by default).
2. Preserved one-shot restore behavior per `sid` and existing restore-apply gate behavior.
3. Added telemetry signal to hydration breadcrumb (`agent_hydration_applied`) for promote/hold evidence windows.
4. Extended restore-hydration hook tests to cover agent-gate off behavior.

## Touched Surfaces
1. `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
2. `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
3. `README.md`
4. `docs/api/api-internal-routes.md`
5. `docs/troubleshooting.md`

## Validation Commands
1. `npm -C frontend run test -- --run features/ai-agent/__tests__/useAiAgent.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts features/ai-studio/logic/__tests__/sessionRestoreCandidate.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreCandidate.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run check:architecture-boundary`
5. `npm -C frontend run check:size-budget`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Result
1. Restore apply now supports staged rollout of workspace/output hydration independent of agent transcript/input hydration.
2. Tests and validation suite passed.
3. Hard size-budget failure is clear; existing `useAiStudioState.ts` warn-lane debt remains unchanged (warn mode only).

## Risk Notes
1. If `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED=false`, users may see restored workspace/output state with fresh/empty agent transcript by design.
2. Promote/hold windows should track hydration breadcrumb distribution split by `agent_hydration_applied`.

## Rollback Readiness
1. Immediate rollback options:
   - set `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=false` (disable all restore apply),
   - or keep restore apply on and set `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED=true` (re-enable transcript/input restore).
2. Revert pass commit if full rollback is required.
