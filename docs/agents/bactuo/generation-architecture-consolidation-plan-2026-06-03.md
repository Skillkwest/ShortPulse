# Bactuo Generation Architecture Consolidation Plan

Status: active planning baseline; implementation not started

Last audited: 2026-06-03

Purpose: define the recommended architecture path for making ShortPulse generation, recovery, and settlement more cohesive without throwing away the current system foundations.

Current checkpoint: the current generation system has strong primitives and a real recovery/control-plane model, but too many surfaces are still allowed to decide identity, settlement, and visibility truth independently. The right next move is not endless patching and not a big-bang rewrite. The right move is staged consolidation around one shared generation kernel.

## Executive Verdict

The current system is salvageable, but it is not yet architecturally trustworthy enough to keep extending in its present fragmented shape.

Keep:

- Supabase-centered lifecycle, storage, and control-plane coordination
- `ai_generations`, `generation_attempts`, `ai_generation_outputs`, `generation_projection`, `generation_publications`, `ai_credit_reservations`, and `ai_credit_ledger`
- the shared recovery/control-plane model
- provider-specific edge integrations

Do not keep:

- multiple partial lineage resolvers with different fallback rules
- cross-provider identifier drift for the same conceptual fields
- success visibility before settlement truth is proven
- projection/publication behaving like primary state without explicit authority discipline

## Architectural Judgment

This system is not fundamentally bad. It is fundamentally under-consolidated.

The foundation is real:

- there is durable lifecycle state
- there is provider-attempt lineage
- there are canonical output records
- there is reservation plus ledger settlement authority
- there is an async recovery/control-plane path

The weakness is authority fragmentation:

- too many files reconstruct generation identity differently
- too many orchestrators own lifecycle ordering
- projection/publication writes happen from too many places
- direct-provider lanes and async-provider lanes do not fully share one contract

## Current Problems To Fix

### 1. Identity truth is fragmented

The same generation can currently be reconstructed through different partial sources depending on the caller:

- `generation_attempts`
- `generation_projection`
- `ai_generations.request_id`
- `ai_generations.metadata.provider_request_id`
- reservation metadata

This is the root cause under multiple recovery, ownership, abandonment, and admin-diagnostics misses.

### 2. Major identifiers do not mean one thing everywhere

`ai_generations.request_id` does not currently carry one stable meaning across provider families:

- async Fal/Kie lanes treat it like a provider request id
- direct OpenAI and ElevenLabs lanes treat it more like an app-side source/request id

That makes generic recovery and diagnostics more fragile than they should be.

### 3. Settlement and visibility ordering are not universal

Some success paths still allow canonical outputs, projection state, or user-visible success to appear before request-scoped settlement is durably converged.

That is an architectural trust problem, not just a local bug class.

### 4. Projection is operationally critical but not governed like a derivative read model

`generation_projection` and related publication state now carry product-critical behavior:

- status recovery
- ownership fallback
- project association
- visibility
- admin diagnostics

That means projection drift is closer to outage-class drift than cache-class drift.

### 5. Diagnostics do not fully share runtime truth

Admin trace, deep health reporting, runtime recovery, and billing repair do not all resolve generation lineage through the same contract. During incidents, that means the system can disagree with itself.

## Methods Considered

### Method 1: Keep patching the current shape

Benefits:

- lowest immediate disruption
- fastest local fixes

Why it loses:

- keeps fragmented authority in place
- increases fallback logic and provider-specific exceptions
- makes future incidents harder to explain and harder to repair cleanly

### Method 2: Big-bang rewrite

Benefits:

- cleanest design freedom
- easy to define a perfect contract on paper

Why it loses:

- highest production risk
- hardest parity problem
- likely to re-learn existing edge cases slowly and painfully

### Method 3: Database-first consolidation

Benefits:

- stronger transactional invariants
- better idempotency opportunities in RPC-controlled seams

Why it only partially wins:

- useful for selected invariants
- risky if too much business orchestration migrates into opaque SQL/RPC logic

### Method 4: Staged domain consolidation around a shared generation kernel

Benefits:

- keeps the current system's best primitives
- fixes the real disease, which is fragmented authority
- reduces risk by migrating caller-by-caller instead of rewriting the world
- can reuse already-good extracted helpers and reduce oversized orchestrators over time

Chosen method: Method 4.

## Core Invariants For The Consolidated System

These invariants should be frozen before implementation slices begin.

1. Every generation has one canonical lineage contract.
2. Every major identity field has one stable meaning across providers.
3. Terminal success cannot become user-visible before settlement truth is known.
4. Projection and publication are derivative outputs, not sole authority for ownership or settlement repair.
5. Recovery, billing, ownership, abandonment, and diagnostics all use the same lineage resolution rules.
6. Provider differences live at the adapter edge, not in the core convergence rules.

## Target Architecture

### Shared generation kernel

Build toward one shared domain kernel that all generation paths use.

Core modules:

1. `generationLineageResolver`
   - answers generation id, source ref, provider request id, attempt linkage, reservation linkage, and projection linkage
   - becomes the common authority for runtime logic and diagnostics

2. `generationTerminalConvergenceCoordinator`
   - owns terminal-state convergence across polling, webhook, recovery worker, and direct-complete providers
   - sequences lifecycle transition, settlement, output persistence, and final visibility sync

3. `generationSettlementCoordinator`
   - enforces one universal settlement ordering rule
   - exposes explicit capture/release outcomes and failure semantics

4. `generationVisibilityProjector`
   - derives projection/publication state only after lifecycle and settlement truth are established
   - narrows projection writes into one deliberate layer

5. provider adapters
   - Fal/Kie/OpenAI/ElevenLabs normalize external provider contracts into the same internal request/attempt/result model

### Existing surfaces likely to shrink

These are the current high-value orchestrators that should lose responsibility as the kernel hardens:

- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/generationProjection.ts`

Their long-term job should be orchestration and adapter work, not truth definition.

## Recommended Execution Sequence

### Phase 0: Freeze architecture truth

Outputs:

- this plan becomes the baseline
- a short invariant checklist is agreed as the no-regression contract for all later work

Success condition:

- future implementation slices can answer whether they improve or weaken the target architecture

### Phase 1: Build the canonical lineage resolver

Goal:

- stop letting runtime, billing, ownership, abandonment, and diagnostics all reconstruct identity differently

First migrations:

- `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`
- `frontend/lib/server/api/generationBilling/settlementService.ts`
- `frontend/lib/server/api/generationBilling/ownershipResolver.ts`
- `frontend/pages/api/admin/generation-trace.ts`
- `frontend/lib/server/adminUserHealth/deepReport.ts`

Why first:

- this is the highest-leverage architectural change in the whole system

### Phase 2: Normalize identifier semantics

Goal:

- define one internal meaning for:
  - internal generation id
  - source ref
  - provider request id
  - latest provider attempt id

Primary target:

- eliminate cross-provider ambiguity in `ai_generations.request_id` usage and related metadata fallback rules

### Phase 3: Centralize terminal convergence

Goal:

- create one shared terminal convergence path used by:
  - polling
  - webhook ingress
  - recovery worker
  - direct settlement

Primary rule:

- no route or worker should hand-roll terminal ordering once this coordinator exists

### Phase 4: Enforce settlement before visibility

Goal:

- make success visibility impossible before capture/release has actually converged

Primary targets:

- recovered success flows
- direct-complete provider flows
- final projection/publication sync

### Phase 5: Collapse projection sprawl

Goal:

- reduce the number of surfaces that write projection/publication state

Preferred outcome:

- one main visibility sync layer
- narrow, explicit exceptions only when the lane is truly view-local

### Phase 6: Unify diagnostics with runtime truth

Goal:

- make trace, health, and integrity checks speak the same lineage and settlement language as production logic

Why it matters:

- incident tooling that disagrees with runtime truth slows every recovery lane down

### Phase 7: Shrink oversized orchestrators

Goal:

- leave large route/runtime files as thin coordinators rather than state-definition hubs

This phase is cleanup only after shared kernel seams are already real.

## Migration Guardrails

1. Do not do a greenfield replacement.
2. Do not change provider behavior and architecture contracts in the same uncontrolled slice.
3. Do not widen one implementation pass across all phases.
4. Prefer caller migration onto shared seams over copying helper logic into new files.
5. Add targeted regression tests at each authority seam before deleting old logic.
6. Keep projection/publication behavior truthful during migration, even if temporary duplication is needed behind one canonical coordinator.

## What To Backlog Now

The backlog should treat this as one architecture-consolidation program with staged implementation slices, not as generic cleanup.

Best first backlog entry:

- build the canonical lineage resolver and migrate the highest-risk identity callers first

Why this is the best first slice:

- it directly addresses recovery misses, settlement repair misses, ownership ambiguity, abandonment asymmetry, and admin-trace disagreement

## Done Criteria

This architecture lane is only done when all of these become true:

- one shared lineage resolver is used across runtime and diagnostics
- cross-provider identity semantics are explicit and stable
- settlement-before-visibility is enforced across all provider families
- projection/publication writes are materially more centralized
- the main generation orchestrators have smaller, clearer authority
- operator tooling agrees with runtime truth during incident analysis

## Proof Before Claiming Success

Local proof:

- targeted generation, recovery, billing, abandonment, and diagnostics tests
- docs validation for plan/index/backlog changes

Decision-grade runtime proof for later implementation slices:

- production validation on `https://www.shortpulse.ai` where the claim depends on deployed behavior
- concrete incident/repair scenarios proving that runtime, billing, and diagnostics converge on the same answer

## Stop Condition

Stop an implementation slice when one of these becomes true:

- one shared kernel seam is in place and validated
- the next useful step broadens into a different architecture phase
- the remaining work is mostly cleanup, renaming, or aesthetic modularization rather than authority consolidation

Do not keep expanding this lane by momentum alone. The point is to make the system more trustworthy, not merely more subdivided.
