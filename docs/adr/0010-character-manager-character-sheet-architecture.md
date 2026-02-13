# ADR 0010: Character Manager Character Sheet Architecture

## Status
Accepted

## Context
Character consistency is moving to a structured character-sheet workflow instead of LoRA training.  
The product needs a beginner-friendly Character Manager that:
- Captures a fixed set of required reference shots.
- Produces deterministic, versioned character sheets for generation.
- Reuses existing media storage and billing paths safely.

Current constraints:
- `media_files.source` is constrained and must remain explicit for stable filtering.
- Fal submit routes are charge-gated and rely on idempotent request IDs.
- Storage and table access must remain user-scoped via RLS.

## Decision
- Introduce Character Manager as a first-class domain with four tables:
  - `characters`
  - `character_reference_packs`
  - `character_reference_images`
  - `character_generation_jobs`
- Use a structured required-reference intake for v1, with phased Character Sheet behavior.
- Keep generation inside Character Manager using Seedream edit submit/status flows.
- Extend `media_files.source` to include:
  - `character_reference`
  - `character_generation`
- Treat warnings as non-blocking and hard errors as blocking for activation.
- Start with deterministic validation + manual guidance in v1 (no viewpoint classifier dependency).
- Enforce user isolation with composite FKs (`id, user_id`) and RLS on all new tables.

Implementation note:
- Current `/character` behavior is governed by `docs/sops/sop_character_manager_operations.md`:
  - up to 8 persisted reference uploads per character,
  - UI-only Character Sheet drop-zone assignments while generation wiring is phased in.

## Consequences
- Positive:
  - Deterministic and reproducible character sheets with version history.
  - Cleaner separation between uploaded references and generated outputs.
  - Stronger data-safety guarantees with user-scoped relational constraints.
  - Minimal operational risk by reusing existing Fal charge/refund and storage infrastructure.
- Negative:
  - Adds schema complexity and migration ordering requirements.
  - Introduces new source values that downstream queries must account for.
  - Requires route/doc synchronization when switching from `/character-soon` to `/character`.
- Follow-ups:
  - Add payload validation guardrails for Seedream edit submit.
  - Add Character Manager cost preview and insufficient-credit UX.
  - Evaluate optional extra references and auto viewpoint classification post-v1.

## Alternatives considered
- LoRA-based identity training as primary workflow: rejected for v1 due to slower UX and higher operational complexity.
- Flexible/unbounded reference uploads: rejected because fixed slots are clearer for beginners and improve consistency.
- Keep all character metadata in client-only IndexedDB: rejected because management/versioning needs durable relational state with RLS.
