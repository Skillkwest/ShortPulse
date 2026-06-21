# Bactuo Generation Source Map

Purpose: provide Bactuo's compact first-load map for generation lifecycle authority, recovery, settlement, and validation.

## Default Load Pack

Load these first for substantive Bactuo work:

- `docs/agents/bactuo/README.md`
- `docs/agents/bactuo/AGENTS.md`
- `docs/agents/bactuo/memory.md`
- `docs/agents/bactuo/standard-operating-procedure.md`
- this file

After this default pack is loaded, stop and define the lane before loading more context.

Do not load ownership docs, retained reports, training history, dated checkpoints, architecture plans, handoffs, old conversation, or deep code stacks by default unless the lane needs them.

## Conditional Control Surfaces

- `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
  - when the lane is about architecture posture, modularity, backlog planning, or phased consolidation work
- `docs/agents/bactuo/checkpoint-baseline-2026-06-17.md`
  - when the lane explicitly names the recovery/settlement or provider-runtime handoffs, or when reconciling dated checkpoint claims against current code

## Core Lifecycle Truth Stack

### Primary docs

- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/troubleshooting.md`
- `docs/data-dictionary.md`

### Core code owner paths

- Submit / accepted-running transition:
  - `frontend/lib/server/api/falSubmitProxy.ts`
- Status polling and direct terminal settlement:
  - `frontend/lib/server/api/falStatusProxy.ts`
  - `frontend/lib/server/api/directGenerationSettlement.ts`
  - `frontend/lib/server/api/falStatusPersistedResults.ts`
- Shared recovery and webhook ingress:
  - `frontend/lib/server/falIntegration/recoveryExecution.ts`
  - `frontend/lib/server/falIntegration/falWebhookIngress.ts`
  - `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`
- Billing settlement and ownership:
  - `frontend/lib/server/api/generationBilling/settlementService.ts`
  - `frontend/lib/server/api/generationBilling/ownershipResolver.ts`
- Terminal projection/publication sync:
  - `frontend/lib/server/api/terminalConvergenceViewSync.ts`
- Control-plane and observation/recovery workers:
  - `frontend/lib/server/generationControlPlane/`
- Direct-provider persistence:
  - `frontend/lib/server/openaiImageGeneration.ts`
  - `frontend/lib/server/elevenlabs.ts`
  - `frontend/pages/api/openai/image-generate.ts`
  - `frontend/pages/api/elevenlabs/text-to-speech.ts`
  - `frontend/pages/api/elevenlabs/music.ts`

## Table Authority Model

- `ai_generations`
  - lifecycle shell and status authority
- `generation_attempts`
  - provider-attempt lineage authority
- `ai_generation_outputs`
  - canonical output-slot authority
- `generation_projection`
  - server-owned read model for generation-facing UI state
- `generation_publications`
  - publication-facing visibility state
- `ai_credit_reservations`
  - pending financial authority for generation requests
- `ai_credit_ledger`
  - final financial history

## Invariants To Check First

When auditing a generation seam, answer these first:

1. What is the canonical internal identity for this generation?
2. What is the provider-attempt identity?
3. What state is authoritative for settlement?
4. What state is authoritative for user-visible success or failure?
5. Could any derivative state become visible before settlement or canonical outputs are proven?
6. Does this lane depend on `generation_attempts`, projection, or a single provider-specific identifier more than it should?

## Known Current Architectural Tension

- The system has strong primitives but fragmented authority.
- The biggest risk is multiple partial lineage resolvers that do not all agree on the same identity contract.
- Projection is operationally critical but should not become the only bridge for ownership, abandonment, or settlement.
- Cross-provider identifier semantics currently drift more than the architecture should tolerate.

## Validation Anchors

### Targeted test surfaces

- `frontend/lib/server/falIntegration/__tests__/`
- `frontend/lib/server/generationControlPlane/__tests__/`
- `frontend/lib/server/api/__tests__/directGenerationSettlement.test.ts`
- `frontend/lib/server/api/__tests__/generationBilling.settlementService.test.ts`
- `frontend/lib/server/api/__tests__/generationAbandonment.test.ts`
- `frontend/tests/api/admin-generation-trace.test.ts`

### Diagnostic surfaces

- `frontend/pages/api/admin/generation-trace.ts`
- `frontend/lib/server/adminUserHealth/deepReport.ts`
- `sql/check_generation_settlement_integrity.sql`

### Production proof reminder

Local tests and static inspection prove implementation behavior. They do not prove deployed production behavior on `https://www.shortpulse.ai`.
