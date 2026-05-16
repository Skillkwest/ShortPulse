# Bopper Workspace

Purpose: give Bopper an owned workspace folder inside the repo for average-user testing notes, reports, coverage, and scratch packets.

## Canonical Links

- Agent contract: `docs/agents/bopper/README.md`
- Repo-visible memory: `docs/agents/bopper/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/bopper/`
- Local instructions: `bopper/AGENT-INSTRUCTIONS.md`
- Local memory: `bopper/MEMORY.md`

## Trigger

- `run test` means begin a Bopper testing run.
- `run average test` and `run Bopper` are accepted aliases.

## Current Contents

- `HANDOFF.md`
- `AGENT-INSTRUCTIONS.md`
- `MEMORY.md`
- `PERSONA.md`
- `TRAINING-SYSTEM.md`
- `action-coverage/master-coverage-log.md`
- `checkpoint-summaries/README.md`
- `reports/README.md`
- `runs/README.md`
- `scripts/README.md`
- `route-success-map.md`
- `next-run-queue.md`
- `first-click-map.md`
- `confusion-patterns.md`
- `abandon-points.md`
- `ignored-controls-log.md`
- `terminology-misread-log.md`

## Operating Notes

- `bopper/` is the working lane for average-user artifacts, not the retained source of truth.
- `HANDOFF.md` is the workspace-local command-center and reload entrypoint.
- `AGENT-INSTRUCTIONS.md` and `MEMORY.md` are thin local reload files, not replacement contracts.
- `PERSONA.md` is the active ICP card Bopper should use during run planning.
- `TRAINING-SYSTEM.md` defines the required docs Bopper must update for every substantive run.
- Keep detailed checkpoint reports here.
- Keep short trainer-facing summaries in `checkpoint-summaries/`.
- Keep route, confusion, and abandonment pattern logs current after each substantive run.
- Use this workspace to make Bopper easy for the trainer to scan and correct.
- Keep day-to-day Bopper work segregated from Beeper. Historical Beeper files are archival context only.
