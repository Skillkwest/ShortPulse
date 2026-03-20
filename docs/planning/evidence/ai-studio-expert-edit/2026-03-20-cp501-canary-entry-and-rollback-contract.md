# CP-501 Evidence Packet - Canary Entry And Rollback Contract

## Packet Metadata
1. Packet ID: `CP-501-2026-03-20-CANARY-ENTRY-ROLLBACK-CONTRACT`
2. Phase / tracker row: `P5 / CP-501`
3. Date (UTC): `2026-03-20`
4. Owners: AI Studio FE + QA + Ops
5. Branch / commit: `editor-fix / pending`
6. Environment scope: local validation + CI required-check posture + staging canary window

## Scope
1. Define a concrete Phase 5 canary entry gate using the new deterministic parity CI job.
2. Define stop/go thresholds and a rollback contract before production verification (`CP-502`).
3. Keep CP-004 and CP-302 waivers visible while canary evidence is collected.

## Canary Entry Gates
1. Required CI checks green on the release candidate:
   - `expert_edit_coordinate_parity`
   - `type_check`
   - `frontend`
2. Required local parity command green:
   - `npm -C frontend run test:expert-edit:coordinate-parity:gate`
3. Documentation integrity green:
   - `npm -C frontend run docs:check`
4. Decision log row recorded for canary start (`CP-501 IN_PROGRESS`).

## Canary Matrix Contract
1. Modes:
   - Markup pen/eraser
   - Inpaint brush/lasso
2. Surfaces:
   - Inline stage
   - Modal stage
3. Camera slices:
   - Zoom: `{0.5, 1, 2, 4}`
   - Pan: `{(0,0), (37,-19), (-120,80)}`
4. Acceptance thresholds:
   - Pointer-to-stroke center error <= `0.75 CSS px`
   - Reticle vs painted diameter delta <= `1.0 CSS px` equivalent
   - Export alignment delta <= `1 mask px`

## Stop / Go Criteria
1. `GO`: no threshold breaches in canary matrix and no new parity regressions observed in canary window.
2. `HOLD`: single threshold breach with reproducible case pending triage.
3. `ROLLBACK`: repeated threshold breach or cross-surface parity drift in the same regression signature class.

## Rollback Contract
1. Immediate action:
   - Stop rollout promotion and record a `ROLLBACK` decision row in the decision log.
2. Code posture:
   - Revert the smallest parity-related commit set required to restore pre-regression behavior.
3. Validation after rollback:
   - `npm -C frontend run test:expert-edit:coordinate-parity:gate`
   - `npm -C frontend run docs:check`
4. Evidence requirement:
   - Capture breached matrix slices, rollback commit IDs, and post-rollback validation results.

## Status Decision
1. `CP-501`: `IN_PROGRESS` with canary entry gates and rollback contract now locked.
2. `CP-502` and `CP-503` remain `PENDING`.

## Residual Risk Notes
1. CP-004 and CP-302 waiver residuals remain active until canary and production evidence supersede them.
2. Browser-backed audit remains optional but recommended for high-confidence runtime capture:
   - `npm -C frontend run test:expert-edit:coordinate-parity:browser-audit`
