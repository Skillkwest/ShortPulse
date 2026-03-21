# AI Studio Full Recovery Program

Status: Planning locked; implementation entry gated (`P0` pending gate closure)  
Owner: AI Studio Engineering  
Last updated: 2026-03-21

## Objective
Stabilize AI Studio end-to-end so all core create/edit/video/character workflows are reliable, then harden model payload contracts, then finalize visual/UX consistency.

## Governance Artifacts (2026-03-21 Refresh)
Master planning governance and tracking for the current Reference Grid reliability incident class are now anchored in:
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/planning/ai-studio-reference-grid-reliability-phase-p0-execution-plan-2026-03-21.md`
6. `docs/planning/ai-studio-reference-grid-reliability-phase-p1-execution-plan-2026-03-21.md`
7. `docs/planning/ai-studio-reference-grid-reliability-phase-p2-execution-plan-2026-03-21.md`
8. `docs/planning/ai-studio-reference-grid-reliability-phase-p3-execution-plan-2026-03-21.md`
9. `docs/planning/ai-studio-reference-grid-reliability-phase-p4-execution-plan-2026-03-21.md`

The `P0` through `P4` planning set is now published; implementation remains gated by tracker/evidence entry criteria.
Implementation start contract: once readiness is promoted to `implementation_ready`, begin implementation immediately with `P0-S1` under the 4-hour kickoff SLA.

## Gate Authority
For AI Studio Reference Grid reliability implementation entry/exit decisions, canonical authority order is:
1. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-readiness-state-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-implementation-entry-checklist-2026-03-21.md`

This document is umbrella context and does not override gate status in the three authority docs above.

## Working Agreements
- Root-cause fixes before visual polish.
- No fallback architecture in this pass.
- Every phase has explicit gates and verification evidence.
- Do not close a phase without automated tests plus bounded smoke checks.

## Phase 1: Core Stability Restoration
Goal: Ensure all user actions that should add/show references reliably update the decoupled reference grid.

### Scope
- Output store publish bridge lifecycle (`useAiStudioState` -> external output store).
- Reference grid selector-store rendering path.
- Generate placeholder visibility and pending/spinner visibility.
- Prompt pin visibility (beginner + expert, create/edit/video).
- Upload/paste/library insertion visibility.

### Tasks
- [x] Fix StrictMode/remount-safe publish lifecycle in `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- [x] Ensure queued publish microtasks cannot apply stale mount state.
- [x] Keep passive-effect publish path (avoid nested sync updates).
- [x] Add selector-bridge regression tests for setOutputs, prompt pin, optimistic placeholders.
- [x] Add decoupled ReferenceCanvas selector-store render regression test.
- [x] Verify no update-depth regressions in targeted test suite.

### Exit Gates
- [ ] Inline generate creates visible pending card immediately.
- [ ] Large generate creates visible pending card immediately.
- [ ] Pin actions create visible prompt references in grid.
- [ ] Pasted/uploaded/library media appears in grid.
- [ ] No `Maximum update depth exceeded` during repeated generate/pin/add loops.

### Evidence
- Tests:
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`
  - Existing targeted suites (generation controller, prompt steps, reference canvas)
- Bounded smoke captures: pending card, pin action, paste/upload action.

## Phase 2: Payload Contract Hardening
Goal: Guarantee settings-to-payload correctness across all model/tool/mode combinations.

### Scope
- Seedream 2K/4K explicit aspect-locked sizing.
- Full model registry payload matrix parity.
- Character-mode submission contract coverage.

### Tasks
- [ ] Enforce explicit `{ width, height }` for Seedream `auto_2K`/`auto_4K`.
- [ ] Expand model payload matrix tests across create/edit/video paths.
- [ ] Add parity guards between registry contracts and submission handlers.
- [ ] Validate character mode on/off payload correctness across aspect/resolution.
- [ ] Update SOP + backlog tracking docs.

### Exit Gates
- [ ] No ambiguous Seedream auto-size pass-through for 2K/4K.
- [ ] Payload matrix green for all supported models.
- [ ] Character mode respects selected aspect/resolution in live smoke.

## Phase 3: UX/Visual Consolidation
Goal: Keep visuals clean and informative without performance regressions.

### Scope
- Loading/pending/spinner consistency.
- Generate disabled state consistency.
- Reference-card control consistency.

### Tasks
- [ ] Finalize bounded spinner policy (with degrade-level behavior).
- [ ] Keep pending card minimal (`generating...`/`pending`) for overflow states.
- [ ] Confirm small generate disabled state mirrors large generate disabled state.
- [ ] Remove unwanted helper text and unused card actions per product rules.

### Exit Gates
- [ ] Loading cues are clear and consistent across all workflows.
- [ ] No measurable interaction regressions from loading visuals.

## Validation Strategy
Automated + bounded live smoke

### Automated baseline
- [x] `npm run type-check`
- [x] Targeted vitest suites for updated hooks/components
- [ ] `npm -C frontend run test:adaptive-v2-gate` for reference-grid/adaptive seam changes (or waiver with owner/risk/expiry)

### Bounded live smoke matrix
- [ ] Create: inline and large generate
- [ ] Edit/video: pin and generate
- [ ] Add files + paste text/media + media library insert
- [ ] Seedream text/edit at `16:9`, `9:16`, `4:5`, `5:4` with 2K/4K
- [ ] Character mode ON/OFF sanity at 4K
- [ ] Two non-Seedream sanity checks

## Risk Register
- Risk: Fixing output bridge exposes latent selector-store assumptions.
  - Mitigation: phase-gated tests for bridge + decoupled canvas render.
- Risk: Payload hardening regresses non-Seedream paths.
  - Mitigation: model matrix parity tests + bounded smoke.
- Risk: Visual updates reintroduce performance instability.
  - Mitigation: bounded spinner caps + pressure-based degradation.
