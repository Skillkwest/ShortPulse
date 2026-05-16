# Holomony Tool Inventory

Purpose: list the current retained tools Holomony uses for media optimization and performance work.

## Current Tools

- `docs/agents/holomony/AGENTS.md`
  - Holomony-scoped execution overlay for surface scope, scoring, and stop rules
- `frontend/scripts/media_panel_kpi_score.mjs`
  - scores media panel KPI packets
- `frontend/scripts/media_panel_kpi_capture.mjs`
  - captures a live AI Studio or Elements embedded media panel run and derives a KPI packet
- `frontend/tests/e2e/media-library-runtime.audit.js`
  - retained browser audit for panel/modal runtime checks
- `frontend/scripts/media_library_checkpoint_runner.mjs`
  - retained media checkpoint bundle
- `frontend/lib/mediaPerfTelemetry.ts`
  - live media performance telemetry buffer and debug handle
- `docs/records/artifacts/agent/holomony/performance-scorecard.md`
  - scores Holomony's own substantive runs
- `docs/records/artifacts/agent/holomony/performance-ledger.md`
  - tracks Holomony performance over time
- `docs/records/artifacts/agent/holomony/failure-taxonomy.md`
  - records repeated Holomony drift and failure modes
- `docs/records/artifacts/agent/holomony/experiment-ledger.md`
  - tracks which optimization or tooling experiments should be reused or avoided
- `docs/records/artifacts/agent/holomony/baseline-kpi.md`
  - frozen or provisional baseline for Holomony's own performance snapshot
- `docs/records/artifacts/agent/holomony/media-surface-inventory.md`
  - cross-surface control sheet for approved and candidate Holomony surfaces
- `docs/records/artifacts/agent/holomony/surface-onboarding-checklist.md`
  - minimum gate checklist before a new media-heavy surface becomes first-class

## Current Gaps

- no regression-comparison mode yet for KPI runs
- no first-class Reference Grid KPI capture path yet
- repeated retained baseline packets are still thin across approved surfaces
- some panel metrics still depend on what the live session exposes
