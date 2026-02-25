# ADR 0025: AI Studio Create Startup Model Precedence

## Status
Accepted

## Context
Create workflow startup model selection was spread across multiple hooks and partially duplicated filtering paths.  
This allowed drift between:
- model picker option filtering,
- saved-model validity checks,
- startup fallback behavior when session storage contained stale or invalid model ids.

The product requirement is explicit: on a new Create session (or invalid restored value), default to Seedream 4.5 text-to-image.

## Decision
1. Introduce a canonical policy module: `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`.
2. Define `fal-ai/bytedance/seedream/v4.5/text-to-image` as the Create/Image startup default model id.
3. Apply one precedence rule for Create startup restore:
   - keep saved model when still valid for current Create mode;
   - else, for Create + Image, resolve Seedream text-to-image;
   - else return `null`.
4. Reuse the same policy for model-option filtering in page derivations and allowed-model hooks to avoid split logic.
5. Keep storage key/version unchanged (`aiStudioWorkflowSettingsByTool.v1`) for backward compatibility.

## Consequences
- Positive:
  - Deterministic startup behavior across fresh and restored sessions.
  - Reduced coupling and drift risk by centralizing filtering + validity logic.
  - Minimal-diff integration with existing hooks and no API contract changes.
- Negative:
  - One additional internal module to maintain.
  - Policy changes now require test updates in multiple hook suites by design.

## Alternatives considered
- Leave per-hook filtering/default logic in place:
  - Rejected due to recurring drift and invalidation mismatches.
- Force model migration by bumping workflow storage schema:
  - Rejected because behavior can be made deterministic without migration or user-state reset.
