# Superseded: Prioritized System-By-System Handoff Queue

This queue is historical only.

Use the active queue instead:

- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Do not use this file for current launch-control sequencing.

Purpose: define the ordered execution queue the Copperknot should hand to specialist agents during the current production-readiness window.

## Queue Rules

- Higher rows should be worked before lower rows unless fresh evidence changes the order.
- Queue position is based on ship impact, not on how easy the work looks.
- A row can move down only when the current blocker above it is genuinely reduced.
- After a meaningful audit, the Copperknot should turn the top actionable rows into a dispatch-ready ordered worklist with paste-ready prompts.

## Queue

| Priority | System | Current | Ship floor | Lane | Recommended agent profile | Current handoff |
| --- | --- | ---: | ---: | --- | --- | --- |
| 1 | `Generation recovery / settlement` | 4 | 7 | Shared runtime hardening | runtime reliability + billing invariants | `docs/systems/next-agent-handoff-generation-recovery-hardening.md` |
| 2 | `Reference Grid` | 6 | 7 | AI Studio workflow stability | AI Studio runtime + reference surfaces | `docs/agents/copperknot/handoffs/2026-05-06-reference-grid-styles-drop-blocker.md` |
| 3 | `Edit workflow` | 5 | 7 | AI Studio workflow stability | AI Studio workflow modularization | `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md` |
| 4 | `Project / workspace persistence` | 6 | 7 | AI Studio workflow stability | persistence contracts + restore boundaries | `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md` |
| 5 | `Billing / credits` | 6 | 7 | Shared runtime hardening | billing runtime + reconciliation | `queue-only` |
| 6 | `Security boundaries` | 6 | 7 | Platform trust and release safety | security boundary + route/RLS audit | `queue-only` |
| 7 | `Characters workflow` | 5 | 6 | Secondary workflow confidence | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md` |
| 8 | `Elements workflow` | 5 | 6 | Secondary workflow confidence | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-elements-workflow.md` |
| 9 | `Generation submission / polling` | 6 | 7 | Shared runtime hardening | provider submit/status contracts | `queue-only` |
| 10 | `Media ingest / save` | 6 | 7 | Platform trust and release safety | media persistence + upload authority | `queue-only` |
| 11 | `Core data persistence` | 6 | 7 | Platform trust and release safety | schema/persistence contract audit | `queue-only` |
| 12 | `Storage / file delivery` | 6 | 7 | Platform trust and release safety | storage scope + signed delivery | `queue-only` |
| 13 | `Create workflow` | 6 | 7 | AI Studio workflow stability | create-mode runtime steward | `queue-only` |
| 14 | `Provider integrations` | 6 | 7 | Shared runtime hardening | provider contract normalization | `queue-only` |
| 15 | `Media Library workflow` | 6 | 6 | Secondary workflow confidence | media UX and workflow semantics | `queue-only` |
| 16 | `Media delivery / signing / preview resolution` | 6 | 6 | Platform trust and release safety | preview delivery performance | `queue-only` |
| 17 | `Media derivatives / variants` | 6 | 6 | Platform trust and release safety | derivative worker reliability | `queue-only` |
| 18 | `Video workflow` | 6 | 6 | Secondary workflow confidence | video generation workflow validation | `queue-only` |
| 19 | `Sound workflow` | 6 | 6 | Secondary workflow confidence | sound workflow validation | `queue-only` |
| 20 | `Observability / incident triage` | 6 | 6 | Platform trust and release safety | telemetry and operator visibility | `queue-only` |
| 21 | `Admin operations` | 6 | 6 | Platform trust and release safety | admin support surface integrity | `queue-only` |
| 22 | `Pricing / entitlements` | 7 | 7 | Platform trust and release safety | control-plane validation | `queue-only` |
| 23 | `Auth / identity` | 7 | 7 | Platform trust and release safety | auth boundary validation | `queue-only` |

## Queue Interpretation

- Priorities `1..6` are the current ship-critical execution set.
- Priorities `7..12` are the next ship-relevant confidence and boundary set.
- Priorities `13..23` should generally be validated and selectively hardened, not expanded by momentum alone.
- If a top-priority row is still `queue-only`, that missing handoff should usually be treated as the next Copperknot output gap to close.

## Immediate Handoff Set

The Copperknot should treat these as the current active handoff packet set:

1. `Generation recovery / settlement`
2. `Reference Grid`
3. `Edit workflow`
4. `Project / workspace persistence`
5. `Characters workflow`
6. `Elements workflow`

## Current Dispatch Snapshot

As of `2026-05-15`:

- reviewed complete, score unchanged pending broader runtime rerate:
  - `Generation recovery / settlement`
- dispatched and still awaiting closeout:
  - `Reference Grid`
- ready next:
  - `Edit workflow`
- ready held:
  - `Project / workspace persistence`

## Fresh Production Follow-Up Signals

- production-only follow-up findings that did not change the exact queue order:
  - `Media Library workflow`: Uploaded Images no-match search empty-state copy is misleading
  - `Media delivery / signing / preview resolution`: recoverable stale signed-thumb path reached production clients
- local-only contradiction retained as follow-up evidence, not promoted to production queue truth:
  - dashboard `New Project` dead-end reported by Bopper
