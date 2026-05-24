# Bopper Agent Artifacts

Purpose: store non-authoritative retained artifacts for Bopper's average-user testing, confusion audits, and abandonment walkthroughs.

## Status

Bopper is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, retained artifact area, owned workspace folder, standing SOP, historical origin context from Beeper, and a full training system.

## Artifact Layout

- `memory.md`
- `baseline-kpi.md`
- `performance-scorecard.md`
- `performance-ledger.md`
- `campaign-scorecard.md`
- `persona-design-lessons.md`
- `retest-debt.md`
- `run-log.md`
- `trainer-directives-log.md`
- `training-history.md`
- `tools.md`
- `sops.md`
- `reports/`

## Canonical Entry Points

- Agent contract: `docs/agents/bopper/README.md`
- Repo-visible memory: `docs/agents/bopper/memory.md`
- Owned workspace folder: `docs/agents/bopper/workspace/`
- Active ICP card: `docs/agents/bopper/workspace/PERSONA.md`
- Training doc system: `docs/agents/bopper/workspace/TRAINING-SYSTEM.md`
- Retained Beeper handoff: `docs/records/artifacts/agent/bopper/handoff-from-beeper-2026-05-15.md`
- Workspace-local handoff synthesis: `docs/agents/bopper/workspace/HANDOFF.md`
- Local reload files: `docs/agents/bopper/workspace/AGENT-INSTRUCTIONS.md`, `docs/agents/bopper/workspace/MEMORY.md`

## Usage Notes

- Use retained artifacts for KPI, scoring, logs, directives, retest debt, and durable reports.
- Treat retained reports and run packets as the technical/operator layer for real follow-up work.
- Use `persona-design-lessons.md` to capture evidence-backed lessons that should improve Bopper and inform the construction of future test personas.
- Use `docs/agents/bopper/workspace/` for working coverage maps, checkpoint summaries, and route-level operating notes.
- Treat `docs/agents/bopper/workspace/checkpoint-summaries/` as the lightweight human-read layer only.
- Use the per-run packet under `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/` to preserve planning, click rationale, and ICP judgments for every substantive run.
- Use `docs/records/artifacts/agent/bopper/handoff-from-beeper-2026-05-15.md` as historical origin context only, not as the day-to-day operating source.
