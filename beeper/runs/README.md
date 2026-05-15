# Beeper Run Packets

Purpose: store per-run scratch packets for supervised Beeper training and live testing.

## Layout

Each substantive run may create a timestamped folder here containing:

- `notes.md`: chronological scratch log of what Beeper did during the run
- `evidence/`: screenshots, JSON packets, and other raw artifacts
- optional temporary helper outputs that support the retained report

## Rules

- This folder is scratch support, not canonical truth.
- Durable conclusions belong in `docs/records/artifacts/agent/beeper/reports/`.
- Every substantive supervised run should have both:
  - a packet here when raw evidence matters, and
  - a retained report in the artifact area.
