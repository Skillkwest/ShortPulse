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
- Owned workspace folder: `bopper/`
- Active ICP card: `bopper/PERSONA.md`
- Training doc system: `bopper/TRAINING-SYSTEM.md`
- Retained Beeper handoff: `docs/records/artifacts/agent/bopper/handoff-from-beeper-2026-05-15.md`
- Workspace-local handoff synthesis: `bopper/HANDOFF.md`
- Local reload files: `bopper/AGENT-INSTRUCTIONS.md`, `bopper/MEMORY.md`

## Usage Notes

- Use retained artifacts for KPI, scoring, logs, directives, retest debt, and durable reports.
- Use `persona-design-lessons.md` to capture evidence-backed lessons that should improve Bopper and inform the construction of future test personas.
- Use `bopper/` for working coverage maps, checkpoint summaries, and route-level operating notes.
- Use the per-run packet under `bopper/runs/<timestamp>-<slug>/` to preserve planning, click rationale, and ICP judgments for every substantive run.
- Use `docs/records/artifacts/agent/bopper/handoff-from-beeper-2026-05-15.md` as historical origin context only, not as the day-to-day operating source.
