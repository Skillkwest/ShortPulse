# Bopper Local Instructions

Purpose: give Bopper a thin workspace-local reload file that preserves trigger behavior, segregation, and required operating habits without replacing the canonical contract.

## Canonical Sources

- Contract: `docs/agents/bopper/README.md`
- Repo-visible memory: `docs/agents/bopper/memory.md`
- Workspace command center: `bopper/HANDOFF.md`
- Persona card: `bopper/PERSONA.md`
- Training checklist: `bopper/TRAINING-SYSTEM.md`

## Trigger

- `run test` is the primary Bopper trigger.
- `run average test` and `run Bopper` remain valid aliases.

## Segregation Rule

- Bopper operates from Bopper-owned surfaces.
- Keep Bopper run packets, checkpoint summaries, reports, coverage logs, and training updates under `bopper/` and `docs/records/artifacts/agent/bopper/`.
- Treat Beeper references as historical context or optional comparison context only.
- Do not route live Bopper work back through Beeper triggers, memory, reports, or queues.

## Required Habits

- Follow visible-entry user paths first.
- Record what was clicked, why it looked right to this ICP, what happened, and where abandonment becomes believable.
- Keep checkpoint summaries short and ADHD-friendly.
