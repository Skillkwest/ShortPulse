# Nuclo Memory

Purpose: keep repo-visible memory for Nuclo's version, environment, Vercel, and Supabase coordination work.

## Standing Preferences

- Formal name: Nuclo.
- Short name: Nuclo.
- Role: environment and version manager for the ShortPulse branch ladder, Vercel topology, and Supabase project wiring.
- Default posture: map first, mutate second.
- Branch ladder rule: `working-development` -> `staging-preview` -> `production`.
- Branch safety rule: keep `git config --local shortpulse.allowedBranch` aligned before branch-affecting work.
- Env rule: local env files are convenience surfaces, not deployed source of truth.
- Secret rule: never store or restate raw secret values in memory or reports.
- Supabase rule: use CLI-first hosted targeting and keep environment/database intent explicit.
- Vercel rule: verify preview/production state with direct evidence before recommending cutover.

## Durable Lessons

- 2026-05-08: Nuclo was established as the repo-visible environment/version manager identity with a dedicated contract, retained artifact area, and owned workspace folder.
- 2026-05-08: At Nuclo setup time, the repo was linked locally to Vercel project `shortpulse` through `.vercel/project.json`.
- 2026-05-08: At Nuclo setup time, the repo's local Supabase link pointed to project ref `jwmcytzyhcvacjwqtynn` (`ShortPulse`), while a separate hosted production project ref `ftgrqgjrchpimronuhop` (`ShortPulse – PRODUCTION – Live`) already existed.
- 2026-05-08: A live Vercel environment audit from this shell was blocked because no authenticated `vercel` credentials or `SHORTPULSE_VERCEL_API_TOKEN` were available.
- 2026-05-08: Nuclo should preserve the distinction between repo-visible contract docs, retained artifacts, and the top-level `nuclo/` workspace. The workspace is useful, but it is not higher authority than canonical docs.
- 2026-05-08: Once live credentials were available, direct inspection showed Vercel branch routing was mostly correct, but `Development`, `Preview`, and `Production` still resolved core Supabase runtime variables to the staging Supabase project.
- 2026-05-08: Direct production runtime inspection showed base URL envs were still pointed at the Vercel default domain instead of `https://www.shortpulse.ai`.
- 2026-05-08: The hosted production Supabase project existed but was not app-ready during live inspection; core app tables, auth users, and storage buckets were not yet present.
- 2026-05-08: GitHub protected `production`, but `staging-preview` lacked matching protection and should be hardened before the release ladder is treated as fully governed.
- 2026-05-08: Production Stripe secrets were unresolved or empty in Vercel during the live audit and must be treated as a release gate if live billing depends on them.
- 2026-05-08: Nuclo's current canonical retained plan is `docs/records/artifacts/agent/nuclo/reports/2026-05-08-environment-separation-and-production-cutover-plan.md`.
- 2026-05-08: The approved environment decision is local development plus `working-development` and `staging-preview` sharing staging Supabase, while `production` must move to the dedicated production Supabase project.
- 2026-05-08: Live production bootstrap work proved `docs/supabase_full_schema.sql` is materially behind staging `public` schema. It can seed part of a fresh project, but it is not sufficient for staging-parity bootstrap by itself.
- 2026-05-08: A direct staging-vs-production table diff is the fastest way to measure production bootstrap progress and should be preferred over assumption-based migration guessing during future cutover prep.
- 2026-05-08: Vercel `Production` and GitHub `production` must remain untouched until production database parity is materially closer to staging and the missing-table set is resolved.
- 2026-05-08: A custom-format `pg_dump`/`pg_restore` path succeeded in bringing the dedicated production project's `public` schema, routines, and policies to staging parity after resetting only the production `public` schema and excluding the dump's `CREATE SCHEMA public` entry.
- 2026-05-08: Once schema parity was achieved, direct row-count inspection showed the staging Supabase project is already carrying live runtime data, including auth users, billing profiles, projects, media files, generation history, worker history, and more than ten thousand storage object records.
- 2026-05-08: Because the live production app has been pointing at staging Supabase, production cutover is no longer a `schema/config only` problem. It is now a data migration, auth migration, and storage object migration problem.
- 2026-05-08: Storage bucket definitions can match while storage object blobs remain absent. Nuclo must treat `storage.objects` and actual object copy as separate cutover checks.
- 2026-05-08: Later same-day migration work seeded the dedicated production project with the core live database/auth footprint, including auth users, identities, sessions, refresh tokens, project data, media file data, generation data, and storage object metadata.
- 2026-05-08: A broad row-count comparison after the live-state seed showed only one database-side drift surface remaining: `public.worker_runs`, caused by continued writes on the staging-backed runtime during migration.
- 2026-05-08: The remaining high-risk cutover blocker is storage blob migration. The `media_library` bucket currently represents about `14 GB` of object payload across `10425` objects.
- 2026-05-08: Nuclo now has a dedicated ops toolkit under `scripts/ops/` for Vercel env audits, GitHub environment audits, Supabase schema parity, Supabase row-count drift, and storage metadata parity.
- 2026-05-08: Nuclo now has a canonical environment-ledger template at `docs/agents/nuclo/environment-ledger-template.md`, so future cutovers should start from a reviewed matrix instead of reconstructing fields from chat.
- 2026-05-08: `rclone` is already installed in this environment, and Nuclo now has a wrapper at `scripts/ops/supabase_storage_rclone_sync.sh` so the remaining blob migration can move onto a supported S3-compatible transfer path once S3 access keys exist for both Supabase projects.

## Open Follow-Ups

- Decide whether hosted development should remain local-only or eventually become a separate hosted Vercel project.
- Build the authoritative branch -> Vercel environment -> domain -> Supabase project environment ledger before any live cutover.
- Decide whether the dedicated production target should remain the current project ref `ftgrqgjrchpimronuhop` or be replaced by a fresh full-restore target.
- Copy storage blobs into the dedicated production project and verify object readability.
- Run a short freeze/final-sync pass for live-write tables before any production Vercel rewiring.
- Turn the retained cutover plan into an exact operator runbook with value slots, verification checkpoints, and rollback steps.
