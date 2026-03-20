# CP-403 / CP-404 Evidence Packet - Coordinate Parity Gate And CI Enforcement

## Packet Metadata
1. Packet ID: `CP-403-CP-404-2026-03-20-PARITY-GATE-CI-ENFORCEMENT`
2. Phase / tracker rows: `P4 / CP-403, CP-404` (consolidates `CP-401`, `CP-402`)
3. Date (UTC): `2026-03-20`
4. Owners: AI Studio FE + DevEx
5. Branch / commit: `editor-fix / pending`
6. Environment: local dev workspace (`frontend`) + CI workflow contract updates

## Scope
1. Add a deterministic parity gate command that aggregates required coordinate parity unit/integration suites.
2. Wire a dedicated CI job with explicit `warn|enforce` policy (`default=enforce`) to block merge-time regressions.
3. Preserve optional browser-backed parity auditing without making it a hard dependency for this gate.

## Implementation Evidence
1. Added focused parity scripts in `frontend/package.json`:
   - `test:expert-edit:coordinate-parity:core`
   - `test:expert-edit:coordinate-parity:browser-audit`
   - `test:expert-edit:coordinate-parity:gate`
2. Added CI job `expert_edit_coordinate_parity` in `.github/workflows/ci.yml`:
   - PR path filtering for Expert Edit parity-impacting files.
   - Non-PR full execution behavior.
   - Mode switch via repository variable `EXPERT_EDIT_COORDINATE_PARITY_MODE`.
   - Enforce-mode failure behavior and warn-mode downgrade behavior.
3. Aligned Phase 4 execution plan module references to the live browser audit path:
   - `frontend/tests/e2e/expert-edit-coordinate-parity.audit.js`

## Validation Commands
1. `npm -C frontend run test:expert-edit:coordinate-parity:gate`

## Validation Result
1. Gate command passed.
2. Included suites passed:
   - `stageSceneGeometry.test.ts`
   - `markupStrokeController.test.ts`
   - `useInpaintMaskController.test.ts`
   - `expertEditStageFlatten.test.ts`
   - `ExpertEditPanelView.test.tsx`
3. `jsdom` emitted expected non-blocking canvas capability warnings in integration tests (`HTMLCanvasElement.getContext` not implemented).

## Status Decision
1. `CP-401`: `DONE` (unit transform/threshold harness fully consolidated into parity gate).
2. `CP-402`: `DONE` (pointer lifecycle parity integration coverage consolidated into parity gate).
3. `CP-403`: `DONE` (deterministic drift signatures are guarded by parity gate suites; browser audit remains optional for additional runtime evidence).
4. `CP-404`: `DONE` (CI gate wiring landed with enforce-mode default and required-check-ready job identity).

## Residual Risk Notes
1. Browser-backed parity matrix capture remains optional in this workspace and is not required for gate pass.
2. Existing CP-004 and CP-302 waiver context remains unchanged and is tracked in the decision log.
