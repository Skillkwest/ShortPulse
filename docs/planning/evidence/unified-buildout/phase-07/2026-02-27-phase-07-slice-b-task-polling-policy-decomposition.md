# Phase 07 Slice B Evidence: Task Polling Policy Decomposition

Date: 2026-02-27  
Owner: Engineering  
Phase: 07 (AI Studio Foundation Modularization)  
Slice: B follow-up (`useAiStudioTasks` decomposition)

## Scope Delivered
1. Extracted provider status parsing/classification policy from `useAiStudioTasks` into:
   - `frontend/features/ai-studio/hooks/taskPolling/providerStatusPolicy.ts`
2. Extracted poll cadence and retry-budget policy into:
   - `frontend/features/ai-studio/hooks/taskPolling/pollingSchedulePolicy.ts`
3. Extracted output-lookup miss/hard-stop policy into:
   - `frontend/features/ai-studio/hooks/taskPolling/outputLookupPolicy.ts`
4. Extracted background recovery scheduling max-attempt policy into:
   - `frontend/features/ai-studio/hooks/taskPolling/backgroundRecoveryPolicy.ts`
5. Rewired `frontend/features/ai-studio/hooks/useAiStudioTasks.ts` to consume extracted policies while preserving behavior.
6. Added focused policy unit tests under:
   - `frontend/features/ai-studio/hooks/taskPolling/__tests__/providerStatusPolicy.test.ts`
   - `frontend/features/ai-studio/hooks/taskPolling/__tests__/pollingSchedulePolicy.test.ts`
   - `frontend/features/ai-studio/hooks/taskPolling/__tests__/outputLookupPolicy.test.ts`
   - `frontend/features/ai-studio/hooks/taskPolling/__tests__/backgroundRecoveryPolicy.test.ts`

## Validation Run
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts features/ai-studio/hooks/taskPolling/__tests__/providerStatusPolicy.test.ts features/ai-studio/hooks/taskPolling/__tests__/pollingSchedulePolicy.test.ts features/ai-studio/hooks/taskPolling/__tests__/outputLookupPolicy.test.ts features/ai-studio/hooks/taskPolling/__tests__/backgroundRecoveryPolicy.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`
6. `node scripts/check_architecture_boundaries.js`

## Behavior/Contract Notes
1. No public API route shape changes.
2. No provider contract changes.
3. No queue/recovery data-shape changes.

## Rollback
1. Revert this slice commit only.
2. Validate parity suite:
   - `features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
3. Keep prior Phase 07 Slice B baseline commit in place.
