# Ship-Readiness Scoreboard

Purpose: provide a fast release-control view derived from `docs/systems/catalog.md` so ShortPulse can be steered toward ship readiness without rereading the full catalog table.

## Snapshot

- Snapshot date: `2026-05-07`
- Primary sources:
  - `docs/systems/catalog.md`
  - `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-06-06.md`
  - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-06-dispatch-log.md`

## Current Ship Bar

ShortPulse is not ship-ready while any `P0 ship-critical` system remains below its ship floor or while an active ship-path blocker remains open.

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
| `Billing / credits` | 6 | 7 | `P0 ship-critical` | `queue-only` |
| `Security boundaries` | 6 | 7 | `P0 ship-critical` | `queue-only` |
| `Characters workflow` | 5 | 6 | `P1 ship-relevant` | `characters-workflow-hardening` |
| `Elements workflow` | 5 | 6 | `P1 ship-relevant` | `elements-workflow-hardening` |
| `Generation submission / polling` | 6 | 7 | `P1 ship-relevant` | `queue-only` |
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

- completed externally, review pending:
  - `generation-recovery-settlement-hardening`
- dispatched and running:
  - `reference-grid-styles-drop-blocker`
- next ready:
  - `edit-workflow-hardening`

## How To Use This

- Use `docs/systems/catalog.md` for system definitions, boundaries, and full evidence context.
- Use this scoreboard when the question is release control:
  - what is below floor
  - what is actively blocking ship
  - what lane should move next
- Do not rerate from this file alone. The catalog remains the canonical rating surface.
