# 2026-04-03 p2a reservation submit metadata trim

## slice_id
`p2a-reservation-submit-metadata-trim`

## date_utc
`2026-04-03`

## phase
`Phase 2A`

## surface
- `frontend/lib/server/api/generationQueue/dispatch.ts`
- `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`

## commands_run
- `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts`
- `npm -C frontend run docs:check`

## results
- Trimmed queued-submit reservation metadata down to the minimum repo-backed correlation field (`queue_id`) on the submit-success path.
- Removed duplicated hot-path reservation metadata fields that are already persisted on generation/attempt/telemetry surfaces:
  - `queue_dispatch_at`
  - `queue_attempts`
  - `submit_route`
  - `upstream_target_url`
  - `upstream_target_index`
- Locked the new reservation-submit contract with a dispatch integrity assertion.
- This is a safe local dispatch-tail cleanup, not a separate architecture change.

## failure_codes_asserted
- None added in this slice; existing queue dispatch failure-code coverage remains unchanged.

## contract_parity_delta
- Reservation submit still persists `provider_request_id` and queue correlation (`queue_id`) for submit-success ownership.
- Detailed dispatch lineage remains authoritative on:
  - `ai_generations.metadata`
  - `generation_attempts`
  - `telemetry.queue.dispatch.submitted`
- No repo consumers were found for the removed reservation metadata keys.

## rollback_note
- Re-add the removed metadata fields to the `markGenerationReservationSubmitted(...)` payload in `dispatch.ts` if a reservation-metadata consumer is introduced later.

## linked_pr
- None.

## task_contract_checklist
- Minimal diff: yes
- Validation run: yes
- Evidence captured: yes
- Docs/tracker/evidence parity: evidence packet + README updated

## audit_findings
- blocking: none
- non-blocking:
  - This slice reduces payload size and reservation JSON merge work, but it does not by itself prove a measurable end-to-end latency step change.
- deferred:
  - If Phase 2A continues, the next remaining ROI question is still whether authoritative claimed-item processing should stay serialized or move to a guarded bounded-concurrency model.

## parity_check
- `pass`
- Reservation-submit ownership and correlation remain intact.

## changelog_decision
- `deferred`
- Owner/date: `Codex / 2026-04-03`
