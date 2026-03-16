# Lane A Evidence Packet: A1-03 AI Studio Size-Budget Recovery

date_utc: 2026-03-16  
slice_id: A1-03  
lane: A  
phase: A1  
owner: Engineering

## Scope
1. Recover `check:size-budget` for `frontend/pages/ai-studio.tsx` without behavior changes.
2. Keep Lane A scope limited to seam extraction (no product behavior or contract changes).
3. Preserve full validation parity after extraction.

## Files Updated
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts`

## Commands Run
1. `npm -C frontend run check:size-budget`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run test -- tests/pages/ai-studio.character-mode.test.tsx features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`
5. `npm -C frontend run validate`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `check:size-budget` | 0 | pass (global pass; reference-grid lane emits warn-mode notices only) |
| `lint` | 0 | pass with baseline warnings unchanged (`7`) |
| `type-check` | 0 | pass |
| targeted tests | 0 | pass (`2` files / `17` tests) |
| `validate` | 0 | pass (`412` files / `2615` tests) |

## Baseline Or Delta Notes
1. `frontend/pages/ai-studio.tsx` reduced from `1879` lines to `1181` lines.
2. Perf-audit runtime registration moved to `useAiStudioPerfAuditRuntime` with existing `window.__shortpulseAiStudioPerf` contract preserved.
3. No runtime API route contracts or payload contracts were changed.

## Rollback Note
1. Revert this slice commit to restore inline perf runtime logic if regression is detected.
2. Rollback is isolated to page/hook modularization only.

## Linked Plan Artifacts
1. `docs/planning/lane-a-master-plan-2026-03-16.md`
2. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
