# Enate Ende Canvas Launch Hardening Plan

Status: active planning baseline; implementation not started

Last audited: 2026-06-03

Launch target: 2026-07-07

Date note: the user set the current Canvas launch target to July 7, 2026. Repo governance docs still describe the broader pre-launch decision window ending 2026-07-02. This plan uses the July 7 launch target for Canvas hardening while preserving the existing repo branch and production-validation rules until those higher-level docs are explicitly revised.

Purpose: harden the current AI Studio right-rail Canvas for launch without adding new Canvas feature classes, new workspace concepts, or alternate authority paths.

Current checkpoint: the Canvas already has solid core primitives for pan, zoom, marquee select, text notes, media drops, dual-camera shared-scene state, and project snapshot durability. The launch risk is not missing big features. The risk is uneven trust at a few owner seams: one stale false-red test, under-proven page-shell entry wiring, one shared restore-and-authority seam that may become a scale risk, weak fallback detail affordances, and save or restore messaging that is truthful but not yet graceful.

## Core Invariant

For launch, every Canvas item created through supported project workflows must persist into project save and restore back into the project-owned Canvas with correct scene placement, camera state, and usable media authority.

Current contract caveat:

- non-durable `blob:` and `data:` media is intentionally excluded from durable Canvas restore in `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- this plan therefore treats unsupported transient-only restore as a contract risk to either eliminate from launch-supported intake paths or make explicitly fail-closed and understandable

## Fixed Launch Limits

The current launch plan assumes these repo-backed limits remain in force unless a separate lane changes them intentionally:

- Canvas hard item cap: `300`
- Canvas snapshot byte budget: `900_000`
- Canvas zoom clamp: `0.2` to `2.5`

Launch hardening must prove these limits behave deterministically and understandably. It must not quietly change them as part of polish work.

## Launch-Supported Persistence Flows

For this plan, `supported project workflows` means the current Canvas paths that either begin durable or are converted to durable authority before save:

- empty-space text creation and external plain-text drops
- internal Reference Grid and related right-rail reference drops that resolve to durable `outputId` or `mediaId`
- Media Library drops that already carry durable authority
- direct file drops that ingest through the canonical page-owned media ingestion path before the project is saved
- restored media items that can recover from durable `outputId`, durable `mediaId`, or both

These are explicitly not launch-supported durable restore flows unless they acquire durable authority before save:

- transient-only `blob:` sources
- transient-only `data:` sources
- any Canvas item path that never becomes durable in the current repo contract

## Planning Principles

This plan should only produce high-ROI launch changes. Every workstream must follow these rules:

- prefer the smallest owner seam that reduces launch risk
- preserve the current `CANVAS_BEHAVIOR_MATRIX.md` contract unless the plan explicitly says otherwise
- prove the issue before optimizing it
- do not widen a Canvas hardening lane into a shared persistence rewrite unless the bug is clearly Canvas-owned
- keep the right rail global and shared; do not fork Canvas by workflow, mode, route, or viewport
- preserve the current shared-scene plus isolated-camera contract across main and rail Canvas instances
- do not introduce a new snapshot side channel, fallback restore path, or duplicate media-authority path
- stop after each workstream and re-check ROI before continuing

## Done Criteria

This lane is done only when all of the following are true:

- Canvas tests are green for the right reasons, with no known stale assertions masking real regressions
- the real page-shell entry path is covered: header toggle, double-click isolate and restore, and Canvas media-detail open routing
- the shared-scene plus isolated-camera contract is directly proven and remains intact
- the global right-rail contract remains intact across Create workflow and Standard versus Pulse mode changes
- project save and project restore reliably preserve the full durable Canvas contract for launch-supported item types
- restore and autosave do not churn because refreshed media URLs or output-authority repair are mistaken for user edits
- Canvas feels fast and stable during normal launch-scale use of the current product
- degraded states are understandable, not silent, and not dead ends
- production validation on `https://www.shortpulse.ai` passes the launch proof matrix before launch freeze

## In Scope

This plan is limited to the current right-rail Canvas contract:

- Canvas visibility, isolation, and page-shell wiring
- Canvas-owned scene persistence, Canvas-owned restore truth, and verification of Canvas save and restore behavior
- Canvas media-authority refresh and fallback detail behavior
- Canvas interaction feel within the current primitive set
- Canvas save-budget, degraded-state, and restore-trust UX
- targeted tests, fixtures, and launch validation for those seams

## Out Of Scope

Do not widen this lane before launch into:

- new Canvas object types or structural tools
- connectors, arrows, sections, frames, comments, collaboration presence, templates, or presentation tools
- Quick Slot Inventory or Reference Grid feature work unless a proven Canvas bug originates there
- broad file-splitting cleanup done only for aesthetics
- new persistence side channels, alternate restore paths, or duplicate Canvas authorities

## Ownership Boundary For This Plan

This plan is intentionally strict about owner seams.

- Enate Ende owns Canvas behavior, Canvas snapshot truth, Canvas page-shell wiring, Canvas-visible detail behavior, and Canvas-focused proof.
- Datserok owns broader project persistence, project restore, and workspace hydration behavior when the root cause is not Canvas-owned.
- Holomony or Gutan own media-display and media-performance work when the root cause is outside Canvas-owned presentation and detail behavior.

Practical rule:

- if the bug is in `sessionSnapshotCanvas.ts`, Canvas tests, Canvas page-shell wiring, or a Canvas-owned detail contract, Enate Ende can carry it
- if the bug is in shared project save or restore logic and Canvas is only the visible symptom, stop and hand off with evidence instead of absorbing the whole lane into Canvas work

## Source Of Truth

Use these in order:

1. root repo rules in `AGENTS.md`
2. launch-claim rules in `docs/agents/solo-owner-launch-trust-standard.md`
3. Enate Ende scope and SOP in `docs/agents/enate-ende/README.md`, `docs/agents/enate-ende/AGENTS.md`, and `docs/agents/enate-ende/standard-operating-procedure.md`
4. global right-rail authority in `docs/adr/0083-create-mode-global-right-rail-authority.md`
5. Canvas interaction contract in `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`
6. Canvas shared-scene and session owner paths in:
   - `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
   - `frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts`
   - `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
   - `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
7. page-shell and shared-runtime verification seams in:
   - `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
   - `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`

If docs and code disagree, treat current code plus current validation evidence as the decision source, then update the stale doc.

## Findings That Control The Plan

1. Canvas is already a competent media-and-text board. The launch gap is trust and polish, not missing major primitives.
2. One false-red test currently weakens the Canvas suite: `canvas.interactions.test.tsx` still expects centered text-drop coordinates while the canonical text-drop contract is release-point placement.
3. The real user path into Canvas is under-proven because page-shell coverage is thinner than lower-level Canvas coverage.
4. The most likely scale hotspot is full-scene Canvas reconciliation after output-authority refresh and `mediaId` signing refresh, but it should be treated as an optimize-only-with-proof seam.
5. The autosave and restore signature model is smart and necessary, but it sits partly in shared persistence ownership, so Canvas planning must verify it carefully and only patch it directly when the defect is clearly Canvas-owned.
6. The fallback Canvas detail path is safe but weak. It makes older Canvas items feel archival rather than usable.
7. The save-budget path is deterministic and tested, but the current messaging is not yet as clear or reassuring as a launch surface should be.

## Chosen Hardening Methods

This plan uses three methods and rejects broader pre-launch expansion.

### Method 1: Trust-First Hardening

Goal: restore truthful regression signal and prove the real user path before deeper changes.

Why this wins:

- it lowers fear when touching launch-critical Canvas code
- it prevents local green tests from hiding page-shell regressions
- it keeps later performance and UX work bounded to proven seams

### Method 2: Canvas Durability Hardening

Goal: make Canvas-owned save and restore behavior trustworthy without quietly turning Enate Ende into a general persistence lane.

Why this wins:

- save and restore is the highest-value user promise in the current Canvas
- Canvas should feel creative, but launch trust depends more on not losing work than on adding tools
- owner boundaries stay cleaner when Canvas verifies shared persistence seams first and only edits them when the repo proves the root cause is Canvas-owned

### Method 3: UX Polish Within Existing Behavior

Goal: make the current Canvas feel quicker, clearer, and more intentional without creating a feature-growth lane.

Why this wins:

- the comparison with Figma, FigJam, and Lucidspark showed the biggest current gap is post-drop trust and organization feel, not raw capability count
- launch-safe polish can improve confidence and speed without introducing new product contracts

## No-Regression Gate For Every Workstream

Do not mark a workstream complete until these are true:

- targeted tests covering the touched seam pass
- no `CANVAS_BEHAVIOR_MATRIX.md` contract was weakened accidentally
- shared-scene and dual-camera behavior remain intact
- the global right-rail authority still behaves as one workspace surface across supported workflow and mode switches
- the change did not introduce a second authority path
- the next lane still has better ROI than stopping

### Workstream 1: Restore Trustworthy Signal

Owner seams:

- `frontend/features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `frontend/features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx`
- `frontend/features/ai-studio/components/canvas/canvasSceneState.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspacePersistenceController.test.ts`

Tasks:

- fix the stale shared-scene text-drop assertion so the suite matches the real text-drop contract
- clean the known async warning debt in the persistence-controller tests only if that cleanup stays at the test-harness level and does not widen into persistence behavior work
- keep the Canvas suite green before moving into deeper hardening lanes

Stop condition:

- Canvas and Canvas-adjacent persistence suites are readable and green for the actual current contract

### Workstream 2: Prove The Real Canvas Entry Path

Owner seams:

- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`

Tasks:

- add focused tests for the header `Canvas` button toggle
- add focused tests for Canvas double-click isolate and restore
- add focused tests for Canvas item open routing to `studio-output` vs `canvas-item` detail targets
- add focused proof that the shared right-rail Canvas does not fork across supported workflow or Standard versus Pulse transitions
- add focused proof that main and rail keep one scene authority while preserving separate camera state

Stop condition:

- the visible page-shell path into Canvas is directly proven, not inferred from lower-level tests

### Workstream 3: Lock Canvas Save And Restore Invariants

Owner seams:

- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- Canvas save and restore tests that prove the current contract
- shared runtime hooks only as verification boundaries unless the root cause is clearly Canvas-owned

Tasks:

- define one explicit launch contract for what Canvas persistence must preserve
- add or tighten tests for mixed media plus text projects, restored stale-output projects, and near-limit projects
- prove the exact supported persistence matrix for:
  - text items
  - durable image items
  - durable audio items
  - durable video items
  - direct file drops that convert to durable authority before save
- verify that durable Canvas state includes:
  - scene items
  - item positions and z-order
  - main and rail camera state
  - valid media authority refresh after restore
- verify that the hard-cap and snapshot-budget paths stay deterministic:
  - Canvas item cap trims by the current deterministic contract
  - oversized or reduced-save behavior stays fail-closed and understandable
- verify that transient edit state is stripped or preserved exactly per current contract, not accidentally
- audit all launch-supported Canvas intake paths to confirm they land on durable authority by save time
- if save or restore trust fails because of shared project-persistence logic outside the Canvas snapshot contract, stop and hand the defect to Datserok with exact evidence

Stop condition:

- project save and project restore are trustworthy for all launch-supported Canvas item flows, or the remaining defect has been sharply handed off outside Canvas ownership

### Workstream 4: Conditional Reconciliation Risk Pass

Owner seams:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`

Tasks:

- profile or reproduce the suspected Canvas-specific restore or authority-refresh cost before changing code
- preserve the current restore-signature rule that ignores refreshed signed URLs when durable media authority already exists
- confirm no false autosave unlocks after restore or authority refresh
- only ship an optimization if it clearly improves a reproduced user-facing Canvas issue and stays on the canonical current path
- if no measured launch-scale problem appears, close this workstream with `no change required`

Stop condition:

- the seam is either proven acceptable for launch or improved by one bounded low-risk fix

### Workstream 5: Polish Existing UX Contracts

Owner seams:

- `frontend/features/ai-studio/logic/canvasDetailModal.ts`
- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`

Tasks:

- strengthen the fallback Canvas detail experience without changing ownership boundaries or inventing new capability policy
- review drag, pan, zoom, selection, draft-text, and text-edit responsiveness for obvious friction
- improve save-budget and degraded-restore warnings so they explain what happened in Canvas terms
- keep all UX work inside the existing Canvas model

Stop condition:

- the current Canvas no longer feels brittle or confusing when users hit degraded states in supported flows

### Workstream 6: Production Proof And Freeze

Tasks:

- run the production Canvas proof matrix on `https://www.shortpulse.ai`
- record the pass or fail status for each launch-critical flow
- after the proof matrix passes, treat Canvas as frozen except for blocker-level fixes

Stop condition:

- production evidence is decision-grade and no non-blocker Canvas churn remains before launch

## Golden Fixtures

Use a small fixed set of reusable Canvas project states:

1. text-only board
2. mixed media plus text board
3. restored board with missing live output authority but valid `mediaId`
4. near-limit board close to Canvas hard-cap or snapshot-size pressure
5. shared-scene dual-viewport board with divergent main and rail camera state
6. workflow or mode-switch board that proves Canvas remains one global right-rail surface

These fixtures must be reused for tests and manual validation instead of improvised one-off cases.

## Current Proof Boundary

As of 2026-06-03, this plan is still based on strong local code and test evidence plus official canvas-product comparison research. Authenticated production Canvas proof is still pending from this session because the last direct production attempt stopped at the auth gate before the Canvas surface could be exercised.

## Launch Proof Matrix

Before launch, prove these flows:

1. open and hide Canvas from the AI Studio header
2. double-click Canvas to isolate and restore the right rail
3. add text to Canvas and confirm it remains after project save and reopen
4. drop current supported media/reference inputs into Canvas and confirm they remain after project save and reopen
5. pan, zoom, select, marquee, drag, and edit without obvious lag or state glitches
6. open detail from fresh Canvas media items
7. open detail from restored Canvas items with and without surviving output authority
8. reload the project and confirm the Canvas scene and both cameras restore as expected
9. hit reduced-save or oversized-save behavior intentionally and confirm warning clarity plus fail-closed behavior
10. verify main and rail share one scene while keeping separate cameras
11. verify Canvas remains one shared right-rail surface across supported workflow and Standard versus Pulse transitions

Local tests count as implementation proof. Launch-safe claims require production proof on `https://www.shortpulse.ai`.

## Launch Thresholds

Canvas is below launch bar if any of these are true:

- user-created durable Canvas items disappear after project save and reopen
- project restore silently drops supported Canvas content
- restore repeatedly re-triggers autosave without user edits
- Canvas detail open is dead-ended for common restored media cases
- normal drag, pan, or zoom obviously stutters on ordinary launch-scale boards
- page-shell Canvas controls behave inconsistently

Canvas can still launch if the remaining issues are only:

- copy clarity improvements
- non-blocking warning wording polish
- test-hygiene cleanup without runtime impact
- maintainability refactors that do not reduce current launch risk

## Stop And Escalate Rules

Treat these as launch blockers:

- proven Canvas data loss
- broken project save or project restore for supported Canvas flows
- false autosave or restore loops
- production-only Canvas control failure on the right rail
- unrecoverable stale-media fallback in common restored flows

Do not spend launch time on:

- sections, frames, connectors, comments, presence, presentation tools, or collaboration concepts
- broad right-rail redesign
- cleanup that does not reduce a real launch risk

## Freeze, Rollback, And Change Rules

- once the production proof matrix passes, only blocker-level Canvas fixes go in before launch
- if a hardening lane introduces restore risk, autosave churn, or interaction regression, revert that lane instead of improvising a late rescue
- do not widen a Canvas hardening patch into adjacent Quick Slot Inventory or Reference Grid work unless the root cause clearly lives there

## Next Execution Order

1. restore trustworthy signal
2. add page-shell Canvas coverage
3. lock save and restore invariants with golden fixtures
4. polish fallback detail and degraded-state UX
5. run the conditional reconciliation pass only if evidence justifies it
6. run production proof and freeze

## What Would Change This Plan

Re-audit this plan if any of these change:

- the launch date or launch decision window
- the Canvas persistence contract
- the global right-rail ownership contract
- the project workspace restore contract
- authenticated production proof that contradicts the current local audit
