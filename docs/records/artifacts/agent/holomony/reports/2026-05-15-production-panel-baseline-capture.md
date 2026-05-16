# Holomony Run Report - 2026-05-15 - production-panel-baseline-capture

## Task

- Requested work: capture retained production KPI baseline packets for the approved media-panel surfaces and begin using compare mode with real packet history.
- User-approved surface: AI Studio Media panel and Elements embedded media panel.
- Environment: production runtime at `https://www.shortpulse.ai`.
- Branch: `production`.
- Database / project target: production runtime audit only; no database mutation.
- KPI or runtime tools used:
  - `frontend/scripts/media_panel_kpi_capture.mjs`
  - `frontend/scripts/media_panel_kpi_score.mjs`
- Why this lane had better ROI than stopping:
  - compare mode needed real packet history
  - the approved surfaces still had no retained repeated production baselines

## Problem Statement

- Observed hotspot:
  - no retained repeated packet history for either approved panel surface
  - no evidence-backed way to tell whether shared panel-runtime issues were surface-specific or common
- Why it matters:
  - without repeated packets, KPI scoring stays mostly theoretical and compare mode has nothing real to compare
- Current hypothesis:
  - the dominant performance weakness is shared across both approved panel surfaces
  - especially extra list calls, weak canonical preview coverage, and some visible state churn
- What would count as success:
  - at least two retained production packets per approved surface
  - first compare-mode output for each surface
  - a clearer diagnosis of shared vs surface-specific weakness

## Scope

- Surfaces included:
  - `ai-studio-panel`
  - `elements-media-panel`
- Surfaces explicitly excluded:
  - dead standalone `/media-library` route
  - modal-only flows
  - Reference Grid
  - Quick Slot Inventory
- What was intentionally not touched:
  - product code
  - save/upload flows
  - database rows
- What evidence was expected:
  - retained KPI packets
  - compare-mode summaries

## Action Log

| Step | Surface / Tool | Action | Result | Evidence |
| ---- | -------------- | ------ | ------ | -------- |
| 1 | `ai-studio-panel` / capture helper | Captured first retained production baseline packet | Success | `2026-05-15-ai-studio-panel-baseline.packet.json` |
| 2 | `elements-media-panel` / capture helper | Captured first retained production baseline packet | Success | `2026-05-15-elements-media-panel-baseline.packet.json` |
| 3 | `ai-studio-panel` / capture helper | Captured second retained production packet | Success | `2026-05-15-ai-studio-panel-baseline-r2.packet.json` |
| 4 | `elements-media-panel` / capture helper | Captured second retained production packet | Success | `2026-05-15-elements-media-panel-baseline-r2.packet.json` |
| 5 | KPI scorer compare mode | Compared AI Studio retained packet pair | Success | compare output in terminal |
| 6 | KPI scorer compare mode | Compared Elements retained packet pair | Success | compare output in terminal |

## Findings

### What Worked

- first visible media remained fast on both surfaces
  - AI Studio: corrected retained pair `361ms`, `412ms`
  - Elements: corrected retained pair `414ms`, `411ms`
- both surfaces were stable enough to audit
  - no console errors
  - no resolver use in these runs
- compare mode worked on real retained packet pairs without any tooling changes during the run

### What Failed Or Drifted

- both surfaces still showed weak canonical preview coverage
  - `0.3333` in the corrected retained pairs
- both surfaces incurred one extra list call on open in the corrected retained pairs
- Elements showed slightly worse visible state churn than AI Studio in the corrected pair
- both surface comparisons remained `insufficient evidence` because each packet still had `sampleCount: 1` and partial metric coverage

### What Was Learned

- this does not look like a one-surface problem
- the dominant weakness appears shared across the panel runtime:
  - weak canonical preview authority
  - repeated list churn
  - residual visible state churn
- the initial fallback-storm diagnosis was a capture-helper bug, not a product truth
- the highest-ROI next optimization target is likely the shared panel preview/list runtime, not surface-specific shell code

## KPI / Evidence Packet

- AI Studio packets:
  - `docs/records/artifacts/agent/holomony/reports/2026-05-15-ai-studio-panel-baseline.packet.json`
  - `docs/records/artifacts/agent/holomony/reports/2026-05-15-ai-studio-panel-baseline-r2.packet.json`
- Elements packets:
  - `docs/records/artifacts/agent/holomony/reports/2026-05-15-elements-media-panel-baseline.packet.json`
  - `docs/records/artifacts/agent/holomony/reports/2026-05-15-elements-media-panel-baseline-r2.packet.json`
- KPI score:
  - all four runs capped to `4.9 / 10`
- Evidence quality:
  - insufficient per packet
  - directionally useful across the repeated pair
- Test validation:
  - existing capture/scorer tests were already green before this run
- Browser/runtime validation:
  - real authenticated production panel captures
- Derived metrics used:
  - `firstMediaPaintP95Ms`
  - `loadingStateVisibleMsP95`
  - `openToFirstMediaP95Ms`
  - `signBatchP95Ms`
  - `resolveCallsPerOpen`
  - `stateFlipCountPerOpen`
  - `extraListCallsPerOpen`
  - `canonicalPreviewCoverageRatio`
- Missing metrics:
  - `stableContentSettleMsP95`
  - `fallbackCallsPerOpen`
  - `resolveFailedRatio`
  - `fallbackFailedRatio`
  - `visualRegressionCount`
  - `missingPreviewRatio`
  - `emptyStateMismatchCount`
  - persistence metrics

## Code / Tooling Follow-Up

- Files changed:
  - none in product code during the capture run
- Tooling created or improved:
  - compare mode was exercised successfully on real packet pairs
  - the capture helper was corrected so it no longer overcounts generic storage/image requests as fallback events
- Docs updated:
  - retained baseline state and training notes updated after capture
- What should be reused next time:
  - same capture helper
  - same report naming pattern
  - compare mode immediately after the second retained packet

## Self Audit

- Score out of 10: `9.1`
- Score breakdown:
  - evidence: `1.9 / 2.0`
  - scope: `1.5 / 1.5`
  - ROI: `1.8 / 2.0`
  - correctness: `1.5 / 1.5`
  - tooling: `1.5 / 1.5`
  - retention: `0.6 / 1.0`
  - ops: `0.2 / 0.5`
- Confidence: `medium`
- Hard gate triggered: `none`
- Weakest category: `retention`
- Smallest next-run improvement:
  - persist compare outputs as retained markdown artifacts, not only terminal evidence
- Did the lane stop at the right point?:
  - yes; the next step is now a real shared-runtime optimization lane, not more baseline collection by momentum alone

## Training Record

- Memory update needed?: yes
- Training-history update needed?: yes
- Failure-taxonomy update needed?: no
- Experiment-ledger update needed?: no
- Capability-ladder impact?: none yet
