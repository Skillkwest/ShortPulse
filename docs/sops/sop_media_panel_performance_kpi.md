# SOP: Media Panel Performance KPI

## Purpose

Define one durable KPI system for measuring how strong the ShortPulse media panels are on the surfaces that matter right now:

- AI Studio `Libraries -> Media` panel
- Elements embedded media panel

This KPI is intended to answer the questions:

- does the panel open fast?
- does it load media fast?
- does it avoid extra churn while loading?
- does it display media correctly?
- does it preserve save/reopen correctness when save-roundtrip checks are included?

This KPI is panel-first. Later phases can expand the same packet format and scoring model to:

- Reference Grid
- Quick Slot Inventory
- detail modals
- other media-heavy rendering surfaces

The scorer is not just a score formatter. It now also emits:

- ranked root-cause diagnostics
- a likely next-fix lane
- likely owner files for that lane

Use those outputs as operational triage hints, not as a substitute for reading the code paths they point to.

## Scope

In scope:

- AI Studio media panel
- Elements embedded media panel
- open/load/render performance
- resolver/sign/fallback churn
- visible correctness and preview health
- optional save-roundtrip correctness

Out of scope:

- standalone dead `/media-library` route
- provider generation latency
- storage backfill operations themselves
- non-panel media viewers

## Source Of Truth Files

- scoring tool:
  - [frontend/scripts/media_panel_kpi_score.mjs](../../frontend/scripts/media_panel_kpi_score.mjs)
- tool tests:
  - [frontend/scripts/**tests**/media_panel_kpi_score.test.ts](../../frontend/scripts/__tests__/media_panel_kpi_score.test.ts)
- runtime telemetry:
  - [frontend/lib/mediaPerfTelemetry.ts](../../frontend/lib/mediaPerfTelemetry.ts)
- panel checkpoint bundle:
  - [frontend/scripts/media_library_checkpoint_runner.mjs](../../frontend/scripts/media_library_checkpoint_runner.mjs)
- phase0 packet bundle:
  - [frontend/scripts/media_library_phase0_bundle.mjs](../../frontend/scripts/media_library_phase0_bundle.mjs)

## Surface IDs

Use these exact surface ids in KPI packets:

- `ai-studio-panel`
- `elements-media-panel`

## KPI Categories

### 1) Speed

Measures how quickly the panel becomes useful.

Metrics:

- `firstMediaPaintP95Ms`
- `loadingStateVisibleMsP95`
- `openToFirstMediaP95Ms`
- `stableContentSettleMsP95`
- `signBatchP95Ms`

Interpretation:

- Strong: first visible media appears quickly and signing overhead stays bounded.
- Weak: users sit in loading states too long or panel paint is delayed by preview work.

### 2) Efficiency

Measures how much extra work the panel does to reach a usable state.

Metrics:

- `resolveCallsPerOpen`
- `fallbackCallsPerOpen`
- `stateFlipCountPerOpen`
- `extraListCallsPerOpen`

Interpretation:

- Strong: list authority and direct preview fields do most of the work.
- Weak: frequent resolver calls, storage fallback, or secondary list churn indicate unnecessary hot-path complexity.

### 3) Reliability

Measures whether the panel succeeds consistently.

Metrics:

- `signFailedRatio`
- `resolveFailedRatio`
- `fallbackFailedRatio`
- `consoleErrorsPerOpen`

Interpretation:

- Strong: the panel stays quiet and finishes the runtime contract without errors.
- Weak: signing failures, resolver failures, fallback failures, or console noise create hidden fragility.

### 4) Correctness

Measures whether the panel visually behaves correctly.

Metrics:

- `visualRegressionCount`
- `missingPreviewRatio`
- `canonicalPreviewCoverageRatio`
- `emptyStateMismatchCount`

Interpretation:

- Strong: cards render, previews are present, and empty-state copy matches reality.
- Weak: broken cards, missing previews, or misleading panel states break trust.

### 5) Persistence

Optional category. Use this when the audit includes uploads or save/reopen validation.

Metrics:

- `saveRoundtripFailureRate`
- `saveRoundtripMismatchRate`
- `saveBrowseReadyRatio`

Interpretation:

- Strong: saved media reappears correctly on reopen/reload.
- Weak: rows save but do not return browse-ready, or reopen state differs from what the panel showed after save.

## Packet Schema

Create a packet like this:

```json
{
  "packetVersion": 2,
  "measuredAt": "2026-05-15T00:00:00.000Z",
  "environment": "production",
  "captureMode": "manual+telemetry",
  "sampleCount": 12,
  "surface": "ai-studio-panel",
  "notes": ["Optional human notes."],
  "metrics": {
    "firstMediaPaintP95Ms": 620,
    "loadingStateVisibleMsP95": 820,
    "openToFirstMediaP95Ms": 980,
    "stableContentSettleMsP95": 1380,
    "signBatchP95Ms": 140,
    "resolveCallsPerOpen": 0.08,
    "fallbackCallsPerOpen": 0,
    "stateFlipCountPerOpen": 0.2,
    "extraListCallsPerOpen": 0.12,
    "signFailedRatio": 0,
    "resolveFailedRatio": 0,
    "fallbackFailedRatio": 0,
    "consoleErrorsPerOpen": 0,
    "visualRegressionCount": 0,
    "missingPreviewRatio": 0,
    "canonicalPreviewCoverageRatio": 1,
    "emptyStateMismatchCount": 0,
    "saveRoundtripFailureRate": 0,
    "saveRoundtripMismatchRate": 0,
    "saveBrowseReadyRatio": 1
  }
}
```

Missing metrics are allowed, but the scorer now treats low-coverage packets as weak evidence:

- coverage `< 0.75`
  - score is capped
- coverage `< 0.5`
  - packet is treated as insufficient evidence

The scorer also caps otherwise-strong runs when they still have trust-breaking failures such as visual regressions, empty-state mismatch, console-error churn, or save-roundtrip failure spikes.

## Tool Usage

Generate a packet template:

```bash
cd frontend
npm run media:kpi:score -- --template --surface ai-studio-panel
```

Score a packet:

```bash
cd frontend
npm run media:kpi:score -- --input /absolute/path/to/panel-kpi.packet.json
```

Capture and score a live AI Studio panel run directly:

```bash
cd frontend
npm run media:kpi:capture -- --base-url https://www.shortpulse.ai --format markdown
```

Capture and score a live Elements embedded panel run directly:

```bash
cd frontend
npm run media:kpi:capture -- --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown
```

Capture a live run and persist the derived packet:

```bash
cd frontend
npm run media:kpi:capture -- --base-url https://www.shortpulse.ai --write-packet /absolute/path/to/panel-kpi.packet.json
```

Change the repeated-run count explicitly when needed:

```bash
cd frontend
npm run media:kpi:capture -- --base-url https://www.shortpulse.ai --runs 5 --format markdown
```

Markdown report:

```bash
cd frontend
npm run media:kpi:score -- --input /absolute/path/to/panel-kpi.packet.json --format markdown
```

JSON report:

```bash
cd frontend
npm run media:kpi:score -- --input /absolute/path/to/panel-kpi.packet.json --format json
```

Compare two retained packets:

```bash
cd frontend
npm run media:kpi:score -- --compare /absolute/path/to/older.packet.json /absolute/path/to/newer.packet.json --format markdown
```

Read the likely next-fix lane from a scored packet:

- `preview-authority`
- `signing-cost`
- `list-orchestration`
- `panel-state-churn`
- `measurement-depth`

These lanes are inferred from the measured metrics and point at the most likely high-ROI next area to inspect.

## How To Collect Metrics

### Local telemetry path

When the debug handle is available:

```js
window.__shortpulseMediaPerf?.clear();
```

## Capture Integrity Rules

- `media:kpi:capture` now defaults to `5` repeated panel-open captures.
- Direct timing `p95` fields from the capture helper are only populated when at least `5` repeated runs were collected.
- If fewer than `5` runs are captured, the helper leaves those direct timing `p95` fields `null` instead of pretending one observation is a percentile.
- `signBatchP95Ms` may still be populated from runtime sign telemetry because that value comes from the live telemetry bucket itself, not from a single open-time observation.

Exercise one panel flow, then inspect:

```js
window.__shortpulseMediaPerf?.durationStats();
window.__shortpulseMediaPerf?.signStats();
window.__shortpulseMediaPerf?.resolveStats();
window.__shortpulseMediaPerf?.fallbackStats();
```

Map those outputs into the KPI packet:

- `firstMediaPaintP95Ms`
  - from `media.panel.first_media_paint`
- `loadingStateVisibleMsP95`
  - from retained browser timing or a panel-specific loading-state measurement packet
- `openToFirstMediaP95Ms`
  - from `media.modal.open_to_first_media` only if the same panel/modal contract is intentionally being measured
  - otherwise capture a panel-specific browser timing packet and write it manually
- `stableContentSettleMsP95`
  - from retained browser timing or panel interaction tracing
- `signBatchP95Ms`
  - from `signStats()`
- `resolveCallsPerOpen`
  - from live session traces or retained browser packets
- `fallbackCallsPerOpen`
  - from `fallbackStats()` plus open-count normalization
- `stateFlipCountPerOpen`
  - from retained browser packet review of visible loading, empty, and loaded state churn
- `signFailedRatio`
  - from `signStats()`
- `resolveFailedRatio`
  - from `resolveStats()`
- `fallbackFailedRatio`
  - from `fallbackStats()`
- `canonicalPreviewCoverageRatio`
  - from manual or browser-audit review of visible cards using canonical preview assets rather than fallback/original delivery

### Browser audit path

Use the retained AI Studio panel/modal audit when the panel debug handle is not available:

```bash
cd frontend
npm run test:e2e:media-library-runtime
```

Use the audit output plus browser/network traces to populate:

- `consoleErrorsPerOpen`
- `visualRegressionCount`
- `emptyStateMismatchCount`
- `loadingStateVisibleMsP95`
- `stableContentSettleMsP95`
- `stateFlipCountPerOpen`
- `canonicalPreviewCoverageRatio`
- `saveRoundtripFailureRate`
- `saveRoundtripMismatchRate`
- `saveBrowseReadyRatio`

### Direct capture helper path

When you want a fast, repeatable panel packet without manually assembling JSON, use:

```bash
cd frontend
npm run media:kpi:capture -- --base-url https://www.shortpulse.ai --format json
```

The helper currently supports both:

- `ai-studio-panel`
- `elements-media-panel`

It derives a scored packet from:

- authenticated panel open timing
- panel tab interaction timing
- panel `/api/media/list` request count
- live `window.__shortpulseMediaPerf` sign/resolve/fallback stats when available
- console error observations

Choose the surface explicitly when you are not auditing the default AI Studio panel:

```bash
cd frontend
npm run media:kpi:capture -- --surface elements-media-panel --base-url https://www.shortpulse.ai --format json
```

It still leaves some metrics null when the live session cannot support a trustworthy derivation. That is intentional; the scorer should mark evidence as partial rather than invent data.

### Regression / comparison path

When retained packets already exist for the same surface, use compare mode instead of eyeballing two separate score reports:

```bash
cd frontend
npm run media:kpi:score -- --compare /absolute/path/to/older.packet.json /absolute/path/to/newer.packet.json --format text
```

The comparison report provides:

- overall score delta
- coverage delta
- meaningful improvements
- meaningful regressions
- packet availability drift
- explicit comparison flags when evidence or coverage weakens

Only compare packets from the same surface id. Cross-surface comparisons are intentionally rejected.

### Network trace path

Use browser devtools or packet capture for:

- `resolveCallsPerOpen`
- `fallbackCallsPerOpen`
- `extraListCallsPerOpen`

For the AI Studio panel, `extraListCallsPerOpen` should trend toward:

- `0` when the first page exhausts the scope
- low values on partial first pages

## Current Score Interpretation

- `9.0+`
  - excellent
  - panel is fast, lean, and dependable
- `8.0 - 8.9`
  - strong
  - keep tuning only if a concrete hotspot remains
- `7.0 - 7.9`
  - usable with debt
  - real improvements still available
- `5.5 - 6.9`
  - fragile
  - users may still feel churn, delay, or trust gaps
- `< 5.5`
  - unacceptable
  - do not call the panel healthy

Coverage matters:

- `>= 0.9`
  - high confidence
- `0.75 - 0.89`
  - medium confidence
- `0.5 - 0.74`
  - low confidence; score is capped
- `< 0.5`
  - insufficient evidence; do not use as the primary sprint KPI

Critical trust failures also matter:

- visual regressions
- empty-state mismatch
- console error churn
- save-roundtrip failure spikes

These cap the score even when raw latency is strong.

Comparison matters too:

- treat `summary: improved` as trustworthy only when neither packet has insufficient evidence
- treat `summary: mixed` as a prompt to inspect the meaningful regression list before celebrating net score gains
- treat coverage drops of `>= 10` percentage points as a regression even when the raw score looks flat

## Minimum Good Packet For This Sprint

For the AI Studio media panel, a sprint-level “good” packet should include at least:

- `firstMediaPaintP95Ms`
- `loadingStateVisibleMsP95`
- `openToFirstMediaP95Ms`
- `stableContentSettleMsP95`
- `signBatchP95Ms`
- `resolveCallsPerOpen`
- `fallbackCallsPerOpen`
- `stateFlipCountPerOpen`
- `extraListCallsPerOpen`
- `signFailedRatio`
- `resolveFailedRatio`
- `fallbackFailedRatio`
- `consoleErrorsPerOpen`
- `visualRegressionCount`
- `missingPreviewRatio`
- `canonicalPreviewCoverageRatio`
- `emptyStateMismatchCount`

Persistence metrics should be added whenever the lane includes upload/save/reopen work.

## Expansion Path

Later expansions should preserve the packet model and add surface ids for:

- `reference-grid`
- `quick-slot-inventory`
- `media-detail-modal`

Do not fork a second KPI system. Extend this one.
