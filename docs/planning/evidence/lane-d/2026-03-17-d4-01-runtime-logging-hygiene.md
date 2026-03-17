# Lane D Evidence Packet: D4-01 Runtime Logging Hygiene

- `slice_id`: `D4-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
  - `frontend/features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `commands_run`:
  1. `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
  2. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
  3. `npm -C frontend run lint`
  4. `npm -C frontend run type-check`
  5. `npm -C frontend run check:architecture-boundary`
  6. `npm -C frontend run check:size-budget`
  7. `npm -C frontend run build`
  8. `npm -C frontend run docs:check`
  9. `npm -C frontend run test:adaptive-v2-gate`
- `results`:
  1. Canvas gesture debug logging now requires both:
     - the governed audit runtime perf flag (`PERF_FLAG_AUDIT_RUNTIME`)
     - the explicit local debug switch (`window.__shortpulseCanvasDebug`)
  2. Raw `window.__shortpulseCanvasDebug` no longer emits `console.log` noise by itself.
  3. Targeted canvas interaction coverage now asserts the ungated debug-switch path stays silent.
  4. Lane D validation bundle passed; strict runtime lint remains green with `0` errors and `2` baseline warnings.
- `warning_inventory_before_after`:
  - before:
    - `lint`: `2` warnings
    - strict runtime lint: `0` errors, `2` warnings
    - runtime console-noise candidates in Lane D scope:
      1. canvas gesture `console.log` behind raw `window.__shortpulseCanvasDebug`
      2. `perfProfileFlags.ts` invalid-env `console.warn`
      3. `videoUpload.ts` upload failure `console.error`
      4. explicit audit-runtime `console.log` calls in `useAiStudioPerfAuditRuntime.ts`
  - after:
    - `lint`: `2` warnings
    - strict runtime lint: `0` errors, `2` warnings
    - raw canvas gesture logging is now governed by the audit runtime lane
- `suppression_delta`:
  - no suppressions added
  - no suppressions removed
- `failure_modes_asserted`:
  1. Canvas double-click/detail fallback behavior still works while audit logging is disabled.
  2. Adaptive/reference-grid protection bundle remains green after canvas logging gate change.
  3. Production-noise reduction does not change user-visible canvas interaction behavior.
- `rollback_note`:
  - If canvas gesture diagnostics are needed during a controlled audit, enable the existing audit runtime lane and the explicit window debug switch together; no code rollback is required.
  - Retained logging surfaces intentionally left out of this slice:
    1. `frontend/features/ai-studio/logic/perfProfileFlags.ts` `console.warn` remains as invalid-env configuration signaling.
    2. `frontend/features/ai-studio/utils/videoUpload.ts` `console.error` remains as operational upload-failure logging.
    3. `frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts` remains audit-mode-only by design.
- `linked_pr`: `local lane-d slice`
