# ADR 0004: Fal Reservation/Capture Settlement

## Status
Accepted

## Context
Fal generation charging is server-authoritative. Prior behavior debited at submit and only auto-refunded on submit transport/reject failure. If provider accepted submit but later failed during queue polling or result fetch, users could be left with incorrect debits and temporary debit UX during running tasks.

We need deterministic, retry-safe refund behavior for failed Fal generations without introducing double-refunds when the UI polls repeatedly.

## Decision
Implement a reservation/capture flow keyed by provider request id:

- On Fal submit, reserve credits in `ai_credit_reservations` (no ledger debit yet).
- On successful submit, persist `provider_request_id` on reservation context.
- Centralize Fal status handling in `falStatusProxy`.
- Status settlement is idempotent:
  - Success with usable media: capture reservation to a `generation_charge` ledger row.
  - Failure/error/content-policy/malformed output: release reservation (no debit posted).
- Keep legacy-compatible fallback for in-flight/older rows that were already debited pre-reservation rollout.

## Consequences
- Positive:
  - Users are not debited while generations are running.
  - Failed Fal generations end with no posted debit.
  - Retry/poll races are safe (reservation + ledger idempotency in DB).
  - One shared status proxy reduces route drift and keeps behavior consistent across models.
- Negative:
  - Requires reservation migration rollout before fully active behavior.
  - Reservation-released jobs that later succeed upstream cannot be re-captured without extra reconciliation hooks.
- Follow-ups:
  - Add reconciliation worker for late upstream completions after client polling stops.
  - Add automated integration tests for submit-success + downstream-fail refund paths.

## Alternatives considered
- Option A: Refund only on submit failures.
  - Rejected because downstream provider failures still leave incorrect debits.
- Option B: Charge only on success without reservation.
  - Rejected because concurrent submits can exceed balance without a hold mechanism.
- Option C: Keep debit/refund model.
  - Rejected due temporary debit UX and avoidable refund churn.
