# Copperknot Operating Package

Purpose: provide one entrypoint for the Copperknot's current operating system for the production-readiness window that runs from `2026-05-06` through `2026-07-02`.

## Core Doctrine

Optimize for the ship bar, not for prettier numbers.

The catalog is a decision tool. It is not the mission.

## Package Contents

- Contract: `docs/agents/copperknot/README.md`
- Memory: `docs/agents/copperknot/memory.md`
- SOP: `docs/agents/copperknot/standard-operating-procedure.md`
- Production plan: `docs/agents/copperknot/production-readiness-plan-2026-07-02.md`
- Handoff queue: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
- Score criteria: `docs/agents/copperknot/system-score-criteria.md`
- Tool health metrics: `docs/agents/copperknot/catalog-tool-health-metrics.md`
- Measurement and learning: `docs/agents/copperknot/measurement-and-learning.md`
- Dispatch-ready audit output template: `docs/agents/copperknot/dispatch-ready-audit-output-template.md`
- ADHD-friendly operator brief template: `docs/agents/copperknot/operator-brief-template.md`
- Handoff template: `docs/agents/copperknot/handoff-template.md`
- Detailed handoffs: `docs/agents/copperknot/handoffs/README.md`
- Dispatch log: `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`
- Latest repo-wide baseline refresh: `docs/records/artifacts/agent/copperknot/reports/2026-05-27-production-baseline-reset-audit.md`
- External lane closeouts: `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

## Authority Rule

For execution order, the authoritative source is:

- `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`

If another package document summarizes priorities more loosely, the queue wins.

If the ship bar evidence no longer supports the current `2026-07-02` target, recommend a date reassessment explicitly instead of stretching weak launch claims to fit the date.

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

- Use the production plan to decide what matters this week.
- Use the handoff queue to decide what to hand to execution agents next.
- Use the score-criteria doc to decide whether score changes are justified.
- Update the catalog only when repo evidence supports the change.
- Keep the dispatch log current so the package reflects what has already been handed to other agents.
- After meaningful audits, produce a dispatch-ready ordered worklist with paste-ready prompts for the next external agents.
- After meaningful runs, produce one ADHD-friendly operator brief so the next user action is obvious at a glance.

## Current Lane Snapshot

As of `2026-05-28`:

- the May 19 baseline refresh is now historical, not current launch-control truth
- the repo moved heavily after May 19 across:
  - AI Studio shell/runtime
  - panel/runtime polish
  - workspace restore behavior
  - media delete, motion intake, and detail authority
  - character-mode recovery and right-rail behavior
- the active worktree now also contains:
  - live motion/video recorder UI work
  - shared record-panel prefab work
  - SQL/security grant-hardening work
- the current validation posture for the last exact-next Create lane is now improved:
  - `node scripts/check_secret_exposure.js` passed
  - `npm -C frontend run build` passed
  - the focused Create/runtime rerun is now green at `24 passed / 24 total tests`
- the Create validation-convergence lane is now reviewed complete with no score change
- `Elements workflow` is now the exact next launch-control lane because the approved media-panel runtime is still fragile on production
- `Project / workspace persistence` remains the next broad below-floor restore/save lane after Elements
- `Reference Grid` should stay closed as a blocker lane on current evidence
- `Security boundaries` stays at floor, but hosted session cleanup plus history-purge follow-through remains open outside the code path
