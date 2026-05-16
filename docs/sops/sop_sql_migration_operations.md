# SOP: SQL Migration And Operations

## Purpose

Provide a single operational guide for SQL work in this repo: what each SQL area is for, how to run scripts safely, and how to validate user-isolation/security outcomes.

## Scope

- Supabase schema/bootstrap scripts under `sql/`.
- Ordered migrations under `sql/migrations/`.
- Rollback scripts under `sql/migrations/rollback/`.
- Diagnostics and repair loops for Media Library isolation.
- Supabase CLI-driven operations with explicit hosted targets (no Docker-based local Supabase workflow commands).

## SQL Layout And Intent

### 1) Bootstrap and utility scripts (`sql/`)

Use these for foundational setup or targeted one-off operations.

- `sql/storage_policies.sql`: creates private `media_library` bucket + user-scoped storage policies.
- `sql/create_media_library_tables.sql`: creates Media Library tables, RLS policies, and constraints.
- `sql/create_saved_creators_table.sql`: saved creators table + isolation controls.
- `sql/create_user_preferences_table.sql`: user preference table bootstrap.
- `sql/create_billing_credit_tables.sql`: billing/credits schema and policies.
- `sql/create_app_error_logs_table.sql`: app incident log tables baseline.
- `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`: ledger compatibility upgrade for legacy billing schemas.
- `sql/migrate_new_user_plan_default_to_free.sql`: targeted plan-default migration.
- `sql/update_billing_pricing_catalog_20260210.sql`: catalog price update script.
- `sql/configure_generation_recovery_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/generation-recovery/run`.
- `sql/configure_generation_recovery_cron_secret_supabase.sql`: set/update recovery scheduler bearer secret (`shortpulse_reconciler_cron_secret`) in Supabase Vault.
- `sql/configure_media_derivative_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/media-derivatives/run`.
- `sql/configure_admin_user_health_fleet_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/admin-user-health-fleet/run`.
- `sql/configure_control_plane_scheduler_bypass_secret_supabase.sql`: set/update optional Vault bypass token (`shortpulse_vercel_protection_bypass_token`) for Vercel-protected scheduler targets.
- `sql/audit_billing_credit_rls.sql`: billing RLS audit checks.
- `sql/check_media_storage_scope_drift.sql`: media storage scope drift diagnostics (read-only).
- `sql/check_media_all_media_completeness_drift.sql`: All Media completeness drift diagnostics for durable storage objects missing `media_files` rows (read-only).
- `sql/check_media_derivative_processing_backlog.sql`: media derivative backlog/retry diagnostics for image rows (read-only).
- `sql/check_media_derivative_terminal_failures.sql`: terminal derivative failure diagnostics for image rows exhausted out of retry (read-only).
- `sql/repair_media_derivative_requeue_terminal_row.sql`: targeted operator requeue for a repaired terminal image row (read-write).
- `sql/check_character_sheet_alias_drift.sql`: character alias drift diagnostics (read-only).
- `sql/check_runtime_sql_security_audit.sql`: runtime RPC existence/owner/security-definer/execute-grant audit plus canary schema/table/sequence grant checks for app/runtime roles (read-only). This is the release gate for hosted operator RPC posture on families such as admin stats and model-pricing control-plane functions.
- `sql/check_generation_settlement_integrity.sql`: released-success settlement leakage diagnostics (read-only).
- `sql/check_control_plane_scheduler_health.sql`: canonical `pg_cron` liveness/missing/inactive/failing/stalled diagnostics (read-only).
- `sql/check_pg_net_failure_taxonomy.sql`: canonical `pg_net` queue-depth/failure-taxonomy diagnostics (read-only).
- `sql/check_agent_safety_policy_control_plane.sql`: agent safety control-plane table/function/execute-posture diagnostics (read-only).
- `sql/check_model_pricing_control_plane.sql`: model-pricing control-plane active policy/version diagnostics (read-only).

### 2) Ordered migrations (`sql/migrations/`)

Use these for durable schema evolution across environments.

Current set:

- `001_add_studio_10000_credit_package.sql`
- `002_add_generation_credit_reservations.sql`
- `003_add_private_media_source.sql`
- `004_add_private_media_integrity_checks.sql`
- `005_add_media_processing_and_variants.sql`
- `006_backfill_media_variant_hints.sql`
- `007_harden_media_source_and_usage_rpc.sql`
- `008_add_character_manager_foundation.sql`
- `009_repair_legacy_media_storage_paths.sql`
- `010_harden_character_reference_media_integrity.sql`
- `011_add_character_description_to_characters.sql`
- `012_add_character_sheet_aliases_and_compat.sql`
- `013_fix_generation_reservation_rpc_ambiguity.sql`
- `014_harden_generation_reservation_rpc_security.sql`
- `015_add_app_error_events.sql`
- `016_harden_media_storage_path_scope.sql`
- `017_harden_media_storage_path_shape.sql`
- `018_add_ai_agent_conversation_state.sql`
- `019_add_generation_recovery_fields.sql`
- `020_generation_runtime_convergence.sql`
- `021_generation_state_machine_constraints.sql`
- `022_generation_persist_idempotency.sql`
- `023_generation_reconciler_claims.sql`
- `024_fal_webhook_inbox.sql`
- `025_generation_recovery_leases.sql`
- `026_generation_recovery_transition_guards.sql`
- `027_fix_reservation_rpc_on_conflict_ambiguity.sql`
- `028_harden_ai_agent_conversation_state_security.sql`
- `029_fix_conversation_state_upsert_ambiguity.sql`
- `030_fix_conversation_state_upsert_conflict_target.sql`
- `031_release_stale_generation_reservations.sql`
- `032_admit_and_reserve_generation_credits.sql`
- `033_fix_atomic_admission_rpc_ambiguity.sql`
- `034_add_generation_submit_queue.sql`
- `035_exclude_queued_reservations_from_stale_cleanup.sql`
- `036_fix_queue_claim_locking.sql`
- `037_expand_recovery_claim_provider_scope.sql`
- `038_harden_queue_claim_active_dispatching_guard.sql`
- `039_admin_error_status_atomic_update.sql`
- `040_harden_runtime_rpc_execute_grants.sql`
- `041_harden_released_reservation_recapture_semantics.sql`
- `042_harden_queue_recovery_rpc_execute_grants.sql`
- `043_add_user_preferences_media_autosave_enabled.sql`
- `044_add_ai_studio_sessions_persistence.sql`
- `045_add_character_quickswap_deck.sql`
- `046_fix_character_quickswap_storage_scope_check.sql`
- `047_add_agent_safety_policy_control_plane.sql`
- `048_harden_agent_safety_policy_control_plane_grants.sql`
- `049_enforce_expert_default_beginner_mode.sql`
- `050_add_media_list_search_cursor_indexes.sql`
- `051_add_agent_safety_policy_version_rpc.sql`
- `052_extend_queue_recovery_provider_scope_to_kie.sql`
- `053_fix_ai_studio_session_upsert_ambiguity.sql`
- `054_add_provider_attached_stale_reservation_cleanup.sql`
- `055_add_user_preferences_expert_edit_preset_panel_labels.sql`
- `056_add_user_preferences_expert_edit_preset_ids_and_custom_presets.sql`
- `057_add_user_preferences_ai_studio_deleted_style_ids.sql`
- `058_add_user_preferences_ai_studio_style_details_overrides.sql`
- `059_add_user_preferences_ai_studio_character_quickswap_tip_hidden.sql`
- `090_add_user_preferences_ai_studio_style_panel_ids.sql`
- `060_add_media_folders_and_membership.sql`
- `061_backfill_media_image_dimensions_metadata.sql`
- `062_add_dashboard_announcements.sql`
- `063_add_media_folder_canvas_states.sql`
- `064_backfill_media_files_from_storage_objects.sql`
- `065_add_media_derivative_processing_fields.sql`
- `066_add_media_derivative_processing_rpcs.sql`
- `067_add_admin_user_health_fleet_automation.sql`
- `068_add_character_media_assets_isolation.sql`
- `069_harden_provider_attached_stale_cleanup_execute_grants.sql`
- `070_harden_queue_claim_collision_advisory_lock.sql`
- `071_add_ai_generation_outputs.sql`
- `072_add_generation_attempts.sql`
- `073_add_media_folder_hierarchy.sql`
- `074_add_generation_worker_ops.sql`
- `075_add_generation_worker_leases.sql`
- `076_add_generation_projection_publication_and_observation_tables.sql`
- `077_add_generation_projection_source_ref.sql`
- `078_add_generation_fields_to_queue_claim.sql`
- `079_add_queued_dispatch_success_commit_rpc.sql`
- `080_add_elements_library_foundation.sql`
- `081_add_generation_observation_inbox_claim_rpc.sql`
- `082_add_user_preferences_ai_studio_saved_voices.sql`
- `083_add_user_preferences_ai_studio_saved_pulses.sql`
- `084_harden_billing_profile_and_stripe_event_rls.sql`
- `085_add_billing_plan_offers_and_subscription_contracts.sql`
- `086_add_internal_comp_billing_contract_support.sql`
- `087_add_storage_entitlements_and_recurring_storage_addons.sql`
- `088_fix_paid_entitlement_fallbacks_and_offer_catalog.sql`
- `089_add_projects_foundation.sql`
- `090_add_user_preferences_ai_studio_style_panel_ids.sql`
- `091_add_project_workspace_states.sql`
- `092_add_project_asset_associations.sql`
- `093_add_project_generation_associations.sql`
- `094_add_project_media_folders.sql`
- `095_add_project_media_folder_canvas_states.sql`
- `096_add_model_pricing_control_plane.sql`
- `097_retire_model_pricing_rounding_exceptions.sql`
- `103_sanitize_project_workspace_conversational_runtime.sql`
- `104_add_user_media_compliance_acceptances.sql`
- `105_enforce_spendable_balance_for_direct_generation_charges.sql`
- `106_add_annual_billing_intervals_and_credit_allocation_cursors.sql`
- `107_add_generation_abandonments.sql`
- `108_retire_legacy_ai_studio_pulses.sql`
- `109_add_generation_projection_project_id.sql`
- `110_add_admin_kanban_foundation.sql`
- `111_harden_admin_kanban_audit_integrity.sql`
- `112_repair_model_pricing_control_plane_seed.sql`
- `113_add_admin_kanban_review_status.sql`
- `114_add_dashboard_offers.sql`
- `115_remove_global_model_pricing_rounding.sql`
- `118_canonicalize_character_metadata_media_ids.sql`
- `119_require_character_media_id_on_character_links.sql`
- `120_remove_legacy_onboarding_user_preference.sql`
- `122_retire_character_sheet_alias_compat.sql`

### 3) Rollbacks (`sql/migrations/rollback/`)

Use only when explicitly reverting a migration in a controlled window. Prefer targeted corrective forward SQL when possible.

## Operating Principles

1. Treat migrations as forward-first.

- Production/staging should move forward through ordered migrations.

2. Idempotent scripts can be safely re-run.

- Many scripts here intentionally use patterns like `drop ... if exists`, `create ... if not exists`, and corrective updates.

3. Diagnostics are read-only and can be run repeatedly.

- `sql/check_media_storage_scope_drift.sql` and `sql/check_character_sheet_alias_drift.sql` should be part of release validation.

4. Re-run hardening after repairs.

- Expected loop: harden -> diagnose -> repair -> harden -> diagnose.

5. Run runtime SQL security audit after migration/security changes.

- Execute `sql/check_runtime_sql_security_audit.sql` in staging/production.
- Expect `failing_checks = 0` before phase/deploy signoff.
- Treat owner drift, missing `SECURITY DEFINER`, or missing service-role execute posture on admin stats, model-pricing control-plane, agent-safety control-plane, and other operator/runtime RPCs as a release blocker, not a degradable warning.
- Treat failing schema/table/sequence grant checks as release blockers even when function execute posture is still green; those checks are the canary for role-grant collapse on hosted environments.

6. Lint SQL before merge when migrations/functions changed.

- Run: `supabase db lint --linked --schema public --fail-on warning`.
- Alternative for explicit DB target pinning: `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`.

7. Do not use Docker-based local Supabase commands in agent workflows.

- Avoid `supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, and direct `docker` commands.

8. Hosted-runner fallback is required when `SUPABASE_DB_URL` is unavailable in local shell context.

- Use `.github/workflows/reliability-control-plane-diagnostics.yml` for read-only reliability diagnostics against `staging`/`production`.
- Runner script authority: `scripts/reliability_control_plane_diagnostics.sh`.
- Keep mode at `warn` for first-time environment validation; use `enforce` only after baseline reliability evidence is established.
- Use `.github/workflows/apply-control-plane-ops-sql.yml` for environment-scoped scheduler SQL apply operations (`configure_bypass_secret`, `configure_generation_recovery_cron_secret`, `configure_generation_recovery_scheduler`, `configure_media_derivative_scheduler`, `configure_admin_user_health_fleet_scheduler`).

## Standard Runbooks

### A) New environment bootstrap (minimum secure media stack)

Run in order:

1. `sql/storage_policies.sql`
2. `sql/create_media_library_tables.sql`
3. `sql/migrations/003_add_private_media_source.sql`
4. `sql/migrations/004_add_private_media_integrity_checks.sql`
5. `sql/migrations/016_harden_media_storage_path_scope.sql`
6. `sql/migrations/017_harden_media_storage_path_shape.sql`
7. `sql/check_media_storage_scope_drift.sql`

Expected outcome:

- All drift checks return `mismatch_count = 0`.

### B) Existing environment hardening (recommended for active dev/staging)

Run in order:

1. `sql/migrations/003_add_private_media_source.sql`
2. `sql/migrations/004_add_private_media_integrity_checks.sql`
3. `sql/migrations/016_harden_media_storage_path_scope.sql`
4. `sql/migrations/017_harden_media_storage_path_shape.sql`
5. `sql/check_media_storage_scope_drift.sql`
6. If drift is non-zero, run `sql/migrations/009_repair_legacy_media_storage_paths.sql`
7. Re-run `sql/check_media_storage_scope_drift.sql`
8. Re-run `sql/migrations/016_harden_media_storage_path_scope.sql`
9. Re-run `sql/migrations/017_harden_media_storage_path_shape.sql`
10. Final `sql/check_media_storage_scope_drift.sql`

### C) Development loop (safe repeated runs)

Use this loop while iterating:

1. Apply target migration(s).
2. Run drift diagnostics.
3. If mismatch exists, run repair migration(s).
4. Re-apply hardening migrations.
5. Re-run diagnostics until clean.

This is expected and not a broken loop; it is convergence to a strict, validated state.

## Verification Queries

### Media drift checks

Run:

- `sql/check_media_storage_scope_drift.sql`
- `sql/check_media_all_media_completeness_drift.sql` (before/after migration `064`)

Expected:

- `media_files.storage_path_backslash = 0`
- `media_files.storage_path_empty = 0`
- `media_files.storage_path_leading_slash = 0`
- `media_files.storage_path_not_user_scoped = 0`
- `media_files.storage_path_traversal_segment = 0`
- `media_files.variant_hint_invalid_shape = 0` (when variant hint columns exist)
- `media_asset_variants.storage_path_invalid_shape = 0` (when `media_asset_variants` exists)
- `check_media_all_media_completeness_drift` summary converges missing durable counts as expected after migration `064`.

### Constraint validation status

```sql
select conname, convalidated
from pg_constraint
where conname in (
  'media_files_storage_scope_check',
  'media_files_storage_path_shape_check',
  'media_files_variant_hint_shape_check',
  'media_asset_variants_storage_path_shape_check'
)
order by conname;
```

### Runtime SQL security posture

Run:

- `sql/check_runtime_sql_security_audit.sql`

Expected:

- Detail query shows `pass = true` for all rows.
- Summary query returns `failing_checks = 0`.

### Storage policy presence

```sql
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'media_access_%'
order by policyname;
```

## Common Errors And Fixes

### Error: `42501 must be owner of table objects`

Cause:

- Role lacks ownership for `storage.objects`.

Action:

- Do not run owner-only `ALTER TABLE storage.objects ...` with restricted roles.
- Apply `sql/storage_policies.sql` policy statements using the project owner role in Supabase Dashboard SQL Editor if needed.

### Error: `23514 check constraint "media_files_source_check" ... violated`

Cause:

- Existing rows contain unsupported `source` values for that migration state.

Action:

1. Inspect values:

```sql
select source, count(*)
from media_files
group by source
order by count(*) desc;
```

2. Apply updated `sql/migrations/003_add_private_media_source.sql` (forward-compatible allowlist + null normalization).
3. Continue with `004`, `016`, `017`, then drift checks.

## Promotion Checklist (Staging -> Production)

1. Run migration sequence in staging.
2. Capture drift output + constraint validation output.
3. Run app smoke tests with two users (list/preview/move/delete isolation).
4. Promote same SQL sequence to production.
5. Run post-deploy drift and policy verification.
6. Record outcome in `docs/change_log.md`.

## Conversation state hardening ops (018 + 028/029/030)

After applying `018`, `028`, `029`, and `030`:

1. Validate RPC execution posture:
   - `upsert_ai_agent_conversation_state` should execute via service-role path only.
2. Validate bounded retention behavior:
   - TTL clamp: `1 day..90 days` (default `30 days`).
   - Cap clamp: `1..200` (default `200`).
3. Validate deterministic pruning:
   - tie-break ordering should remain stable under timestamp ties.
4. Validate cleanup operation:
   - `prune_ai_agent_conversation_state_expired(...)` callable from service role for daily cleanup cadence.

## Related Docs

- `docs/database-migrations.md`
- `docs/security-checklist.md`
- `docs/troubleshooting.md`
- `docs/monitoring.md`
- `docs/supabase_full_schema.sql`
