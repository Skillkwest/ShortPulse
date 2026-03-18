# ADR 0043: Generation Pipeline Shared Payload Contract And Queue Fail-Closed Boundaries

## Status
Accepted

## Context
AI Studio generation submit and queued dispatch had drift risk at three boundaries:
1. Submit routes could accept unknown top-level payload fields and pass them downstream to billing, queue persistence, and provider submission.
2. Queued payloads could drift away from current route/model expectations before dispatch, creating provider-facing ambiguity after persistence.
3. Queue dispatch safety checks existed, but payload and identity invariants were not enforced as one shared contract across submit and dispatch.
4. Residual claim collisions on `claim_generation_submit_queue_batch` could still surface as `23505`-shape failures under concurrent claim pressure.

These gaps increased the chance of hidden contract drift, unsafe retries, and hard-to-triage queue failures.

## Decision
1. Use one shared server-side payload contract for generation submit and queued dispatch.
2. Treat unknown top-level payload fields as invalid after allowlist completeness is covered per model family.
3. Use the shared projected payload, not raw request or queued payload bodies, as the canonical downstream payload for:
   - billing
   - queue persistence/dispatch
   - provider submission
4. Fail closed deterministically with explicit codes for boundary violations:
   - `GENERATION_PAYLOAD_CONTRACT_VIOLATION`
   - `QUEUE_PAYLOAD_CONTRACT_VIOLATION`
   - `QUEUE_IDENTITY_MISMATCH`
5. Enforce queue identity invariants across queue row, generation metadata, and reservation submission surfaces before allowing queued work to continue.
6. Reduce queue-claim collisions at two layers:
   - SQL source reduction with per-user advisory claim locks
   - one bounded application retry with jitter for residual `23505` dispatching-user collisions

## Consequences
- Positive:
  - Submit and dispatch now share one explicit payload boundary.
  - Unknown-field drift is rejected before billing or provider side effects.
  - Queue identity mismatches fail closed instead of falling through generic retry/error handling.
  - Queue claim collisions are reduced at the SQL source and bounded at runtime.
  - Operator runbooks can triage queue failures by deterministic codes instead of generic exceptions.
- Negative:
  - Payload contract changes now require model allowlist maintenance before enforcement can stay green.
  - Older queued rows that violate the contract will fail closed instead of being best-effort retried.
  - Claim hardening depends on migration promotion parity for full production effect.
- Follow-ups:
  - Keep SOP/operator guidance synchronized with any new queue failure codes.
  - Preserve the minimal-diff rule: future queue/runtime work should extend the shared contract, not add parallel validators.

## Alternatives considered
- Keep route-level validators only and avoid a shared contract.
  - Rejected: drift between submit routes and queued dispatch would remain likely.
- Allow unknown top-level fields and rely on provider-side tolerance.
  - Rejected: this weakens fail-closed guarantees and makes queue/runtime behavior less deterministic.
- Solve claim collisions only with application retries.
  - Rejected: source-level SQL contention reduction is higher value than retrying around the same race.
