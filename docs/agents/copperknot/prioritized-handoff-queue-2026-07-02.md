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
| 1        | `Elements workflow`                             |       5 |          6 | Approved panel list orchestration   | shared panel runtime root-fix discipline      | `docs/agents/copperknot/handoffs/2026-05-31-approved-panel-list-orchestration-root-fix.md` |
| 2        | `Project / workspace persistence`               |       6 |          7 | AI Studio workflow stability        | persistence contracts + restore boundaries    | `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`              |
| 3        | `Characters workflow`                           |       5 |          6 | Secondary workflow confidence       | workflow modularization + persistence cleanup | `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`                        |
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

- Priority `1` is still `Elements workflow`, but the reason changed on May 31.
- The accepted May 30 runtime patch appears to have removed the visible Elements missing-preview symptom on production, so the old symptom-focused framing is no longer the best description of the remaining risk.
- Fresh May 31 production remeasurement still shows `extraListCallsPerOpen: 1` on both approved-panel surfaces, which means the remaining highest-ROI issue is the shared approved-panel open-phase list-orchestration seam.
- The May 31 production packet is faster than the older Holomony baseline, but it is not a score-lift packet because:
  - evidence coverage dropped to `35%`
  - many deeper metrics were not measured
  - the shared runtime still makes one extra list request during open-phase settlement
- The current live Elements handoff is intentionally narrower than the May 30 runtime packet: it is now a root-fix lane on shared list orchestration under an explicit no-UI, no-UX, no-intended-behavior-change constraint.
- Priorities `2..9` are the remaining below-floor workflow and persistence set after the heavy May 21 through May 27 repo hardening wave.
- `Characters workflow` moved down from the May 19 exact-next slot because newer repo movement materially changed that surface's evidence base, so the old Characters-first ordering is no longer trustworthy by default.
- `Create workflow` stays below floor, but it remains a held follow-up state after the May 28 validation-convergence closeout and the May 30 post-redeploy review rather than returning to the exact next lane.
- The bounded `2026-05-28` Elements closeout plus the bounded `2026-05-30` runtime closeout are both accepted as real seam evidence, but neither one clears the broader workflow/runtime lane by itself.
- `Reference Grid` stays at floor and should not be reopened as a blocker lane on current evidence.
- `Security boundaries` stays at floor, but the queue keeps an explicit follow-through slot for hosted auth-session cleanup, Git history purge judgment, and the new public-schema grant hardening posture.

## Immediate Handoff Set

The Copperknot should treat these as the current active next-work set:

1. `Elements workflow`
2. `Project / workspace persistence`
3. `Characters workflow`

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
- fresh queue correction after the May 27 baseline reset:
  - the May 19 `Characters workflow -> Elements workflow` exact-next order is now historical
  - the earlier Create validation-red state has now been absorbed and accepted
  - the current product-code worktree no longer carries the May 27 active-drift contradiction
- bounded Elements execution evidence reviewed:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-28-elements-workflow-hardening-closeout.md`
  - accepted as real repo-durable evidence for the persistence seam only
  - not sufficient to clear the broader approved-panel/runtime lane
  - the narrowed May 30 runtime handoff was dispatched, returned a bounded patch, and was accepted as local shared-runtime evidence on `2026-05-30`
  - the May 31 production remeasurement then confirmed that the old Elements missing-preview symptom no longer reproduced
  - the current accepted follow-up packet is now the root-fix list-orchestration handoff rather than the older broad workflow packet or the May 30 symptom-focused runtime packet
  - that May 31 root-fix handoff returned a bounded patch and was accepted as local root-fix evidence in the shared data-controller seam

## Fresh Production And Worktree Follow-Up Signals

- production-only follow-up findings that materially changed the queue:
  - `Elements workflow` plus approved panel runtime: the fresh `2026-05-31-approved-panel-production-remeasurement-audit.md` removed the old visible missing-preview symptom but kept the lane exact next because both approved panels still show `extraListCallsPerOpen: 1` and only `35%` evidence coverage
  - `Reference Grid`: Holomony's `2026-05-25-reference-grid-production-baseline.md` found `no clear blocker`, which keeps the row out of the active blocker set
  - `Security boundaries`: Dave's `2026-05-23-prod-storage-state-exposure.md` confirmed a historical production storage-state exposure and left hosted session cleanup plus history purge as open operator follow-through
- post-redeploy repo truth that keeps the exact top queue order stable:
  - latest launch-relevant movement is `ed86fb5ce`, which preserved canonical billed-resolution ids in Create pricing/runtime support seams
  - the later `c2b127581` commit is Gear Ball evidence only and does not change the product queue
  - the product-code worktree is clean, so there is no active local contradiction forcing a queue reorder
  - the May 31 production rerun and the accepted local root-fix patch together are fresh enough to keep `Elements workflow` exact next without pretending the lane is solved
