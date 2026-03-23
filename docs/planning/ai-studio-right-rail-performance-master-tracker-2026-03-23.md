# AI Studio Right-Rail Performance Master Tracker (2026-03-23)

Last updated: 2026-03-23  
Status: Active (`implementation_ready_scoped`)  
Owner: AI Studio Engineering  
Program doc: `docs/planning/ai-studio-right-rail-performance-master-plan-2026-03-23.md`  
Implementation entry checklist: `docs/planning/ai-studio-right-rail-performance-implementation-entry-checklist-2026-03-23.md`  
Readiness state: `docs/planning/ai-studio-right-rail-performance-readiness-state-2026-03-23.md`

## Status Legend
- `Planned`
- `In Progress`
- `Completed`
- `Blocked`
- `Optional`

## Program Snapshot
| Lane | Status | Current Focus | Stop Condition |
| --- | --- | --- | --- |
| Lane A Surface Contract | Completed | Keep target routing and duplicate ownership stable | New bugs or regressions only |
| Lane B Media Work Contract | Completed | Keep shared media resolution stable | New measured bottleneck only |
| Lane C Validation And Stop Gates | In Progress | Decide whether more implementation is justified | `RRP-M06` through `RRP-M08` complete |

## Master Tracker Rows
| ID | Task | Required | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| `RRP-M01` | Publish scope contract, tracker, checklist, readiness state, and ADR | Yes | Completed | This planning package | Scope and stop state are now explicit |
| `RRP-M02` | Right-rail target routing respects the intended surface | Yes | Completed | `a9bea956`, `8c261d92` | Rail Canvas, Quick Slot, and Reference Grid routing are the protected target surfaces |
| `RRP-M03` | Quick Slot owns duplicate-surface priority over All Refs | Yes | Completed | `bad386cf` | Ownership is centralized instead of re-derived per controller |
| `RRP-M04` | Shared media resolution is used by visible-card and hydration hot paths | Yes | Completed | `3f484597` | Shared resolver is now the hot-path source of truth |
| `RRP-M05` | Newly inserted right-rail image cards can paint without waiting for hydration completion | Yes | Completed | Current `ReferenceGrid` card-item behavior | First paint is no longer intentionally withheld behind hydration state |
| `RRP-M06` | Targeted tests cover routing, duplicate ownership, and shared media resolution | Yes | In Progress | Current targeted vitest coverage | Core suites exist; closeout should record the final required bundle explicitly |
| `RRP-M07` | Remaining right-rail work is profiled before more optimization is attempted | Yes | Planned | pending | This is the gate that prevents new patchwork |
| `RRP-M08` | Stop-state confirmed: only optional or profiling-driven work remains | Yes | Planned | pending | When complete, implementation for this scope stops |
| `RRP-O01` | Additional shell drag-session hint consolidation | No | Optional | pending | Only pursue with measured evidence |
| `RRP-O02` | Residual `useReferenceGridImageHydrationController` tuning | No | Optional | pending | Only pursue after profiling and only if ROI exceeds stopping |

## Current Required Validation Bundle
1. `features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
2. `features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridHydrationQueueController.test.ts`
3. `features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridResolvedMediaController.test.ts`
4. `features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridVideoLifecycleController.test.ts`
5. `features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
6. `features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts`

## Notes Log
### 2026-03-23
1. Locked the planning scope to AI Studio right-rail performance only.
2. Recorded the current repo-backed structural wins instead of treating the scope as open-ended optimization.
3. Explicitly separated required rows from optional rows so future implementation can stop cleanly.
