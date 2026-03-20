---
name: skill-mvp-modularization-pass
description: Plan and execute low-risk modularization of oversized ShortPulse files while preserving behavior, tests, and release timelines. Use when continuing Phase 3 of the MVP pre-tester remediation plan, splitting large pages/hooks/services, and enforcing file-size and boundary standards with evidence updates.
---

# MVP Modularization Pass

Purpose: reduce change risk and improve maintainability by splitting high-churn files into clear modules without altering behavior.

## Sources of truth
- `docs/planning/mvp-pretester-full-audit-remediation-plan.md`
- `docs/agent-playbook.md`
- `docs/conventions.md`
- `docs/dev-ground-rules.md`
- `docs/sops/sop_new_feature_modularization.md`
- `docs/frontend-architecture.md`
- `frontend/pages/media-library.tsx`
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/lib/server/api/generationBilling.ts`
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
- Target core source files at ~`500` lines.
- Temporary exceptions up to `800` lines are allowed only with explicit rationale and a dated follow-up split plan.
- Avoid creating new files above `500` lines without explicit rationale.
5. Track plan evidence
- Update the relevant Phase 3 checklist item(s) in `docs/planning/mvp-pretester-full-audit-remediation-plan.md`.
- Add a dated change-log line in the same plan doc describing exactly what was extracted.
- Include concrete evidence paths for new modules/tests in the checklist entry.
6. Finalize and document
- Update architecture or SOP docs when boundaries materially change.
- Record completed phase-level outcomes in `docs/change_log.md` when a phase closes.

## Required verification
- `cd frontend && npm run validate`
- `cd frontend && npm run docs:check`
- `cd frontend && npm run build`
- Run targeted feature tests for touched logic before full validation.

## Output format (recommended)
```text
Modularization report
- Scope: <files>
- Behavior status: preserved | regression risk

Splits completed
- <source file> -> <new modules> -> <why this boundary>

Validation
- validate: pass | fail
- docs:check: pass | fail
- build: pass | fail

Follow-ups
- <remaining oversized file> -> <next split>
- line-count delta: <source file before> -> <source file after>
- plan update paths: <checklist line>, <change-log line>
```
