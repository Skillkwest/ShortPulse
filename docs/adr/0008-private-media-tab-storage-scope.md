# ADR 0008: Private Media Tab Storage Scope

## Status
Accepted

## Context
Media Library needed a dedicated **Private** tab for user-uploaded private images. Existing storage is already a private Supabase bucket (`media_library`) with per-user folder policies (`auth.uid()` first segment), and `media_files` drives tab filtering through the `source` field.

Adding a separate Supabase bucket would duplicate policies and signing logic across the app while not improving isolation beyond the existing per-user bucket policy.

## Decision
- Keep using the existing private `media_library` bucket.
- Reserve a dedicated folder namespace for private images: `<auth.uid()>/private/images/<filename>`.
- Add explicit `media_files.source = 'private_upload'` for Private tab rows.
- Constrain `media_files.source` to `upload | private_upload | ai_studio` via schema/migration so filtering stays deterministic.
- Enforce DB integrity checks so `private_upload` rows are image-only and always under `<auth.uid()>/private/images/...`.
- Treat Private tab uploads as image-only in UI.

## Consequences
- Positive:
  - Private uploads are explicitly isolated by both folder convention and row source.
  - No new bucket/policy surface to maintain; signed URL and RLS flow stays unchanged.
  - Tab filtering remains stable and queryable from `media_files`.
- Negative:
  - Path convention is app-managed (not enforced by storage policy beyond user prefix).
  - Existing deployments need migration `003_add_private_media_source.sql`.

## Alternatives considered
- New dedicated bucket (`media_library_private`): rejected due to duplicate policies and signing logic without stronger per-user guarantees than current RLS + private bucket.
- Folder-only split without new source value: rejected because tab filtering can drift when storage paths vary over time.
