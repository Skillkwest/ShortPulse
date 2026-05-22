# Ship-Readiness Scoreboard

Purpose: provide a fast release-control view derived from `docs/systems/catalog.md` so ShortPulse can be steered toward ship readiness without rereading the full catalog table.

## Snapshot

- Snapshot date: `2026-05-19`
- Snapshot freshness as of `2026-05-19`: `current`
- Freshness reason:
  - launch-state fields were refreshed against a full repo-plus-worktree audit on `production`
  - the May 16 rerating package was preserved as historical evidence, not overwritten
  - a focused May 19 validation pass was run from `frontend/` using the bundled Node runtime to avoid stale shell-path assumptions
- Primary sources:
  - `docs/systems/catalog.md`
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-19-production-baseline-refresh.md`

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

| Signal                                             | Current value |
| -------------------------------------------------- | ------------- |
| `P0` systems below floor                           | `3`           |
| Active ship-path blockers                          | `0`           |
| Active local regression reviews                    | `0`           |
| External lanes still running                       | `0`           |
| Reviewed-complete lanes awaiting broader rerate    | `1`           |
| Undispatched below-floor lanes with handoffs ready | `2`           |
| Non-blocking production findings tracked           | `3`           |
| Score changes made in this refresh                 | `0`           |

Catalog-tool health metrics:

- `docs/agents/copperknot/catalog-tool-health-metrics.md`

## Active Ship-Path Blocker

- none

## Current Worktree Review Note

The May 19 refresh first surfaced one Create-side attachment seam, but the current worktree now carries the fix and the focused rerun is green:

- `Create workflow`
  - the attachment staging/refresh hardening landed during the May 19 audit
  - focused Create + persistence validation reran cleanly at `193/193`
  - the row stays at `6/10`, but confidence moved up and the seam is no longer the exact next lane

This is not a reopened blocker. It is now a score-held row with better trust, not an active local regression review.

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
- score held after May 19 validation:
  - `Create workflow`
- ready next:
  - `characters-workflow-hardening`
- second open workflow lane:
  - `elements-workflow-hardening`

## Non-Blocking Production Findings

- `Media delivery / signing / preview resolution`
  - a stale signed-thumb path reached production clients in historical implementation
  - the May 19 repo refresh hardened delivery/list/signing behavior and focused API tests passed, so the row stays at floor but remains worth watching
- `Media Library workflow`
  - Uploaded Images no-match search empty-state copy currently misreads a search miss as if no uploads exist
  - this is a real production UX defect, but not a blocker
- `Characters workflow`
  - Beeper captured a real edit -> reload continuity auth bounce on the deprecated `/character` alias
  - this is a production trust break, but it remains below the current ship-critical set

## How To Use This

- Use `docs/systems/catalog.md` for system definitions, boundaries, and full evidence context.
- Use this scoreboard when the question is release control:
  - what is below floor
  - what is actively blocking ship
  - what lane should move next
- Use `Priority band` for urgency class and the dated handoff queue for exact order.
- Do not rerate from this file alone. The catalog remains the canonical rating surface.
