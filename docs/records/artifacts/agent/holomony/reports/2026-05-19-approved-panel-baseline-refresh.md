# Approved Panel Baseline Refresh

Date: 2026-05-19
Environment: `production`
Surfaces:

- `ai-studio-panel`
- `elements-media-panel`

## Purpose

Refresh the approved-surface source of truth after the KPI honesty and telemetry-attribution fixes.

This run was meant to answer one question cleanly:

- what is the current real state of the approved media panels on the corrected toolchain?

## Method

Ran:

- `node ./scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown --write-packet ../docs/records/artifacts/agent/holomony/reports/2026-05-19-ai-studio-panel-baseline.packet.json`
- `PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL=https://www.shortpulse.ai PLAYWRIGHT_MEDIA_PANEL_SURFACE=ai-studio-panel node ./tests/e2e/media-panel-persistence.audit.js`
- `node ./scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown --write-packet ../docs/records/artifacts/agent/holomony/reports/2026-05-19-elements-media-panel-baseline.packet.json`
- `PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL=https://www.shortpulse.ai PLAYWRIGHT_MEDIA_PANEL_SURFACE=elements-media-panel node ./tests/e2e/media-panel-persistence.audit.js --surface elements-media-panel`

The KPI runs used:

- repeated production browser captures: `sampleCount: 5`
- root-tab scope: `All Media`
- corrected capture validity gates
- corrected Elements surface attribution

## Result

| Surface                | KPI             | Readiness | Coverage | First paint p95 | Settle p95 | Sign batch p95 | Missing preview ratio | Persistence |
| ---------------------- | --------------- | --------- | -------- | --------------: | ---------: | -------------: | --------------------: | ----------- |
| `ai-studio-panel`      | `6.04 / 10 (C)` | `fragile` | `51%`    |        `2345ms` |   `2753ms` |       `1084ms` |                 `0.4` | passed      |
| `elements-media-panel` | `6.38 / 10 (C)` | `fragile` | `51%`    |        `2165ms` |   `2575ms` |       `1078ms` |              `0.3429` | passed      |

Persistence detail for both surfaces:

- `saveRoundtripFailureRate: 0`
- `saveRoundtripMismatchRate: 0`
- `saveBrowseReadyRatio: 1`

Shared runtime positives:

- `resolveCallsPerOpen: 0`
- `extraListCallsPerOpen: 0`
- `stateFlipCountPerOpen: 1`
- `signFailedRatio: 0`
- `canonicalPreviewCoverageRatio: 1`

## Decision

The corrected measurement tools are valid enough to use, and the fresh retained evidence is now current.

The old `done enough for now` classification is no longer the right current read for the approved panels.

Why:

- persistence trust is now strong on both approved surfaces
- but mixed-open browse is still too slow
- the remaining active blocker is not resolver churn or extra list churn
- the remaining active blocker is open-phase signing cost and the first useful media paint that follows it

## Current Read

What is now proved:

- AI Studio and Elements both have honest fresh KPI packets on the corrected toolchain
- AI Studio and Elements both have direct same-day production persistence proof
- the tool-validity lane can stop for now

What is still weak:

- both approved panels are still only `C / fragile`
- both panels still show `~2.2s - 2.3s` first paint p95
- both panels still show `~2.6s - 2.8s` settle p95
- both panels still show `~1.08s` sign batch p95
- both panels still show visible missing-preview pressure on the mixed default open

## Best Next Step

Stay on the approved panels and treat this as a real product-performance lane again.

Highest-ROI next lane:

1. audit the mixed `All Media` open signing path
2. reduce first useful media paint and sign batch cost without reopening resolver/list churn work
3. preserve the now-proved persistence behavior while tuning

Do not treat Character expansion as the next default move while the approved panels still have a measured blocker this clear.
