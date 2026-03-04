# AI Studio Generation Queue Hardening Tracker (2026-03-04)

## Objective
Track implementation status for generation recovery + queue hardening with minimal drift.

## Status Legend
- `DONE`: implemented and validated.
- `IN_PROGRESS`: active implementation.
- `PENDING`: not started.

## Workstreams

### A) Shared capacity evaluator
- `DONE` Add `activeProviderCapacity.ts` helper.
- `DONE` Classify provider-attached reservations into active vs stale-ignored capacity buckets.
- `DONE` Return tier/global/tier-active and stale-ignored counters.

### B) Admission + dispatch wiring
- `DONE` Replace duplicate reservation count logic in `falSubmitProxy.ts`.
- `DONE` Replace duplicate reservation count logic in `generationQueue/dispatch.ts`.
- `DONE` Add stale-ignored telemetry events in admission and dispatch.

### C) Queue status determinism
- `DONE` Update queue-status service behavior so exhausted queue rows resolve as failed.
- `DONE` Keep queue-status response contract unchanged.

### D) Recovery cleanup automation
- `DONE` Add migration `054_add_provider_attached_stale_reservation_cleanup.sql`.
- `DONE` Add service-role execute grant posture for the new cleanup RPC.
- `DONE` Call cleanup RPC in `/api/internal/generation-recovery/run` behind runtime flag.
- `DONE` Aggregate cleanup metrics in existing response fields.

### E) Runtime flags
- `DONE` Add provider-attached cleanup flags in `falRuntimeFlags.ts`.
- `DONE` Add parsing/default tests in `falRuntimeFlags.test.ts`.

### F) Security/runtime audit alignment
- `DONE` Add new RPC signature to `sql/check_runtime_sql_security_audit.sql`.
- `DONE` Update `runtime-sql-security-audit-script.test.ts` required signatures.

### G) Tests
- `DONE` `generationQueue.dispatch.test.ts`.
- `DONE` `generationQueue.dispatch.integrity.test.ts`.
- `DONE` `fal-submit-proxy.test.ts`.
- `DONE` `fal-queue-status.test.ts`.
- `DONE` `internal-generation-recovery-run.test.ts`.
- `DONE` `falRuntimeFlags.test.ts`.
- `DONE` `runtime-sql-security-audit-script.test.ts`.

## Test Command Used
```bash
npm -C frontend run test -- \
  lib/server/api/__tests__/generationQueue.dispatch.test.ts \
  lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts \
  tests/api/fal-submit-proxy.test.ts \
  tests/api/fal-queue-status.test.ts \
  tests/api/internal-generation-recovery-run.test.ts \
  lib/server/api/__tests__/falRuntimeFlags.test.ts \
  tests/lib/runtime-sql-security-audit-script.test.ts
```

## Exit Criteria
1. No silent generate dead-click in eligible states.
2. Queued runs are not blocked indefinitely by stale provider-attached holds.
3. Exhausted queue rows resolve as failed deterministically.
4. Recovery route can reduce stale provider-attached hold pressure without manual SQL.
5. No public API contract drift.

## Follow-Up Monitoring Checklist
1. Track `telemetry.queue.dispatch.exhausted` volume.
2. Track `telemetry.queue.dispatch.capacity_stale_ignored` and `telemetry.api.fal_submit.capacity_stale_ignored` volume.
3. Validate cleanup release counts from `/api/internal/generation-recovery/run` remain bounded and trend down after incidents.
4. Keep manual SQL remediation as fallback only, not primary operations path.
