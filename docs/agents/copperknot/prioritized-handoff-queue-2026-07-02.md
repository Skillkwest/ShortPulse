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
| 1        | `Elements workflow`                             |       5 |          6 | Approved panel/runtime health       | panel runtime + preview delivery hardening    | `docs/agents/copperknot/handoffs/2026-05-30-elements-approved-panel-runtime-hardening.md`  |
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

- Priority `1` is `Elements workflow` because the `Create workflow` validation-convergence lane stayed green through both the May 28 focused rerun and the May 30 post-redeploy AI Studio/media-authority bundle, so the earlier validation-red blocker is no longer open.
- The strongest current green validation set is:
  - `18 passed test files`
  - `385 passed / 385 total tests`
- Priority `1` still stays on `Elements workflow` because Holomony's `2026-05-21` approved-panel runtime check continues to hold the shared media-panel lane at `6/10 fragile`, with open-phase signing cost still high and an Elements-only missing-preview gap still active.
- The current live Elements handoff is intentionally narrower than the older May 6 packet: it is now a backend/runtime-only lane under an explicit no-UI, no-UX, no-intended-behavior-change constraint.
- Priorities `2..9` are the remaining below-floor workflow and persistence set after the heavy May 21 through May 27 repo hardening wave.
- `Characters workflow` moved down from the May 19 exact-next slot because newer repo movement materially changed that surface's evidence base, so the old Characters-first ordering is no longer trustworthy by default.
- `Create workflow` stays below floor, but it remains a held follow-up state after the May 28 validation-convergence closeout and the May 30 post-redeploy review rather than returning to the exact next lane.
- The bounded `2026-05-28` Elements closeout is accepted as real persistence-seam evidence, but it does not clear the broader workflow/runtime lane by itself.
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

As of `2026-05-30`:

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
- fresh queue correction after the May 27 baseline reset:
  - the May 19 `Characters workflow -> Elements workflow` exact-next order is now historical
  - the earlier Create validation-red state has now been absorbed and accepted
  - the current product-code worktree no longer carries the May 27 active-drift contradiction
- bounded Elements execution evidence reviewed:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-28-elements-workflow-hardening-closeout.md`
  - accepted as real repo-durable evidence for the persistence seam only
  - not sufficient to clear the broader approved-panel/runtime lane
  - current dispatch-ready follow-up packet is now the narrowed runtime handoff rather than the older broad workflow packet
  - after user approval, that narrowed runtime packet was dispatched, returned a bounded patch, and was accepted as local shared-runtime evidence on `2026-05-30`
  - the next proof is production remeasurement after this patch lands on the production URL

## Fresh Production And Worktree Follow-Up Signals

- production-only follow-up findings that materially changed the queue:
  - `Elements workflow` plus approved panel runtime: Holomony's `2026-05-21-approved-panel-runtime-check.md` still holds the lane at `6/10 fragile`
  - `Reference Grid`: Holomony's `2026-05-25-reference-grid-production-baseline.md` found `no clear blocker`, which keeps the row out of the active blocker set
  - `Security boundaries`: Dave's `2026-05-23-prod-storage-state-exposure.md` confirmed a historical production storage-state exposure and left hosted session cleanup plus history purge as open operator follow-through
- post-redeploy repo truth that keeps the exact top queue order stable:
  - latest committed launch-relevant movement is `755fec94b`, which hardened generated-media authority, prompt surfaces, detail rendering, reference-card rendering, and project workspace support seams
  - `npm -C frontend run build` passed
  - the May 30 targeted AI Studio/media-authority validation bundle passed at `18 files / 385 tests`
  - `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed after redeploy
  - the product-code worktree is now clean, so there is no active local contradiction forcing a queue reorder
