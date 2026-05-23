# Beeper Run Packets

Purpose: store per-run scratch packets for supervised Beeper training and live testing.

## Layout

Each substantive run may create a timestamped folder here containing:

- `notes.md`: chronological scratch log of what Beeper did during the run
- `evidence-manifest.md`: tracked redacted summary of what raw evidence existed and what product signal it preserved
- optional temporary helper outputs that support the retained report

## Rules

- This folder is scratch support, not canonical truth.
- Durable conclusions belong in `docs/records/artifacts/agent/beeper/reports/`.
- Raw screenshots, JSON packets, storage-state dumps, and other sensitive artifacts should live in the ignored local cache at `beeper/evidence-cache/`, not inside tracked run packets.
- Historical raw `evidence/` folders were retired from tracked workspace storage on `2026-05-23`; use `beeper/evidence-manifests/2026-05-23-redacted-run-evidence-index.md` when an older report references them.
- Every substantive supervised run should have both:
  - a packet here when notes and a redacted evidence manifest matter, and
  - a retained report in the artifact area.
