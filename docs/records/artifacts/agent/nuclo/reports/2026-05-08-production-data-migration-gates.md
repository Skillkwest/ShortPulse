# Nuclo Production Data Migration Gates

Purpose: capture the decisive 2026-05-08 finding that the current staging Supabase project is already carrying live runtime data, which changes production cutover from a schema-bootstrap problem into a full data/auth/storage migration problem.

## Scope

- staging Supabase project ref `jwmcytzyhcvacjwqtynn`
- production Supabase project ref `ftgrqgjrchpimronuhop`
- no Vercel `Production` rewiring
- no GitHub `production` secret rewiring

## Decisive Findings

1. Production `public` schema parity is now materially achieved.
   - staging `public` table count: `82`
   - production `public` table count: `82`
   - staging and production `public` routine counts also match: `86`
   - staging and production `public` policy counts also match: `169`

2. Storage bucket metadata is aligned at the bucket-definition level.
   - staging bucket definitions: `media_library`
   - production bucket definitions: `media_library`

3. The current staging project already contains live runtime data.
   - `auth.users`: `10`
   - `public.billing_profiles`: `10`
   - `public.projects`: `8`
   - `public.media_files`: `2497`
   - `public.ai_generations`: `5564`
   - `public.worker_runs`: `200087`
   - `storage.objects` in `media_library`: `10425`

4. The current production project does not yet contain the corresponding live runtime data footprint.
   - `auth.users` remains absent or effectively empty for cutover purposes
   - `storage.objects` currently has no rows

## Later Same-Day Progress

Additional live migration work later on 2026-05-08 changed the state materially:

1. Database-side runtime data is now largely seeded into the dedicated production project.
   - production `auth.users`: `10`
   - production `auth.identities`: `10`
   - production `auth.sessions`: `181`
   - production `auth.refresh_tokens`: `657`
   - production `public.projects`: `8`
   - production `public.media_files`: `2497`
   - production `public.ai_generations`: `5564`
   - production `storage.objects`: `10425`

2. Broad row-count comparison across `public`, `auth`, and `storage` metadata now shows only one live drift surface:
   - `public.worker_runs`
   - staging count at verification time: `200547`
   - production count at verification time: `200457`

3. The residual `worker_runs` mismatch is attributable to live writes continuing on the staging-backed runtime during migration.

4. Storage metadata is now present in production, but the actual storage blobs have not been copied yet.
   - `media_library` object count: `10425`
   - total staged blob payload: about `14 GB`

## What This Means

The old assumption that production could cut over with `schema/config only` is no longer safe.

Because the live production app has been pointed at the staging Supabase project, the staging project is now the effective source of truth for:

- customer auth accounts
- application data
- billing-adjacent records
- generation history
- storage object references
- actual uploaded storage objects

Cutting Vercel `Production` over to the dedicated production Supabase project right now would still strand actual storage blobs, and minor live-write drift may continue until a final sync/freeze window is executed.

## Current Production Cutover Gates

Production cutover is blocked until all of the following are handled:

1. Database data migration
   - initial migration is largely complete
   - a final sync/freeze pass is still required for live-write drift surfaces such as `public.worker_runs`

2. Auth migration
   - initial migration is largely complete for the core live auth tables
   - final verification is still required after any final sync window

3. Storage object migration
   - migrate the actual files behind `storage.objects`
   - bucket metadata and object metadata are not sufficient
   - Supabase documents that storage file metadata lives in Postgres, but object blobs must be copied separately

4. Auth/runtime configuration parity
   - production auth site URL
   - redirect URLs
   - API/JWT settings as needed
   - note: if JWT secret changes, existing sessions become invalid

## Source Notes

Supabase primary guidance used for this conclusion:

- Auth migration: `https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects`
- Dashboard restore and object migration caveats: `https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore`
- Storage object migration caveats: `https://supabase.com/docs/guides/storage/management/download-objects`

## Safe Conclusion

Do not rewire:

- Vercel `Production`
- GitHub `production` `SUPABASE_DB_URL`
- live production domain traffic

until:

- final live-write drift is reconciled
- storage blobs are copied
- auth/runtime settings are verified against the dedicated production project

## Recommended Next Step

Keep the cutover plan in `live-state migration` mode.

Recommended order:

1. copy the actual `media_library` blobs into the dedicated production project
2. choose a short freeze/final-sync window for live-write tables
3. re-run row-count parity checks after the final sync
4. validate production file access against real objects, not just metadata
5. only then rewire Vercel and GitHub production configuration
