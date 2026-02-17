# Expert Workflow Hardening + CSS Reorg Plan

Purpose: execution tracker for the unified expert-mode robustness + styling reorganization effort. This is the source of truth for scope, sequencing, gates, and rollout safety.

## Scope Summary
This plan combines two workstreams:
1. Expert-mode generation robustness hardening.
2. Expert create CSS reorganization with no visual-intent change.

## Global Rules
1. One concern per slice. Do not mix functional and CSS reorg work in the same slice.
2. Do not start the next phase until the current phase Definition of Done is met.
3. Any failed gate blocks forward progress.
4. Existing class names must remain; additive classes are allowed only when needed.
5. CSS output must remain visually and behaviorally equivalent.

## Feature Flag Matrix
Flag: `NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI`

1. Development:
   - Default ON when unset.
   - May be forced OFF explicitly.
2. Preview/Staging:
   - Default OFF.
   - ON only when explicitly set for rollout validation.
3. Production:
   - Default OFF.
   - ON only when explicitly set.
4. Fallback:
   - Missing/invalid value is OFF outside development.

## Rollback / Kill Switch
1. Immediate mitigation: set `NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI=false`.
2. Functional rollback boundary: revert latest generation-controller/reconciliation slice only.
3. CSS rollback boundary: revert expert split import block and restore previous expert stylesheet.
4. Use reversible commits only; no destructive git operations.

## Visual Baseline Protocol (Before CSS Phase)
Capture screenshots for all required states:
1. Expert create, no chat history.
2. Expert create, with chat history and output-generate pills.
3. Character mode ON and OFF.
4. Dropdown states open: model/aspect/resolution.
5. Mobile versions of the above.

Required viewports:
1. Desktop: `1440x900`
2. Tablet: `1024x768`
3. Mobile: `390x844`

Acceptance criteria:
1. Only anti-aliasing/subpixel noise allowed.
2. No layout shift, spacing drift, color drift, or interaction-state behavior change.

## Phase Tracker

### Phase 0: Baseline + Contract Fixes
- [ ] Fix current `type-check` failures in `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts`.
- [ ] Add missing tests before logic changes:
  - [ ] Guardrail parity for output-generate.
  - [ ] Optimistic debit orphan/null-entry cleanup behavior.

Definition of Done:
1. `cd frontend && npm run type-check` passes.
2. New tests are present and passing (and validated against behavior intent).
3. `cd frontend && npm run test -- features/ai-studio` passes.

### Phase 1: Guardrail Consistency
- [ ] Enforce primary-generate guardrails for output-generate path.

Definition of Done:
1. Output-generate blocks on busy/lock/guardrail conditions.
2. No bypass path remains in generation controller.
3. Targeted tests and full AI Studio tests pass.

### Phase 2: Optimistic Debit Integrity
- [ ] Prevent orphan optimistic debit entries for non-submitted runs.
- [ ] Add stale-null-entry cleanup safeguards.

Definition of Done:
1. No null debit entries persist beyond policy window.
2. No unrelated outputs receive stale debit assignment.
3. Reconciliation tests and full AI Studio tests pass.

### Phase 3: Output-Generate Eligibility + Sanitization
- [ ] Centralize output-generate disable logic to align with primary generate.
- [ ] Normalize/sanitize output-generate prompt input (not trim-only).

Definition of Done:
1. Inline expert and right-panel output-generate use identical eligibility rules.
2. Sanitization parity matches existing apply/variation prompt normalization semantics.
3. Text panel tests, page tests, and full AI Studio tests pass.

### Phase 4: Expert UI Rollout Flag
- [ ] Replace dev-only expert gating with runtime feature flag + env defaults.
- [ ] Update `.env.example`.

Definition of Done:
1. Flag behavior matches matrix in development/preview/production expectations.
2. `.env.example` is updated.
3. Full AI Studio tests and type-check pass.

### Phase 5: Character Picker State Hardening
- [ ] Close/reset picker state when character mode toggles OFF.
- [ ] Eliminate hidden-open modal/listener edge state.

Definition of Done:
1. Picker cannot remain logically open while hidden.
2. Character mode toggle tests cover the edge path.
3. Relevant tests pass.

### Phase 6: CSS Reorganization (No Visual Change)
- [ ] Split `frontend/styles/ai-studio-create-expert.css` into:
  - [ ] `frontend/styles/ai-studio-create-expert.tokens.css`
  - [ ] `frontend/styles/ai-studio-create-expert-chat.css`
  - [ ] `frontend/styles/ai-studio-create-expert-output-generate.css`
  - [ ] `frontend/styles/ai-studio-create-expert-composer.css`
  - [ ] `frontend/styles/ai-studio-create-expert-controls.css`
  - [ ] `frontend/styles/ai-studio-create-expert-motion.css`
  - [ ] `frontend/styles/ai-studio-create-expert-responsive.css`
- [ ] Update import order in `frontend/styles/globals.css`.

Definition of Done (per sub-slice and final):
1. No visual diff outside allowed baseline threshold.
2. No selector/state regression.
3. Full AI Studio tests and type-check pass after each sub-slice.

### Phase 7: Docs + Final Certification
- [ ] Update docs (`docs/styles-structure.md`, changelog entries as needed).
- [ ] Run final verification gates.

Definition of Done:
1. `cd frontend && npm run type-check` passes.
2. `cd frontend && npm run test -- features/ai-studio` passes.
3. `cd frontend && npm run test -- tests/pages/ai-studio.character-mode.test.tsx` passes.
4. Visual baseline comparison is signed off.

## Gate Command Checklist
- [ ] `cd frontend && npm run type-check`
- [ ] `cd frontend && npm run test -- features/ai-studio`
- [ ] `cd frontend && npm run test -- tests/pages/ai-studio.character-mode.test.tsx`

## Change Log
Use this section to track progress slice-by-slice.

### 2026-02-17
1. Created execution tracker document.
2. No functional or styling behavior changes in this step.

