# Phase 5 Evidence: Default-Model Foundation + Reliability Delta Closeout (2026-02-24)

## Scope
- Create workflow startup default-model hardening with shared policy module.
- Residual reliability delta hardening for parse/body-read exception normalization.
- Missing regression coverage for malformed upstream payload handling and cross-card optimizer source bypass behavior.

## Before vs After
- Before:
  - Create startup model validity/default logic was split across hooks, increasing drift risk.
  - Some upstream parse/body-read failures could escape as thrown exceptions rather than typed failures.
  - Optimizer failover had baseline coverage, but cross-card same-source bypass was not explicitly asserted.
- After:
  - `modelSelectionPolicy.ts` is the canonical source for allowed options + Create startup model precedence.
  - Create/Image restore now deterministically resolves to `fal-ai/bytedance/seedream/v4.5/text-to-image` when saved model is missing/invalid.
  - Fast-path and thinker/formatter parse/body-read failures return typed failures (`status` + `detail`) and remain in classified retry/fallback lanes.
  - Added explicit regression proving same-session cross-card same-source optimizer bypass behavior.

## Create Startup Model Precedence (Locked)
1. Preserve saved model when it remains valid for current Create mode.
2. For Create + Image with missing/invalid saved model, default to `fal-ai/bytedance/seedream/v4.5/text-to-image`.
3. Keep `null` only when no valid/default candidate exists for the active mode.

## Retry/Fallback Matrix (No User-Lane Contract Change)
- `infra_transient` / `infra_runtime` -> assistant fallback (`200`)
- `safety_refusal` -> canonical refusal (`200`)
- `auth_config` / `invalid_request` -> explicit non-200 errors

## Regression Validation Executed
- `features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
- `features/ai-agent/logic/__tests__/studioAgentThinkerFormatter.test.ts`
- `tests/api/studio-agent.runtime.test.ts`
- `features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
- `features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
