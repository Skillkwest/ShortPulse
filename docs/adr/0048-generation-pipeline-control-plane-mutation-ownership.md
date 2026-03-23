# ADR 0048: Generation Pipeline Control-Plane Mutation Ownership

- Status: Accepted
- Date: 2026-03-23
- Owners: AI Studio / Generation Runtime
- Related:
  - `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
  - `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
  - `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`

## Context
The generation pipeline accumulated multiple overlapping mutation surfaces across submit, queue polling, recovery, and fleet health:
1. `GET /api/fal/queue-status` could dispatch queued work and trigger recovery side effects.
2. Queue recovery and stale-reservation cleanup were split across dedicated recovery flows and optional fleet-health drainage behavior.
3. Transitional kick flags and manual recovery paths made it harder to reason about which surface was allowed to mutate generation state in steady state.

That shape increased regression risk. The pipeline needed clearer ownership so correctness fixes would reduce complexity instead of layering more patchwork on top of existing control paths.

## Decision
1. Submit paths own submit-time mutations only:
   - reserve credits
   - persist generation tracking
   - enqueue or dispatch upstream work
   - compensate when accepted work cannot be durably tracked
2. Status surfaces are read-only:
   - `GET /api/fal/queue-status` reports queue state only
   - user polling must not dispatch queued work or claim recovery
3. Recovery execution owns repair, retry, and cleanup:
   - the internal recovery runner is the steady-state mutation owner for generation repair and stale-reservation cleanup
   - request-id repair stays attached to explicit recovery paths, not polling surfaces
4. Fleet health remains observational in steady state:
   - fleet scans report and escalate
   - fleet drainage is not part of normal automated reconciliation
5. Transitional queue-status kick paths and runtime flags are retired once the read-only status contract is in place.

## Consequences
- Positive:
  - One owner exists for each mutation class, which lowers control-plane ambiguity.
  - Status polling is safe to call repeatedly and matches normal HTTP expectations.
  - Recovery behavior is easier to test because repair and cleanup stay on explicit worker paths.
  - Future reliability fixes have to fit the ownership model instead of adding new side-effect surfaces.
- Negative:
  - Manual user-facing kick behavior is no longer available as an escape hatch.
  - Operators must rely on explicit recovery entrypoints and observability instead of hidden status-side effects.
- Follow-ups:
  - Keep queue/recovery docs aligned with the read-only status contract.
  - Treat any new mutation surface in this pipeline as an ADR-level change unless it clearly belongs to the existing owners.

## Alternatives considered
- Keep `GET /api/fal/queue-status` with optional dispatch/recovery side effects.
  - Rejected: it hides mutations behind a polling surface and weakens ownership clarity.
- Keep fleet-health remediation active alongside the dedicated recovery runner.
  - Rejected: duplicate cleanup ownership increases drift and makes incident behavior harder to reason about.
- Preserve the queue-status kick lane as a permanent manual escape hatch.
  - Rejected: it leaves an unnecessary extra mutation surface after read-only queue status is established.

## Links
- `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
- `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_admin_user_health_fleet_operations.md`
