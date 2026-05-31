# Copperknot May 31 Approved-Panel Post-Deploy Verification

Purpose: verify whether the deployed approved-panel root fix materially changed the live production signal and decide whether `Elements workflow` should remain the exact next lane.

## Verification Target

- Branch: `production`
- Deployed commit under test: `d7e3fa775`
- Production URL:
  - `https://www.shortpulse.ai`
- Resolved deployment:
  - `https://shortpulse-f2t7m3ciu-kirk-artmans-projects.vercel.app`
- Route parity:
  - passed

Validation command:

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`

## Why This Verification Was Run

The accepted May 31 root fix removed one exact local source seam for the approved-panel extra list request. Copperknot needed live production proof before deciding whether:

- the fix actually reduced the shared approved-panel hotspot
- `Elements workflow` should stay exact next
- any score move is justified

## Production KPI Results

Confirmed live reruns:

| Surface                | KPI        | Readiness               | Coverage | First paint p95 | Settle p95 | Extra list calls/open | Missing preview ratio |
| ---------------------- | ---------- | ----------------------- | -------- | --------------: | ---------: | --------------------: | --------------------: |
| `ai-studio-panel`      | `4.9 / 10` | `insufficient evidence` | `35%`    |         `667ms` |   `1075ms` |                   `0` |                   `0` |
| `elements-media-panel` | `4.9 / 10` | `insufficient evidence` | `35%`    |        `1146ms` |   `1554ms` |                   `0` |                   `0` |

Capture commands:

- `node frontend/scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown`
- `node frontend/scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown`

## Verification Notes

- The first immediate post-deploy `elements-media-panel` rerun still showed `extraListCallsPerOpen: 0.8` with `includeLibraryTotalCount=false`.
- A confirming rerun after deployment stabilized showed:
  - `extraListCallsPerOpen: 0`
  - `includeLibraryTotalCount=true`
- Copperknot treats the confirming rerun plus successful route parity as the stronger live signal.

## Main Outcome

- The deployed root fix materially improved the live approved-panel signal.
- The old approved-panel hotspot that kept `Elements workflow` exact next is no longer the strongest open lane.
- No score lift is justified yet because the KPI packet still caps at `35%` coverage and remains `insufficient evidence`.
- `Project / workspace persistence` should now move into the exact next slot.

## Queue Decision

New exact-next order:

1. `Project / workspace persistence`
2. `Characters workflow`
3. `Elements workflow`

Why:

- the approved-panel production hotspot is no longer the clearest highest-ROI live issue
- `Project / workspace persistence` remains a `P0 ship-critical` below-floor system with no equivalent post-deploy clearance
- `Elements workflow` still stays below floor, but its concrete runtime blocker class was materially reduced in production

## Score Posture

- `Elements workflow`
  - keep `5/10`
  - reason:
    - the live runtime signal improved enough to move it out of the exact-next slot
    - the packet is still too evidence-thin to justify a score lift
- `Media delivery / signing / preview resolution`
  - keep `6/10`
  - reason:
    - the row stays at floor
    - live proof is better, but still not deep enough to claim a maturity lift
- `Project / workspace persistence`
  - keep `6/10`
  - reason:
    - it becomes exact next by queue priority, not by new score movement

## Control-Surface Consequence

- `Elements workflow` moves from exact next to a held follow-up lane.
- The May 31 root-fix handoff is now historical accepted evidence, not the next packet to dispatch again.
- Copperknot should stop at `dispatch-ready` on `Project / workspace persistence` and wait for user approval before sending a new worker.

## Recommended Next Step

Stop at the new checkpoint:

- exact next lane:
  - `Project / workspace persistence`
- handoff:
  - `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
- user checkpoint:
  - explicit approval before dispatching the next execution lane
