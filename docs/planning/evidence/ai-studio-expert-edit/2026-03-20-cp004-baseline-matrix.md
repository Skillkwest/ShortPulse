# CP-004 Baseline Matrix Evidence Packet (2026-03-20)

## Packet Metadata
1. Packet ID: `2026-03-20-cp004-baseline-matrix`
2. Phase / Tracker rows: `P0` / `CP-004`
3. Date (UTC): `2026-03-20T17:49:20Z`
4. Owners: AI Studio FE + QA
5. Branch / commit: `editor-fix` / `0a70e51f`
6. Environment: local macOS workspace, `frontend/.env.local` loaded by Next.js build

## Scope
1. Surfaces covered: inline + modal (automated coverage only)
2. Modes covered: markup pen/eraser, inpaint brush/lasso (automated coverage only)
3. Matrix slices covered: partial via existing deterministic unit/integration tests

## Matrix Results
| Dimension | Values Covered | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Zoom | `0.5`, `1`, `2` | PARTIAL | Current clamp values are exercised in targeted tests, but the packet still lacks one consolidated max-zoom threshold rollup across both surfaces. |
| Pan | non-zero pan covered in existing flatten/panel tests | PARTIAL | Required canonical pan set `(0,0)`, `(37,-19)`, `(-120,80)` not fully recorded yet. |
| Stage Aspect | `1:1`, `16:9`, `9:16` | PARTIAL | `4:3` not yet captured in baseline artifact. |
| Image Aspect | partial via existing fixtures | PARTIAL | Full required set not yet explicitly captured in one matrix packet. |
| DPR | not explicitly captured in current baseline run | FAIL | `DPR {1,2,3}` capture still pending for CP-004 closure. |

## Threshold Results
| Metric | Threshold | Observed Max | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Pointer-to-stroke center error | `<= 0.75 CSS px` | TBD | PARTIAL | Characterization tests exist but full matrix max not yet assembled in one packet. |
| Reticle vs painted diameter delta | `<= 1.0 CSS px equivalent` | TBD | PARTIAL | Existing brush-radius tests validate scaling behavior, not full matrix max rollup. |
| Export alignment delta | `<= 1 mask px` | TBD | PARTIAL | Export camera assertions exist; full matrix max rollup pending. |
| Lasso deterministic parity | exact for fixtures | PASS (fixture-level) | PARTIAL | Full CP-004 matrix signoff still pending. |

## CP-004 Remaining Closure Run Sheet
Use this checklist to finish the missing baseline slices before moving `CP-004` to `DONE`.

| Gap | Required Coverage | Capture Method | Evidence Output | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Zoom max | current clamp max (`2x`) at inline + modal | Run existing deterministic test bundle, then perform interactive draw checks at max zoom in both surfaces | Add observed threshold max values to this packet + supporting captures | AI Studio FE + QA | OPEN |
| Canonical pan tuples | `(0,0)`, `(37,-19)`, `(-120,80)` | Interactive characterization pass at each tuple with fixed anchor strokes (markup + inpaint) | Add per-tuple deltas and pass/fail row updates in this packet | AI Studio FE + QA | OPEN |
| Stage aspect `4:3` | stage viewport `4:3` with parity checks | Capture with a `4:3` stage viewport pass (for example `1200x900`) for inline + modal | Add `4:3` matrix row evidence and threshold max values in this packet | AI Studio FE + QA | OPEN |
| DPR matrix | `1`, `2`, `3` | Repeat the same characterization pass at each DPR profile | Add DPR max-threshold rollup and pass/fail decision in this packet | AI Studio FE + QA | OPEN |

### Clarification: Stage Aspect vs Output Aspect Options
1. CP-004 `Stage Aspect` is a viewport/stage geometry requirement.
2. It is independent from create/edit output aspect selectors in `frontend/features/ai-studio/constants.ts`.
3. A `4:3` stage baseline is still required even if the current UI aspect option list does not expose `4:3` as a selectable output preset.

### Remaining Capture Sequence
1. Re-run deterministic baseline command bundle (below) and attach pass/fail outcomes.
2. Run interactive characterization across the remaining matrix:
   - zoom: current clamp max (`2`)
   - pan tuples: `(0,0)`, `(37,-19)`, `(-120,80)`
   - stage aspect: include `4:3`
   - DPR: `1`, `2`, `3`
3. For each slice, record:
   - pointer-to-stroke center error max
   - reticle vs painted diameter delta max
   - export alignment delta max
   - lasso deterministic parity result
4. Update this packet tables from `PARTIAL/FAIL` to final pass/fail values.
5. Append final engineering + QA signoff and change decision from `HOLD` to `PASS` when complete.

### Capture Constraint (Current)
1. Browser-backed parity harness is now available:
   - Command: `cd frontend && npm run test:e2e:expert-edit-parity`
   - Script: `frontend/tests/e2e/expert-edit-coordinate-parity.audit.js`
2. In this workspace, execution is currently blocked by missing audit credentials:
   - `PLAYWRIGHT_AUDIT_EMAIL` is empty in `frontend/.env.local`.
3. Until a valid audit account is provided, DPR closure remains blocked at `CP-004`.

## Waiver Decision
1. Waiver ID: `CP-004-W1`
2. Decision: approved by user request to skip remaining CP-004 baseline slices and proceed.
3. Accepted residual scope:
   - max zoom (`2`)
   - canonical pan tuples `(0,0)`, `(37,-19)`, `(-120,80)`
   - stage aspect `4:3`
   - DPR `1`, `2`, `3`
4. Risk statement: implementation proceeds without complete baseline characterization for these slices; regression risk shifts to Phase 1-4 implementation validation.
5. Control: keep waiver visible in tracker/decision log until superseded by later phase evidence.

## Validation Commands
1. Command list:
   - `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
   - `npm -C frontend run type-check`
   - `npm -C frontend run lint`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`
2. Pass/fail summary:
   - tests: PASS (`191` tests passed)
   - type-check: PASS
   - lint: PASS with existing repo warnings (no errors)
   - build: PASS
   - docs:check: PASS
3. Known flakes and reruns:
   - Vitest/jsdom emits repeated `HTMLCanvasElement.getContext()` "Not implemented" warnings in this suite; tests still pass.
4. Latest validated run timestamp (UTC):
   - `2026-03-20T17:49:20Z`

## Artifact Links
1. Test logs: terminal runs from `2026-03-20` readiness pass in this workspace session
2. Visual artifacts: pending
3. Supporting notes:
   - this packet
   - `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-gap-inventory.md`
4. Decision log entry: `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`

## Regressions / Incidents
1. Description: CP-004 not yet complete because required full matrix capture is still partial.
2. Matrix slice: max zoom (`2`), stage aspect `4:3`, DPR `1/2/3`, canonical pan tuple set.
3. Severity: Medium (readiness gate blocker, not a production incident)
4. Mitigation: finish remaining matrix captures and publish max-threshold rollup.
5. Rollback triggered: no

## Signoff
1. Engineering signoff: approved with waiver (`CP-004-W1`)
2. QA signoff: approved with waiver (`CP-004-W1`)
3. Decision: DONE WITH WAIVER (`CP-004`)
4. Timestamp: `2026-03-20T18:30:08Z`
