# AI Studio Create Reliability Hardening v3 (Evidence)

Date: 2026-02-25

## Scope
- Create Properties Character Mode submit reliability.
- Nano Banana Pro / Seedream edit submit-start invariants.
- Spinner-without-network fast-fail hardening.
- Effect/idempotency stabilization for model/video-mode synchronization.

## Code Paths Updated
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/logic/staleOutputCleanup.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/features/ai-studio/logic/withDeadline.ts`

## Validation Executed
1. Targeted reliability suites:
   - `npm run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts features/ai-studio/hooks/__tests__/useAiStudioStateEffects.test.tsx features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts features/ai-studio/logic/__tests__/withDeadline.test.ts`
2. Full AI Studio regression suite:
   - `npm run test -- features/ai-studio`
3. Type safety:
   - `npm run type-check`

## Result
- All listed test suites passed.
- `features/ai-studio` suite passed: 84 files / 580 tests.
- TypeScript type-check passed (`tsc --noEmit`).

## Behavioral Guarantees Added
1. Pre-submit async stages now have explicit 10s deadlines and fail-fast UX copy.
2. Submission route completion without task start now fails immediately (`SUBMIT_NOT_STARTED`) and emits telemetry.
3. Generated stale placeholder detection now keys on behavioral generated state (`mediaSource: "generated"`), not only `out-*` ids.
4. Selector-store publish queue cannot remain latched after epoch mismatch flush abort.
5. State effect writes now guard against redundant same-value model/reference-mode setters.
