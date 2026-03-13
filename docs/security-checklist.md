# Security Checklist

Purpose: ensure user isolation and authenticated access across the Next.js app + internal API stack.

## Current expectations
- Supabase client uses persisted sessions and auto-refresh tokens.
- Frontend redirects authenticated sessions to the dashboard after sign-in/sign-up.
- SQL runbook reference: `docs/sops/sop_sql_migration_operations.md`.

## Required controls
- **RLS**: Enable Row-Level Security on Supabase tables; policies should enforce `user_id = auth.uid()` for select/insert/update/delete on user-owned tables (`saved_creators`, `media_files`, `media_prompts`, `media_folders`, `ai_generations`). Membership tables (`media_folder_media_items`, `media_folder_prompt_items`) should enforce user-scoped select/insert/delete. `media_events` allows select + insert only.
- **Billing tables**: Keep `billing_profiles`, `ai_credit_balance`, and `ai_credit_ledger` isolated per user (`user_id = auth.uid()`). Do not allow users to self-credit with positive ledger rows.
- **Client credit reads**: Query credit tables with an explicit per-user filter (`user_id = current user id`); never use unscoped fallback reads like `.limit(1)` on shared relations.
- **Ledger integrity**: Enforce credit underflow protection at the database layer so debits cannot push balances below zero.
- **Schema parity**: Keep `ai_credit_ledger` columns aligned with app expectations (`source`, `source_ref`, `metadata`, `created_by`) or run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` before enabling admin credit operations.
- **Reservation lifecycle**: Keep `ai_credit_reservations` + reservation RPC functions aligned with app expectations (run `sql/migrations/002_add_generation_credit_reservations.sql` before enabling production generation billing).
- **Provider request ownership**: Status/result proxy routes must only accept provider request IDs (`requestId`/`taskId`) when ownership is explicitly proven for the caller. Reject both cross-user IDs and unknown/untracked IDs; record provider request IDs at submit time (`markSubmitted`) so ownership checks are enforceable.
- **Webhook idempotency**: Persist Stripe event IDs (`stripe_event_log`) and skip duplicates before applying credits/subscription updates.
- **Webhook size limits**: Enforce bounded raw-body reads on webhook endpoints and return `413` for oversized payloads before signature parsing or downstream processing.
- **Safe webhook errors**: Do not expose internal transport/database error messages from webhook `500` responses; log internals server-side and return stable generic failures.
- **Describe-image host trust**: Enforce fail-closed trusted-host checks for `/api/ai/describe-image`; non-allowlisted external hosts must be rejected and only explicit allowlist entries (plus auto-trusted Supabase host) may pass.
- **Storage isolation**: Keep the `media_library` bucket private; require folder prefixes that start with `auth.uid()` (see `sql/storage_policies.sql`). Private tab uploads must stay under `<auth.uid()>/private/images/...`.
- **Media storage scope**: Keep `media_files.storage_path` constrained to `<user_id>/...` and shape-safe (`no ../`, no backslashes; run `sql/migrations/016_harden_media_storage_path_scope.sql` and `sql/migrations/017_harden_media_storage_path_shape.sql`) and reject out-of-scope paths in service-role media routes before signing or moving objects.
- **Media upload authority**: Prefer server-authoritative Media Library uploads (`/api/media/upload`) so destination/source classification and persisted row metadata are derived server-side from validated signatures, not client-declared MIME/classification fields.
- **Media folder ownership**: Folder CRUD and membership operations must reject root-id writes, enforce custom-folder UUID validation, and ensure all membership item ids are user-owned before assign/unassign (`/api/media/folders/*`, `/api/media/prompts/list`, `/api/media/list` folder filter path).
- **Media direct-preview trust**: Default-block external direct-preview hosts. Allow external direct fallback only when explicitly enabled (`SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`/`NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`) and host allowlisted (`SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS`/`NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS`). Keep Next image optimizer host usage constrained to trusted hosts only.
- **Media derivative worker boundary**: Keep `/api/internal/media-derivatives/run` cron-secret protected (`x-shortpulse-cron-secret` or bearer secret) and fail-closed when `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=false`; derivative claim/update RPCs (`claim_media_derivative_batch`, `mark_media_derivative_ready`, `mark_media_derivative_failed`) must remain `SECURITY DEFINER` with service-role-only execute grants.
- **Character table isolation**: Keep RLS enabled on `characters`, `character_reference_packs`, `character_reference_images`, `character_quick_swap_items`, and `character_generation_jobs` with strict `user_id = auth.uid()` policies (run `sql/migrations/008_add_character_manager_foundation.sql` and `sql/migrations/045_add_character_quickswap_deck.sql`).
- **Media source integrity**: Keep `media_files.source` constrained to `upload | private_upload | ai_studio | character_reference | character_generation | character_quickswap`, enforce non-null/default semantics, and keep private/character path checks aligned (run `sql/migrations/003_add_private_media_source.sql`, `sql/migrations/004_add_private_media_integrity_checks.sql`, `sql/migrations/007_harden_media_source_and_usage_rpc.sql`, `sql/migrations/010_harden_character_reference_media_integrity.sql`, and `sql/migrations/045_add_character_quickswap_deck.sql`).
- **Media usage aggregate**: Keep `get_media_library_usage_bytes()` available for authenticated users so usage UI can avoid partial totals from paged caches.
- **Frontend route protection**: Guard `/dashboard`, `/performance*`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/creator-studio`, `/character*`, and `/admin`; redirect unauthenticated users to `/auth`.
- **Key management**: Never expose the service-role key. Use only the anon key in the browser.
- **Secret exposure response**: If credentials are exposed in chat logs, temp files, or commits, rotate and replace affected keys immediately (staging then production), revoke old keys, and record incident evidence in `docs/planning/evidence/` and `docs/change_log.md`.
- **Network calls**: All Supabase requests already include the user’s JWT; avoid any other unauthenticated calls for user-owned data.
- **API auth boundary**: Require authenticated bearer tokens for provider proxy routes (`/api/fal/*`, `/api/ai/*`), media routes (`/api/media/*`), upload endpoints, billing routes, and admin routes (enforced in `frontend/proxy.ts`, with additional route-level guards where needed).
- **Route-level auth checks**: Keep `requireApiUser`/`requireAdminUser` in sensitive API handlers even when `frontend/proxy.ts` already guards the prefix, so auth still fails closed if middleware configuration drifts.
- **Autosave policy authority**: AI Studio recovery execution must read `user_preferences.media_autosave_enabled` at completion-time and skip background `media_files` persistence when preference is OFF; manual save remains allowed.
- **Preset panel preference isolation**: Expert Edit preset preferences persisted in `user_preferences.expert_edit_preset_panel_ids` and `user_preferences.expert_edit_custom_presets` (with legacy fallback reads from `expert_edit_preset_panel_labels`) must remain protected by `user_id = auth.uid()` RLS isolation and only be written through authenticated user context.
- **Styles library deletion preference isolation**: Styles Library deletions persisted in `user_preferences.ai_studio_deleted_style_ids` must remain protected by `user_id = auth.uid()` RLS isolation and only be written through authenticated user context.
- **Styles library details preference isolation**: Styles Library detail overrides persisted in `user_preferences.ai_studio_style_details_overrides` must remain protected by `user_id = auth.uid()` RLS isolation and only be written through authenticated user context.
- **Character QuickSwap tip preference isolation**: Character-panel QuickSwap guidance visibility persisted in `user_preferences.ai_studio_character_quickswap_tip_hidden` must remain protected by `user_id = auth.uid()` RLS isolation and only be written through authenticated user context.
- **Character client local persistence isolation**: Browser-local Character Manager persistence keys (selected character id and QuickSwap tip cache) must be namespaced by authenticated `user_id` to prevent cross-account leakage on shared browsers.
- **Token-first route auth**: `requireApiUser` must verify bearer identity server-side and must not authorize from `x-shortpulse-*` headers alone. Proxy headers are advisory metadata only after successful token verification.
- **Emergency auth fallback**: `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS` may be enabled only for short-lived incident recovery. Default must remain `false` in normal operation.
- **Admin boundary**: Restrict admin APIs to operator roles from `app_metadata` (`role`/`roles`) or explicit allow-listed admin emails. Do not trust `user_metadata` for admin authorization.
- **Dashboard announcement boundary**: Expose only active announcement reads to authenticated users (`/api/announcements/active` + active-row RLS policy) and keep publish/clear operations admin-only through server routes (`/api/admin/announcements/*`) using service-role DB access.
- **Conversation-state RPC hardening**: Keep `upsert_ai_agent_conversation_state` execute scope service-role-only, enforce bounded TTL/cap in DB logic, and run scheduled cleanup via `prune_ai_agent_conversation_state_expired`.
- **AI Studio session RPC hardening**: Keep session persistence RPCs (`upsert_ai_studio_session_snapshot`, `get_ai_studio_session_snapshot`, `list_ai_studio_sessions`, `prune_ai_studio_sessions_expired`) service-role-only with explicit `SECURITY DEFINER` search-path hardening and deterministic bounded prune semantics.
- **Agent safety control-plane RPC hardening**: Keep control-plane RPCs (`get_active_agent_safety_policy`, `activate_agent_safety_policy`, `rollback_agent_safety_policy`) service-role-only with `SECURITY DEFINER` posture; only admin APIs may invoke these via server-side service-role clients.
- **Runtime SQL RPC hardening audit**: Run `sql/check_runtime_sql_security_audit.sql` after migration/security updates and before release signoff; require `failing_checks = 0`.

## Validation
- Periodically test RLS with different users to confirm isolation.
- Manually verify unauthenticated visitors cannot reach gated routes and cannot list/upload media.
- Verify new-signup flow allocates the expected plan and initial credits.
- Verify Stripe webhook replay does not duplicate credit grants.
- Verify `/admin` credit adjustments succeed and ledger rows are created with expected attribution fields.
- Verify runtime SQL audit summary reports `failing_checks = 0` in staging for critical RPCs.
