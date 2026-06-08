# Ship-Readiness Scoreboard

Status: stale secondary overlay. Do not use this file for exact July 7, 2026 launch sequencing or readiness claims.

Purpose: provide a fast secondary release-control overlay derived from `docs/systems/catalog.md` and the current Copperknot authority chain so ShortPulse can be steered toward ship readiness without rereading the full catalog table.

## Snapshot

- Snapshot date: `2026-05-31`
- Snapshot freshness as of `2026-06-05`: `stale`
- Freshness reason:
  - launch-state fields were refreshed against a post-deploy production verification on `production`
  - the accepted May 31 root fix was compared against live route parity plus fresh approved-panel reruns
  - the queue and measurement surfaces were updated together so the current launch packet and retained metrics match
- Original snapshot sources are stale. Use the Freshness Rule below for current launch-control truth.

## Freshness Rule

Treat this scoreboard as a quick overlay, not the primary authority.

For exact launch-control truth, defer first to:

- `docs/systems/catalog.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-system-map.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

This overlay is reliable only when:

- the snapshot is inside the 7-day freshness window
- and no blocker, lane, or external completion event has landed since the snapshot

When stale:

- use this file as a baseline only
- refresh the catalog, queue, and scoreboard together before making exact sequencing decisions
- prefer the July 7 launch board over this overlay when they disagree

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

## Current Evidence Note

Fresh May 31 persistence production verification says:

- the accepted persistence patch is real local repo progress
- the first live production rerun still failed on the orphan restore class
- the canonicalized project workspace read still exposed the orphan generated output

This is now a direct production contradiction, not just a missing proof packet.

## Below-Floor Systems

| System                             | Current | Ship floor | Priority band      | Active lane                                |
| ---------------------------------- | ------: | ---------: | ------------------ | ------------------------------------------ |
| `Generation recovery / settlement` |       4 |          7 | `P0 ship-critical` | `generation-recovery-settlement-hardening` |
| `Edit workflow`                    |       6 |          7 | `P0 ship-critical` | `edit-workflow-hardening`                  |
| `Project / workspace persistence`  |       6 |          7 | `P0 ship-critical` | `project-workspace-persistence-hardening`  |
| `Characters workflow`              |       5 |          6 | `P1 ship-relevant` | `characters-workflow-hardening`            |
| `Elements workflow`                |       5 |          6 | `P1 ship-relevant` | `queue-only`                               |
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
  - `edit-workflow-hardening`
- score held after accepted local root-fix review:
  - `project-workspace-persistence-hardening`
- production verification failed after accepted local root-fix review:
  - `project-workspace-persistence-hardening`
- score held after May 30 post-redeploy review:
  - `Create workflow`
- score held after May 31 post-deploy production verification:
  - `Elements workflow`
  - `Media delivery / signing / preview resolution`
- exact next:
  - `project-workspace-persistence-hardening`
- ready after that:
  - `characters-workflow-hardening`
- follow-up hold:
  - `Elements workflow`

The accepted Elements runtime patch is real production evidence, but the persistence lane now has a direct production failure packet. The old approved-panel hotspot is no longer the strongest open lane, and the next exact move is persistence deployment reconciliation plus rerun.

## Non-Blocking Production Findings

- `Elements workflow`
  - the May 31 post-deploy reruns cleared the concrete approved-panel hotspot that had kept this row exact next
  - the row stays below floor, but it moves into follow-up hold because the live production symptom is no longer the strongest open lane
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
