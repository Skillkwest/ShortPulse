# Prioritized System-By-System Handoff Queue

Purpose: define the ordered execution queue the Copperknot should hand to specialist agents during the current production-readiness window through `2026-07-02`.

## Queue Rules

- Higher rows should be worked before lower rows unless fresh evidence changes the order.
- Queue position is based on ship impact, not on how easy the work looks.
- A row can move down only when the current blocker above it is genuinely reduced.
- After a meaningful audit, the Copperknot should turn the top actionable rows into a dispatch-ready ordered worklist with paste-ready prompts.
- Reviewed-complete and score-held lanes should be tracked separately from undispatched next-work rows so the queue stays actionable.
- If the active worktree introduces launch-relevant drift or a failing targeted regression test, Copperknot should absorb that local review before blindly dispatching older queued lanes.

## Queue

| Priority | System                                          | Current | Ship floor | Lane                                | Recommended agent profile                     | Current handoff                                                                            |
| -------- | ----------------------------------------------- | ------: | ---------: | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1        | `Characters workflow`                           |       5 |          6 | Secondary workflow confidence       | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`                        |
| 2        | `Elements workflow`                             |       5 |          6 | Secondary workflow confidence       | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-elements-workflow.md`                          |
| 3        | `Project / workspace persistence`               |       6 |          7 | AI Studio workflow stability        | persistence contracts + restore boundaries    | `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`              |
| 4        | `Create workflow`                               |       6 |          7 | AI Studio create/runtime confidence | AI Studio create/runtime steward              | `queue-only`                                                                               |
| 5        | `Media ingest / save`                           |       6 |          7 | Platform trust and release safety   | media persistence + upload authority          | `queue-only`                                                                               |
| 6        | `Core data persistence`                         |       6 |          7 | Platform trust and release safety   | schema/persistence contract audit             | `queue-only`                                                                               |
| 7        | `Storage / file delivery`                       |       6 |          7 | Platform trust and release safety   | storage scope + signed delivery               | `queue-only`                                                                               |
| 8        | `Provider integrations`                         |       6 |          7 | Shared runtime hardening            | provider contract normalization               | `queue-only`                                                                               |
| 9        | `Edit workflow`                                 |       6 |          7 | AI Studio workflow stability        | AI Studio workflow modularization             | `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`                              |
| 10       | `Media delivery / signing / preview resolution` |       6 |          6 | Platform trust and release safety   | preview delivery performance                  | `queue-only`                                                                               |
| 11       | `Reference Grid`                                |       7 |          7 | AI Studio workflow stability        | reference-surface validation maintenance      | `docs/agents/copperknot/handoffs/2026-05-16-reference-grid-styles-runtime-verification.md` |
| 12       | `Security boundaries`                           |       7 |          7 | Platform trust and release safety   | security boundary validation                  | `docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md`          |
| 13       | `Generation submission / polling`               |       7 |          7 | Shared runtime hardening            | provider submit/status validation             | `docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md`    |
| 14       | `Billing / credits`                             |       7 |          7 | Shared runtime hardening            | billing-runtime validation                    | `docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md`          |
| 15       | `Media Library workflow`                        |       6 |          6 | Secondary workflow confidence       | media UX and workflow semantics               | `queue-only`                                                                               |
| 16       | `Media derivatives / variants`                  |       6 |          6 | Platform trust and release safety   | derivative worker reliability                 | `queue-only`                                                                               |
| 17       | `Video workflow`                                |       6 |          6 | Secondary workflow confidence       | video generation workflow validation          | `queue-only`                                                                               |
| 18       | `Sound workflow`                                |       6 |          6 | Secondary workflow confidence       | sound workflow validation                     | `queue-only`                                                                               |
| 19       | `Observability / incident triage`               |       6 |          6 | Platform trust and release safety   | telemetry and operator visibility             | `queue-only`                                                                               |
| 20       | `Admin operations`                              |       6 |          6 | Platform trust and release safety   | admin support surface integrity               | `queue-only`                                                                               |
| 21       | `Pricing / entitlements`                        |       7 |          7 | Platform trust and release safety   | control-plane validation                      | `queue-only`                                                                               |
| 22       | `Auth / identity`                               |       7 |          7 | Platform trust and release safety   | auth boundary validation                      | `queue-only`                                                                               |

## Queue Interpretation

- Priority `1` is the exact next-work lane from the May 19 baseline refresh because the current worktree no longer reproduces the earlier Create attachment seam and `Characters workflow` remains the strongest open below-floor workflow with direct production evidence.
- Priorities `2..4` are the remaining below-floor workflow-confidence set.
- Priorities `5..9` are the remaining below-floor workflow and shared-boundary set.
- Priorities `10..22` should generally be validated and selectively hardened, not expanded by momentum alone.
- If a top-priority row is still `queue-only`, that missing handoff should usually be treated as the next Copperknot output gap to close.

## Immediate Handoff Set

The Copperknot should treat these as the current active handoff packet set:

1. `Characters workflow`
2. `Elements workflow`

## Reviewed-Complete Follow-Up Lanes

- `Generation recovery / settlement`
  - execution-complete and reviewed on `2026-05-15`
  - keep out of the exact next-work queue unless:
    - broader generation-runtime rerating reopens it, or
    - new runtime failure evidence lands

## Current Dispatch Snapshot

As of `2026-05-19`:

- reviewed complete:
  - `Generation recovery / settlement`
- rerated to at-floor validation:
  - `Reference Grid`
  - `Billing / credits`
  - `Security boundaries`
  - `Generation submission / polling`
- score held after bounded review:
  - `Project / workspace persistence`
  - `Edit workflow`
- score held after May 19 validation:
  - `Create workflow`
- ready next:
  - `Characters workflow`
- second open workflow lane:
  - `Elements workflow`

## Fresh Production Follow-Up Signals

- production-only follow-up findings that did not change the exact top queue order:
  - `Characters workflow`: edit -> reload continuity currently bounces through auth in production Beeper evidence
  - `Media Library workflow`: Uploaded Images no-match search empty-state copy is misleading
  - `Media delivery / signing / preview resolution`: recoverable stale signed-thumb path reached production clients, then the May 19 repo hardening refreshed that delivery surface without a score lift
- current worktree findings that did change the exact top queue order:
  - `Create workflow`: the earlier May 19 attachment-refresh seam no longer reproduces in the current worktree, so the row stayed at `6/10` with higher confidence instead of forcing a narrow follow-up lane ahead of the workflow queue
  - `Project / workspace persistence`: May 19 review broadened the unsent draft exclusion contract to Create/Edit/Video plus Sound drafts and raised confidence without lifting score
