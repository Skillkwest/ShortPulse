# Ship-Readiness Scoreboard

Purpose: provide a fast release-control view derived from `docs/systems/catalog.md` so ShortPulse can be steered toward ship readiness without rereading the full catalog table.

## Snapshot

- Snapshot date: `2026-05-30`
- Snapshot freshness as of `2026-05-30`: `current`
- Freshness reason:
  - launch-state fields were refreshed against a fresh post-redeploy repo-plus-production audit on `production`
  - the latest AI Studio/media-authority commit and the bounded Elements closeout were both reconciled into the control surface
  - a targeted May 30 validation pass plus production route parity re-established current launch truth after redeploy
- Primary sources:
  - `docs/systems/catalog.md`
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-30-production-post-redeploy-baseline-refresh.md`

## Freshness Rule

Treat this scoreboard as exact launch-control truth only when:

- the snapshot is inside the 7-day freshness window
- and no blocker, lane, or external completion event has landed since the snapshot

When stale:

- use this file as a baseline only
- refresh the catalog, queue, dispatch log, and scoreboard together before making exact sequencing decisions

## Current Ship Bar

ShortPulse is not ship-ready while any `P0 ship-critical` system remains below its ship floor or while an active ship-path blocker remains open.

For exact sequencing inside a priority band, the handoff queue remains the authority.

## Release-Control Summary

| Signal                                          | Current value |
| ----------------------------------------------- | ------------- |
| `P0` systems below floor                        | `3`           |
| Active ship-path blockers                       | `0`           |
| Active local regression reviews                 | `0`           |
| External lanes still running                    | `0`           |
| Reviewed-complete lanes awaiting broader rerate | `1`           |
| Active below-floor lanes with handoffs ready    | `2`           |
| Non-blocking production findings tracked        | `3`           |
| Score changes made in this refresh              | `0`           |

Catalog-tool health metrics:

- `docs/agents/copperknot/catalog-tool-health-metrics.md`

## Active Ship-Path Blocker

- none

## Current Worktree Review Note

The current product-code worktree is clean.

The latest launch-relevant repo movement is committed at `755fec94b`, redeployed, and validated green:

- `npm -C frontend run build`
- targeted AI Studio/media-authority validation bundle at `18 passed test files` and `385 passed / 385 total tests`
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`

This is not a reopened blocker picture. It is a stronger green-proof snapshot that still does not justify score lifts on its own.

## Below-Floor Systems

| System                             | Current | Ship floor | Priority band      | Active lane                                |
| ---------------------------------- | ------: | ---------: | ------------------ | ------------------------------------------ |
| `Generation recovery / settlement` |       4 |          7 | `P0 ship-critical` | `generation-recovery-settlement-hardening` |
| `Edit workflow`                    |       6 |          7 | `P0 ship-critical` | `edit-workflow-hardening`                  |
| `Project / workspace persistence`  |       6 |          7 | `P0 ship-critical` | `project-workspace-persistence-hardening`  |
| `Characters workflow`              |       5 |          6 | `P1 ship-relevant` | `characters-workflow-hardening`            |
| `Elements workflow`                |       5 |          6 | `P1 ship-relevant` | `elements-workflow-hardening`              |
| `Media ingest / save`              |       6 |          7 | `P1 ship-relevant` | `queue-only`                               |
| `Core data persistence`            |       6 |          7 | `P1 ship-relevant` | `queue-only`                               |
| `Storage / file delivery`          |       6 |          7 | `P1 ship-relevant` | `queue-only`                               |
| `Create workflow`                  |       6 |          7 | `P2 validation`    | `queue-only`                               |
| `Provider integrations`            |       6 |          7 | `P2 validation`    | `queue-only`                               |

## At-Floor Systems

| System                                          | Current | Ship floor | Priority band      |
| ----------------------------------------------- | ------: | ---------: | ------------------ |
| `Video workflow`                                |       6 |          6 | `P2 validation`    |
| `Sound workflow`                                |       6 |          6 | `P2 validation`    |
| `Media Library workflow`                        |       6 |          6 | `P2 validation`    |
| `Media delivery / signing / preview resolution` |       6 |          6 | `P2 validation`    |
| `Media derivatives / variants`                  |       6 |          6 | `P2 validation`    |
| `Admin operations`                              |       6 |          6 | `P2 validation`    |
| `Observability / incident triage`               |       6 |          6 | `P2 validation`    |
| `Reference Grid`                                |       7 |          7 | `P2 validation`    |
| `Pricing / entitlements`                        |       7 |          7 | `P2 validation`    |
| `Auth / identity`                               |       7 |          7 | `P2 validation`    |
| `Billing / credits`                             |       7 |          7 | `P2 validation`    |
| `Security boundaries`                           |       7 |          7 | `P1 ship-relevant` |
| `Generation submission / polling`               |       7 |          7 | `P1 ship-relevant` |

## Active Lanes

- reviewed complete, score unchanged pending broader runtime rerate:
  - `generation-recovery-settlement-hardening`
- score held after bounded review:
  - `project-workspace-persistence-hardening`
  - `edit-workflow-hardening`
- score held after May 30 post-redeploy review:
  - `Create workflow`
- score held after accepted Elements runtime closeout:
  - `Elements workflow`
- ready after that:
  - `project-workspace-persistence-hardening`
- third lane:
  - `characters-workflow-hardening`

The accepted Elements runtime patch is real repo evidence, but the next proof is production remeasurement after the patch lands on `https://www.shortpulse.ai`.

## Non-Blocking Production Findings

- `Elements workflow`
  - Holomony's `2026-05-21` approved-panel runtime check still rates the shared media-panel lane as `6/10 fragile`
  - the May 30 repo/deploy refresh did not reopen `Create workflow`, so this remains the highest-ROI open workflow lane
- `Reference Grid`
  - Holomony's `2026-05-25` production baseline still says `no clear blocker`
  - the May 30 reference-card rendering changes and targeted tests did not reopen the old blocker class
- `Security boundaries`
  - Dave's `2026-05-23` storage-state exposure report still leaves hosted session cleanup and history-purge judgment as open follow-through
  - the row stays at floor, but the finding remains retained as a real production signal

## How To Use This

- Use `docs/systems/catalog.md` for system definitions, boundaries, and full evidence context.
- Use this scoreboard when the question is release control:
  - what is below floor
  - what is actively blocking ship
  - what lane should move next
- Use `Priority band` for urgency class and the dated handoff queue for exact order.
- Do not rerate from this file alone. The catalog remains the canonical rating surface.
