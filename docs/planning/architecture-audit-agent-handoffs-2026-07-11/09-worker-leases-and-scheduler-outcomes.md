# Next-Agent Handoff: Worker Leases And Scheduler Outcomes

Lane id: `architecture-audit-09-worker-leases-and-scheduler-outcomes`

Status: start after Lane 03 fixes durable generation execution identity. Design shared primitives; do not consolidate unrelated business logic.

## Copy/Paste Assignment

Create a reusable lease/fencing contract for recoverable workers and make scheduler outcomes truthful from schedule trigger through HTTP/business result. Apply it first to confirmed high-risk workers, preserving each domain's business rules.

## Required Context

Read first:

- `AGENTS.md`, worker/scheduler/operations docs, current SQL operations SOP
- Lane 03 command/execution identity contract
- current launch-week production operations and environment rules

Inspect first:

- generation recovery and stale-run workers
- derivative/media workers
- resident/leader workers
- provider-capacity admission/slot logic
- `pg_cron`, `pg_net`, cron-trigger routes, secrets, probes, and run ledgers
- credit-expiry and billing-renewal schedules

## Confirmed Problems

- Worker ownership patterns differ and may omit lease token, renewal, fencing, or stale-takeover guarantees.
- Provider capacity may be reserved separately from durable command/admission state.
- A scheduler can record enqueue success without proving the HTTP route or business operation succeeded.
- Important jobs need one explicit environment contract: enabled flag, secret, schedule, route, and probe.

## Owned Write Surface

- shared lease schema/primitive and bounded adapters
- selected worker claim/renew/complete/fail transitions
- provider-capacity slot reservation tied to command/reservation identity
- scheduler delivery/result ledger and probes
- credit-expiry/billing-renewal environment contracts
- focused concurrency, stale-takeover, and scheduler-result tests

## Avoid Surface

- generation command creation/provider ambiguity, owned by Lane 03
- rewriting domain-specific retry or billing rules
- one giant generic worker framework
- changing production schedules before read-only evidence and approval

## Required Lease Contract

1. Claim returns immutable lease token, attempt number, owner, and expiry.
2. Renewal and completion require the same live token.
3. Expired work can be reclaimed with a higher fencing generation.
4. A stale owner cannot commit after takeover.
5. Completion/failure is idempotent and records outcome evidence.
6. Leader workers renew continuously and lose mutation authority when renewal fails.
7. Capacity admission is atomic with the durable command/reservation that consumes it.

## Required Scheduler Contract

- distinguish schedule fired, network enqueue accepted, HTTP response, route authorization, business outcome, and probe/readback
- record correlation id, scheduled time, attempt, response class, business status, and retry disposition
- alert on missing execution as well as explicit failure

## Required Failure Tests

- two workers claim simultaneously
- lease expires during external call, then stale worker returns
- renew fails and leader continues attempting mutation
- scheduler enqueue succeeds but route returns 401, 500, timeout, or business no-op/failure
- capacity reservation races and command cancellation

## Acceptance Criteria

- Confirmed high-risk workers cannot double-commit after takeover.
- Scheduler dashboards do not equate enqueue with successful business completion.
- Each critical scheduled job has a documented and probeable environment contract.
- Existing business retry semantics remain domain-owned and tested.

## Validation And Proof

- Run database concurrency/fencing tests and focused worker tests.
- Inspect production schedules, secrets presence, route health, and ledgers read-only before mutation.
- For SQL, use Lane 00; deploy/schedule changes require separate authority.
- Report local, deployed, and observed-run evidence separately.

## Stop Rules

- Stop if Lane 03 execution identity is unresolved for a dependent worker.
- Do not change a live schedule or invoke a spend-capable job without approval.
- Do not claim success from `pg_net` enqueue alone.
