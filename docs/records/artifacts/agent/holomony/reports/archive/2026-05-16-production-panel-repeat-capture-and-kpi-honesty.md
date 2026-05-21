# Holomony Run Report - 2026-05-16 - production-panel-repeat-capture-and-kpi-honesty

## Task

- Requested work: continue Holomony's media-panel lane by fixing KPI capture honesty, then rerun retained production panel captures on the approved surfaces.
- User-approved surfaces:
  - `ai-studio-panel`
  - `elements-media-panel`
- Environment: production runtime at `https://www.shortpulse.ai`
- Branch: `production`
- Database / project target: none

## Problem Statement

- The capture helper was still generating single-run timing fields with `p95` names.
- That undermined the KPI system's authority even when the direction of the work was right.
- After the recent panel list-count optimization, retained evidence also needed a fresh capture to verify whether `extraListCallsPerOpen` had actually improved.

## Actions Taken

1. Hardened `frontend/scripts/media_panel_kpi_capture.mjs`
   - added repeated-run capture support with `--runs`
   - defaulted the helper to `5` repeated panel opens
   - kept direct timing `p95` fields null unless at least `5` runs were collected
   - aggregated per-open metrics honestly across repeated captures
2. Updated capture tests in `frontend/scripts/__tests__/media_panel_kpi_capture.test.ts`
3. Updated KPI SOP guidance in `docs/sops/sop_media_panel_performance_kpi.md`
4. Ran fresh retained production captures:
   - `2026-05-16-ai-studio-panel-baseline.packet.json`
   - `2026-05-16-elements-media-panel-baseline.packet.json`
5. Compared those new retained packets against the latest 2026-05-15 retained baselines

## Findings

### What Worked

- The KPI capture helper is materially more honest now.
- Repeated-run timing evidence is now real repeated-run evidence, not a single-run pseudo-percentile.
- Both approved surfaces still open stably enough to capture.
- `resolveCallsPerOpen` stayed at `0` on both approved surfaces in the fresh repeated-run packets.
- `consoleErrorsPerOpen` stayed at `0` on both approved surfaces in the fresh repeated-run packets.

### What Failed Or Drifted

- `extraListCallsPerOpen` remained `1` on both surfaces even after the recent panel count-request optimization.
- `canonicalPreviewCoverageRatio` dropped to `0` in both new repeated-run packets.
- `signBatchP95Ms` was much worse than the older single-run retained packets:
  - AI Studio: `1801ms`
  - Elements: `1892ms`
- Evidence quality improved from `insufficient` to only `low`, not `medium/high`, because coverage is still only `57%`.

### What Was Learned

- The earlier panel hook change removed one real count-only request seam, but it was not the full explanation for the KPI list-churn metric.
- There is still another open-path `media/list` request seam, or the capture is reflecting another legitimate second open-phase list call.
- The stronger repeated-run evidence shifts the next likely hotspot away from the retired fallback-storm theory and toward:
  - remaining open-path list churn
  - weak canonical preview authority on visible rows
  - very expensive preview signing

## KPI / Evidence Packet

- AI Studio retained packet:
  - `docs/records/artifacts/agent/holomony/reports/2026-05-16-ai-studio-panel-baseline.packet.json`
- Elements retained packet:
  - `docs/records/artifacts/agent/holomony/reports/2026-05-16-elements-media-panel-baseline.packet.json`
- Repeated-run packet highlights:
  - AI Studio:
    - `sampleCount: 5`
    - `firstMediaPaintP95Ms: 1094`
    - `loadingStateVisibleMsP95: 1002`
    - `signBatchP95Ms: 1801`
    - `resolveCallsPerOpen: 0`
    - `extraListCallsPerOpen: 1`
    - `canonicalPreviewCoverageRatio: 0`
  - Elements:
    - `sampleCount: 5`
    - `firstMediaPaintP95Ms: 920`
    - `loadingStateVisibleMsP95: 859`
    - `signBatchP95Ms: 1892`
    - `resolveCallsPerOpen: 0`
    - `extraListCallsPerOpen: 1`
    - `canonicalPreviewCoverageRatio: 0`

## Compare Output Summary

- AI Studio versus `2026-05-15-ai-studio-panel-baseline-r2.packet.json`
  - score delta: `+1.1`
  - still flagged `insufficient evidence` because one side of the comparison remains the old thin packet
  - meaningful regressions:
    - first media paint
    - loading state visible time
    - open to first media
    - sign batch p95
    - canonical preview coverage
- Elements versus `2026-05-15-elements-media-panel-baseline-r2.packet.json`
  - score delta: `+1.1`
  - still flagged `insufficient evidence` for the same reason
  - meaningful improvements:
    - visible state flips per open
  - meaningful regressions:
    - first media paint
    - loading state visible time
    - open to first media
    - sign batch p95
    - canonical preview coverage

## Self Audit

- Score out of 10: `8.7`
- Confidence: `medium`
- Hard gate triggered: `none`
- Weakest category: `retention`
- Why not higher:
  - retained baseline and compare evidence are now stronger, but Holomony's summary surfaces still needed catch-up after the product/tooling changes
- Did the lane stop at the right point?:
  - yes; the next best move is another focused audit on the still-remaining open-path list churn and preview authority, not more KPI scaffolding

## Next Best Step

1. identify the remaining second open-phase `/api/media/list` request
2. inspect why visible rows are still resolving almost entirely to original assets instead of canonical preview-backed delivery
3. only then decide whether the next optimization cut is list churn or canonical preview authority
