# System Catalog Agent Operating Package

Purpose: provide one entrypoint for the System Catalog Agent's current operating system for the production-readiness window that runs from `2026-05-06` through `2026-06-06`.

## Core Doctrine

Optimize for the ship bar, not for prettier numbers.

The catalog is a decision tool. It is not the mission.

## Package Contents

- Contract: `docs/agents/system-catalog-agent/README.md`
- Memory: `docs/agents/system-catalog-agent/memory.md`
- SOP: `docs/agents/system-catalog-agent/standard-operating-procedure.md`
- Production plan: `docs/agents/system-catalog-agent/production-readiness-plan-2026-06-06.md`
- Handoff queue: `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-06-06.md`
- Score criteria: `docs/agents/system-catalog-agent/system-score-criteria.md`
- Handoff template: `docs/agents/system-catalog-agent/handoff-template.md`
- Detailed handoffs: `docs/agents/system-catalog-agent/handoffs/README.md`
- Dispatch log: `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-06-dispatch-log.md`
- External lane closeouts: `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`

## Authority Rule

For execution order, the authoritative source is:

- `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-06-06.md`

If another package document summarizes priorities more loosely, the queue wins.

## Current Ship Bar

ShortPulse is not considered production-ready until all of the following are true:

1. No active production-critical hot-path system remains below its ship floor.
2. No active known P0 blocker remains unresolved or un-waived with fresh evidence.
3. No ship-blocking system remains below `Confidence = 4`.
4. Release, deployment-parity, docs, and security gates pass on the intended release path.

## Current Highest-Priority Systems

1. `generation-recovery-settlement`
2. `ai-studio-reference-grid`
3. `ai-studio-edit-workflow`
4. `ai-studio-project-workspace-persistence`
5. `billing-credits`
6. `security-boundaries`
7. `ai-studio-characters-workflow`
8. `ai-studio-elements-workflow`

## Active P0 Production Blocker

- `KI-AI-RG-STYLES-001`: Reference Grid -> Styles drop reliability remains broken in `docs/known-issues.md`

This must be resolved or explicitly re-waived with fresh evidence before final ship signoff.

## Operating Rhythm

- Use the production plan to decide what matters this week.
- Use the handoff queue to decide what to hand to execution agents next.
- Use the score-criteria doc to decide whether score changes are justified.
- Update the catalog only when repo evidence supports the change.
- Keep the dispatch log current so the package reflects what has already been handed to other agents.

## Current Lane Snapshot

As of `2026-05-15`:

- `Generation recovery / settlement` is treated as execution-complete and reviewed, but its score remains unchanged pending a broader generation-runtime rerate.
- `Reference Grid` remains the active external blocker lane and still lacks a closeout packet.
- `Edit workflow` remains the next ready handoff.
- `Project / workspace persistence` remains ready but held because the strongest new contradiction report is local-only and this prelaunch window is production-only.
