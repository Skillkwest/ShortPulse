# Next-Agent Handoff: Durable Generation Command

Lane id: `architecture-audit-03-durable-generation-command`

Status: overlap-gated. Current work modifies `falSubmitProxy.ts`, generation controllers, task submission, pricing evidence, and new generation-ownership SQL.

## Copy/Paste Assignment

Make one durable ShortPulse generation command the authority before provider mutation. Prevent duplicate provider execution after ambiguous responses, resume unfinished provider webhook receipts, and make recovery topology provider-specific. Do not redesign UI output materialization or pricing.

## Required Context

Read first:

- `AGENTS.md`
- `docs/systems/next-agent-handoff-generation-recovery-hardening.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_provider_incident_response.md`
- `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- `docs/adr/0026-ai-studio-generation-admission-control.md`
- `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
- `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`

Inspect first:

- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/falIntegration/submitEngine.ts`
- `frontend/lib/server/falIntegration/falWebhookIngress.ts`
- `frontend/lib/server/generationControlPlane/`
- generation attempt/projection/observation schema and tests
- current migrations `224+` and their active diffs before proposing new schema

## Confirmed Problems

- Credit/source idempotency can return `already_reserved` and still proceed toward provider submission.
- Fal/Kie submission retries selected transport/HTTP failures without provider execution idempotency.
- Provider submission can occur before durable generation/attempt identity is committed.
- Duplicate Fal webhook receipt can return success without resuming an unfinished `received` record.
- Recovery policy and endpoint reconstruction can diverge from provider-specific interactive status authority.

## Owned Write Surface

- generation command/attempt/dispatch services
- Fal/Kie submit engine and webhook inbox
- generation control-plane recovery policy and endpoint storage
- directly related schema/migrations and tests
- generation recovery/operator docs required by the final contract

## Avoid Surface

- AI Studio view-model/rendering files unless an unavoidable minimal contract change is approved
- pricing formulas/display policy
- Stripe webhook/billing entitlement logic
- Media Library UX and signed cache
- broad provider-family rewrite

## Required Architecture

1. Create the durable command and attempt in `dispatching` before external POST.
2. Make `source_ref` or an explicit command id the execution identity.
3. Duplicate command requests return the existing command state; they do not submit again.
4. Do not automatically repeat ambiguous provider POSTs unless the provider supports a stable idempotency key.
5. Persist provider request id and returned status/result/cancel endpoints with the attempt.
6. Transition dispatch state using compare-and-swap/attempt identity.
7. Webhook receipt uses durable claim/resume semantics and converges through shared recovery execution.
8. Recovery allowlists and endpoint policy are provider-specific.

## Required Failure Tests

- Process dies after durable command but before provider request.
- Provider accepts request but response is lost.
- Client repeats the same command/source reference.
- Provider webhook is stored, process dies, duplicate webhook arrives.
- Provider endpoint/config changes after submission.
- Stale worker tries to finalize a newer attempt.

## Acceptance Criteria

- One user command cannot create two provider jobs through application retry.
- Every provider job has a previously committed ShortPulse command/attempt identity.
- Recovery can resume from durable state without reconstructing identity from client memory.
- Billing reservation remains exactly-once and is attached to the canonical command.
- Existing terminal-state and no-refund guards remain intact.

## Validation And Proof

- Run complete Fal/Kie submit, billing reservation, generation attempt, webhook ingress, recovery, projection, and settlement suites affected by the contract.
- Add executable SQL concurrency tests when schema claims/CAS are introduced.
- Run architecture boundaries and model route parity.
- Production proof must use safe trace/readback or an approved non-spend canary; do not trigger provider spend without authorization.

## Stop Rules

- Stop if overlapping generation/pricing work is active.
- Stop before provider-spend tests.
- Stop rather than inventing provider idempotency support.
- Do not absorb generic worker leases; Lane 09 consumes this lane's command identity.

