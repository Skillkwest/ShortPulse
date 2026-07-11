# Next-Agent Handoff: Stripe Webhook Inbox And Financial Reconciliation

Lane id: `architecture-audit-01-stripe-webhook-inbox`

Status: ready after Lane 00 and a clean overlap check.

## Copy/Paste Assignment

Replace Stripe's insert/delete event claim with a durable leased inbox state machine and stop suppressing schema failures on required billing projections. Preserve all existing financial idempotency. Phase two may design refund/dispute reconciliation only after event ingestion is trustworthy.

## Required Context

Read first:

- `AGENTS.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/security-checklist.md`
- `docs/data-dictionary.md`
- billing ADRs under `docs/adr/0059*`, `0060*`, `0068*`, and `0069*`
- Stripe's current webhook retry and event-ordering documentation

Inspect first:

- `frontend/pages/api/billing/stripe/webhook.ts`
- `frontend/tests/api/stripe-webhook.test.ts`
- `frontend/lib/server/api/stripe.ts`
- `stripe_event_log`, billing contract, credit-ledger, and storage-entitlement schema/migrations

## Confirmed Problems

- The event row is inserted before business effects.
- Any existing event id is acknowledged as a successful duplicate.
- Processing failure relies on deleting the claim; failed deletion poisons future retries.
- `isIgnorableSchemaDriftError` treats missing required billing tables/columns/schema-cache entries as compatibility success.
- Refund/dispute event handling is absent, but its policy requires separate design for used credits and debt.

## Owned Write Surface

- `frontend/pages/api/billing/stripe/webhook.ts`
- focused Stripe webhook services extracted from that route
- Stripe event inbox migration and rollback
- `frontend/tests/api/stripe-webhook.test.ts` and new focused inbox tests
- billing SOP/data dictionary/security docs required by the change

## Avoid Surface

- generation provider submission/recovery
- model pricing formulas or UI pricing
- general subscription UI redesign
- automatic refund/dispute debits before an explicit policy is approved
- unrelated webhook providers

## Implementation Phases

### Phase 1: Inbox correctness

1. Persist states such as `received`, `processing`, `succeeded`, `retryable_failed`, and `terminal_failed`.
2. Store attempts, lease owner/token, lease expiry, last error, first/last received times, and completion time.
3. Atomically claim or reclaim retryable/stale work.
4. Acknowledge duplicates only when `succeeded` or when the current delivery is safely owned elsewhere.
5. Preserve ledger/source-reference idempotency for every monetary effect.
6. Narrow compatibility suppression to explicitly documented optional fields with telemetry and removal conditions.

### Phase 2: Reversal design

- Map refund/dispute events to original Checkout/payment/grant-lot identity.
- Define unused-credit reversal, used-credit debt/restriction, and appeal/support behavior.
- Do not implement this phase without an approved owner decision.

## Required Regression Sequence

1. First delivery claims successfully.
2. A business effect fails.
3. Claim cleanup/update also fails or the process dies.
4. A later Stripe retry reclaims/resumes instead of returning false duplicate success.
5. Eventual success produces each financial effect exactly once.

Also cover out-of-order subscription/invoice events, duplicate deliveries, stale leases, and required-schema failure.

## Acceptance Criteria

- No retained non-success event can be mistaken for completed work.
- Required billing projection failure returns retryable failure and is observable.
- Duplicate delivery cannot duplicate grants, contracts, storage add-ons, or ledger rows.
- The route becomes a thin verifier/dispatcher around the canonical inbox service where practical.
- Existing signature verification and raw-body limits remain intact.

## Validation And Proof

- Run the complete Stripe webhook suite plus new sequential-retry regressions.
- Run billing ledger/contract tests affected by projections.
- Run SQL security and migration parity checks for schema changes.
- Production closure requires a safe event-state readback or controlled replay evidence; local tests are implementation proof only.

## Stop Rules

- Stop if Lane 00 is unresolved for required schema.
- Stop before replaying or mutating real Stripe events without explicit approval.
- Stop rather than inventing refund policy.
- Do not broaden into entitlement resolver or generation settlement.

