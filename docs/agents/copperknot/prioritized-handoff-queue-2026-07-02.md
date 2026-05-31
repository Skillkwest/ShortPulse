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
| 1        | `Project / workspace persistence`               |       6 |          7 | AI Studio workflow stability        | persistence contracts + restore boundaries    | `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`              |
| 2        | `Characters workflow`                           |       5 |          6 | Secondary workflow confidence       | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`                        |
| 3        | `Elements workflow`                             |       5 |          6 | Approved panel follow-up hold       | workflow/runtime reassessment after live fix  | `queue-only`                                                                               |
| 4        | `Create workflow`                               |       6 |          7 | AI Studio validation follow-up hold | AI Studio runtime triage + workflow steward   | `docs/agents/copperknot/handoffs/2026-05-28-create-workflow-validation-convergence.md`     |
| 5        | `Media delivery / signing / preview resolution` |       6 |          6 | Approved panel/runtime follow-up    | preview delivery performance                  | `queue-only`                                                                               |
| 6        | `Edit workflow`                                 |       6 |          7 | AI Studio workflow stability        | AI Studio workflow modularization             | `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`                              |
| 7        | `Media ingest / save`                           |       6 |          7 | Platform trust and release safety   | media persistence + upload authority          | `queue-only`                                                                               |
| 8        | `Core data persistence`                         |       6 |          7 | Platform trust and release safety   | schema/persistence contract audit             | `queue-only`                                                                               |
| 9        | `Storage / file delivery`                       |       6 |          7 | Platform trust and release safety   | storage scope + signed delivery               | `queue-only`                                                                               |
| 10       | `Security boundaries`                           |       7 |          7 | Release security follow-through     | security boundary validation                  | `docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md`          |
| 11       | `Provider integrations`                         |       6 |          7 | Shared runtime hardening            | provider contract normalization               | `queue-only`                                                                               |
| 12       | `Video workflow`                                |       6 |          6 | Secondary workflow confidence       | video generation workflow validation          | `queue-only`                                                                               |
| 13       | `Reference Grid`                                |       7 |          7 | Validation maintenance              | reference-surface validation maintenance      | `docs/agents/copperknot/handoffs/2026-05-16-reference-grid-styles-runtime-verification.md` |
| 14       | `Generation submission / polling`               |       7 |          7 | Shared runtime hardening            | provider submit/status validation             | `docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md`    |
| 15       | `Billing / credits`                             |       7 |          7 | Shared runtime hardening            | billing-runtime validation                    | `docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md`          |
| 16       | `Media Library workflow`                        |       6 |          6 | Secondary workflow confidence       | media UX and workflow semantics               | `queue-only`                                                                               |
| 17       | `Media derivatives / variants`                  |       6 |          6 | Platform trust and release safety   | derivative worker reliability                 | `queue-only`                                                                               |
| 18       | `Sound workflow`                                |       6 |          6 | Secondary workflow confidence       | sound workflow validation                     | `queue-only`                                                                               |
| 19       | `Observability / incident triage`               |       6 |          6 | Platform trust and release safety   | telemetry and operator visibility             | `queue-only`                                                                               |
| 20       | `Admin operations`                              |       6 |          6 | Platform trust and release safety   | admin support surface integrity               | `queue-only`                                                                               |
| 21       | `Pricing / entitlements`                        |       7 |          7 | Platform trust and release safety   | control-plane validation                      | `queue-only`                                                                               |
| 22       | `Auth / identity`                               |       7 |          7 | Platform trust and release safety   | auth boundary validation                      | `queue-only`                                                                               |

## Queue Interpretation

- Priority `1` is now `Project / workspace persistence`.
- The deployed May 31 approved-panel root fix materially improved the live production signal:
  - confirmed reruns now show `extraListCallsPerOpen: 0`
  - `missingPreviewRatio: 0`
  - `includeLibraryTotalCount=true` on the approved-panel root request shape
- The old approved-panel hotspot is no longer the strongest open lane, so `Elements workflow` should not stay exact next by momentum alone.
- The live May 31 post-deploy packet is still not a score-lift packet because:
  - evidence coverage remains `35%`
  - many deeper metrics are still not measured
- `Elements workflow` remains below floor, but it now shifts into a held follow-up position instead of the active top slot.
- Priorities `4..9` are the remaining below-floor workflow and persistence set after the heavy May 21 through May 27 repo hardening wave.
- `Create workflow` stays below floor, but it remains a held follow-up state after the May 28 validation-convergence closeout and the May 30 post-redeploy review rather than returning to the exact next lane.
- The bounded `2026-05-28` Elements closeout, the bounded `2026-05-30` runtime closeout, and the accepted `2026-05-31` root fix are all real seam evidence. Together they materially reduce the old live hotspot without justifying a score lift.
- `Reference Grid` stays at floor and should not be reopened as a blocker lane on current evidence.
- `Security boundaries` stays at floor, but the queue keeps an explicit follow-through slot for hosted auth-session cleanup, Git history purge judgment, and the new public-schema grant hardening posture.

## Immediate Handoff Set

The Copperknot should treat these as the current active next-work set:

1. `Project / workspace persistence`
2. `Characters workflow`
3. `Elements workflow`

## Reviewed-Complete Follow-Up Lanes

- `Generation recovery / settlement`
  - execution-complete and reviewed on `2026-05-15`
  - keep out of the exact next-work queue unless:
    - broader generation-runtime rerating reopens it, or
    - new runtime failure evidence lands

## Current Dispatch Snapshot

As of `2026-05-31`:

- reviewed complete:
  - `Generation recovery / settlement`
- rerated to at-floor validation:
  - `Reference Grid`
  - `Billing / credits`
  - `Security boundaries`
  - `Generation submission / polling`
- score held after bounded review:
  - `Edit workflow`
  - `Project / workspace persistence`
- score held after May 28 validation convergence:
  - `Create workflow`
- score held after May 30 post-redeploy review:
  - `Create workflow`
  - `Elements workflow`
  - `Project / workspace persistence`
  - `Media delivery / signing / preview resolution`
- score held after May 30 bounded runtime follow-up review:
  - `Elements workflow`
  - `Media delivery / signing / preview resolution`
- score held after May 31 production remeasurement:
  - `Elements workflow`
  - `Media delivery / signing / preview resolution`
- score held after accepted May 31 root-fix closeout review:
  - `Elements workflow`
  - `Media delivery / signing / preview resolution`
- score held after May 31 post-deploy production verification:
  - `Elements workflow`
  - `Media delivery / signing / preview resolution`
- score held after accepted May 31 local persistence root-fix review:
  - `Project / workspace persistence`
- fresh queue correction after the May 27 baseline reset:
  - the May 19 `Characters workflow -> Elements workflow` exact-next order is now historical
  - the earlier Create validation-red state has now been absorbed and accepted
  - the current product-code worktree now carries an accepted local persistence root fix that still needs deploy and production remeasurement before the row can be treated as cleared
- bounded Elements execution evidence reviewed:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-28-elements-workflow-hardening-closeout.md`
  - accepted as real repo-durable evidence for the persistence seam only
  - the narrowed May 30 runtime handoff was dispatched, returned a bounded patch, and was accepted as local shared-runtime evidence on `2026-05-30`
  - the May 31 production remeasurement then confirmed that the old Elements missing-preview symptom no longer reproduced
  - the accepted May 31 root-fix handoff then deployed and materially reduced the remaining approved-panel hotspot on production
  - `Elements workflow` is no longer the exact next dispatch lane after that post-deploy verification

## Fresh Production And Worktree Follow-Up Signals

- production-only follow-up findings that materially changed the queue:
  - `Elements workflow` plus approved panel runtime: the fresh `2026-05-31-approved-panel-post-deploy-verification.md` confirmed the deployed root fix reduced both approved-panel surfaces to `extraListCallsPerOpen: 0`, so the row should move out of the exact-next slot even though the score stays held
  - `Reference Grid`: Holomony's `2026-05-25-reference-grid-production-baseline.md` found `no clear blocker`, which keeps the row out of the active blocker set
  - `Security boundaries`: Dave's `2026-05-23-prod-storage-state-exposure.md` confirmed a historical production storage-state exposure and left hosted session cleanup plus history purge as open operator follow-through
- post-redeploy repo truth that keeps the exact top queue order stable:
  - latest launch-relevant movement is `ed86fb5ce`, which preserved canonical billed-resolution ids in Create pricing/runtime support seams
  - the later `c2b127581` commit is Gear Ball evidence only and does not change the product queue
  - the accepted May 31 local persistence root fix strengthens the current exact-next row without yet clearing it for a queue reorder
  - the May 31 post-deploy rerun is fresh enough to move exact-next back to `Project / workspace persistence` without pretending `Elements workflow` is fully solved
