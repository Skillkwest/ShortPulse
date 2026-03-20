# Architecture Decision Records (ADRs)

ADRs capture **important, durable decisions** so the repo stays coherent as it grows.

## When to write an ADR
- Introducing or removing a major dependency/tooling (e.g., test framework, state management).
- Changing architecture (e.g., client-only → backend, pages router → app router).
- New cross-cutting patterns (e.g., feature module conventions, data contracts).

## How to add one
1. Copy `TEMPLATE.md` to a new file: `NNNN-title-in-kebab-case.md`
2. Fill it out succinctly (1–2 pages is ideal).
3. Link it from `docs/README.md` if it changes how people work.

## Active inventory
- `docs/adr/0001-client-only-and-demo-data.md`
- `docs/adr/0002-media-library-persistence.md`
- `docs/adr/0003-admin-authorization-source.md`
- `docs/adr/0004-fal-failure-refund-settlement.md`
- `docs/adr/0005-ai-studio-modularization-boundaries.md`
- `docs/adr/0006-ai-studio-agent-api.md`
- `docs/adr/0007-ai-studio-agent-tooling-strategy.md`
- `docs/adr/0008-private-media-tab-storage-scope.md`
- `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`
- `docs/adr/0010-character-manager-character-sheet-architecture.md`
- `docs/adr/0011-character-sheet-terminology-policy.md`
- `docs/adr/0012-ai-studio-agent-runtime-hardening.md`
- `docs/adr/0013-reference-grid-bounded-work-architecture.md`
- `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md`
- `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`
- `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
- `docs/adr/0017-ai-studio-curated-reference-split-grid.md`
- `docs/adr/0018-adaptive-media-v2-modular-policy-and-surface-adapters.md`
- `docs/adr/0019-fal-modular-submit-retrieval-reliability.md`
- `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- `docs/adr/0022-reference-grid-domain-modular-architecture.md`
- `docs/adr/0023-ai-studio-naming-canonicalization-and-alias-sunset-policy.md`
- `docs/adr/0024-ai-studio-agent-prompt-only-single-stage-runtime.md`
- `docs/adr/0025-ai-studio-create-startup-model-precedence.md`
- `docs/adr/0026-ai-studio-generation-admission-control.md`
- `docs/adr/0027-ai-studio-reference-grid-reroll-replay-snapshot.md`
- `docs/adr/0028-agent-safety-control-plane-and-modality-profiles.md`
- `docs/adr/0029-ai-studio-reference-only-session-persistence.md`
- `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
- `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`
- `docs/adr/0032-ai-studio-media-library-target-ux-and-folder-canvas-domains.md`
- `docs/adr/0033-ai-studio-media-library-folder-canvas-persistence-and-gesture-v2.md`
- `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
- `docs/adr/0035-media-library-all-media-completeness-and-preview-contract.md`
- `docs/adr/0036-media-library-signed-preview-delivery-and-next-optimizer-bypass.md`
- `docs/adr/0037-media-library-supabase-first-derivative-worker-and-claim-rpcs.md`
- `docs/adr/0038-ai-studio-media-library-all-media-inline-tabs.md`
- `docs/adr/0039-media-library-transform-sunset-and-local-derivative-engine.md`
- `docs/adr/0040-character-panel-media-isolation-v2.md`
- `docs/adr/0041-foundational-modularization-governance-and-size-gates.md`
- `docs/adr/0042-ai-studio-properties-panel-workflow-contract.md`
- `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
- `docs/adr/0044-media-rendering-surface-delivery-policy-and-adr-reconciliation.md`
- `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
