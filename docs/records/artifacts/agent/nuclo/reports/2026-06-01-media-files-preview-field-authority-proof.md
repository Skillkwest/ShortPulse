# 2026-06-01 Media Files Preview-Field Authority Proof

Purpose: capture Nuclo's read-only hosted production proof for Holomony's `media_files.preview_storage_path` handoff.

## Scope

- Date: `2026-06-01`
- Mode: inspection only
- Branch: `production`
- Requested by: Holomony
- Goal: prove whether production `media_files` preview authority is canonical variant/original fields or a missing `preview_storage_path` column

## Environment Checked

Hosted production Supabase target verified from two independent surfaces:

- deployed Vercel production env pull:
  - `NEXT_PUBLIC_SUPABASE_URL=https://ftgrqgjrchpimronuhop.supabase.co`
- hosted production database connection target:
  - sanitized DB host: `db.ftgrqgjrchpimronuhop.supabase.co`
  - database: `postgres`
  - relation presence:
    - `public.media_files`
    - `public.generation_projection`
    - `public.generation_publications`

Important note:

- local `.env.agent.local` currently contains a different `NEXT_PUBLIC_SUPABASE_URL` (`jwmcytzyhcvacjwqtynn.supabase.co`), so it is a stale local convenience surface and not the deployed production source of truth for this lane.

## Commands And SQL Used

Secrets redacted. Commands shown in shape only.

```bash
vercel env pull /tmp/nuclo-proof/prod.env --environment production
```

```bash
/opt/homebrew/opt/libpq/bin/psql "$SHORTPULSE_PRODUCTION_DB_URL" -Atc "
  select current_database(), current_user;
  select to_regclass('public.media_files');
  select to_regclass('public.generation_projection');
  select to_regclass('public.generation_publications');
"
```

```sql
select table_name, column_name, data_type
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

```bash
curl -H "apikey: [redacted]" -H "Authorization: Bearer [redacted]" \
  "https://ftgrqgjrchpimronuhop.supabase.co/rest/v1/media_files?select=id,preview_storage_path&limit=1"
```

```bash
curl -H "apikey: [redacted]" -H "Authorization: Bearer [redacted]" \
  "https://ftgrqgjrchpimronuhop.supabase.co/rest/v1/media_files?select=id,storage_path,thumb_variant_path,poster_variant_path,preview_variant_path,width,height,metadata&limit=1"
```

```bash
supabase db lint --db-url "$SHORTPULSE_PRODUCTION_DB_URL" --schema public --fail-on warning
```

## Result Table

| Proof question | Result |
| --- | --- |
| 1. Which hosted Supabase project/database did Nuclo verify? | Production app env and DB target both point to project ref `ftgrqgjrchpimronuhop`, database `postgres`. |
| 2. Does `public.media_files.preview_storage_path` exist? | No. |
| 3. Do canonical `media_files` variant/original fields exist? | Yes: `storage_path`, `thumb_variant_path`, `poster_variant_path`, `preview_variant_path`, `width`, `height`, `metadata`. |
| 4. Do `generation_projection.preview_storage_path` and `generation_publications.preview_storage_path` exist? | Yes. `full_storage_path` also exists on both tables. |
| 5. Does hosted PostgREST/schema-cache behavior reject selecting `media_files.preview_storage_path`? | Yes. Live production REST probe returned `HTTP 400`, `code 42703`, `message: column media_files.preview_storage_path does not exist`. |
| 6. Is there any evidence production is missing canonical media variant columns? | No. |

## Column Inventory Observed

Relevant production columns found:

- `media_files`
  - `id`
  - `storage_path`
  - `thumb_variant_path`
  - `poster_variant_path`
  - `preview_variant_path`
  - `width`
  - `height`
  - `metadata`
- `generation_projection`
  - `preview_storage_path`
  - `full_storage_path`
- `generation_publications`
  - `preview_storage_path`
  - `full_storage_path`

Relevant production column not found:

- `media_files.preview_storage_path`

## Hosted API Probe

Invalid production REST probe:

- request:
  - `GET /rest/v1/media_files?select=id,preview_storage_path&limit=1`
- result:
  - `HTTP 400`
  - `proxy-status: PostgREST; error=42703`
  - body:

```json
{"code":"42703","details":null,"hint":null,"message":"column media_files.preview_storage_path does not exist"}
```

Valid production REST probe:

- request:
  - `GET /rest/v1/media_files?select=id,storage_path,thumb_variant_path,poster_variant_path,preview_variant_path,width,height,metadata&limit=1`
- result:
  - `HTTP 200`
  - empty rowset was acceptable for the anonymous probe

Interpretation:

- hosted PostgREST behavior matches the SQL catalog result closely enough to explain the browser `400` errors without inventing a separate outage theory.

## Yes/No Answers

- Production `media_files` preview authority is canonical variant/original fields, not `preview_storage_path`: `yes`
- Hosted schema/cache is contributing beyond stale app-code selects: `no`
- Required next owner is Holomony app-code cleanup: `yes`
- Required next owner is Nuclo schema repair: `no`

## Owner Recommendation

Hand back to Holomony.

Recommended implementation direction:

- remove `media_files.preview_storage_path` selects from app/runtime paths
- route `media_files` preview authority through:
  - `preview_variant_path`
  - `poster_variant_path`
  - `thumb_variant_path`
  - `storage_path`
- keep `preview_storage_path` usage scoped to `generation_projection` and `generation_publications`
- do not add a new migration for `media_files.preview_storage_path`

## Residual Risk

Low for hosted schema truth. Moderate for app cleanup completeness.

Residual risks:

- multiple stale app callers may still exist beyond the first browser-visible failures
- local `.env.agent.local` has a stale public Supabase URL and could mislead future local-only audits if treated as deployed truth
- this proof did not mutate production, so it does not prove every stale caller has already been removed

## Validation

- `supabase db lint --db-url "$SHORTPULSE_PRODUCTION_DB_URL" --schema public --fail-on warning`
- result: `No schema errors found`
