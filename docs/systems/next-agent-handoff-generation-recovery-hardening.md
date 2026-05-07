# Next-Agent Handoff: Generation Recovery / Settlement Hardening

Purpose: give the next agent one high-ROI, bounded task derived from the systems catalog.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not broaden into adjacent systems unless the stop rules are hit and the evidence demands it.

## Why this task

- Overall app rating is currently `6/10`.
- `Generation recovery / settlement` is the weakest high-value system in `docs/systems/catalog.md` at `4/10`.
- This system sits underneath `Create workflow`, `Edit workflow`, `Reference Grid`, and `Billing / credits`.
- Improvements here have a direct reliability payoff without requiring a broad product refactor.

## Scoped task

Investigate and harden `generation-recovery-settlement` with a narrow focus on terminal-state convergence and billing/publication invariants.

The goal is not a broad redesign.

The goal is to find the highest-value bounded hardening change in the recovery path and either:

1. implement it safely, or
2. produce a precise findings packet with the smallest defensible follow-up scope.

## In scope

- Accepted-job recovery after provider acceptance.
- Webhook and reconciler convergence into one terminal state.
- Settlement correctness:
  - reservation capture
  - reservation release
  - no-refund abandoned outcomes
- Projection/publication repair after recovery.
- Replay/recovery idempotency and provider-request linkage repair.
- Existing tests around recovery and billing settlement.

## Out of scope

- Create/Edit/Video/Sound surface redesign.
- Pricing control-plane changes.
- Provider catalog/model metadata changes.
- Media Library UX.
- General app-wide auth/security cleanup unless a concrete recovery bug requires it.

## Required context

Read these first:

- `docs/systems/catalog.md`
- `docs/operator-map.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_provider_incident_response.md`
- `docs/api/api-internal-routes.md`
- `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- `docs/adr/0026-ai-studio-generation-admission-control.md`

Inspect these code paths first:

- `frontend/pages/api/internal/generation-recovery/run.ts`
- `frontend/pages/api/admin/generation-recovery/replay.ts`
- `frontend/pages/api/fal/webhook.ts`
- `frontend/lib/server/generationControlPlane/runCycle.ts`
- `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/falIntegration/falWebhookIngress.ts`
- `frontend/lib/server/api/generationBilling/settlementService.ts`
- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationProjection.ts`

## Questions to answer

1. Can billing settlement and publication/projection state diverge for the same provider request?
2. Can webhook-driven convergence and reconciler-driven convergence produce inconsistent terminal outcomes?
3. Where is provider-request linkage repair most fragile?
4. Are abandoned/no-refund outcomes fully guarded against accidental refund or republish?
5. Which missing regression test would buy the most confidence for the least code change?

## Expected output

The next agent should leave behind:

- one bounded hardening change, or
- one findings summary with file/line references and a sharply reduced next scope

If a safe patch exists, prefer:

- targeted invariant hardening
- targeted test additions
- targeted observability/diagnostic improvement

Avoid broad refactors unless the bug cannot be fixed otherwise.

## Suggested validation

Run the smallest relevant checks for touched recovery/billing files, likely including:

```bash
npx vitest run \
  frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts \
  frontend/tests/api/generation-billing.reservations.test.ts \
  frontend/tests/api/generation-billing.pricing-params.test.ts
```

If docs change:

```bash
npm -C frontend run docs:check
```

## Stop rules

Stop and hand back when one of these is true:

- one meaningful hardening patch is complete and validated
- one concrete, high-confidence finding is isolated with evidence
- the next useful step would require broadening into a different system lane

Do not keep expanding from recovery into adjacent systems by momentum alone.

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.

## Current system snapshot

- `Generation recovery / settlement`: `4/10`
- `Generation submission / polling`: `6/10`
- `Billing / credits`: `6/10`
- `Create workflow`: `6/10`
- `Edit workflow`: `5/10`
- `Reference Grid`: `6/10`

Interpretation:

- recovery is the weakest shared runtime system
- it is a better hardening target than cataloging more low-confidence rows
