# AI Studio Expert Edit Properties Panel Tracker (2026-03-04)

## Objective
Track execution status, validations, and rollback posture for the Expert Edit properties panel rollout.

## Status Legend
1. `DONE`: completed and validated.
2. `IN_PROGRESS`: active work.
3. `PENDING`: not started.
4. `BLOCKED`: waiting on dependency/decision.

## Phase Status
1. `DONE` Phase 0: Fal edit prompt capability evidence captured.
2. `DONE` Phase 1: Expert-edit routing + kill-switch gate with legacy fallback.
3. `DONE` Phase 2: Expert Edit panel UI + scoped styling.
4. `DONE` Phase 3: Model-capability prompt policy wiring across generation/submit gates.
5. `DONE` Phase 4: Character mode parity for Edit with user-first reference merge.
6. `DONE` Phase 5: Regression hardening and required gates.
7. `DONE` Phase 6: Documentation/index/env updates.

## Validation Log
1. `DONE` Targeted phase tests for routing, panel rendering, prompt policy, and character parity.
2. `DONE` `npm -C frontend run lint` (warnings only; no errors).
3. `DONE` `npm -C frontend run type-check`.
4. `DONE` `npm -C frontend run test -- features/ai-studio`.
5. `DONE` `npm -C frontend run check:architecture-boundary`.
6. `DONE` `npm -C frontend run build`.
7. `PENDING` `npm -C frontend run docs:check` (final docs gate).

## Commits
1. `6ac7028e` docs evidence for edit prompt capabilities.
2. `5e0e919d` expert-edit routing gate + legacy fallback.
3. `01c65d65` expert-edit panel view + styles.
4. `759a32bc` model-capability prompt requirement policy.
5. `5a71fac6` character-mode submission parity for expert edit.
6. `8ed1342b` regression stabilization for expert-edit rollout gates.

## Rollout Control
1. Default mode: `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=true`.
2. Kill switch: set `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` to force legacy Edit panel.

## Open Follow-Ups
1. Decide final chat-mode behavior strategy for Edit panel beyond current hidden/off default.
2. Revisit secondary slot model-capability limits if provider contracts change.
3. Add production telemetry dashboard slice for expert-edit-specific start-failure trends.
