# ADR 0035: Media Library All Media Completeness And Preview Contract

- Status: Accepted
- Date: 2026-03-12
- Owners: AI Studio / Media Library

## Context
Two stability gaps remained in the AI Studio Media Library panel:
1. `All Media` image/video double-click preview parity regressed (no preview modal path).
2. Some legacy/private/generated storage objects existed in `media_library` bucket but had no corresponding `media_files` rows, so they could not appear in `All Media`.

Additional UX friction: root media pagination discoverability was weak when load-more was anchored to one section instead of the full `All Media` surface.

## Decision
1. Restore `All Media` double-click preview behavior for image/video cards as preview-only (no ingest side effects).
2. Move root media load-more controls to a single global `All Media` paginator footer with loaded-count visibility.
3. Add deterministic SQL drift + backfill governance:
   - Read-only diagnostics: `sql/check_media_all_media_completeness_drift.sql`.
   - Idempotent migration: `sql/migrations/064_backfill_media_files_from_storage_objects.sql`.
   - Target durable classes:
     - `<uid>/private/images/*` -> `private_upload` + `image`
     - `<uid>/uploads/images/*` + legacy `<uid>/images/*` -> `upload` + `image`
     - `<uid>/uploads/videos/*` + legacy `<uid>/videos/*` -> `upload` + `video`
     - `<uid>/generations/images/*` -> `ai_studio` + `image`
     - `<uid>/generations/videos/*` -> `ai_studio` + `video`
   - Explicit exclusions:
     - transient paths (`<uid>/images/reference/*`, `<uid>/videos/motion-control/*`)
     - character paths (`<uid>/characters/*`)
     - derivative/variant paths (`media_asset_variants`, variant-hint paths, and known variant classes)
4. Tag migration-inserted rows in `media_files.metadata` so rollback can remove only `064` inserts (`sql/migrations/rollback/064_backfill_media_files_from_storage_objects_rollback.sql`).

## Consequences
Positive:
1. Restores expected preview ergonomics without changing drag/ingest contracts.
2. Improves `All Media` pagination discoverability for large libraries.
3. Provides an auditable, repeatable, rollback-safe path to converge legacy completeness drift.

Tradeoffs:
1. Additional SQL operational step required per environment (diagnose -> migrate -> verify).
2. Backfilled `ai_studio` rows may not include historical `source_ref` linkage when unavailable.

## Links
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/sops/sop_media_library_ui.md`
- `sql/check_media_all_media_completeness_drift.sql`
- `sql/migrations/064_backfill_media_files_from_storage_objects.sql`
- `sql/migrations/rollback/064_backfill_media_files_from_storage_objects_rollback.sql`
