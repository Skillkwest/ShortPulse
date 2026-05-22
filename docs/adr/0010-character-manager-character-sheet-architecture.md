# ADR 0010: Character Manager Character Sheet Architecture

## Status

Accepted

## Context

Character consistency is moving to a structured character-sheet workflow instead of LoRA training.  
The product needs an approachable character-management workflow that:

- Captures a fixed set of required reference shots.
- Produces deterministic, versioned character sheets for generation.
- Reuses existing media storage and billing paths safely.

Current constraints:

- `media_files.source` is constrained and must remain explicit for stable filtering.
- Fal submit routes are charge-gated and rely on idempotent request IDs.
- Storage and table access must remain user-scoped via RLS.

## Decision

- Introduce Character Manager as a first-class domain with five tables:
  - `characters`
  - `character_reference_packs`
  - `character_reference_images`
  - `character_quick_swap_items`
  - `character_generation_jobs`
- Use a structured required-reference intake for v1, with phased Character Sheet behavior.
- Keep generation inside the character workflow using Seedream edit submit/status flows.
- Extend `media_files.source` to include:
  - `character_reference`
  - `character_quickswap`
  - `character_generation`
- Treat warnings as non-blocking and hard errors as blocking for activation.
- Start with deterministic validation + manual guidance in v1 (no viewpoint classifier dependency).
- Enforce user isolation with composite FKs (`id, user_id`) and RLS on all new tables.

Implementation note:

- The active character workflow is now owned by AI Studio, with deprecated `/character` and `/character-soon` aliases redirecting into `/ai-studio`.
- Current character workflow behavior is governed by `docs/sops/sop_character_manager_operations.md`:
  - unlimited QuickSwap persistence per character (newest 500 active, overflow archived),
  - persisted Character Sheet drop-zone assignments and preset tabs used for generation wiring.

## Consequences

- Positive:
  - Deterministic and reproducible character sheets with version history.
  - QuickSwap deck scales beyond fixed-slot limits while preserving bounded active render work.
  - Cleaner separation between uploaded references and generated outputs.
  - Stronger data-safety guarantees with user-scoped relational constraints.
  - Minimal operational risk by reusing existing Fal charge/refund and storage infrastructure.
- Negative:
  - Adds schema complexity and migration ordering requirements.
  - Introduces new source values that downstream queries must account for.
  - Requires continued compatibility handling for deprecated `/character*` aliases while AI Studio remains the only live character-management surface.
- Follow-ups:
  - Add payload validation guardrails for Seedream edit submit.
  - Add Character Manager cost preview and insufficient-credit UX.
  - Evaluate optional extra references and auto viewpoint classification post-v1.

## Alternatives considered

- LoRA-based identity training as primary workflow: rejected for v1 due to slower UX and higher operational complexity.
- Flexible/unbounded Character Sheet required-shot uploads: rejected because deterministic preset zones are clearer for new users and improve consistency.
- Flexible/unbounded QuickSwap with bounded active archive: accepted for QuickSwap Deck while retaining deterministic Character Sheet preset zones.
- Keep all character metadata in client-only IndexedDB: rejected because management/versioning needs durable relational state with RLS.
