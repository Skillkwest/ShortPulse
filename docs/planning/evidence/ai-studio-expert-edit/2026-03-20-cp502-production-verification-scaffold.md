# CP-502 Evidence Packet - Production Verification Scaffold

## Packet Metadata
1. Packet ID: `CP-502-2026-03-20-PRODUCTION-VERIFICATION-SCAFFOLD`
2. Phase / tracker row: `P5 / CP-502`
3. Date (UTC): `2026-03-20`
4. Owners: QA + Ops + AI Studio FE
5. Status: `SCAFFOLD_READY`

## Purpose
1. Provide a ready-to-fill production verification template aligned to the CP-501 canary matrix contract.
2. Ensure CP-502 evidence captures the exact threshold contract required for closeout readiness.

## Required Inputs
1. Production run window:
   - Start timestamp (UTC): `TBD`
   - End timestamp (UTC): `TBD`
2. Release candidate identifiers:
   - Branch / commit: `TBD`
   - Deployment URL(s): `TBD`
3. CI check references:
   - `expert_edit_coordinate_parity`: `TBD`
   - `type_check`: `TBD`
   - `frontend`: `TBD`

## Verification Matrix
1. Surfaces:
   - Inline
   - Modal
2. Modes:
   - Markup pen
   - Markup eraser
   - Inpaint brush
   - Inpaint lasso
3. Camera slices:
   - Zoom `{0.5,1,2}`
   - Pan `{(0,0),(37,-19),(-120,80)}`
4. Aspect / DPR slices:
   - Stage aspect `{1:1,4:3,16:9}`
   - DPR `{1,2,3}`

## Threshold Contract
1. Pointer-to-stroke center error <= `0.75 CSS px`
2. Reticle vs painted diameter delta <= `1.0 CSS px`
3. Export alignment delta <= `1 mask px`

## Evidence Attachments
1. Browser-backed parity audit artifacts: `TBD`
2. Deterministic parity gate run output: `TBD`
3. Manual verification notes (if used): `TBD`
4. Incident/rollback notes (if any): `TBD`

## Decision Block
1. `CP-502` decision: `TBD` (`PASS` / `HOLD` / `ROLLBACK`)
2. Rationale: `TBD`
3. Linked decision-log row: `TBD`

## Exit Condition For CP-502
1. Matrix coverage completed across required slices.
2. No unresolved threshold breaches.
3. Decision log updated with final CP-502 outcome and evidence links.
