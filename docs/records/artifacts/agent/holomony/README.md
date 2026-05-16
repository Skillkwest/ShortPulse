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

## Recommended Read Order

For a substantive Holomony run, the shortest high-signal path is:

1. `docs/agents/holomony/README.md`
2. `docs/agents/holomony/AGENTS.md`
3. `docs/agents/holomony/standard-operating-procedure.md`
4. `docs/agents/holomony/memory.md`
5. `performance-scorecard.md`
6. `media-surface-inventory.md`
7. the one or two retained reports relevant to the current surface

Ignore by default unless the current run specifically needs them:

- `baseline-kpi.md`
- `capability-ladder.md`
- `experiment-ledger.md`
- `failure-taxonomy.md`
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
- KPI SOP: `docs/sops/sop_media_panel_performance_kpi.md`
- Media performance operations SOP: `docs/sops/sop_media_performance_operations.md`
- Media checkpoint runner: `frontend/scripts/media_library_checkpoint_runner.mjs`
- KPI scorer: `frontend/scripts/media_panel_kpi_score.mjs`
- KPI capture helper: `frontend/scripts/media_panel_kpi_capture.mjs`
