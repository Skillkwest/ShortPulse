# Bactuo Checkpoint Baseline - 2026-06-17

Purpose: freeze Bactuo's current source-of-truth baseline before working the recovery/settlement and provider-runtime handoffs.

## Executive Decision

Bactuo should not work the Copperknot handoffs as blind task lists.

The correct path is to treat the handoffs as evidence packets under Bactuo's own lifecycle authority. Current code, current tests, Bactuo's lifecycle invariants, and the active launch queue decide what is true now. Handoff claims are useful only after they are reconciled against those sources.

Current operational decision:

- Primary Bactuo lane: recovery, settlement, and output integrity.
- Secondary Bactuo lane: generation runtime and provider contract proof.
- First checkpoint: consolidate the Phase 1 lineage baseline and decide the next smallest authority fix before any broader provider-runtime work.

## Source-Of-Truth Order

Use this order when sources disagree:

1. Current root repo instructions and Bactuo instructions.
2. Current source code and current tests for the generation seam being changed.
3. The lifecycle truth model in Bactuo's source map.
4. Current Copperknot queue and board for launch priority and proof boundaries.
5. Current handoff packets as scoped evidence, not authority.
6. Older reports, retained artifacts, and prior chat as historical context only.

This means Bactuo may accept, narrow, reorder, or reject a handoff step when current code or lifecycle invariants show a better path.

## Current Phase 1 State

The architecture plan's old wording said implementation had not started. That is no longer current.

Current code already contains:

- `frontend/lib/server/api/generationLineageResolver.ts`
- resolver usage in:
  - `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`
  - `frontend/lib/server/api/generationBilling/settlementService.ts`
  - `frontend/lib/server/api/directGenerationSettlement.ts`
  - `frontend/lib/server/falIntegration/falWebhookIngress.ts`
  - `frontend/lib/server/api/falStatusPersistedResults.ts`
- resolver tests in `frontend/lib/server/api/__tests__/generationLineageResolver.test.ts`

Therefore Phase 1 is no longer "build the canonical lineage resolver from scratch." The current Phase 1 checkpoint is:

- verify the resolver contract,
- identify remaining high-risk identity callers that still hand-roll lineage,
- migrate only the smallest next caller set that improves recovery, settlement, or diagnostics truth,
- and stop before entering terminal-convergence or provider-runtime proof work by momentum.

Post-baseline slice completed on 2026-06-17:

- `generationLineageResolver` now treats `ai_generations.request_id` as lifecycle-shell evidence through the shared resolver contract.
- `generationBilling/ownershipResolver` no longer hand-rolls generation attempt plus `ai_generations.request_id` ownership lineage; it uses the shared resolver after reservation authority and before projection-only diagnostics.
- Strict recovery lookups that pass `includeProjection: false` remain attempt-only.
- `generationLineageResolver` now also owns caller-scoped `source_ref` lineage, using projection source-ref evidence before caller-owned `ai_generations.metadata.source_ref` fallback; `/api/generation/reconcile` no longer hand-rolls this source-ref resolution before delegating to recovery.
- Reference Grid visibility suppression now also resolves `source_ref` and `request_id` through the shared lineage resolver before suppressing projection/publication visibility; it still does not rewrite provider lifecycle, generation attempts, or settlement state.
- `/api/admin/generation-trace` now expands user-scoped `requestId` and `traceId` diagnostics through the shared lineage resolver before fanout, so admin trace lookup shares provider-request and source-ref fallback order without changing lifecycle, settlement, provider, or UI behavior.
- `/api/admin/user-health` deep-report assembly now recognizes `ai_generations.metadata.source_ref` as local lineage evidence before flagging generation charges as missing success linkage, matching the shared resolver source-ref fallback without adding new reads or changing settlement behavior.
- `/api/admin/user-health-fleet` scan assembly now scopes cost-without-success lineage maps by `user_id` plus identifier and recognizes `ai_generations.metadata.source_ref`, preventing another user's projection or raw identifier collision from hiding fleet risk.
- `generationOutputConvergence` now carries source-ref and provider-request identity into repaired projection rows when owned output-slot convergence attaches canonical media, so later restore and diagnostics can reuse the same projection lineage instead of relying only on output attachment metadata.

## Handoff Interpretation

### Recovery, Settlement, And Output Integrity

Source packet:

- `docs/agents/copperknot/handoffs/2026-06-03-recovery-settlement-output-integrity.md`

Bactuo decision:

- This is the higher-priority Bactuo lane because the current launch queue puts it first and because it controls user-visible success, request-scoped settlement, output persistence, and diagnostics trust.
- Its evidence proves substantial local source hardening, not production-convergent lifecycle trust.
- The next correct work is not a fresh audit from zero. Start from the existing resolver and settlement gates.

Primary unresolved questions:

- Should every future provider-request lineage lookup go through `generationLineageResolver` or a small extension of it?
- Which remaining diagnostics or health surfaces still hand-roll enough lineage to drift from runtime truth?
- Is a full terminal convergence coordinator required now, or can it wait until resolver governance is tighter?

### Generation Runtime And Provider Contract

Source packet:

- `docs/agents/copperknot/handoffs/2026-06-04-generation-runtime-provider-contract-audit.md`

Bactuo decision:

- This is valid Bactuo scope, but it should not outrank the recovery/settlement integrity lane.
- Treat provider-contract proof as dependent on the lifecycle baseline: provider adapters can be locally consistent while lifecycle truth is still under-consolidated.
- The refreshed handoff evidence matters: generated Fal/Kie submit/status modules are canonical route wrappers; `fal:routes:check` covers `17` route families; `validate` and `validate:phase11:fal-regression` now include route-wrapper drift checks.

Primary unresolved questions:

- Are active provider contracts locally consistent after the route-wrapper refresh?
- Which production-safe provider/env checks can be run without credits?
- Which provider smokes require explicit approval because they spend credits or call live providers?

## Acceptance Checklist For Next Implementation Slice

Before coding, the next Bactuo slice must answer:

- What exact caller or caller family is being migrated to shared lineage truth?
- What old lookup behavior will no longer be allowed to decide generation identity independently?
- What lifecycle truth does the change protect: recovery, settlement, output persistence, diagnostics, or visibility?
- What targeted tests prove the migrated caller uses the shared lineage contract?
- What is explicitly out of scope for this slice?

The slice is acceptable only if it:

- improves the current canonical lineage contract,
- avoids new duplicate resolvers or hidden fallback paths,
- preserves UI, UX, billing policy, provider behavior, and production env posture,
- uses targeted tests tied to the changed seam,
- and stops before broad provider-runtime proof, terminal-convergence coordinator work, or production generation smokes unless explicitly approved.

## Current Stop Boundary

This checkpoint baseline does not claim launch readiness.

It only establishes that Bactuo's next source-of-truth path is:

1. start from current code, not stale plan language;
2. treat the recovery/settlement handoff as the primary Bactuo continuation;
3. treat the provider-runtime handoff as a second, dependent proof lane;
4. finish Phase 1 by governing and migrating shared lineage truth before widening into terminal convergence or provider proof.
