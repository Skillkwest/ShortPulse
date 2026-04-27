# AI Studio Inpaint Reference Contract Phase 4: Mask And UI Contract Hardening Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Make the inpaint mask contract explicit in code/tests and make the Edit panel, debit path, and polling behavior derive from one authoritative effective inpaint model contract.

## Scope
Phase 4 covers:
1. mask/base-image pairing invariants,
2. mask dimension and framing checks,
3. mask polarity confirmation,
4. selected-layer scope confirmation,
5. effective-model authority for:
   - model label,
   - resolution options,
   - selected resolution value,
   - aspect options,
   - pricing and lock-state behavior,
6. hidden-model authority for:
   - cost override/debit parity,
   - polling-provider mapping,
   - route/doc parity for the active submit/status path.

## Required Outcomes
1. The Edit panel must not show inpaint resolution or aspect options that the effective inpaint model does not support.
2. The inpaint lane must not submit a mask whose dimensions, polarity, or framing diverge from the exported base image contract.
3. The UI contract must reflect the real provider contract after Phase 3, not the stale selected-model state.
4. If the inpaint model changes, debit and polling behavior must change with it rather than remaining pinned to FLUX Fill assumptions.

## Deliverables
1. explicit effective-model authority in the Edit panel,
2. explicit mask invariants in code and tests,
3. removal of misleading UI states such as `Pulse Fill v1` combined with stale `2K` selection,
4. debit/polling behavior aligned with the authoritative inpaint model contract.

## Non-Goals
1. No new feature scope beyond the chosen inpaint contract.
2. No stage-system rebuild work.

## Entry Criteria
1. Phase 3 payload behavior is stable.
2. The team agrees on the authoritative inpaint model and mask contract from Phase 1.

## Exit Criteria
1. Inpaint UI options come from the effective inpaint model.
2. Mask export and submission invariants are explicit and covered.
3. No stale-model-derived selector state survives in the Edit panel for inpaint.
4. Debit and polling behavior match the effective inpaint submit model.
5. The active route behavior is accurately reflected in durable docs planned for Phase 5.

## Validation
1. Add focused UI tests for inpaint resolution/aspect behavior.
2. Add focused mask contract tests for size, framing, polarity, and base/mask pairing.
3. Confirm final submit behavior uses the same authoritative model assumptions that the UI displays.
4. Confirm hidden-model debit and polling-provider behavior remain consistent with the chosen lane.

## Rollback Note
If the effective-model authority refactor creates blocking regressions, temporarily restore the last known-good panel state only alongside an explicit guard that prevents unsupported selections from being shown or used, and revert debit/polling behavior to the last verified effective-model contract.
