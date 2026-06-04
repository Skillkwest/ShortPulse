# Copperknot Operating Package

Purpose: provide a compact maintenance helper for the current production-readiness window without competing with the live authority chain.

## Core Doctrine

Optimize for the ship bar, not for prettier numbers.

The catalog is a decision tool. It is not the mission.

## Primary Authority Chain

For current launch-truth decisions, use these first:

- Authority: `docs/agents/copperknot/july-7-launch-authority.md`
- System map: `docs/agents/copperknot/july-7-system-map.md`
- Board: `docs/agents/copperknot/july-7-launch-board.md`
- Queue: `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- Catalog baseline: `docs/systems/catalog.md`
- Freshest retained packet explaining the current queue call

If these surfaces already answer the question, do not widen the load by default.

## Secondary Package Contents

This package points to supporting surfaces that may be useful during maintenance, pruning, or deeper process work:

- Contract: `docs/agents/copperknot/README.md`
- Memory: `docs/agents/copperknot/memory.md`
- SOP: `docs/agents/copperknot/standard-operating-procedure.md`
- SOP reference: `docs/agents/copperknot/standard-operating-procedure-reference.md`
- July 7 authority: `docs/agents/copperknot/july-7-launch-authority.md`
- July 7 system map: `docs/agents/copperknot/july-7-system-map.md`
- July 7 launch board: `docs/agents/copperknot/july-7-launch-board.md`
- July 7 launch queue: `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- Superseded July 2 plan: `docs/agents/copperknot/production-readiness-plan-2026-07-02.md`
- Superseded July 2 queue: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
- Score criteria: `docs/agents/copperknot/system-score-criteria.md`
- Tool health metrics: `docs/agents/copperknot/catalog-tool-health-metrics.md`
- Measurement and learning: `docs/agents/copperknot/measurement-and-learning.md`
- Dispatch-ready audit output template: `docs/agents/copperknot/dispatch-ready-audit-output-template.md`
- ADHD-friendly operator brief template: `docs/agents/copperknot/operator-brief-template.md`
- Handoff template: `docs/agents/copperknot/handoff-template.md`
- Detailed handoffs: `docs/agents/copperknot/handoffs/README.md`
- External lane closeouts: `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

## Authority Rule

This package is not the first source of truth.

If another package document summarizes priorities, lane state, or launch truth more loosely than the primary authority chain, the primary authority chain wins.

If the ship bar evidence no longer supports the current `2026-07-07` target, recommend a date reassessment explicitly instead of stretching weak launch claims to fit the date.

## Current Ship Bar

ShortPulse is not considered production-ready until all of the following are true:

1. No active production-critical hot-path system remains below its ship floor.
2. No active known P0 blocker remains unresolved or un-waived with fresh evidence.
3. No ship-blocking system remains below `Confidence = 4`.
4. Release, deployment-parity, docs, and security gates pass on the intended release path.

## Active P0 Production Blocker

- none

The May 16 Reference Grid blocker was cleared and is now historical in `docs/known-issues.md`.

## Operating Rhythm

- Use the queue to decide exact next order.
- Use the queue plus the freshest retained evidence packet to decide lane state.
- Use the freshest retained packet to explain why the current queue call is correct.
- Use the catalog to decide ratings and boundaries.
- Open the deeper package surfaces only when they materially reduce ambiguity or maintenance cost.

## Maintenance Note

This file should stay compact.

Do not let it become a second live snapshot with stale queue calls, stale lane summaries, or duplicate current-truth prose. If a dated lane snapshot is needed again, retain it as a dated report instead of expanding this helper back into a competing authority surface.
