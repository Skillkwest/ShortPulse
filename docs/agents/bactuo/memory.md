# Bactuo Memory

Purpose: keep concise, durable generation, recovery, and settlement truths and working rules for Bactuo.

## Current Contract Truths

- ShortPulse is currently one human owner/operator supported by named AI agents. Bactuo is a bounded AI authority surface for generation, recovery, and request-scoped settlement, not evidence of a larger human team.
- Pre-launch Bactuo work stays on local `production` with `shortpulse.allowedBranch=production`; launch-relevant browser/manual validation uses `https://www.shortpulse.ai` unless the user explicitly asks otherwise in the current thread.
- The core lifecycle chain is split across `ai_generations`, `generation_attempts`, `ai_generation_outputs`, `generation_projection`, `generation_publications`, `ai_credit_reservations`, and `ai_credit_ledger`.
- `ai_generations` is the lifecycle shell, not the whole truth of a generation.
- `generation_attempts` is provider-attempt lineage and should not be the only bridge the system can use to recover ownership or settlement authority.
- `ai_generation_outputs` is the canonical output-slot surface; projection and publication are user-facing read models on top of that truth.
- `generation_projection` behaves like product-critical state in practice, but it should still be treated as derivative state, not the only identity bridge.
- Request-scoped generation settlement is part of the generation lifecycle. It is not optional post-processing.
- The current architecture has strong primitives but fragmented authority. The main risk is not missing tables; it is too many partial truth resolvers.
- As of the 2026-06-17 checkpoint, Phase 1 canonical lineage work is partially implemented; start from `docs/agents/bactuo/checkpoint-baseline-2026-06-17.md` before working the recovery/settlement or provider-runtime handoffs.

## Working Rules

- Start from the source map, then inspect only the specific seam needed for the lane.
- Treat generation architecture questions as invariants questions first:
  - what is the canonical identity,
  - what is the canonical settlement order,
  - what state may become visible before another state is proven,
  - what surfaces are derivative versus authoritative.
- When explaining a generation outcome, separate what is:
  - lifecycle truth,
  - output truth,
  - billing truth,
  - view-state truth,
  - and inferred behavior not yet directly validated.
- When expressing confidence, use one stable frame that distinguishes repo-backed, test-backed, and production-backed certainty without making the recommendation itself sound unstable.
- For launch-relevant generation claims, production URL evidence outranks local inspection. Local code and tests are still valid implementation evidence.
- Follow `docs/agents/solo-owner-launch-trust-standard.md` for launch-relevant generation, recovery, settlement, or output-visibility claims.
- Bactuo ownership boundaries live in `docs/agents/bactuo/ownership-manifest.md`; use it before crossing into pricing policy, security, environment, media-display, or project-persistence lanes.
- Durable learning belongs here or in `docs/records/artifacts/agent/bactuo/`, not in chat alone.
- Do not carry prior incident narratives as active truth into a new generation lane. Start from current code, current docs, current tests, and current production evidence; load old reports only when the current proof question names that history.

## Common Drift To Reject

- "Generation visibility can lead settlement." False as a target architecture, even when current code still allows it.
- "Projection is the system of record." False; projection is operationally important but still derivative.
- "A missing `generation_attempts` row means the generation is missing." False.
- "One identifier field can safely mean different things by provider family forever." False if recovery, diagnostics, and settlement are meant to stay coherent.
- "More fallback resolvers are the same as a better architecture." False; fragmented recovery logic usually increases drift.
