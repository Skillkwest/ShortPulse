# Nuclo Current Handoff

Status: active

Date opened: 2026-06-01

Requester:

- Holomony, ShortPulse media display and right-rail media authority owner

## Handoff Title

Hosted Supabase proof for `media_files` preview-field authority

## Why Nuclo Is Being Asked

Production browser logs show repeated `400` responses from direct Supabase REST calls against:

```text
/rest/v1/media_files?...select=...,preview_storage_path,...
```

Holomony traced the app-code sources and found stale media-display paths querying `media_files.preview_storage_path`. Repo schema evidence indicates `preview_storage_path` is canonical for `generation_projection` and `generation_publications`, not for `media_files`.

This handoff is for Nuclo to verify hosted Supabase truth and environment posture before Holomony removes the stale app-code queries. This is an inspection/proof request, not a request to mutate production.

## Nuclo Scope

In scope:

- Verify the active hosted production Supabase project/database target.
- Verify whether `public.media_files.preview_storage_path` exists in hosted production.
- Verify the canonical `media_files` preview/delivery columns exist in hosted production:
  - `storage_path`
  - `thumb_variant_path`
  - `poster_variant_path`
  - `preview_variant_path`
  - `width`
  - `height`
  - `metadata`
- Verify `public.generation_projection.preview_storage_path` and `public.generation_publications.preview_storage_path` exist in hosted production.
- Check whether hosted API/schema-cache behavior matches the SQL catalog result enough to explain browser `400` errors.
- Report whether this is a Holomony app-code cleanup, a hosted schema/cache drift problem, or both.

Out of scope:

- Do not add `preview_storage_path` to `media_files` unless the user explicitly approves a new data-model decision after this proof.
- Do not run destructive SQL.
- Do not delete or backfill user media.
- Do not change storage objects.
- Do not deploy, promote, commit, push, or mutate Vercel/GitHub environment state as part of this handoff.

## Current Holomony Finding

Holomony's current root-cause read:

- The pasted console errors are not a generic Supabase outage.
- The errors are direct browser Supabase REST failures caused by selecting a non-canonical column from `media_files`.
- `media_files.preview_storage_path` is not present in repo schema sources:
  - `sql/create_media_library_tables.sql`
  - `sql/migrations/005_add_media_processing_and_variants.sql`
  - `docs/data-dictionary.md`
- `preview_storage_path` is present in repo schema for:
  - `sql/migrations/076_add_generation_projection_publication_and_observation_tables.sql`
  - `generation_projection`
  - `generation_publications`

Primary stale app-code callers Holomony plans to clean up after Nuclo proof:

- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
- `frontend/features/ai-studio/logic/videoPosterRepair.ts`
- `frontend/features/ai-studio/reference-ingestion/prepareLibraryMediaIngestionPayload.ts`
- `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
- server-side fallback paths in `frontend/lib/server/api/mediaDeliveryPaths.ts` and `frontend/lib/server/projectGenerationAssociationsService.ts`

## Requested Nuclo Proof

Run production-safe, read-only hosted checks and return a concise proof packet.

Minimum proof questions:

1. Which hosted Supabase project/database did Nuclo verify?
2. Does `public.media_files.preview_storage_path` exist?
3. Do the canonical `media_files` variant columns exist?
4. Do `generation_projection.preview_storage_path` and `generation_publications.preview_storage_path` exist?
5. Does hosted PostgREST/schema-cache behavior reject selecting `media_files.preview_storage_path`?
6. Is there any evidence that production is missing canonical media variant columns, or is this strictly stale app code?

Suggested read-only SQL shape:

```sql
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'media_files' and column_name in (
      'id',
      'storage_path',
      'thumb_variant_path',
      'poster_variant_path',
      'preview_variant_path',
      'width',
      'height',
      'metadata',
      'preview_storage_path'
    ))
    or (table_name in ('generation_projection', 'generation_publications')
      and column_name in ('preview_storage_path', 'full_storage_path'))
  )
order by table_name, column_name;
```

Optional read-only API/schema-cache probe:

```text
GET /rest/v1/media_files?select=id,preview_storage_path&limit=1
```

Expected result if Holomony's diagnosis is correct:

- SQL catalog has no `media_files.preview_storage_path`.
- SQL catalog has `media_files.thumb_variant_path`, `poster_variant_path`, and `preview_variant_path`.
- SQL catalog has `generation_projection.preview_storage_path` and `generation_publications.preview_storage_path`.
- PostgREST rejects `media_files.preview_storage_path` selection with a schema-cache or missing-column error.

## Decision Rules

If expected result is confirmed:

- Hand back to Holomony.
- Recommended implementation: remove all `media_files.preview_storage_path` selects and route `media_files` display authority through canonical variant/original fields.
- Do not create a Supabase migration for `media_files.preview_storage_path`.

If hosted production unexpectedly has `media_files.preview_storage_path`:

- Report drift against repo schema.
- Do not rely on the column as canonical without a user-approved data-model decision.
- Identify whether app 400s might instead be schema-cache, permissions, environment mismatch, or a different hosted project target.

If hosted production is missing canonical variant columns:

- Treat as a Nuclo Supabase schema/parity incident.
- Stop before mutation and propose the smallest forward repair plan with validation gates.

## Stop Condition

Nuclo is done when the proof packet can answer:

```text
Production media_files preview authority is canonical variant/original fields, not preview_storage_path: yes/no.
Hosted schema/cache is or is not contributing beyond stale app-code selects: yes/no.
Required next owner: Holomony app-code cleanup, Nuclo schema repair, or both.
```

## Reporting Format

Return:

- environment checked
- commands or SQL used, with secrets redacted
- concise result table
- yes/no answer for each minimum proof question
- owner recommendation
- residual risk

Do not include raw secrets, service-role keys, database passwords, bearer tokens, or raw user media data.
