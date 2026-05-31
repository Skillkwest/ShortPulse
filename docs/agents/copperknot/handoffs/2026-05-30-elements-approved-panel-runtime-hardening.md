# Next-Agent Handoff: Elements Approved Panel Runtime Hardening

## Lane Id

`elements-approved-panel-runtime-hardening`

Purpose: reduce the remaining approved-panel runtime risk that keeps `Elements workflow` below floor without making UI, UX, or product-behavior changes.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Stay inside backend/runtime hardening and evidence-backed validation.
- Do not broaden into a product-workflow redesign unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Elements workflow`
- Current score: `5/10`
- Target score: `6/10`
- Ship floor: `6/10`
- Current queue reason:
  - Holomony's `2026-05-21` production packet still shows approved-panel/runtime fragility on the Elements surface
  - the accepted `2026-05-28` Elements closeout already hardened the persistence seam, so the remaining risk is no longer primarily workflow/persistence ambiguity
- Why the score is currently low:
  - open-phase signing cost is still too high on the approved panel path
  - the Elements approved panel still has an Elements-only settled missing-preview gap
  - the remaining debt is primarily shared media-panel/runtime debt, not a UI semantics problem

## Mandatory Constraint

- Do **not** make UI changes.
- Do **not** make UX changes.
- Do **not** intentionally change user-visible product behavior.
- Any allowed code change must be runtime/support hardening that preserves the current product contract while reducing implementation risk, incorrect preview hydration, or unnecessary signing/runtime cost.

## Recommended Agent Profile

Backend/runtime hardening agent with strong preview-signing, panel-runtime, and API contract discipline.

## Scoped Task

Investigate the approved Elements media-panel runtime and make one bounded backend/runtime hardening change that reduces the remaining production risk without changing UI, UX, or intended user-visible behavior.

## Owned Write Surface

- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`
- `frontend/features/media-library/runtime/surfaceConfig.ts`
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/sign-batch.ts`
- directly related tests for the same seams

## Inspect First

- `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`
- `frontend/features/elements-manager/components/ElementsPanelSplitHost.tsx`
- `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`
- the owned write surface above

## Avoid Surface

- `frontend/features/ai-studio/components/ElementsPanel.tsx` unless a narrow runtime wiring fix is unavoidable and still non-user-visible
- broad asset-management redesign
- element copy/layout/interaction changes
- character workflow files except where direct comparison is required for diagnosis
- unrelated AI Studio panels
- provider runtime and billing files
- project/workspace persistence files

## In Scope

- approved panel open-phase signing path
- shared preview hydration/runtime wiring
- missing-preview diagnosis on the Elements approved surface
- server support seams that feed the approved panel
- targeted runtime characterization and regression tests

## Out Of Scope

- UI component redesign
- UX changes
- intended behavior changes
- broad workflow modularization
- project/workspace persistence
- character workflow

## Required Context

Read first:

- `docs/systems/catalog.md`
- `docs/records/artifacts/agent/holomony/reports/current/2026-05-21-approved-panel-runtime-check.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-30-production-post-redeploy-baseline-refresh.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-28-elements-workflow-hardening-closeout.md`

Inspect first:

- the owned write surface above
- directly related tests

## Questions To Answer

1. Which exact runtime seam is still driving the approved Elements panel cost or missing-preview gap?
2. What one backend/runtime hardening change reduces that risk without altering the product contract?
3. What proof is strong enough to show the lane improved without pretending that UI/UX or broader workflow semantics were changed?

## Expected Output

- one bounded backend/runtime hardening patch with tests and evidence, or
- one findings packet that sharply reduces the next scope

## Suggested Validation

- targeted media-panel/runtime tests
- targeted API tests for list/signing support seams
- `npm -C frontend run docs:check` if docs change
- if a runtime-safe measurement rerun is practical, include it as evidence, but do not substitute measurement alone for code validation

## Done State

- one key approved-panel runtime ambiguity is removed or isolated
- the patch stays inside no-UI/no-UX/no-behavior-change constraints

## Stop Rules

- Stop if the only plausible improvement requires intentional UI, UX, or user-visible behavior change.
- Stop if the issue actually belongs to `Project / workspace persistence` or another separately queued lane.
- Stop before broadening into a larger panel redesign unless the bounded issue cannot be solved in place.

## Required Closeout Report

- Path:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-elements-approved-panel-runtime-hardening-closeout.md`
- Required contents:
  - lane id
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - acceptance criteria reached
  - evidence snapshot
  - validation run
  - validation evidence
  - self-audit findings
  - issues fixed during self-audit
  - issues intentionally left out of scope
  - blockers encountered
  - residual risk
  - recommended next step for Copperknot review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-elements-approved-panel-runtime-hardening-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded hardening patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - what self-audit found
  - what was fixed during self-audit
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
