# System Catalog Agent Operating Package

Purpose: provide one entrypoint for the System Catalog Agent's current operating system for the production-readiness window that runs from `2026-05-06` through `2026-07-02`.

## Core Doctrine

Optimize for the ship bar, not for prettier numbers.

The catalog is a decision tool. It is not the mission.

## Package Contents

- Contract: `docs/agents/system-catalog-agent/README.md`
- Memory: `docs/agents/system-catalog-agent/memory.md`
- SOP: `docs/agents/system-catalog-agent/standard-operating-procedure.md`
- Production plan: `docs/agents/system-catalog-agent/production-readiness-plan-2026-07-02.md`
- Handoff queue: `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-07-02.md`
- Score criteria: `docs/agents/system-catalog-agent/system-score-criteria.md`
- Tool health metrics: `docs/agents/system-catalog-agent/catalog-tool-health-metrics.md`
- Measurement and learning: `docs/agents/system-catalog-agent/measurement-and-learning.md`
- Dispatch-ready audit output template: `docs/agents/system-catalog-agent/dispatch-ready-audit-output-template.md`
- ADHD-friendly operator brief template: `docs/agents/system-catalog-agent/operator-brief-template.md`
- Handoff template: `docs/agents/system-catalog-agent/handoff-template.md`
- Detailed handoffs: `docs/agents/system-catalog-agent/handoffs/README.md`
- Dispatch log: `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-06-dispatch-log.md`
- Latest repo-wide audit and dispatch output: `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-16-production-repo-audit-and-dispatch-output.md`
- External lane closeouts: `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`

## Authority Rule

For execution order, the authoritative source is:

- `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-07-02.md`

If another package document summarizes priorities more loosely, the queue wins.

If the ship bar evidence no longer supports the current `2026-07-02` target, recommend a date reassessment explicitly instead of stretching weak launch claims to fit the date.

## Current Ship Bar

ShortPulse is not considered production-ready until all of the following are true:

1. No active production-critical hot-path system remains below its ship floor.
2. No active known P0 blocker remains unresolved or un-waived with fresh evidence.
3. No ship-blocking system remains below `Confidence = 4`.
4. Release, deployment-parity, docs, and security gates pass on the intended release path.

## Active P0 Production Blocker

- `KI-AI-RG-STYLES-001`: Reference Grid -> Styles drop reliability remains broken in `docs/known-issues.md`

This must be resolved or explicitly re-waived with fresh evidence before final ship signoff.

## Operating Rhythm

- Use the production plan to decide what matters this week.
- Use the handoff queue to decide what to hand to execution agents next.
- Use the score-criteria doc to decide whether score changes are justified.
- Update the catalog only when repo evidence supports the change.
- Keep the dispatch log current so the package reflects what has already been handed to other agents.
- After meaningful audits, produce a dispatch-ready ordered worklist with paste-ready prompts for the next external agents.
- After meaningful runs, produce one ADHD-friendly operator brief so the next user action is obvious at a glance.

## Current Lane Snapshot

As of `2026-05-16`:

- `Generation recovery / settlement` is treated as execution-complete and reviewed, but its score remains unchanged pending a broader generation-runtime rerate.
- `Reference Grid`, `Edit workflow`, `Billing / credits`, and `Generation submission / polling` all now have closeouts on file and are awaiting Catalog Agent review before any rerate or follow-up split.
- `Security boundaries` is now the only actively running ship-critical external lane still awaiting a closeout.
- `Project / workspace persistence` remains ready but held because recent repo hardening landed while stronger direct production proof is still missing.
- `Characters workflow` now carries fresh production trust-break evidence, but it remains below the active ship-critical set.
