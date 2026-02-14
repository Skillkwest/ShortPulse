---
name: skill-mvp-modularization-pass
description: Plan and execute low-risk modularization of oversized ShortPulse files while preserving behavior, tests, and release timelines. Use when splitting large pages/hooks/services, reducing churn risk in MVP code paths, or enforcing file-size and boundary standards from the pre-tester remediation plan.
---

# MVP Modularization Pass

Purpose: reduce change risk and improve maintainability by splitting high-churn files into clear modules without altering behavior.

## Sources of truth
- `docs/planning/mvp-pretester-full-audit-remediation-plan.md`
- `docs/conventions.md`
- `docs/dev-ground-rules.md`
- `docs/sops/sop_new_feature_modularization.md`
- `docs/frontend-architecture.md`
- `frontend/pages/media-library.tsx`
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/pages/api/_utils/generationBilling.ts`
- `frontend/lib/falClient.ts`

## Workflow
1. Baseline and boundaries
- Capture file size and churn targets before edits.
- Define module boundaries by concern and ownership.
- Keep public interfaces stable while splitting internals.
2. Extract incrementally
- Move one concern at a time into focused modules.
- Keep orchestration files thin and delegate logic to feature modules/hooks/services.
- Avoid broad renames and unrelated cleanups in the same diff.
3. Preserve behavior
- Keep data contracts and side-effect ordering equivalent.
- Add or adjust tests around extracted business logic and edge paths.
- Validate API route behavior when splitting server utilities.
4. Enforce limits
- Target no core source file above `800` lines in this pass.
- Avoid creating new files above `500` lines without explicit rationale.
5. Finalize and document
- Update architecture or SOP docs when boundaries materially change.
- Record completed modularization outcomes in `docs/change_log.md`.

## Required verification
- `cd frontend && npm run type-check`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- Run targeted route or feature tests for touched logic.

## Output format (recommended)
```text
Modularization report
- Scope: <files>
- Behavior status: preserved | regression risk

Splits completed
- <source file> -> <new modules> -> <why this boundary>

Validation
- type-check: pass | fail
- test: pass | fail
- build: pass | fail

Follow-ups
- <remaining oversized file> -> <next split>
```
