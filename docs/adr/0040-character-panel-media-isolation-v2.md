# ADR 0040: Character Panel Media Isolation V2

- Status: Accepted
- Date: 2026-03-14
- Owners: AI Studio / Character Manager

## Context

Character panel uploads and drag-drop references have historically persisted into `media_files`, which couples Character Manager assets to Media Library behavior. This caused duplication, cross-surface leakage, and lifecycle complexity (folder membership/move/delete impacts on character-owned assets).

We need a no-regression path to isolate Character panel media without a broad platform rewrite.

## Decision

Adopt Character Media Isolation V2 with a minimal durable model:

1. Add one canonical character-owned asset table: `character_media_assets`.
2. Extend existing linkage tables (`character_reference_images`, `character_quick_swap_items`) with `character_media_id` while preserving legacy `media_file_id` compatibility reads.
3. Gate rollout with independent write/read flags:
   - `SHORTPULSE_CHARACTER_MEDIA_V2_WRITES_ENABLED`
   - `SHORTPULSE_CHARACTER_MEDIA_V2_READS_ENABLED`
4. Enforce containment on Media Library surfaces:
   - Exclude `<uid>/characters/%` rows from list APIs by default.
   - Reject character-scoped media ids in folder membership/move APIs.
5. Use copy semantics for internal Media Library/Reference Grid drops into Character Sheet/QuickSwap (no direct attach-by-`media_files.id` in V2).

## Consequences

### Positive

- Character panel assets become lifecycle-isolated from Media Library organization and deletion semantics.
- Duplicate/cross-surface drift risk is reduced by explicit character namespace ownership.
- Rollout is reversible via flags without immediate destructive cleanup.

### Tradeoffs

- Transitional dual-reference handling (`media_file_id` + `character_media_id`) increases short-term code path complexity.
- Backfill/diagnostics are required to validate migration completeness before legacy path removal.

### Operational Guardrails

- Keep containment filter enabled during rollout.
- Validate with `sql/check_character_media_isolation_backfill.sql` before forcing V2-read-only posture.
- Do not remove legacy compatibility columns/reads until fallback hit-rate is effectively zero.

## Implementation Notes

- Schema migration: `sql/migrations/068_add_character_media_assets_isolation.sql`
- Rollback companion: `sql/migrations/rollback/068_add_character_media_assets_isolation_rollback.sql`
- Diagnostics: `sql/check_character_media_isolation_backfill.sql`
- Media Library containment enforcement:
  - `frontend/pages/api/media/list.ts`
  - `frontend/lib/server/mediaFoldersService.ts`
  - `frontend/lib/server/mediaMoveService.ts`
- Character panel runtime flags:
  - `frontend/features/character-manager/logic/characterMediaIsolationFlags.ts`
