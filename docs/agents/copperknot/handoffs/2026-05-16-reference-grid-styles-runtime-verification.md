# Next-Agent Handoff: Reference Grid Styles Runtime Verification

## Lane Id

`reference-grid-styles-runtime-verification`

## Why This Lane Exists

The bounded `Reference Grid -> Styles` hardening lane landed strong regression coverage and removed multiple payload-authority loss modes, but the Copperknot did **not** clear the blocker yet.

Reason:

- the ship-path blocker moved from broad investigation to narrow runtime verification
- the remaining gap is live confirmation:
  - either the production/runtime styles-drop failure is gone
  - or there is one more concrete payload-loss shape still escaping the new tests

This is now the exact next-work item because `Reference Grid` is still below floor and still carries the live ship-path blocker.

## System

- `Reference Grid`
- system id: `ai-studio-reference-grid`
- current score: `6/10`
- target score for this lane: `7/10`
- why the score is currently low:
  - the bounded fix is strong, but the blocker is not yet retired because live runtime confirmation is still missing

## Owned Write Surface

- `frontend/features/ai-studio/components/style-creator/**`
- `frontend/features/ai-studio/components/**/StylesLibraryPanel*`
- `frontend/features/ai-studio/hooks/useAiStudioInternalDropResolvers*`
- targeted tests under:
  - `frontend/features/ai-studio/components/style-creator/__tests__/`
  - `frontend/features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioInternalDropResolvers.test.ts`
- Catalog-Agent closeout only under:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

## Avoid Surface

- do **not** widen into `Billing / credits`
- do **not** widen into `Generation submission / polling`
- do **not** redesign the broader Reference Grid runtime
- do **not** reopen unrelated Media Library or preview-delivery work

## Required Context

- `docs/agents/copperknot/handoffs/2026-05-06-reference-grid-styles-drop-blocker.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-reference-grid-styles-drop-blocker-closeout.md`
- `docs/known-issues.md`
- current Copperknot rerating packet:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-16-consolidated-rerating-pass.md`

## Goal

Do a narrow live/runtime verification pass on the `Reference Grid -> Styles` drag/drop blocker and either:

1. prove the blocker is resolved with fresh runtime evidence, or
2. isolate the remaining payload-loss shape into one bounded follow-up patch with regression coverage

## Tasks

1. Reproduce the current `Reference Grid -> Styles` drag/drop flow in the most direct runtime path available.
2. Compare the observed runtime payload shape against the newly hardened snapshot/rehydration logic.
3. If the flow now works:
   - capture the evidence clearly
   - confirm no additional code change is needed
4. If the flow still fails:
   - isolate the exact remaining payload-loss mode
   - patch only that mode
   - add the regression test that would have caught it
5. Keep the lane narrow. This is verification-first, not a broad redesign.

## Validation

Run the most relevant targeted verification for the touched seam.

At minimum:

- the style-creator focused tests
- any panel/drop tests touched by the patch
- any direct runtime/browser verification you can capture clearly

## Stop Conditions

Stop only when one of these is true:

1. you have strong live/runtime evidence that the blocker is gone, or
2. you found one remaining bounded payload-loss mode, fixed it, and validated it, or
3. you can prove the remaining issue is outside this lane’s owned surface

Do **not** keep expanding scope after that.

## Required Self-Audit Before Stopping

Before closing the lane:

- audit the touched repo area for adjacent regressions or incomplete acceptance criteria
- fix any high-value in-scope issue you discover
- explicitly record anything left out of scope

## Closeout And Archive

When done, write the closeout here:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-reference-grid-styles-runtime-verification-closeout.md`

Use the template:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/template.md`

The closeout must include:

- whether live/runtime verification succeeded
- what runtime evidence was captured
- any code changes made
- tests run
- self-audit findings
- whether the Copperknot should now clear `KI-AI-RG-STYLES-001`

## Send To Catalog

If the user tells you `send this to the catalog`, do this exactly:

1. write the closeout report into `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
2. use the required filename above
3. follow the required closeout template
4. then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is `complete`, `blocked`, or `verification only`
