# Next-Agent Handoff: Approved Panel List-Orchestration Root Fix

## Lane Id

`approved-panel-list-orchestration-root-fix`

Purpose: remove the shared approved-panel open-phase extra-list request at the owning runtime seam without making UI, UX, or intended behavior changes.

## Fix Classification

- `root fix`

This lane is not a cosmetic cleanup and not a patch-around.

The May 31 production remeasurement says the remaining high-ROI issue is the shared approved-panel list-orchestration seam itself.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Stay inside the named source seam.
- Do not broaden into UI work, product-semantics redesign, or measurement-tool rewrites unless the stop rules are hit.

## Why this task

- System: `Elements workflow`
- Current score: `5/10`
- Target score: `6/10`
- Ship floor: `6/10`
- Current queue reason:
  - the accepted May 30 runtime patch removed one visible missing-preview symptom
  - the fresh May 31 production rerun still shows `extraListCallsPerOpen: 1` on both approved-panel surfaces
  - the remaining risk is shared runtime debt, not a product-workflow semantics issue

## Mandatory Constraint

- Do **not** make UI changes.
- Do **not** make UX changes.
- Do **not** intentionally change user-visible product behavior.
- Do **not** widen the solution with fallback branches, parallel paths, or workaround authority.
- Fix the canonical source seam that causes the extra open-phase list request.

## Recommended Agent Profile

Runtime orchestration agent with strong source-fix discipline in React data flow, shared panel runtime ownership, and targeted regression testing.

## Scoped Task

Trace the extra approved-panel list request back to the owning orchestration seam and make one bounded source fix that removes the unnecessary open-phase churn while preserving the current browse contract.

## Owned Write Surface

- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`
- `frontend/features/media-library/runtime/surfaceConfig.ts` only if required by the canonical fix
- directly related tests for the same seams

## Inspect First

- `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`
- `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`
- `frontend/features/elements-manager/components/ElementsPanelSplitHost.tsx`
- the owned write surface above
- the May 31 production remeasurement packet

## Avoid Surface

- `frontend/pages/api/media/list.ts` unless the investigation proves the duplicate request originates from server contract misuse rather than client orchestration
- preview-signing fallback logic unless the extra list request is directly caused there
- panel copy, layout, interaction, or selection semantics
- project/workspace persistence files
- character workflow files
- Create pricing or resolution files

## In Scope

- approved-panel open-phase list orchestration
- panel data-controller/runtime ownership
- request de-duplication at the source seam
- targeted regression tests
- sharp findings if the seam is misidentified

## Out Of Scope

- UI changes
- UX changes
- intended behavior changes
- measurement-script redesign as the primary fix
- broad panel/runtime refactors outside the owning seam

## Required Context

Read first:

- `docs/systems/catalog.md`
- `docs/records/artifacts/agent/holomony/reports/current/2026-05-21-approved-panel-runtime-check.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-30-production-post-redeploy-baseline-refresh.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-approved-panel-production-remeasurement-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-30-elements-approved-panel-runtime-hardening-closeout.md`

Inspect first:

- the owned write surface above
- directly related tests

## Questions To Answer

1. Which exact state transition or effect dependency is causing the second list request during approved-panel open-phase?
2. What single canonical-source fix removes that duplicate request without changing the browse contract?
3. What targeted proof is strong enough to show the root seam improved without pretending the whole workflow is solved?

## Expected Output

- one bounded root-fix patch with targeted tests and evidence, or
- one findings packet that proves the real source seam is elsewhere

## Suggested Validation

- targeted tests for:
  - `frontend/features/media-library/runtime`
  - `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController`
- any existing tests that specifically exercise approved-panel browse open
- `npm -C frontend run docs:check` if docs change
- if practical, include a local rerun or evidence trace that shows the duplicate open-phase list request is removed or isolated

## Done State

- the owning source seam for the duplicate list request is reduced or clearly isolated
- the patch stays inside the no-UI/no-UX/no-intended-behavior-change constraint
- the result is easy for Copperknot to review as either:
  - real root-fix progress, or
  - a bounded findings packet

## Stop Rules

- Stop if the only plausible improvement requires intentional UI, UX, or user-visible behavior change.
- Stop if the issue actually belongs to a separately queued lane such as `Project / workspace persistence`.
- Stop if the only honest next move is measurement-tool expansion rather than a runtime source fix; return a findings packet instead of forcing code churn.

## Required Closeout Report

- Path:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-approved-panel-list-orchestration-root-fix-closeout.md`
- Required contents:
  - lane id
  - fix classification
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - source seam identified
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
   - `YYYY-MM-DD-approved-panel-list-orchestration-root-fix-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `root-fix patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - root-fix patch complete
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
