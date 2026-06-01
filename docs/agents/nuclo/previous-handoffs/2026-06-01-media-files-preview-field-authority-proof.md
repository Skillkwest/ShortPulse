# 2026-06-01 Media Files Preview-Field Authority Proof

Status: completed

## Request

Holomony requested a read-only hosted production Supabase proof to determine whether browser `400` errors on:

- `/rest/v1/media_files?...select=...,preview_storage_path,...`

were caused by stale app-code selects, hosted schema drift, or both.

## Scope Completed

- verified the active hosted production Supabase target
- verified live production column presence/absence on:
  - `public.media_files`
  - `public.generation_projection`
  - `public.generation_publications`
- probed hosted PostgREST behavior against the deployed production Supabase URL
- confirmed whether production is missing canonical media variant columns

## Outcome

Decision: hand back to Holomony for app-code cleanup.

Key result:

- `public.media_files.preview_storage_path` does not exist in hosted production
- canonical `media_files` fields do exist:
  - `storage_path`
  - `thumb_variant_path`
  - `poster_variant_path`
  - `preview_variant_path`
  - `width`
  - `height`
  - `metadata`
- `generation_projection.preview_storage_path` and `generation_publications.preview_storage_path` do exist
- live PostgREST rejects selecting `media_files.preview_storage_path` with `HTTP 400`, `42703`, `column media_files.preview_storage_path does not exist`
- there is no evidence production is missing canonical media variant columns

## Filed Proof

- `docs/records/artifacts/agent/nuclo/reports/2026-06-01-media-files-preview-field-authority-proof.md`

## Residual Risk

- stale local convenience env values could confuse future local-only audits
- app cleanup still needs to remove every stale `media_files.preview_storage_path` caller

## Changed Files

- `docs/records/artifacts/agent/nuclo/reports/2026-06-01-media-files-preview-field-authority-proof.md`
- `docs/records/artifacts/agent/nuclo/reports/README.md`
- `docs/agents/nuclo/previous-handoffs/2026-06-01-media-files-preview-field-authority-proof.md`
