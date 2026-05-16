# Prioritized System-By-System Handoff Queue

Purpose: define the ordered execution queue the Catalog Agent should hand to specialist agents during the current production-readiness window through `2026-07-02`.

## Queue Rules

- Higher rows should be worked before lower rows unless fresh evidence changes the order.
- Queue position is based on ship impact, not on how easy the work looks.
- A row can move down only when the current blocker above it is genuinely reduced.
- After a meaningful audit, the Catalog Agent should turn the top actionable rows into a dispatch-ready ordered worklist with paste-ready prompts.
- Reviewed-complete lanes should be tracked separately from undispatched next-work rows so the queue stays actionable.

## Queue

| Priority | System | Current | Ship floor | Lane | Recommended agent profile | Current handoff |
| --- | --- | ---: | ---: | --- | --- | --- |
| 1 | `Reference Grid` | 6 | 7 | AI Studio workflow stability | AI Studio runtime + reference surfaces | `docs/agents/system-catalog-agent/handoffs/2026-05-06-reference-grid-styles-drop-blocker.md` |
| 2 | `Edit workflow` | 5 | 7 | AI Studio workflow stability | AI Studio workflow modularization | `docs/agents/system-catalog-agent/handoffs/2026-05-06-edit-workflow.md` |
| 3 | `Billing / credits` | 6 | 7 | Shared runtime hardening | billing runtime + reconciliation | `docs/agents/system-catalog-agent/handoffs/2026-05-16-billing-credits-runtime-hardening.md` |
| 4 | `Security boundaries` | 6 | 7 | Platform trust and release safety | security boundary + route/RLS audit | `docs/agents/system-catalog-agent/handoffs/2026-05-16-security-boundaries-release-audit.md` |
| 5 | `Generation submission / polling` | 6 | 7 | Shared runtime hardening | provider submit/status contracts | `docs/agents/system-catalog-agent/handoffs/2026-05-16-generation-submission-polling-hardening.md` |
| 6 | `Project / workspace persistence` | 6 | 7 | AI Studio workflow stability | persistence contracts + restore boundaries | `docs/agents/system-catalog-agent/handoffs/2026-05-06-project-workspace-persistence.md` |
| 7 | `Characters workflow` | 5 | 6 | Secondary workflow confidence | workflow modularization + persistence cleanup | `docs/agents/system-catalog-agent/handoffs/2026-05-06-characters-workflow.md` |
| 8 | `Elements workflow` | 5 | 6 | Secondary workflow confidence | workflow modularization + persistence cleanup | `docs/agents/system-catalog-agent/handoffs/2026-05-06-elements-workflow.md` |
| 9 | `Media ingest / save` | 6 | 7 | Platform trust and release safety | media persistence + upload authority | `queue-only` |
| 10 | `Core data persistence` | 6 | 7 | Platform trust and release safety | schema/persistence contract audit | `queue-only` |
| 11 | `Storage / file delivery` | 6 | 7 | Platform trust and release safety | storage scope + signed delivery | `queue-only` |
| 12 | `Create workflow` | 6 | 7 | AI Studio workflow stability | create-mode runtime steward | `queue-only` |
| 13 | `Provider integrations` | 6 | 7 | Shared runtime hardening | provider contract normalization | `queue-only` |
| 14 | `Media Library workflow` | 6 | 6 | Secondary workflow confidence | media UX and workflow semantics | `queue-only` |
| 15 | `Media delivery / signing / preview resolution` | 6 | 6 | Platform trust and release safety | preview delivery performance | `queue-only` |
| 16 | `Media derivatives / variants` | 6 | 6 | Platform trust and release safety | derivative worker reliability | `queue-only` |
| 17 | `Video workflow` | 6 | 6 | Secondary workflow confidence | video generation workflow validation | `queue-only` |
| 18 | `Sound workflow` | 6 | 6 | Secondary workflow confidence | sound workflow validation | `queue-only` |
| 19 | `Observability / incident triage` | 6 | 6 | Platform trust and release safety | telemetry and operator visibility | `queue-only` |
| 20 | `Admin operations` | 6 | 6 | Platform trust and release safety | admin support surface integrity | `queue-only` |
| 21 | `Pricing / entitlements` | 7 | 7 | Platform trust and release safety | control-plane validation | `queue-only` |
| 22 | `Auth / identity` | 7 | 7 | Platform trust and release safety | auth boundary validation | `queue-only` |

## Queue Interpretation

- Priorities `1..6` are the current ship-critical execution set.
- Priorities `7..11` are the next ship-relevant confidence and boundary set.
- Priorities `12..22` should generally be validated and selectively hardened, not expanded by momentum alone.
- If a top-priority row is still `queue-only`, that missing handoff should usually be treated as the next Catalog Agent output gap to close.

## Immediate Handoff Set

The Catalog Agent should treat these as the current active handoff packet set:

1. `Reference Grid`
2. `Edit workflow`
3. `Billing / credits`
4. `Security boundaries`
5. `Generation submission / polling`
6. `Project / workspace persistence`
7. `Characters workflow`
8. `Elements workflow`

## Reviewed-Complete Follow-Up Lanes

- `Generation recovery / settlement`
  - execution-complete and reviewed on `2026-05-15`
  - keep out of the exact next-work queue unless:
    - broader generation-runtime rerating reopens it, or
    - new runtime failure evidence lands

## Current Dispatch Snapshot

As of `2026-05-16`:

- reviewed complete:
  - `Generation recovery / settlement`
- closeout received and awaiting Catalog Agent review:
  - `Reference Grid`
  - `Edit workflow`
  - `Billing / credits`
  - `Generation submission / polling`
- dispatched and still awaiting closeout:
  - `Security boundaries`
- ready held:
  - `Project / workspace persistence`
- secondary workflow follow-up signal with fresh production evidence:
  - `Characters workflow`

## Fresh Production Follow-Up Signals

- production-only follow-up findings that did not change the exact top queue order:
  - `Characters workflow`: edit -> reload continuity currently bounces through auth in production Beeper evidence
  - `Media Library workflow`: Uploaded Images no-match search empty-state copy is misleading
  - `Media delivery / signing / preview resolution`: recoverable stale signed-thumb path reached production clients
- local-only contradiction retained as follow-up evidence, not promoted to production queue truth:
  - dashboard `New Project` dead-end reported by Bopper
