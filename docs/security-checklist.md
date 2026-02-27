# Security Checklist

Purpose: ensure user isolation and authenticated access across the Next.js app + internal API stack.

## Current expectations
- Supabase client uses persisted sessions and auto-refresh tokens.
- Frontend redirects authenticated sessions to the dashboard after sign-in/sign-up.
- SQL runbook reference: `docs/sops/sop_sql_migration_operations.md`.

## Required controls
- **RLS**: Enable Row-Level Security on Supabase tables; policies should enforce `user_id = auth.uid()` for select/insert/update/delete on user-owned tables (`saved_creators`, `media_files`, `media_prompts`, `ai_generations`). `media_events` allows select + insert only.
- **Billing tables**: Keep `billing_profiles`, `ai_credit_balance`, and `ai_credit_ledger` isolated per user (`user_id = auth.uid()`). Do not allow users to self-credit with positive ledger rows.
- **Client credit reads**: Query credit tables with an explicit per-user filter (`user_id = current user id`); never use unscoped fallback reads like `.limit(1)` on shared relations.
- **Ledger integrity**: Enforce credit underflow protection at the database layer so debits cannot push balances below zero.
- **Schema parity**: Keep `ai_credit_ledger` columns aligned with app expectations (`source`, `source_ref`, `metadata`, `created_by`) or run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` before enabling admin credit operations.
- **Reservation lifecycle**: Keep `ai_credit_reservations` + reservation RPC functions aligned with app expectations (run `sql/migrations/002_add_generation_credit_reservations.sql` before enabling production generation billing).
- **Provider request ownership**: Status/result proxy routes must only accept provider request IDs (`requestId`/`taskId`) when ownership is explicitly proven for the caller. Reject both cross-user IDs and unknown/untracked IDs; record provider request IDs at submit time (`markSubmitted`) so ownership checks are enforceable.
- **Webhook idempotency**: Persist Stripe event IDs (`stripe_event_log`) and skip duplicates before applying credits/subscription updates.
- **Storage isolation**: Keep the `media_library` bucket private; require folder prefixes that start with `auth.uid()` (see `sql/storage_policies.sql`). Private tab uploads must stay under `<auth.uid()>/private/images/...`.
- **Media storage scope**: Keep `media_files.storage_path` constrained to `<user_id>/...` and shape-safe (`no ../`, no backslashes; run `sql/migrations/016_harden_media_storage_path_scope.sql` and `sql/migrations/017_harden_media_storage_path_shape.sql`) and reject out-of-scope paths in service-role media routes before signing or moving objects.
- **Media upload authority**: Prefer server-authoritative Media Library uploads (`/api/media/upload`) so destination/source classification and persisted row metadata are derived server-side from validated signatures, not client-declared MIME/classification fields.
- **Media direct-preview trust**: Default-block external direct-preview hosts. Allow external direct fallback only when explicitly enabled (`SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`/`NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`) and host allowlisted (`SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS`/`NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS`). Keep Next image optimizer host usage constrained to trusted hosts only.
- **Character table isolation**: Keep RLS enabled on `characters`, `character_reference_packs`, `character_reference_images`, and `character_generation_jobs` with strict `user_id = auth.uid()` policies (run `sql/migrations/008_add_character_manager_foundation.sql`).
- **Media source integrity**: Keep `media_files.source` constrained to `upload | private_upload | ai_studio | character_reference | character_generation`, enforce non-null/default semantics, and keep private/character path checks aligned (run `sql/migrations/003_add_private_media_source.sql`, `sql/migrations/004_add_private_media_integrity_checks.sql`, `sql/migrations/007_harden_media_source_and_usage_rpc.sql`, and `sql/migrations/010_harden_character_reference_media_integrity.sql`).
- **Media usage aggregate**: Keep `get_media_library_usage_bytes()` available for authenticated users so usage UI can avoid partial totals from paged caches.
- **Frontend route protection**: Guard `/dashboard`, `/performance*`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/creator-studio`, `/character*`, and `/admin`; redirect unauthenticated users to `/auth`.
- **Key management**: Never expose the service-role key. Use only the anon key in the browser.
- **Secret exposure response**: If credentials are exposed in chat logs, temp files, or commits, rotate and replace affected keys immediately (staging then production), revoke old keys, and record incident evidence in `docs/planning/evidence/` and `docs/change_log.md`.
- **Network calls**: All Supabase requests already include the user’s JWT; avoid any other unauthenticated calls for user-owned data.
- **API auth boundary**: Require authenticated bearer tokens for provider proxy routes (`/api/fal/*`, `/api/ai/*`), media routes (`/api/media/*`), upload endpoints, billing routes, and admin routes (enforced in `frontend/proxy.ts`, with additional route-level guards where needed).
- **Route-level auth checks**: Keep `requireApiUser`/`requireAdminUser` in sensitive API handlers even when `frontend/proxy.ts` already guards the prefix, so auth still fails closed if middleware configuration drifts.
- **Token-first route auth**: `requireApiUser` must verify bearer identity server-side and must not authorize from `x-shortpulse-*` headers alone. Proxy headers are advisory metadata only after successful token verification.
- **Emergency auth fallback**: `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS` may be enabled only for short-lived incident recovery. Default must remain `false` in normal operation.
- **Admin boundary**: Restrict admin APIs to operator roles from `app_metadata` (`role`/`roles`) or explicit allow-listed admin emails. Do not trust `user_metadata` for admin authorization.
- **Conversation-state RPC hardening**: Keep `upsert_ai_agent_conversation_state` execute scope service-role-only, enforce bounded TTL/cap in DB logic, and run scheduled cleanup via `prune_ai_agent_conversation_state_expired`.

## Validation
- Periodically test RLS with different users to confirm isolation.
- Manually verify unauthenticated visitors cannot reach gated routes and cannot list/upload media.
- Verify new-signup flow allocates the expected plan and initial credits.
- Verify Stripe webhook replay does not duplicate credit grants.
- Verify `/admin` credit adjustments succeed and ledger rows are created with expected attribution fields.
