# Copperknot May 31 Approved-Panel Production Remeasurement Audit

Purpose: remeasure the live approved media-panel surfaces after the accepted May 30 runtime patch and decide whether the launch queue or system scores should actually move.

## Audit Target

- Branch: `production`
- Commit anchor: `c2b1275816b22eaf6a169ebf9fcbc38173402075`
- Latest launch-relevant repo movement:
  - `ed86fb5ce` — `Preserve canonical billed resolution ids in Create pricing`
- Worktree included: yes
- Product-code worktree drift: none
- Evidence mix:
  - `production durable`
  - `repo durable`
  - `retained comparison`

## What Was Remeasured

- `ai-studio-panel`
- `elements-media-panel`
- live production URL:
  - `https://www.shortpulse.ai`

Comparison anchors:

- `docs/records/artifacts/agent/holomony/reports/current/2026-05-21-approved-panel-runtime-check.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-30-production-post-redeploy-baseline-refresh.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-30-elements-approved-panel-runtime-hardening-closeout.md`

## Main Outcome

- The accepted May 30 runtime patch appears to have removed the visible Elements missing-preview symptom on the live production surface.
- No score lift is justified from the May 31 production remeasurement.
- No queue reorder is justified from the May 31 production remeasurement.
- The exact next lane remains `Elements workflow`.
- The remaining highest-ROI risk is no longer the old Elements-only missing-preview symptom. It is now the shared approved-panel open-phase list-orchestration seam plus weak evidence depth.

## Production KPI Results

| Surface                | KPI        | Readiness               | Coverage | First paint p95 | Settle p95 | Extra list calls/open | Missing preview ratio |
| ---------------------- | ---------- | ----------------------- | -------- | --------------: | ---------: | --------------------: | --------------------: |
| `ai-studio-panel`      | `4.9 / 10` | `insufficient evidence` | `35%`    |         `574ms` |    `989ms` |                     `1` |                     `0` |
| `elements-media-panel` | `4.9 / 10` | `insufficient evidence` | `35%`    |         `565ms` |    `972ms` |                     `1` |                     `0` |

Fresh capture commands:

- `node frontend/scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown`
- `node frontend/scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown`

## Comparison Against May 21

What improved:

- `elements-media-panel` missing-preview ratio improved from `0.2647` to `0`
- both approved-panel surfaces got materially faster on first paint and settle
- `resolveCallsPerOpen` stayed at `0`
- console errors stayed at `0`

What regressed or stayed weak:

- `extraListCallsPerOpen` moved from `0` to `1` on both surfaces
- coverage dropped from `51%` to `35%`
- many deeper metrics are now not measured in the fresh packet
- readiness fell from `fragile` to `insufficient evidence`

## Interpretation

This is not a score-lift packet.

The May 30 patch looks real and useful:

- the live Elements missing-preview symptom did not reproduce in the May 31 production rerun

But the broader lane is still not healthy enough to rerate because:

- the shared approved-panel runtime still makes one extra list request during open-phase settlement
- the source seam is shared across AI Studio and Elements, so the remaining risk is not just an Elements-local symptom anymore
- the measurement packet now has weaker evidence depth than the May 21 Holomony packet

## Score Posture

- `Elements workflow`
  - keep `5/10`
  - reason:
    - the visible missing-preview symptom no longer reproduced, which is real progress
    - the broader workflow still stays below floor because the shared open-phase list-orchestration seam remains and the packet is evidence-thin
- `Media delivery / signing / preview resolution`
  - keep `6/10`
  - reason:
    - the row stays at floor
    - the remaining risk belongs to a shared runtime seam that still needs a cleaner source fix before maturity can be claimed
- `Create workflow`
  - keep `6/10`
  - reason:
    - the latest launch-relevant repo movement touched Create pricing/runtime support seams
    - nothing in the May 31 production remeasurement reopened Create as the exact next lane

## Queue Decision

The exact next lane remains:

1. `Elements workflow`
2. `Project / workspace persistence`
3. `Characters workflow`

Why:

- the accepted May 30 runtime patch reduced one real symptom
- the remaining highest-ROI risk is still inside the broader approved-panel lane
- the next correct step is a source-oriented root fix on shared list orchestration, not a broad workflow rewrite and not a score lift

## Exact Next Root-Fix Lane

New dispatch-ready handoff:

- `docs/agents/copperknot/handoffs/2026-05-31-approved-panel-list-orchestration-root-fix.md`

Root seam:

- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`

Constraint:

- no UI changes
- no UX changes
- no intended behavior changes

## Control-Surface Corrections Made

- refreshed the queue to point at the new May 31 root-fix handoff
- refreshed the dispatch log to record the May 31 production remeasurement outcome
- refreshed the scoreboard, operator brief, checklist, and measurement logs
- kept the score holds explicit instead of quietly letting the accepted patch imply more than the production evidence supports

## Recommended Next Step

Copperknot should stop at `dispatch-ready`:

- exact next lane:
  - `Elements workflow`
- exact handoff:
  - `docs/agents/copperknot/handoffs/2026-05-31-approved-panel-list-orchestration-root-fix.md`
- why:
  - the real remaining source seam is now clear enough to package tightly
- required user checkpoint:
  - explicit approval before any execution dispatch
