# Approved Panel Runtime Check

Date: 2026-05-21
Environment: `production`
Surfaces:

- `ai-studio-panel`
- `elements-media-panel`

## Purpose

Run Holomony on the approved panel surfaces and answer one current-state question:

- are the approved media panels materially healthier today, or is the same mixed-open blocker still active?

## Method

Ran fresh repeated production KPI captures:

- `cd frontend && node scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown --write-packet ../docs/records/artifacts/agent/holomony/reports/current/2026-05-21-ai-studio-panel-baseline.packet.json`
- `cd frontend && node scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown --write-packet ../docs/records/artifacts/agent/holomony/reports/current/2026-05-21-elements-media-panel-baseline.packet.json`

This run did not rerun persistence because the current question was runtime hot-path health, not save/reopen trust.

## Result

| Surface                | KPI         | Readiness | Coverage | First paint p95 | Settle p95 | Sign batch p95 | Missing preview ratio |
| ---------------------- | ----------- | --------- | -------- | --------------: | ---------: | -------------: | --------------------: |
| `ai-studio-panel`      | `6 / 10`    | `fragile` | `51%`    |        `1621ms` |   `2030ms` |       `1181ms` |                     `0` |
| `elements-media-panel` | `6 / 10`    | `fragile` | `51%`    |        `1843ms` |   `2250ms` |       `1121ms` |                `0.2647` |

Shared runtime positives:

- `resolveCallsPerOpen: 0`
- `extraListCallsPerOpen: 0`
- `signFailedRatio: 0`
- `consoleErrorsPerOpen: 0`
- `canonicalPreviewCoverageRatio: 1`
- both repeated packets passed the current capture-validity gate

Shared hotspot shape:

- mixed `All Media` open remains audio-heavy:
  - average row mix: `image=6`, `video=2`, `audio=12`
  - representative first rows are still all `audio / ai_studio`
- both surfaces still spend roughly `1.1s - 1.18s` on open-phase signing for `uploaded_images`
- both surfaces remain capped at `6 / 10` because evidence depth is still only `51%`

## Interpretation

This was a real runtime check, not KPI theater.

What improved relative to the 2026-05-19 paired baseline:

- AI Studio first paint and settle improved materially
- Elements first paint and settle also improved
- missing preview pressure improved from the older baseline

What did **not** improve enough:

- sign-batch cost is still too high on both surfaces
- the mixed default open is still shaped around an audio-heavy first row set
- Elements still has a visible missing-preview gap on a meaningful portion of rendered cards

## Current Read

The approved-panel blocker is still active.

It is narrower now:

- not resolver churn
- not extra list churn
- not sign failure
- not browse/save persistence trust

It is still mainly:

- open-phase signing cost
- plus mixed-open row composition pressure
- plus an Elements-specific visible-preview gap that still shows up in the settled card set

## Best Next Step

Stay on the approved shared panel lane.

Highest-ROI next move:

1. inspect `useMediaPreviewSigningController` and the open-phase visible-card signing path for both approved surfaces
2. determine why an audio-heavy first row still drives a `~1.1s` sign p95 even after prior tuning
3. separately inspect why Elements still settles with `missingPreviewRatio: 0.2647` while AI Studio is at `0`

Do not reopen measurement-tooling work first. The current packets are valid enough to point at a real runtime hotspot.
