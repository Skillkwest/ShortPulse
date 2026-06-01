# Prioritized System-By-System Handoff Queue

Purpose: define the ordered execution queue for the current production-readiness window through `2026-07-02`.

## Queue Rules

- Higher rows should be worked before lower rows unless fresh evidence changes the order.
- Queue position is based on ship impact, not on ease.
- Do not keep a lane exact next by momentum once its strongest live blocker is materially reduced.
- Keep reviewed-complete and score-held lanes out of the top dispatch order unless fresh evidence reopens them.

## Queue

| Priority | System                                          | Current | Ship floor | Lane                               | Recommended agent profile                   | Current handoff                                                                            |
| -------- | ----------------------------------------------- | ------: | ---------: | ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1        | `Edit workflow`                                 |       6 |          7 | AI Studio workflow stability       | AI Studio workflow modularization           | `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`                              |
| 2        | `Create workflow`                               |       6 |          7 | Production proof hold              | AI Studio runtime triage + workflow steward | `docs/agents/copperknot/handoffs/2026-05-28-create-workflow-validation-convergence.md`     |
| 3        | `Media ingest / save`                           |       6 |          7 | Platform trust and release safety  | media persistence + upload authority        | `queue-only`                                                                               |
| 4        | `Core data persistence`                         |       6 |          7 | Platform trust and release safety  | schema/persistence contract audit           | `queue-only`                                                                               |
| 5        | `Storage / file delivery`                       |       6 |          7 | Platform trust and release safety  | storage scope + signed delivery             | `queue-only`                                                                               |
| 6        | `Provider integrations`                         |       6 |          7 | Shared runtime hardening           | provider contract normalization             | `queue-only`                                                                               |
| 7        | `Characters workflow`                           |       6 |          6 | Production-verified maintenance    | character workflow validation               | `reviewed-complete`                                                                        |
| 8        | `Elements workflow`                             |       6 |          6 | Production-measured maintenance    | workflow measurement-depth follow-up        | `reviewed-complete`                                                                        |
| 9        | `Media delivery / signing / preview resolution` |       6 |          6 | Approved panel/runtime maintenance | preview delivery performance                | `queue-only`                                                                               |
| 10       | `Security boundaries`                           |       7 |          7 | Release security follow-through    | security boundary validation                | `docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md`          |
| 11       | `Project / workspace persistence`               |       7 |          7 | Production-verified maintenance    | persistence contracts + restore boundaries  | `reviewed-complete`                                                                        |
| 12       | `Video workflow`                                |       6 |          6 | Secondary workflow confidence      | video generation workflow validation        | `queue-only`                                                                               |
| 13       | `Reference Grid`                                |       7 |          7 | Validation maintenance             | reference-surface validation maintenance    | `docs/agents/copperknot/handoffs/2026-05-16-reference-grid-styles-runtime-verification.md` |
| 14       | `Generation submission / polling`               |       7 |          7 | Shared runtime hardening           | provider submit/status validation           | `docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md`    |
| 15       | `Billing / credits`                             |       7 |          7 | Shared runtime hardening           | billing-runtime validation                  | `docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md`          |
| 16       | `Media Library workflow`                        |       6 |          6 | Secondary workflow confidence      | media UX and workflow semantics             | `queue-only`                                                                               |
| 17       | `Media derivatives / variants`                  |       6 |          6 | Platform trust and release safety  | derivative worker reliability               | `queue-only`                                                                               |
| 18       | `Sound workflow`                                |       6 |          6 | Secondary workflow confidence      | sound workflow validation                   | `queue-only`                                                                               |
| 19       | `Observability / incident triage`               |       6 |          6 | Platform trust and release safety  | telemetry and operator visibility           | `queue-only`                                                                               |
| 20       | `Admin operations`                              |       6 |          6 | Platform trust and release safety  | admin support surface integrity             | `queue-only`                                                                               |
| 21       | `Pricing / entitlements`                        |       7 |          7 | Platform trust and release safety  | control-plane validation                    | `queue-only`                                                                               |
| 22       | `Auth / identity`                               |       7 |          7 | Platform trust and release safety  | auth boundary validation                    | `queue-only`                                                                               |

## Current Queue Truth

- `Project / workspace persistence` reached ship floor after the production persistence audit passed on `https://www.shortpulse.ai`. The deployed read path strips the orphan generated-output class and keeps runtime-identity generated rows only when ownership resolves through `generationId`, `taskId`, or `sourceRef`.
- `Characters workflow` reached ship floor after the Character Mode model-picker audit and Character Manager save/reopen continuity audit passed on production with a real reference image.
- `Characters workflow` stays at floor, not above it, because the save/reopen audit found a residual Character Library delete-confirmation pointer-layering risk.
- `Elements workflow` reached ship floor after the approved-panel KPI capture tooling correction and production remeasurement moved both approved-panel surfaces to `6/10` with `extraListCallsPerOpen: 0`, `missingPreviewRatio: 0`, and `51%` coverage.
- `Elements workflow` stays at floor, not above it, because evidence depth remains low and the score is still capped below `75%` coverage.
- `Create workflow` stays below floor at `6/10`, but it is no longer the exact-next source-fix lane: the focused Create/runtime validation set is green on current repo evidence (`13` focused files / `54` tests plus Generate CTA contract check), and the remaining score-lift proof is production workflow/browser depth rather than a known safe source fix.
- `Edit workflow` is exact next because it is now the highest-ROI below-floor workflow lane and still carries the stronger `P0 ship-critical` priority band.
- `Reference Grid`, `Billing / credits`, `Generation submission / polling`, and `Security boundaries` remain at floor on current evidence.

## Current Lane Posture

- Exact next:
  - `Edit workflow`
- Next proof boundary:
  - audit current Edit workflow repo truth before making any score or lane claim
- Score-held below floor:
  - `Create workflow`
- Reviewed complete at floor:
  - `Characters workflow`
  - `Elements workflow`
  - `Project / workspace persistence`
- Reviewed complete but not rerated up:
  - `Generation recovery / settlement`
