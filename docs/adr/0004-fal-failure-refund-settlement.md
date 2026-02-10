# ADR 0004: Fal Failure Refund Settlement

## Status
Accepted

## Context
Fal generation charging is server-authoritative and occurs at submit time. Prior behavior auto-refunded only when submit transport or submit HTTP response failed. If the provider accepted submit but later failed during queue polling or result fetch, users could be left with a debit for a failed generation.

We need deterministic, retry-safe refund behavior for failed Fal generations without introducing double-refunds when the UI polls repeatedly.

## Decision
Implement a failure-settlement flow keyed by provider request id:

- Keep debit at submit in `generationBilling`.
- On successful submit, persist `provider_request_id` into charge metadata.
- Centralize Fal status handling in `falStatusProxy`.
- When status/result indicates definitive failure (failed/error state, content-policy rejection, malformed/failed result, or completed response without usable media), call an idempotent settlement helper that:
  - Finds the original charge by `(user_id, source='generation_charge', metadata.provider_request_id)`.
  - Inserts a matching `generation_refund` ledger row using the original `source_ref`.
  - Relies on the existing unique key `(user_id, source, source_ref)` so repeated polls cannot duplicate refunds.

## Consequences
- Positive:
  - Failed Fal generations converge to zero net debit.
  - Retry/poll races are safe (refund idempotency is enforced in DB).
  - One shared status proxy reduces route drift and keeps behavior consistent across models.
- Negative:
  - Charging still occurs at submit, so users may see a temporary debit before a later failure is refunded.
  - Legacy environments missing v2 ledger columns cannot use provider-request settlement until migrated.
- Follow-ups:
  - Consider a reservation/capture architecture if product requires “no temporary debit while pending”.
  - Add automated integration tests for submit-success + downstream-fail refund paths.

## Alternatives considered
- Option A: Refund only on submit failures.
  - Rejected because downstream provider failures still leave incorrect debits.
- Option B: Charge only on success.
  - Rejected for now because it can allow uncharged provider spend without a reservation layer.
- Option C: Full reservation/capture ledger design.
  - Deferred due larger schema/runtime changes and migration complexity.
