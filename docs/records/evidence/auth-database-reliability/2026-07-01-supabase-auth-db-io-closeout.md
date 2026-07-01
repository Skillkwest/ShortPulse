# Supabase Auth And Database I/O Reliability Closeout

Date: 2026-07-01

## Scope

This evidence note covers the discovered Supabase/auth/database issues from the June 30/July 1 incident thread:

1. Google OAuth handoff can expose a raw Supabase/Cloudflare outage page to customers.
2. Supabase Disk I/O budget pressure is driven by a small set of database and scheduler hot paths.

This note is not a second source of implementation authority. The source of truth remains the code, SQL, docs, live database state, and validation commands listed below.

## Owner And Lane

- Active lane: ShortPulse auth/Supabase/database reliability.
- Active owner: solo-owner ShortPulse implementation lane.
- Out of scope: AI Studio generate CTA behavior, model-catalog governance, unrelated full-suite test drift, mobile-specific UX, billing/credit semantics, release/deploy/commit/push state.

## Protected Contracts

- Preserve the existing `/auth`, `/sign-up`, and `/log-in` user flow and safe internal `next` redirect handling.
- Keep Google OAuth account selection behavior and do not use local email/password form values as OAuth account hints.
- Do not expose Supabase service-role credentials or raw user data.
- Do not add duplicate auth authorities, legacy routes, or fallback OAuth providers.
- Keep database changes narrow: index existing hot predicates and prune Supabase Cron history without changing application table semantics.
- Preserve rollback paths for schema index changes.

## Issue 1: Google OAuth Handoff Outage UX

Source of truth:

- `frontend/pages/auth.tsx`
- `frontend/pages/api/auth/oauth-handoff-preflight.ts`
- `frontend/tests/pages/auth.route-behavior.test.tsx`
- `frontend/tests/api/auth-oauth-handoff-preflight.test.ts`
- `README.md`
- `docs/routes.md`
- `docs/api/api-internal-routes.md`
- `docs/sops/sop_auth_recovery_trust_smoke.md`

Source fix:

- `/auth` now requests a Supabase OAuth authorize URL with `skipBrowserRedirect: true`.
- Before leaving ShortPulse, `/auth` posts that URL to `/api/auth/oauth-handoff-preflight`.
- The preflight route only accepts the configured HTTPS Supabase origin, path `/auth/v1/authorize`, and `provider=google`.
- The preflight route performs a short server-side no-redirect fetch and returns a customer-facing temporary-unavailable response on upstream outage or timeout.
- The browser redirects to Supabase only after the preflight succeeds.

Validation proof:

- `npm run test -- --run tests/pages/auth.route-behavior.test.tsx tests/api/auth-oauth-handoff-preflight.test.ts tests/pages/dashboard.announcements.test.tsx tests/api/error-logging-coverage.test.ts`
- `npm run build`
- Production probe on 2026-07-01 returned `404` for `/api/auth/oauth-handoff-preflight`, proving the local auth UX fix is not deployed yet.

Remaining boundary:

- Requires release/deploy approval before production can show the customer-facing outage handling.
- This fix cannot hide vendor pages for users who manually open a raw Supabase authorize URL outside the ShortPulse app.

## Issue 2: Supabase Disk I/O Budget Pressure

Source of truth:

- `sql/migrations/169_add_audio_companion_art_scheduler_index.sql`
- `sql/migrations/170_add_media_files_ai_studio_source_ref_index.sql`
- `sql/migrations/171_add_ai_generations_terminal_repair_index.sql`
- `sql/migrations/rollback/169_add_audio_companion_art_scheduler_index_rollback.sql`
- `sql/migrations/rollback/170_add_media_files_ai_studio_source_ref_index_rollback.sql`
- `sql/migrations/rollback/171_add_ai_generations_terminal_repair_index_rollback.sql`
- `sql/configure_cron_job_run_details_retention_supabase.sql`
- `sql/check_database_io_hotspots.sql`
- `sql/check_scheduler_egress_activity.sql`
- `.github/workflows/apply-control-plane-ops-sql.yml`
- `docs/database-migrations.md`
- `docs/deployment.md`
- `docs/sops/sop_sql_migration_operations.md`
- `sql/README.md`
- Live production Supabase catalog state.

Source fix:

- Added `ix_generation_projection_audio_companion_art_claim` for the existing audio companion-art scheduler claim predicate.
- Added `ix_media_files_ai_studio_user_source_ref_created` for generation-owned `media_files` lookup by `user_id + source_ref`.
- Added `ix_ai_generations_terminal_completed_repair` for terminal generation repair scans by `completed_at desc nulls last`.
- Added and applied hosted Supabase Cron run-history retention for `cron.job_run_details`.
- Added `sql/check_database_io_hotspots.sql` as the read-only source diagnostic for future shared-block I/O checks without raw query text or row data.
- Extended scheduler diagnostics to report retention-job presence and `cron.job_run_details` size/age posture.
- Added the retention helper to the existing control-plane SQL apply workflow.

Validation proof:

- `sql/check_database_io_hotspots.sql` ran successfully against production on 2026-07-01. It confirmed the fixed app hot paths now have low current plan cost and identified `public.worker_runs` as the remaining high shared-block/table-size candidate.
- Live production catalog check on 2026-07-01 showed all three indexes exist.
- Live production cron check on 2026-07-01 showed job `shortpulse_prune_cron_job_run_details_daily`, schedule `5 3 * * *`, active `t`.
- Live production `cron.job_run_details` relation size was `3616 kB`.
- Live production plan checks on 2026-07-01 showed `ix_ai_generations_terminal_completed_repair`, `ix_generation_projection_audio_companion_art_claim`, and `ix_media_files_ai_studio_user_source_ref_created` are used by their target query shapes.
- `npm run test -- --run lib/server/api/__tests__/generationProjection.test.ts lib/server/audioCompanionArt/__tests__/processing.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts`
- `npm run docs:check`

Remaining boundary:

- Re-check `pg_stat_statements` after a meaningful traffic window to confirm the hot statements stay down.
- `public.worker_runs` is a cleanup candidate: production had 203,302 rows, all older than 30 days, no rows newer than 2026-05-09, and about 281 MB total size on 2026-07-01. Because it is a persisted generation control-plane run ledger, deleting or shortening retained history is a persistence/forensics contract change and needs explicit owner approval before live cleanup or a retention migration.
- `public.app_error_events` is intentionally append-only per `docs/monitoring.md`; do not prune it during this incident lane without a separate monitoring/forensics decision.
- The optional `cron.job_run_details` active-status index remains owner-only follow-up if retention alone does not reduce pg_cron status-update scan I/O enough.

## Validation Summary

Latest focused local validation:

- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run docs:check`: pass.
- `npm run type-check:touched`: pass, with repo-wide unrelated diagnostics still noted by the script.
- Focused auth/API/dashboard tests: 38 passed.
- Focused DB/generation owner tests: 41 passed.
- `git diff --check` over touched files: pass.

Known out-of-scope full-suite failures observed during this lane:

- `features/ai-studio/components/edit/__tests__/ExpertEditPanelView.launch-lock.test.tsx`
- `features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`
- `prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`
- `features/ai-studio/logic/__tests__/modelApiContracts.test.ts`

These failures concern AI Studio generate control labeling, output-store count expectations, agent-panel generate controls, and model-catalog audit stamps. They are not evidence against the auth/Supabase/database fixes.
