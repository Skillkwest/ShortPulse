# Holomony Agent Artifacts

Purpose: store retained, non-authoritative artifacts for Holomony's media optimization and performance workflow.

## Status

Holomony is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, and a retained artifact area for KPI runs, performance audits, optimization reports, and training history.

## Artifact Layout

- `baseline-kpi.md`: frozen or provisional baseline for Holomony's own performance.
- `performance-scorecard.md`: scoring model for substantive Holomony runs.
- `performance-ledger.md`: trend history across scored runs.
- `failure-taxonomy.md`: repeated drift and failure-pattern catalog.
- `experiment-ledger.md`: retained record of optimization experiments and outcomes.
- `capability-ladder.md`: current and future Holomony capability levels.
- `media-surface-inventory.md`: approved and candidate media-surface control sheet.
- `sops.md`: Holomony-specific SOP references and operating notes.
- `surface-onboarding-checklist.md`: minimum gate for promoting a new media-heavy surface into first-class Holomony scope.
- `tools.md`: KPI, capture, telemetry, and audit helper inventory.
- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `reports/`: full reports, KPI snapshots, and media-performance evidence summaries.
- `docs/agents/holomony/media-display-command-index.md`: compact first-load map for product media grids, media-library carriages, detail modals, and double-click handoffs.
- `docs/agents/holomony/media-display-authority-ledger.md`: current claim packet table for media-display and detail-modal authority.
- `docs/agents/holomony/right-rail-command-index.md`: compact first-load owner/test map for Reference Grid, Quick Slot Inventory, and right-rail Canvas.
- `docs/agents/holomony/reference-grid-ownership-map.md`: active Reference Grid ownership and owner-path map.
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`: active Reference Grid diagnostic workflow.

Holomony-owned helper scripts live under:

- `scripts/ops/holomony/`

## Default Read Path

For ordinary Holomony runs, use the lean startup path in `docs/agents/holomony/AGENTS.md` and `docs/agents/holomony/memory.md`:

1. Complete the root repo startup spine required by `AGENTS.md`.
2. Read `docs/agents/holomony/AGENTS.md`.
3. Read `docs/agents/holomony/memory.md`.
4. Load the lane command index: `docs/agents/holomony/media-display-command-index.md` for media-display/detail-modal lanes, or `docs/agents/holomony/right-rail-command-index.md` for right-rail lanes.
5. Load exact owner docs, code, tests, or current reports only when the command index or task needs decision-grade proof.

Do not load these by default unless the current run specifically needs scoring, KPI history, historical evidence, or self-maintenance context:

- `baseline-kpi.md`
- `capability-ladder.md`
- `experiment-ledger.md`
- `failure-taxonomy.md`
- `media-surface-inventory.md`
- `performance-scorecard.md`
- retained reports under `reports/`
- `docs/agents/holomony/ownership-manifest.md`
- `docs/agents/holomony/reference-grid-ownership-map.md`
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`
- `docs/agents/holomony/standard-operating-procedure.md`
- `surface-onboarding-checklist.md`

## Authority

These artifacts support Holomony training and traceability. They do not override canonical repo rules, product docs, current user instructions, or direct validation evidence.

Pruning rule:

- `docs/agents/holomony/memory.md` is the only active Holomony memory surface.
- `training-history.md` is the durable chronological training record.
- `performance-ledger.md` is the concise scored-run trend record.
- Do not recreate parallel memory or run-log files unless a new distinct job exists that those surfaces do not already cover.

## Canonical Entry Points

- Agent contract: `docs/agents/holomony/README.md`
- Local execution overlay: `docs/agents/holomony/AGENTS.md`
- Standing SOP: `docs/agents/holomony/standard-operating-procedure.md`
- Repo-visible memory: `docs/agents/holomony/memory.md`
- Media-display command index: `docs/agents/holomony/media-display-command-index.md`
- Media-display authority ledger: `docs/agents/holomony/media-display-authority-ledger.md`
- Right-rail command index: `docs/agents/holomony/right-rail-command-index.md`
- KPI SOP: `docs/sops/sop_media_panel_performance_kpi.md`
- Media performance operations SOP: `docs/sops/sop_media_performance_operations.md`
- Media checkpoint runner: `frontend/scripts/media_library_checkpoint_runner.mjs`
- KPI scorer: `frontend/scripts/media_panel_kpi_score.mjs`
- KPI capture helper: `frontend/scripts/media_panel_kpi_capture.mjs`
