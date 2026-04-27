# AI Studio Expert Edit Properties Panel Fresh-Start Lean-Up Plan (2026-04-10)

Last updated: 2026-04-10  
Status: draft  
Owner: Engineering

## Purpose
Define a fresh-start, repo-audit-backed plan to make the Expert Edit properties panel materially leaner without changing runtime behavior, layout, interaction semantics, or existing user-visible functionality.

This plan is intentionally written from current repo truth first. Older planning docs may still contain useful history, but they are not authoritative for this effort unless they match the live code and current validation baseline.

## Authority Order
Use these sources in this order:
1. Live code in `frontend/`
2. Current tests and guardrail outputs
3. Current SOP and ADR contracts that still match live runtime behavior
4. Historical planning docs only as reference material

## Current Repo-Backed Baseline
Audit date: 2026-04-10

### Verified validation state
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
   - Result: `180` tests passed
2. `npm -C frontend run check:architecture-boundary`
   - Result: passed
3. `npm -C frontend run check:size-budget`
   - Result: passed in warn mode
   - Active warning: `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` is `5937` lines and exceeds the Expert Edit target budget of `5000`

### Current hotspot posture
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` remains the dominant hotspot.
2. The file currently contains concentrated orchestration, render output, host sync, drag/drop ingress, session sync, context-menu wiring, and secondary-slot handling in one surface.
3. Existing extraction work already landed for some domains:
   - `frontend/features/ai-studio/components/edit/useExpertEditTransformController.ts`
   - `frontend/features/ai-studio/components/edit/useExpertEditMarkupViewportController.ts`
   - `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`
   - `frontend/features/ai-studio/components/edit/useExpertEditStageInteractionRouter.ts`
4. The remaining structural bulk is still local to `ExpertEditPanelView.tsx`, not a routing or architecture-boundary failure.

### Current high-value seam inventory
1. Primary ingress, file handling, blob lifecycle, and layer insertion logic around the primary-image path.
2. Session and host synchronization effects, including prop-to-layer and layer-to-host sync.
3. Render-heavy presenter blocks for the primary stage, context menu, and secondary reference row.
4. Partial reuse of the generic reference-properties interaction hook despite Expert Edit-specific behavior needs.

### Contract anchors that must remain stable
1. `frontend/features/ai-studio/components/edit/expertEditPanelViewContract.ts`
2. `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
3. `frontend/features/ai-studio/hooks/contracts/pageContentContracts.ts`

### Characterization locks from current tests
The cleanup pass must preserve these already-proven behaviors:
1. blank primary stage remains inert to upload click
2. blank primary stage remains inert to drag/drop ingest
3. blank primary stage does not open the stage context menu
4. blank primary canvas frame stack accepts image drops
5. loaded primary surface keeps current stage context-menu behavior, including recenter
6. move-tool controls keep current recenter and zoom-slider behavior
7. inline stage pan/zoom behavior remains active under current markup/move rules
8. presets surface continues to suppress primary upload and drop ingest
9. populated-stage reference drops keep current flatten/composite handoff behavior

Primary test anchor:
1. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`

## Problem Statement
The Expert Edit properties panel is functionally stable but structurally overweight.

The immediate problem is not feature absence. The immediate problem is that one oversized component still owns too many domains, which increases maintenance cost, coupling, and regression risk around the primary staging area and surrounding panel behavior.

## Goal
Reach a state where:
1. `ExpertEditPanelView.tsx` is below the current `5000` line transition target,
2. remaining inline code is predominantly orchestration rather than mixed-domain logic,
3. behavior, layout, and interaction semantics remain unchanged,
4. targeted Expert Edit tests and existing guardrails remain green,
5. future UX work can be added on top of smaller, clearer seams instead of inside the current hotspot.

### Budget posture
1. `5000` is the active transition budget for this cleanup plan, not the desired long-term steady state.
2. After the first successful convergence under `5000`, the next recommended tightening target is `3500` for the remaining orchestrator surface.
3. A later target near `2000` is only appropriate if `ExpertEditPanelView.tsx` becomes a true thin coordinator.
4. A `1000`-line target is not appropriate for the current architecture and should not be adopted during this cleanup pass.

## Explicit Non-Goals
1. No redesign of the Expert Edit panel.
2. No DOM contract changes for the current blank-stage or populated-stage behavior.
3. No prompt-token grammar or generation-payload changes.
4. No changes to stage-interaction semantics, modal parity rules, or current menu behavior.
5. No CSS/layout restyling except parity-preserving movement needed for extraction.
6. No net-new UX or functionality in this lean-up pass.

## Fresh-Start Planning Decisions
### Documentation decision
Create one new current-state roadmap document now: this file.

### Tracker decision
Do not create a new tracker yet.

Reason:
1. no implementation slice is active yet,
2. a tracker created before slice kickoff is likely to become stale immediately,
3. the first implementation slice should create the tracker only if work actually starts.

### Lane-doc decision
Do not create individual lane docs yet.

Reason:
1. the seam order is clear enough for one roadmap,
2. lane-level docs should appear only when a seam enters implementation and needs its own acceptance bundle.

### ADR decision
Do not create a new ADR for this effort.

Reason:
1. this plan is structural and no-regression in scope,
2. it does not currently propose a new durable architecture decision,
3. any future behavior or contract change should trigger a separate ADR decision at that time.

## Historical References Posture
The following files remain historical references only for this plan unless re-audited during implementation:
1. `docs/planning/ai-studio-expert-edit-properties-panel-plan-2026-03-04.md`
2. `docs/planning/ai-studio-expert-edit-properties-panel-tracker-2026-03-04.md`
3. `docs/planning/lane-b-master-plan-2026-03-16.md`
4. `docs/planning/lane-b-tracker-spec-2026-03-16.md`
5. `docs/planning/lane-b-execution-plan-2026-03-16.md`

These docs are not deleted or invalidated here. They are simply not the authority source for this lean-up plan.

## Locked Invariants
The following must remain unchanged during the lean-up effort:
1. public prop contracts consumed by the AI Studio panel wiring
2. visible Expert Edit layout and structure
3. current blank-stage and populated-stage interaction semantics
4. inline versus modal parity behavior already governed by runtime contracts
5. prompt-reference behavior already covered by current SOP contracts
6. current focused test outcomes for `ExpertEditPanelView`

## Implementation Process Rules
1. No cleanup slice may change CSS unless the change is strictly required for parity-preserving extraction.
2. No cleanup slice may rewrite test assertions except where import paths or helper ownership must move without changing asserted behavior.
3. No cleanup slice may rename accessibility labels, menu roles, or current DOM-facing surface identifiers.
4. No cleanup slice may combine structure work with opportunistic behavior fixes.
5. Each slice must move one coherent domain only.

## Execution Sequence
### Phase 0: Characterization Lock Refresh
Goal:
1. confirm the baseline before any extraction starts,
2. capture the exact command results and hotspot measurements in a first implementation evidence packet if implementation begins.

Required checks:
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `npm -C frontend run check:architecture-boundary`
3. `npm -C frontend run check:size-budget`

Required audit output:
1. current `ExpertEditPanelView.tsx` line count
2. current hook/effect density snapshot
3. exact behavior locks being protected for the next slice

### Phase 1: Presenter Extraction
Goal:
1. move render-only subtrees out of `ExpertEditPanelView.tsx`,
2. keep DOM output and behavior unchanged.

Primary targets:
1. primary stage subtree
2. stage context menu subtree
3. secondary reference row
4. lower panel wrappers that are presentation-only

Success criteria:
1. no prop contract changes,
2. no DOM-facing behavior changes,
3. measurable `ExpertEditPanelView.tsx` size reduction.

### Phase 2: Primary Ingress Extraction
Goal:
1. isolate primary image ingress behavior into a dedicated Expert Edit controller hook,
2. preserve all existing upload, drag/drop, blob, and layer-insertion semantics.

Primary targets:
1. primary file select handling
2. primary drag/drop handling
3. blob cloning and lifecycle ownership
4. layer insertion/replacement policy
5. max-layer enforcement

Success criteria:
1. primary image behavior is unchanged,
2. the extracted hook has a clear single responsibility,
3. no new DOM or UX behavior is introduced.

### Phase 3: Session And Host Sync Extraction
Goal:
1. remove the host/session synchronization mass from `ExpertEditPanelView.tsx`,
2. keep synchronization behavior identical.

Primary targets:
1. session-state dispatch/coalescing
2. equality guards
3. prop-to-layer sync
4. layer-to-host primary sync
5. owned object URL cleanup

Success criteria:
1. no observable host-sync behavior drift,
2. no new persistence or lifecycle regressions,
3. reduced effect density in `ExpertEditPanelView.tsx`.

### Phase 4: Expert-Edit-Only Reference Interaction Seam
Goal:
1. remove generic interaction-hook baggage from Expert Edit,
2. replace partial reuse with an Expert Edit-specific interaction hook while preserving semantics.

Primary targets:
1. secondary slot drag/drop handling
2. prompt drop handling
3. prompt-token drag insertion handling

Success criteria:
1. Expert Edit no longer depends on unrelated generic interaction state,
2. secondary and prompt flows remain behaviorally identical,
3. the new hook is scoped to Expert Edit needs only.

### Phase 5: Convergence Review
Goal:
1. decide whether the hotspot is now clean enough to stop,
2. avoid micro-seam churn that only moves code around.

Questions to answer:
1. Is `ExpertEditPanelView.tsx` now below the current target budget?
2. Is the remaining inline code primarily orchestration?
3. Would another extraction materially reduce coupling, or just add indirection?

## Validation Bundle
Run after every implementation phase:
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `npm -C frontend run check:architecture-boundary`

Run at each phase closeout:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:size-budget`
4. `npm -C frontend run build`

Validation interpretation rules:
1. the focused `ExpertEditPanelView` suite is the required parity gate after every seam, not just at the end of a phase bundle
2. if a seam causes a test failure in unrelated Expert Edit behavior, stop and re-scope rather than patching forward blindly
3. size-budget improvement is expected from this plan, but test and behavior parity override line-count optimism

## Stop Conditions
Stop a phase immediately if:
1. preserving behavior starts requiring DOM contract changes,
2. preserving behavior starts requiring test rewrites for changed semantics instead of parity proof,
3. the seam adds more dependency threading than it removes coupling,
4. the extracted module does not have a clear domain identity,
5. the work begins to drift into redesign, CSS churn, or opportunistic behavior cleanup.

Stop the overall lean-up program when:
1. `ExpertEditPanelView.tsx` is at or below the current `5000` line target,
2. remaining inline code is mainly orchestration,
3. further seams would be low-leverage micro-extractions,
4. the next likely changes belong to product UX work rather than structural cleanup.

Recommended reassessment point:
1. once the file is below `5000`, decide whether to stop or continue toward a tighter `3500` follow-on target based on actual remaining mixed-domain mass rather than momentum.

## Rollback Rule
Every implementation phase must be independently reversible.

Do not combine:
1. behavior changes,
2. visual changes,
3. naming churn,
4. docs cleanup by adjacency,
5. unrelated refactors

with a lean-up slice.

## Recommended Next Step
If implementation begins, start with Phase 1 only and create the tracker at that time.

The first implementation packet should include:
1. the refreshed baseline command output,
2. exact extracted files,
3. before/after file size delta,
4. phase-specific validation results,
5. rollback notes.
