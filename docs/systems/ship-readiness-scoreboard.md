# Ship-Readiness Scoreboard

Purpose: provide a fast release-control view derived from `docs/systems/catalog.md` so ShortPulse can be steered toward ship readiness without rereading the full catalog table.

## Snapshot

- Snapshot date: `2026-05-16`
- Snapshot freshness as of `2026-05-16`: `current`
- Freshness reason:
  - launch-state fields were refreshed against the full repo-plus-worktree audit on `production`
  - the active target window, exact queue, and dispatch-ready handoff set were reconciled together
- Primary sources:
  - `docs/systems/catalog.md`
  - `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-07-02.md`
  - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-06-dispatch-log.md`
  - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-16-production-repo-audit-and-dispatch-output.md`

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

| Signal | Current value |
| --- | --- |
| `P0` systems below floor | `6` |
| Active ship-path blockers | `1` |
| External lanes still running | `1` |
| Reviewed-complete lanes awaiting broader rerate | `1` |
| Undispatched below-floor lanes with handoffs ready | `4` |
| Non-blocking production findings tracked | `3` |
| Score changes made in this refresh | `0` |

Catalog-tool health metrics:

- `docs/agents/system-catalog-agent/catalog-tool-health-metrics.md`

## Active Ship-Path Blocker

- `KI-AI-RG-STYLES-001`
  - System: `Reference Grid`
  - Lane: `reference-grid-styles-drop-blocker`
  - Status: active external lane

## Below-Floor Systems

| System | Current | Ship floor | Priority band | Active lane |
| --- | ---: | ---: | --- | --- |
| `Generation recovery / settlement` | 4 | 7 | `P0 ship-critical` | `generation-recovery-settlement-hardening` |
| `Edit workflow` | 5 | 7 | `P0 ship-critical` | `edit-workflow-hardening` |
| `Reference Grid` | 6 | 7 | `P0 ship-critical` | `reference-grid-styles-drop-blocker` |
| `Project / workspace persistence` | 6 | 7 | `P0 ship-critical` | `project-workspace-persistence-hardening` |
| `Billing / credits` | 6 | 7 | `P0 ship-critical` | `billing-credits-runtime-hardening` |
| `Security boundaries` | 6 | 7 | `P0 ship-critical` | `security-boundaries-release-audit` |
| `Characters workflow` | 5 | 6 | `P1 ship-relevant` | `characters-workflow-hardening` |
| `Elements workflow` | 5 | 6 | `P1 ship-relevant` | `elements-workflow-hardening` |
| `Generation submission / polling` | 6 | 7 | `P1 ship-relevant` | `generation-submission-polling-hardening` |
| `Media ingest / save` | 6 | 7 | `P1 ship-relevant` | `queue-only` |
| `Core data persistence` | 6 | 7 | `P1 ship-relevant` | `queue-only` |
| `Storage / file delivery` | 6 | 7 | `P1 ship-relevant` | `queue-only` |
| `Create workflow` | 6 | 7 | `P2 validation` | `queue-only` |
| `Provider integrations` | 6 | 7 | `P2 validation` | `queue-only` |

## At-Floor Systems

| System | Current | Ship floor | Priority band |
| --- | ---: | ---: | --- |
| `Video workflow` | 6 | 6 | `P2 validation` |
| `Sound workflow` | 6 | 6 | `P2 validation` |
| `Media Library workflow` | 6 | 6 | `P2 validation` |
| `Media delivery / signing / preview resolution` | 6 | 6 | `P2 validation` |
| `Media derivatives / variants` | 6 | 6 | `P2 validation` |
| `Admin operations` | 6 | 6 | `P2 validation` |
| `Observability / incident triage` | 6 | 6 | `P2 validation` |
| `Pricing / entitlements` | 7 | 7 | `P2 validation` |
| `Auth / identity` | 7 | 7 | `P2 validation` |

## Active Lanes

- reviewed complete, score unchanged pending broader runtime rerate:
  - `generation-recovery-settlement-hardening`
- dispatched and still awaiting closeout:
  - `reference-grid-styles-drop-blocker`
- next ready:
  - `edit-workflow-hardening`
- packaged and ready but not dispatched:
  - `billing-credits-runtime-hardening`
  - `security-boundaries-release-audit`
  - `generation-submission-polling-hardening`
- ready held:
  - `project-workspace-persistence-hardening`
- secondary workflow follow-up signal with fresh production evidence:
  - `characters-workflow-hardening`

## Non-Blocking Production Findings

- `Media delivery / signing / preview resolution`
  - a stale signed-thumb path reached production clients in `historical implementation`
  - current behavior recovered client-side, so this remains follow-up work, not a ship-path blocker
- `Media Library workflow`
  - Uploaded Images no-match search empty-state copy currently misreads a search miss as if no uploads exist
  - this is a real production UX defect, but not a blocker
- `Characters workflow`
  - Beeper captured a real edit -> reload continuity auth bounce on `/character`
  - this is a production trust break, but it remains below the current ship-critical set

## How To Use This

- Use `docs/systems/catalog.md` for system definitions, boundaries, and full evidence context.
- Use this scoreboard when the question is release control:
  - what is below floor
  - what is actively blocking ship
  - what lane should move next
- Use `Priority band` for urgency class and the dated handoff queue for exact order.
- Do not rerate from this file alone. The catalog remains the canonical rating surface.
