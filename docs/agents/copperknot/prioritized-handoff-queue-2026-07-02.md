# Prioritized System-By-System Handoff Queue

Purpose: define the ordered execution queue for the current production-readiness window through `2026-07-02`.

## Queue Rules

- Higher rows should be worked before lower rows unless fresh evidence changes the order.
- Queue position is based on ship impact, not on ease.
- Do not keep a lane exact next by momentum once its strongest live blocker is materially reduced.
- Keep reviewed-complete and score-held lanes out of the top dispatch order unless fresh evidence reopens them.

## Queue

| Priority | System                                          | Current | Ship floor | Lane                                | Recommended agent profile                    | Current handoff                                                                            |
| -------- | ----------------------------------------------- | ------: | ---------: | ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1        | `Elements workflow`                             |       5 |          6 | Approved panel follow-up hold       | workflow/runtime reassessment after live fix | `queue-only`                                                                               |
| 2        | `Create workflow`                               |       6 |          7 | AI Studio validation follow-up hold | AI Studio runtime triage + workflow steward  | `docs/agents/copperknot/handoffs/2026-05-28-create-workflow-validation-convergence.md`     |
| 3        | `Edit workflow`                                 |       6 |          7 | AI Studio workflow stability        | AI Studio workflow modularization            | `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`                              |
| 4        | `Media ingest / save`                           |       6 |          7 | Platform trust and release safety   | media persistence + upload authority         | `queue-only`                                                                               |
| 5        | `Core data persistence`                         |       6 |          7 | Platform trust and release safety   | schema/persistence contract audit            | `queue-only`                                                                               |
| 6        | `Storage / file delivery`                       |       6 |          7 | Platform trust and release safety   | storage scope + signed delivery              | `queue-only`                                                                               |
| 7        | `Provider integrations`                         |       6 |          7 | Shared runtime hardening            | provider contract normalization              | `queue-only`                                                                               |
| 8        | `Characters workflow`                           |       6 |          6 | Production-verified maintenance     | character workflow validation                | `reviewed-complete`                                                                        |
| 9        | `Media delivery / signing / preview resolution` |       6 |          6 | Approved panel/runtime follow-up    | preview delivery performance                 | `queue-only`                                                                               |
| 10       | `Security boundaries`                           |       7 |          7 | Release security follow-through     | security boundary validation                 | `docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md`          |
| 11       | `Project / workspace persistence`               |       7 |          7 | Production-verified maintenance     | persistence contracts + restore boundaries   | `reviewed-complete`                                                                        |
| 12       | `Video workflow`                                |       6 |          6 | Secondary workflow confidence       | video generation workflow validation         | `queue-only`                                                                               |
| 13       | `Reference Grid`                                |       7 |          7 | Validation maintenance              | reference-surface validation maintenance     | `docs/agents/copperknot/handoffs/2026-05-16-reference-grid-styles-runtime-verification.md` |
| 14       | `Generation submission / polling`               |       7 |          7 | Shared runtime hardening            | provider submit/status validation            | `docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md`    |
| 15       | `Billing / credits`                             |       7 |          7 | Shared runtime hardening            | billing-runtime validation                   | `docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md`          |
| 16       | `Media Library workflow`                        |       6 |          6 | Secondary workflow confidence       | media UX and workflow semantics              | `queue-only`                                                                               |
| 17       | `Media derivatives / variants`                  |       6 |          6 | Platform trust and release safety   | derivative worker reliability                | `queue-only`                                                                               |
| 18       | `Sound workflow`                                |       6 |          6 | Secondary workflow confidence       | sound workflow validation                    | `queue-only`                                                                               |
| 19       | `Observability / incident triage`               |       6 |          6 | Platform trust and release safety   | telemetry and operator visibility            | `queue-only`                                                                               |
| 20       | `Admin operations`                              |       6 |          6 | Platform trust and release safety   | admin support surface integrity              | `queue-only`                                                                               |
| 21       | `Pricing / entitlements`                        |       7 |          7 | Platform trust and release safety   | control-plane validation                     | `queue-only`                                                                               |
| 22       | `Auth / identity`                               |       7 |          7 | Platform trust and release safety   | auth boundary validation                     | `queue-only`                                                                               |

## Current Queue Truth

- `Project / workspace persistence` reached ship floor after the production persistence audit passed on `https://www.shortpulse.ai`. The deployed read path strips the orphan generated-output class and keeps runtime-identity generated rows only when ownership resolves through `generationId`, `taskId`, or `sourceRef`.
- `Characters workflow` reached ship floor after the Character Mode model-picker audit and Character Manager save/reopen continuity audit passed on production with a real reference image.
- `Characters workflow` stays at floor, not above it, because the save/reopen audit found a residual Character Library delete-confirmation pointer-layering risk.
- `Elements workflow` is exact next because Characters no longer has the stronger live ship-risk signal.
- `Create workflow` stays below floor, but it remains held rather than returning to exact next.
- `Reference Grid`, `Billing / credits`, `Generation submission / polling`, and `Security boundaries` remain at floor on current evidence.

## Current Lane Posture

- Exact next:
  - `Elements workflow`
- Next proof boundary:
  - audit the current Elements workflow against production and repo truth before making any score or lane claim
- Follow-up hold:
  - `Create workflow`
- Reviewed complete at floor:
  - `Characters workflow`
  - `Project / workspace persistence`
- Reviewed complete but not rerated up:
  - `Generation recovery / settlement`
