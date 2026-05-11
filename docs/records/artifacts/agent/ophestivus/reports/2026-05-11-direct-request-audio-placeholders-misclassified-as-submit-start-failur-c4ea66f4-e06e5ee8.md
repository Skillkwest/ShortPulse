# Direct-request audio placeholders misclassified as submit-start failures

- Created: 2026-05-11T02:30:22.666Z
- Status: review-ready
- Ticket: c4ea66f4-270b-4efb-8712-96570ecb673a
- Incident: e06e5ee8-44fb-49a6-b576-3202ca5332fb

## Summary

Synchronous ElevenLabs audio placeholders were being treated as provider-task start placeholders, causing false submit-start failures when direct requests ran longer than the generic 90s start timeout.

## Changes

Added direct-request placeholder classification for synchronous ElevenLabs audio generation, routed music, sound-effects, and voice placeholders into that class, and taught stale cleanup/output lifecycle to use a separate direct-request timeout instead of the submit-start timeout.

## Validation

npm run test -- features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts; npx eslint features/ai-studio/types.ts features/ai-studio/hooks/useAiStudioOptimisticPlaceholderActions.ts features/ai-studio/hooks/useAiStudioAudioGeneration.ts features/ai-studio/logic/staleOutputCleanup.ts features/ai-studio/hooks/useAiStudioOutputLifecycle.ts features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts; git diff --check -- features/ai-studio/types.ts features/ai-studio/hooks/useAiStudioOptimisticPlaceholderActions.ts features/ai-studio/hooks/useAiStudioAudioGeneration.ts features/ai-studio/logic/staleOutputCleanup.ts features/ai-studio/hooks/useAiStudioOutputLifecycle.ts features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts

Verification class: tests-and-data-verified

Recurrence: 0 open same-fingerprint incidents; 0 fresh events after 2026-05-11T02:29:17.000Z.

## Residual Risk

monitor: Live browser route verification was not performed in this pass; watch localhost/dev ElevenLabs audio generation recurrence, especially if provider latency exceeds the new direct-request timeout budget.
