# ADR 0020: AI Studio Server-Authoritative Generation Runtime V2

- Status: Accepted
- Date: 2026-02-20
- Owners: AI Studio Engineering
- Supersedes: `docs/adr/0019-fal-modular-submit-retrieval-reliability.md` (execution details)

## Context
AI Studio generation behavior drifted across routes, client hooks, and model-specific patches. Reliability incidents showed the same classes repeatedly:
- duplicated billing/persistence side effects under retries,
- stuck running states,
- terminal success without durable media,
- hard-to-replay recovery behavior.

The rollout must preserve existing `/api/fal/*` contracts and user-facing AI Studio UX while centralizing lifecycle authority server-side.

## Decision
Lock runtime V2 to one server-authoritative lifecycle behind current `/api/fal/*` contracts:

1. No new public page; existing AI Studio UI remains.
2. Server owns submit, retrieve/poll/webhook ingestion, normalization, persistence, settlement, recovery.
3. Client is thin: submit intent + render state only.
4. Single retry owner: server runtime only.
5. Strict lifecycle transitions enforced in one state machine boundary.
6. Idempotency keys/constraints on all side effects (submit, persist, settlement, replay/recovery claims).
7. Progressive canary by model family (Seedream first).
8. Hard rollout gates block merges on stuck-running, duplicate billing, or duplicate persistence regressions.

## Consequences
Positive:
- Deterministic retry semantics and reduced cascading failure risk.
- One settlement contract (`settleGenerationOutcome`) for terminal outcomes.
- Webhook-first completion with polling fallback.
- Clear operator controls for reconciler/replay and rollout flags.

Tradeoffs:
- Short-term migration complexity while legacy/client lifecycle code is retired.
- Requires strict migration discipline (schema convergence first, then fallback deletion).

## Required controls
- Runtime flags:
  - `SHORTPULSE_FAL_INTEGRATION_MODE=legacy|shadow|on`
  - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
  - `SHORTPULSE_FAL_WEBHOOK_ENABLED`
  - `SHORTPULSE_FAL_RECONCILER_ENABLED`
  - `SHORTPULSE_FAL_RECONCILER_*`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_*`
- Auth boundaries:
  - `/api/fal/webhook` is signature-verified webhook exception.
  - `/api/internal/generation-recovery/run` requires `x-shortpulse-cron-secret`.

## Rollback criteria
Revert to `SHORTPULSE_FAL_INTEGRATION_MODE=legacy` if any occur:
- duplicate capture/refund for the same provider request,
- duplicate media persistence for same generation output index,
- stuck-running SLA regression,
- unresolved terminal-no-media backlog growth beyond gates.
