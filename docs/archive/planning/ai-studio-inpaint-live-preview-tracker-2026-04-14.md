> Archived 2026-05-23 during planning cleanup. Reason: dormant draft plan packet no longer part of the active planning reading path.

# AI Studio Inpaint Live Preview Tracker (2026-04-14)

Last updated: 2026-04-14  
Status: draft  
Owner: Engineering

## Tracker Rules
1. Do not mark a phase complete unless code, tests, and rollback obligations for that phase are complete.
2. Do not widen scope beyond the inpaint live-preview problem unless a blocking defect proves the current done state cannot be met otherwise.
3. Preserve committed-mask export/history/submit behavior in every phase unless a deliberate phase explicitly changes that contract.
4. This tracker is the operational source of truth for the inpaint live-preview program.

## Program Done State
The program is done when:
1. brush feedback is immediate and visible while drawing,
2. lasso feedback is immediate and legible while drawing,
3. inline and modal preview behavior are aligned,
4. committed-mask export/history/submit behavior remain unchanged,
5. targeted tests pass,
6. adjacent cleanup is not required to justify stopping.

## Program Phases

| Phase | Status | Goal | Entry Criteria | Exit Criteria | Rollback Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Planned | Add the shared transient preview layer to the stage scene for both inline and modal surfaces. | Shared insertion point confirmed. | Both surfaces mount a non-interactive preview layer inside the stage scene. | Remove only preview-layer mount/CSS changes if stage rendering destabilizes. |
| 2 | Planned | Drive immediate brush and lasso preview from pointer input. | Shared preview layer exists. | Brush and lasso feedback render immediately during draw interactions. | Remove transient preview-state wiring if live feedback becomes unstable. |
| 3 | Planned | Preserve committed-mask, export, history, and submit behavior while preview is additive. | Immediate preview path exists. | Authoritative mask behavior is unchanged and preview state does not leak into committed state. | Revert preview-state separation changes if authoritative mask behavior drifts. |
| 4 | Planned | Tighten inline/modal preview coordinate parity. | Preview exists on both surfaces. | Inline and modal preview placement/behavior align under pan and zoom. | Revert coordinate-unification changes if modal regressions appear. |
| 5 | Planned | Validate the done state and enforce the stop rule. | Phases 1-4 are functionally complete. | Targeted tests pass and the master-plan done state is satisfied. | Roll back only preview-layer work if the done state is not reached cleanly. |

## Phase Links
1. `docs/archive/planning/ai-studio-inpaint-live-preview-master-plan-2026-04-14.md`
2. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-1-stage-preview-layer-plan-2026-04-14.md`
3. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-2-immediate-pointer-preview-plan-2026-04-14.md`
4. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-3-committed-mask-contract-preservation-plan-2026-04-14.md`
5. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-4-inline-modal-parity-plan-2026-04-14.md`
6. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-5-validation-and-stop-rule-plan-2026-04-14.md`
