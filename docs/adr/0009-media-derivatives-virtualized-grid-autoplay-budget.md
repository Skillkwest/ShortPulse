# ADR 0009: Media Derivatives, Virtualized Grids, and Autoplay Budgeting

## Status
Accepted (February 12, 2026)

## Context
ShortPulse Media Library and AI Studio Reference Grid currently slow down under large media volumes due to:
- unbounded list retrieval and rendering,
- eager signed-URL generation,
- heavy image/video decoding at card level,
- and full-asset autoplay behavior in grid cards.

Product direction requires:
- near-instant media browsing at high library counts,
- preserved inline autoplay video UX in the Reference Grid,
- and strict Supabase private-storage + RLS isolation.

The optimization plan in `docs/planning/media-library-reference-grid-optimization-plan.md` selected a high-complexity architecture path. A durable architectural decision is needed before implementation.

## Decision
Adopt a derivative-first media delivery architecture with paged retrieval, virtualized rendering, and bounded autoplay:

1. Media variants
- Introduce derivative variants for listing/playback optimization (thumbnail, poster, preview-loop, playback tier).
- Keep original assets private and authoritative.
- Use variants for list/grid presentation; reserve originals for detail/download paths.

2. Retrieval model
- Replace full-table eager loading with cursor pagination.
- Sign URLs lazily for visible-window + prefetch buffer, not entire result sets.
- Cache signed URLs in bounded in-memory LRU keyed by storage path and expiry bucket.

3. Rendering model
- Virtualize Media Library grid, AI Studio Media Library modal grid, and Reference Grid.
- Use staged hydration (shell -> thumb/poster -> autoplay preview).

4. Autoplay model (required UX)
- Preserve autoplay in Reference Grid.
- Autoplay source uses lightweight preview-loop variant, not full original.
- Gate playback by viewport visibility and global decode budget.
- Pause/detach offscreen videos to prevent decoder/memory saturation.

5. Rollout and safety
- Deliver in phases with feature flags and kill switches.
- Backfill derivatives for existing assets.
- Keep existing auth and storage boundaries intact.

## Consequences
- Positive:
  - Substantially improved perceived and measured performance at high item counts.
  - Preserves autoplay UX without broad decode storms.
  - Reduces network/CPU costs for list and grid views.
  - Improves scalability for future media-heavy workflows.
- Negative:
  - Adds schema, pipeline, and operational complexity.
  - Requires migration/backfill sequencing and new observability.
  - Increases storage footprint because of derivative assets.
- Follow-ups:
  - Finalize schema and migration specs before writing SQL.
  - Define derivative generation runtime and job retry/dead-letter policy.
  - Establish SLO pass/fail gates and baseline instrumentation before rollout.
  - Update SOPs, schema docs, and security docs when implementation lands.

## Alternatives considered
- Option A: Query/render-only optimization (pagination + virtualization only).
  - Rejected: insufficient for heavy video decode/network costs at scale.
- Option B: Derivatives only with minimal retrieval/render changes.
  - Rejected: leaves unbounded UI and signing bottlenecks unresolved.
- Option C: Full architecture (selected).
  - Accepted for long-term performance and UX fidelity.
