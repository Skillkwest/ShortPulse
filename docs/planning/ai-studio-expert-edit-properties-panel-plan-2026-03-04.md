# AI Studio Expert Edit Properties Panel Plan (2026-03-04)

## Purpose
Define a regression-safe, minimal-diff implementation plan for the new Expert Edit properties panel while preserving legacy Edit behavior for beginner mode fallback.

## Scope
1. Add Expert Edit panel UI for Edit workflow in expert mode.
2. Keep legacy Edit panel intact for beginner mode fallback.
3. Preserve left rail and toolbar primary actions (`Create`, `Edit`, `Video`, `Character`).
4. Reuse existing generation/reference pipelines where possible.
5. Add rollout kill switch and documentation.

## Non-Scope
1. Left rail redesign.
2. Beginner-mode re-enable project.
3. Mobile-specific behavior.
4. Changing secondary edit slots beyond three.

## Locked Decisions
1. Expert Edit renders by default.
2. Chat mode UI is hidden/off in Expert Edit; inline Generate is the primary action.
3. Generate remains disabled until a primary reference image exists.
4. Character mode in Edit follows Create parity for submission behavior.
5. Prompt requirement is model-capability driven; unknown capability defaults to required.
6. Kill switch: `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` reverts Edit to legacy panel.

## Implementation Strategy
1. Add a parallel Expert Edit view path instead of rewriting legacy Edit internals.
2. Keep left rail and workflow routing primitives unchanged outside required panel selection.
3. Route via panel-contract layer (`useAiStudioPanelProps` -> page-content adapter -> `AiStudioPageContent`).
4. Reuse existing reference drag/drop handlers and submission orchestration.
5. Keep model/aspect/resolution controls aligned with Create behavior and existing registries.

## Phases And Validation
1. Phase 0: Capability evidence lock from Fal docs for edit prompt requirements.
2. Phase 1: Expert-edit routing and kill-switch gate with legacy fallback.
3. Phase 2: Expert Edit panel UI (primary + three secondary drop zones, inline composer/generate, character controls).
4. Phase 3: Model-capability prompt requirement policy integrated across generate/submit guards.
5. Phase 4: Character mode submission parity for Edit with user-reference-first merge ordering.
6. Phase 5: Regression hardening (`lint`, `type-check`, `test -- features/ai-studio`, architecture boundary, build).
7. Phase 6: SOP/index/env/planning docs updates and evidence indexing.

## Acceptance Matrix
1. Edit in expert mode renders Expert Edit panel; beginner mode continues to use legacy Edit panel.
2. Left rail behavior and structure remain unchanged.
3. Primary and three secondary drop zones support internal drags and file drops.
4. Inline Generate remains disabled until primary image is present.
5. Prompt-required models reject empty prompt with explicit error at submit boundaries.
6. Character mode in Edit injects character context and merges references user-first.
7. Kill switch cleanly routes Edit back to legacy panel.

## Rollout And Rollback
1. Default rollout: `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=true`.
2. Immediate rollback: set `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false`.
3. Secondary rollback: revert expert-edit commits in reverse batch order.

## Evidence
1. Prompt capability notes: `docs/planning/evidence/ai-studio-expert-edit/2026-03-04-model-capability-notes.md`.
