# Reference Grid Reliability Evidence Packet: P0-S2 Not-Found Policy Parity

- slice_id: P0-S2
- date_utc: 2026-04-03
- phase: P0
- workstream: WG-1
- commands_run:
  1. `npm -C frontend run test -- features/ai-studio/hooks/taskSubmission/__tests__/queueStatusPolling.test.ts features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
- results: aligned active queued polling and resume-watchdog `not_found` handling behind one bounded retry + age gate; active polling no longer hands off to recovery before the recovery age window, and resume watchdog now transitions to recovery-pending once the same gate is met.
- risk_class: High
- rollback_note: revert the shared `queueStatusNotFoundPolicy` helper and restore prior per-path `not_found` handling in `queueStatusPolling.ts` and `useAiStudioTaskOrchestration.ts`.
- linked_pr_or_commit: working-tree (implementation + evidence slice)

## Scope
1. Replace divergent `not_found` heuristics between queued-submit polling and resume-watchdog polling with one shared policy.
2. Keep the browser thin by aligning to the existing two-minute recovery-age contract instead of adding a new queue-status API.
3. Leave server claim ownership unchanged; this slice only harmonizes when the client hands unresolved rows over to server recovery.

## Files
1. `frontend/features/ai-studio/hooks/taskSubmission/queueStatusNotFoundPolicy.ts`
2. `frontend/features/ai-studio/hooks/taskSubmission/queueStatusPolling.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
4. `frontend/features/ai-studio/hooks/taskSubmission/__tests__/queueStatusPolling.test.ts`
5. `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
6. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
7. `docs/planning/ai-studio-reference-grid-reliability-phase-p0-execution-plan-2026-03-21.md`
8. `docs/planning/evidence/ai-studio-reference-grid-reliability/README.md`

## Validation Results
1. Targeted validation:
   - `queueStatusPolling.test.ts` now proves active queued polling does not hand off on `not_found` before the age gate and does hand off after the combined retry + age threshold.
   - `useAiStudioTaskOrchestration.test.ts` now proves resume-watchdog behavior matches that same threshold model.
2. Pass/fail summary:
   - Pass. Both targeted suites are green after the parity change.

## Technical Notes
1. Added `QUEUE_STATUS_NOT_FOUND_MIN_AGE_MS = 120_000` to mirror the server-side recovery minimum-age posture used by queue recovery claim logic.
2. Active queued polling still uses bounded retries, but it no longer escalates after retry count alone.
3. Resume watchdog now tracks `not_found` counts per output so restored sessions no longer stay best-effort forever when the row has aged beyond the recovery handoff window.
4. This slice does not change queue-status route semantics, server reconciliation claim logic, or terminal-failure rules.

## task_contract_checklist
- [x] Concrete defect remained real in current code.
- [x] Diff stayed scoped to the `P0-S2` seam.
- [x] Targeted tests were updated before closeout.
- [x] Rollback posture is explicit.

## audit_findings
### blocking
1. None.

### non-blocking
1. Server claim-age and client handoff-age are aligned by shared constant value, not by a shared cross-runtime config source. If the server minimum-age flag changes materially later, this client policy will need a follow-up review.

### deferred
1. `P0-S3` recoverable-row retention remains the next unresolved WG-1 slice.

## follow_up_actions
1. Reassess `P0-S3` against the current code, because `P0-S1` appears to have been refactored away and `P0-S2` is now closed.
2. If `P0-S3` is still real, implement the smallest retention-window fix next.
3. If `P0-S3` is no longer real, publish a narrow reassessment packet instead of forcing a stale plan slice.
