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
- `sql/create_user_preferences_table.sql`: user preference table bootstrap.
- `sql/create_billing_credit_tables.sql`: billing/credits schema and policies.
- `sql/create_app_error_logs_table.sql`: app incident log tables baseline.
- `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`: ledger compatibility upgrade for legacy billing schemas.
- `sql/migrate_new_user_plan_default_to_free.sql`: targeted plan-default migration.
- `sql/update_billing_pricing_catalog_20260210.sql`: historical catalog refresh reference only; do not use as current pricing authority.
- `sql/migrations/164_add_paid_signup_intent_gate.sql`: base signup intent table and paid-signup Auth hook foundation.
- `sql/migrations/165_account_first_signup_intent_gate.sql`: account-first signup intent gate and canonical `hook_shortpulse_signup_intent(event jsonb)` Auth hook.
- `sql/migrations/166_grant_signup_hook_schema_usage.sql`: grants the Supabase Auth hook runner enough schema usage to resolve the canonical signup intent hook.
- `sql/migrations/167_add_google_ip_signup_intent.sql`: adds the Google-only short-lived IP-bound signup intent fallback so `/sign-up` can open Google OAuth before the app knows the selected Google email.
- `sql/migrations/214_add_admin_error_watch_items.sql`: extends the admin incident status RPC with resolved-watch metadata and status-history notes for `/admin/errors`.
- `sql/configure_generation_recovery_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/generation-recovery/run`.
- `sql/configure_generation_recovery_cron_secret_supabase.sql`: set/update recovery scheduler bearer secret (`shortpulse_reconciler_cron_secret`) in Supabase Vault.
- `sql/configure_media_derivative_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/media-derivatives/run`.
- `sql/configure_admin_user_health_fleet_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/admin-user-health-fleet/run`.
- `sql/configure_internal_billing_renewal_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/billing-contract-renewals/run`.
- `sql/configure_credit_expiration_scheduler_supabase.sql`: configure Supabase Cron + Vault-backed scheduler invocation for `/api/internal/credit-expirations/run`.
- `sql/align_business_plan_8000_credits.sql`: apply-gated hosted packet for aligning Business plan/offers/active open contract monthly credit snapshots to the 8,000-credit recurring policy.
- `sql/configure_control_plane_scheduler_bypass_secret_supabase.sql`: set/update optional Vault bypass token (`shortpulse_vercel_protection_bypass_token`) for Vercel-protected scheduler targets.
- `sql/configure_cron_job_run_details_retention_supabase.sql`: prune old ended `cron.job_run_details` rows, compact the pruned table, and schedule daily run-history retention for Supabase Cron Disk I/O control.
- `sql/migrations/172_schedule_worker_runs_retention.sql`: schedule daily hosted pg_cron retention for completed `ok` rows in `public.worker_runs` after 30 days while preserving incomplete/running rows and error rows.
- `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql`: add the service-role-only `voice_source_lifecycle` proof table and aggregate Media Library storage lifecycle diagnostic RPC for dry-run reporting without raw object paths or user ids.
- `sql/migrations/174_remove_legacy_signup_seed_credit_grants.sql`: neutralize remaining retired signup seed credit grants, reject future positive signup seed inserts, and keep the baseline-access sentinel zero-value.
- `sql/migrations/176_add_app_error_events_admin_stats_source_index.sql`: add a narrow partial index for admin stats telemetry reads from `app_error_events`.
- `sql/migrations/177_optimize_admin_global_stats_v1_rpc.sql`: slim the shared generation CTE inside `get_admin_global_stats_v1()` so admin stats reads avoid carrying TOAST-heavy generation metadata through unrelated aggregates.
- `sql/migrations/178_add_admin_stats_generated_columns.sql`: add DB-maintained scalar projections for the remaining TOAST-heavy admin stats JSON flags and update `get_admin_global_stats_v1()` to read those scalars.
- `sql/migrations/180_harden_scheduler_and_admin_error_summary.sql`: add the missing internal billing scheduler HTTP timeout and provision service-role-only aggregate admin error-events summary RPC.
- `sql/migrations/181_harden_admin_pricing_offer_activation_grants.sql`: re-harden service-role-only execute grants for admin pricing offer activation RPCs and keep the enforce gate aligned with the runtime SQL audit.
- `sql/migrations/182_add_voice_changer_staged_audio_lifecycle.sql`: add Voice Changer video-derived staged-audio source objects to the service-role-only voice lifecycle proof class and aggregate dry-run diagnostics.
- `sql/migrations/183_fix_media_storage_lifecycle_lint.sql`: rewrite the aggregate media storage lifecycle diagnostic without temp-table references so hosted Supabase lint can analyze the service-role-only RPC.
- `sql/migrations/184_harden_media_library_bucket_limits.sql`: set private `media_library` bucket file-size and MIME guardrails to match app upload admission without deleting objects.
- `sql/migrations/185_add_media_storage_basename_resolver_rpc.sql`: add a service-role-only basename resolver RPC for legacy media preview repair without exposing route-local direct `storage.objects` lookup code.
- `sql/migrations/186_add_admin_storage_usage_snapshots.sql`: add service-role-only admin Supabase usage snapshots for the historical `/admin/storage` provider usage and margin-monitoring plan; the admin storage route is currently parked.
- `sql/migrations/187_add_app_error_event_telemetry_retention.sql`: add service-role-only daily telemetry rollups and scheduled raw retention for low/medium `telemetry.*` app-error events.
- `sql/migrations/188_add_media_storage_usage_helper.sql`: add a service-role-only aggregate media storage usage helper for server-side quota preflights.
- `sql/migrations/189_rename_free_plan_offer_rejection_to_baseline_access.sql`: rename the service-role plan-offer rejection copy for the legacy baseline-access sentinel without changing pricing, entitlement, acquisition, or execute-grant behavior.
- `sql/migrations/190_require_paid_plan_for_media_library_inserts.sql`: require current non-free billing authority before authenticated users can insert Media Library or Reference Grid rows.
- `sql/migrations/191_rename_credit_top_up_packages.sql`: rename credit top-up package display names to amount-only customer copy without changing ids, pricing, Stripe linkage, or grant amounts.
- `sql/migrations/192_reprice_credit_top_up_ladder.sql`: add the active numeric-id credit top-up ladder and deactivate legacy package rows without deleting historical references.
- `sql/migrations/193_add_tester_report_runs.sql`: add service-role-only automated tester-run reports with persona and engineering handoff bodies for `/admin/tester-reports`.
- `sql/migrations/194_add_ai_generations_request_id_lookup_index.sql`: add a narrow partial request-id lookup index for provider callback/recovery paths that receive `request_id` before user ownership is known.
- `sql/migrations/195_rename_baseline_access_catalog_display.sql`: restore the non-public baseline-access sentinel display name to `Baseline access` without changing pricing, entitlements, Stripe linkage, or acquisition behavior.
- `sql/migrations/196_add_browser_crash_sessions.sql`: add service-role-only authenticated browser freeze/crash session evidence for `/admin/crashes`.
- `sql/migrations/197_add_browser_crash_session_review_status.sql`: add operator review state so `/admin/crashes` rows can be resolved or ignored without deleting evidence.
- `sql/migrations/198_allow_equal_timestamp_project_workspace_updates.sql`: allow same-timestamp project workspace saves to persist structural checkpoint changes while older autosaves still no-op.
- `sql/migrations/199_repair_create_pulse_builtin_catalog.sql`: repair legacy seeded Create Pulse built-in labels while preserving operator-authored admin catalog entries and hidden system instructions.
- `sql/migrations/200_add_credit_grant_lot_expiration.sql`: add canonical credit grant lots, grant allocation tracking, expiring-first debit/reservation RPCs, and the service-role credit expiration RPC.
- `sql/migrations/201_harden_paid_media_library_access_contract_authority.sql`: keep Media Library and Reference Grid insert authority on current non-free billing contracts instead of billing profile projection drift.
- `sql/migrations/202_harden_credit_grant_lot_reservation_ambiguity.sql`: harden grant-lot reservation RPC ambiguity without changing customer-facing billing policy.
- `sql/migrations/203_add_hybervees_tester_report_review.sql`: add Hybervees review metadata to tester report runs for `/admin/tester-reports`.
- `sql/migrations/204_harden_credit_grant_lot_credit_rpc_ambiguity.sql`: harden grant-lot credit RPC ambiguity without changing customer-facing billing policy.
- `sql/migrations/205_add_bulk_credit_grant_summary_rpc.sql`: add the service-role-only set-based grant-lot summary RPC used by admin surfaces to avoid per-user RPC fanout.
- `sql/migrations/206_repair_prompt_modifier_starter.sql`: repair legacy Prompt Modifier built-in rows that are missing the required starter message.
- `sql/migrations/207_exclude_unpaid_from_paid_access_statuses.sql`: exclude Stripe `unpaid` subscriptions from paid-access and current storage-add-on status sets while keeping `past_due` as the recovery grace state.
- `sql/migrations/208_repair_model_pricing_policy_version_sequence.sql`: repair model-pricing policy-version and event identity sequence drift that can block `/admin/pricing` saves with duplicate primary keys.
- `sql/migrations/209_update_storage_addon_ladder_20260707.sql`: repair the recurring storage add-on ladder to the July 7 `50/100/250 GB/1 TB` self-serve set, retire `10 GB` from active self-serve metadata, and keep `500 GB` inactive for non-self-serve handling.
- `sql/migrations/210_add_admin_generation_breakdown_stats.sql`: add the service-role-only generation breakdown helper used by `/admin/stats` for per-user and model/media-type generation analytics.
- `sql/migrations/211_add_admin_first_value_funnel_stats.sql`: add the service-role-only first-value funnel helper used by `/admin/stats` Marketing to track signup through first retained generation value.
- `sql/migrations/218_add_admin_growth_cohorts_stats.sql`: add the service-role-only growth cohort helper used by `/admin/stats` Marketing to track signed-up accounts by subscription, generation, credit top-up, and storage add-on state.
- `sql/migrations/212_add_issue_report_screenshots.sql`: add private screenshot storage, metadata, and the service-role-only atomic issue-report insert helper for `/report-issue` and `/admin/reports`.
- `sql/migrations/213_add_billing_subscription_change_intents.sql`: add the service-role-only full-price subscription-upgrade intent proof table used by the Stripe paid-invoice webhook.
- `sql/migrations/215_add_billing_subscription_scheduled_changes.sql`: add the service-role-only Stripe subscription schedule projection used by Profile and AI Studio to show pending period-end downgrades while current contracts remain active.
- `sql/migrations/219_add_account_storage_ownership_proof.sql`: add service-role-only inactive-account storage ownership proof RPCs for report-only active/inactive/deleted/missing-owner classification without deletion authority.
- `sql/migrations/220_harden_browser_crash_observability.sql`: add typed browser crash high-water evidence, monotonic transition protection, and the service-role-only canonical Admin Crash Logs list RPC.
- `sql/migrations/221_add_voice_changer_remux_recovery_projection.sql`: add the projection-only Voice Changer remux retry contract used to reconstruct a failed video card after refresh while `ai_generations.metadata` remains recovery authority.
- `sql/migrations/222_add_admin_kanban_backlog_source_sync.sql`: add admin Kanban source metadata and the service-role-only planning backlog sync RPC for mirroring `docs/planning/backlog.md` into `/admin/kanban`.
- `sql/audit_billing_credit_rls.sql`: billing RLS audit checks.
- `sql/check_database_io_hotspots.sql`: read-only `pg_stat_statements` shared-block I/O summary plus table size/read posture, planner-stat freshness, and hot diagnostic table age/retention posture without raw query text.
- `sql/analyze_hot_database_tables_supabase.sql`: hosted apply-gated maintenance script that refreshes planner statistics on hot public tables without rewriting tables or deleting rows. Run through `.github/workflows/apply-control-plane-ops-sql.yml` with `operation=analyze_hot_database_tables`.
- `sql/check_media_storage_scope_drift.sql`: media storage scope drift diagnostics (read-only).
- `sql/check_media_all_media_completeness_drift.sql`: All Media completeness drift diagnostics for durable storage objects missing `media_files` rows (read-only).
- `sql/check_storage_object_egress_risk_breakdown.sql`: storage object byte-risk breakdown by safe bucket/path class and media tracking state, without printing object paths or user ids (read-only).
- `sql/check_media_storage_lifecycle_summary.sql`: aggregate Media Library lifecycle dry-run classes from `get_media_storage_lifecycle_summary(integer)` without object paths or user ids (read-only).
- `sql/check_media_storage_cleanup_manifest.sql`: manifest-first Media Library storage cleanup classifier for protected, review, integrity, and deletion-candidate object classes. It is read-only, prints raw storage paths only for local delete-candidate review, and must be run before any storage cleanup deletion is proposed.
- `frontend/scripts/media_storage_lifecycle_cleanup.mjs`: dry-run-only operator wrapper for the cleanup manifest. It consumes `sql/check_media_storage_cleanup_manifest.sql` as the classification source of truth and refuses destructive `--apply` because active-user-owned private storage objects must not be deleted by lifecycle cleanup. Raw candidate paths remain local-only and must not be pasted into chat or tracked reports.
- `sql/check_account_storage_ownership_proof.sql`: aggregate inactive-account storage ownership proof from `get_account_storage_ownership_proof_summary(integer)` without object paths, user ids, or deletion authority (read-only).
- `frontend/scripts/account_storage_ownership_proof.mjs`: report-only operator wrapper for inactive-account storage ownership proof. It refuses destructive flags and runs `sql/check_account_storage_ownership_proof.sql` through `psql` without passing the database URL as a positional command argument.
- `sql/check_database_egress_query_stats.sql`: `pg_stat_statements` query-class summary plus hot-path table scan/cache/index posture for database/API egress risk without printing raw query text or row data (read-only).
- `sql/check_postgrest_payload_projection_risk.sql`: PostgREST payload projection risk summary for generation tables, including aggregate column-size posture and hot query projection classes without printing raw query text or row data (read-only).
- `sql/check_scheduler_egress_activity.sql`: Supabase Cron and `pg_net` activity profile for distinguishing expected scheduler cadence from duplicate jobs or failing HTTP patterns, without printing URLs, headers, bodies, or secrets (read-only).
- `sql/check_media_derivative_processing_backlog.sql`: aggregate media derivative backlog/retry diagnostics for image rows without row ids, user ids, or storage paths (read-only).
- `sql/check_media_derivative_terminal_failures.sql`: aggregate terminal derivative failure diagnostics for image rows exhausted out of retry without row ids, user ids, or storage paths (read-only).
- `sql/repair_media_derivative_requeue_terminal_row.sql`: targeted operator requeue for a repaired terminal image row (read-write).
- `sql/check_user_owned_custom_voices_backfill.sql`: custom-voice ownership backfill diagnostics after migrations `128`/`129`/`130` (read-only).
- `sql/check_user_owned_custom_voices_review_queue.sql`: custom-voice ownership review-queue diagnostics for migrated/disputed rows and suspicious sample-path scope mismatches (read-only).
- `sql/check_character_sheet_alias_drift.sql`: character alias drift diagnostics (read-only).
- `sql/check_runtime_sql_security_audit.sql`: runtime RPC existence/owner/security-definer/execute-grant audit plus canary schema/table/sequence grant checks for app/runtime roles (read-only). This is the release gate for hosted operator RPC posture on families such as admin stats and model-pricing control-plane functions.
- `sql/check_generation_settlement_integrity.sql`: released-success settlement leakage diagnostics (read-only).
- `sql/check_control_plane_scheduler_health.sql`: canonical `pg_cron` liveness/missing/inactive/failing/stalled diagnostics (read-only).
- `sql/check_pg_net_failure_taxonomy.sql`: canonical `pg_net` queue-depth/failure-taxonomy diagnostics (read-only).
- `sql/check_agent_safety_policy_control_plane.sql`: agent safety control-plane table/function/execute-posture diagnostics (read-only).
- `sql/check_model_pricing_control_plane.sql`: model-pricing control-plane active policy/version diagnostics (read-only).
- `sql/check_plan_concurrency_entitlements.sql`: plan-based active-generation concurrency entitlement diagnostics for current offers and open subscription contracts (read-only).

### 2) Ordered migrations (`sql/migrations/`)

Use these for durable schema evolution across environments.

Create Pulse built-in catalog repair migrations must only mutate system-owned
seed rows. Once `/api/admin/agent-instructions/pulse-builtins` saves the
singleton `create_pulse_builtin_runtime` row with admin actor metadata, that
operator-owned catalog is the authority; do not rewrite its Pulse definitions
from seeded ids, hardcoded labels, hidden instructions, starter messages, or
workflow hints.

Current set:

Migration number 134 is intentionally unused; the ordered sequence moves from `133_restore_model_pricing_policy_function_grants.sql` to `135_add_media_folder_count_rpcs.sql`.

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
- `098_add_billing_plan_creation_metadata.sql`
- `099_add_admin_global_stats_rpcs.sql`
- `100_add_admin_global_stats_v1_rpc.sql`
- `101_fix_admin_stats_and_pricing_rpc_lint.sql`
- `102_add_admin_growth_stats_v1.sql`
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
- `116_add_atomic_admin_pricing_offer_activation_rpcs.sql`
- `117_add_create_pulse_builtin_control_plane.sql`
- `118_canonicalize_character_metadata_media_ids.sql`
- `119_require_character_media_id_on_character_links.sql`
- `120_remove_legacy_onboarding_user_preference.sql`
- `121_add_agent_prompt_runtime_control_plane.sql`
- `122_retire_character_sheet_alias_compat.sql`
- `123_add_audio_companion_art_projection_fields.sql`
- `124_add_generation_projection_save_error.sql`
- `125_add_expert_edit_system_preset_control_plane.sql`
- `126_seed_standard_runtime_prompt.sql`
- `127_add_generation_projection_transcript_text.sql`
- `128_add_user_owned_custom_voices.sql`
- `129_backfill_user_owned_custom_voices_from_preferences.sql`
- `130_quarantine_legacy_migrated_custom_voice_ownership.sql`
- `131_add_user_issue_reports.sql`
- `132_harden_public_data_api_default_privileges.sql`
- `133_restore_model_pricing_policy_function_grants.sql`
- `135_add_media_folder_count_rpcs.sql`
- `136_restore_global_media_folder_authority.sql`
- `137_retire_project_media_folder_authority.sql`
- `138_retire_character_quickswap_tip_preference.sql`
- `139_add_motion_reference_video_generation_leases.sql`
- `140_add_admitted_reference_image_variant.sql`
- `141_harden_storage_entitlement_helper_grants.sql`
- `142_add_model_pricing_custom_row_manifests.sql`
- `143_add_project_workspace_snapshot_freshness_guard.sql`
- `144_retire_media_folder_canvas_states.sql`
- `145_add_project_output_display_items.sql`
- `146_harden_control_plane_scheduler_timeouts.sql`
- `147_add_plan_concurrency_entitlements.sql`
- `148_add_generation_projection_workflow_reload.sql`
- `149_add_generation_projection_workspace_runtime_key.sql`
- `150_restore_dashboard_announcement_publish_grants.sql`
- `151_add_ai_studio_builtin_style_control_plane.sql`
- `152_add_audio_generation_display_title.sql`
- `153_add_dashboard_tutorials.sql`
- `154_add_dashboard_tutorial_thumbnail_uploads.sql`
- `155_add_dashboard_tutorial_thumbnail_display_derivatives.sql`
- `156_add_user_preferences_deleted_builtin_presets.sql`
- `157_add_generation_projection_error_payload.sql`
- `158_disable_signup_seed_credit_grants.sql`
- `159_repair_historical_generation_project_convergence.sql`
- `160_repair_global_media_library_visibility.sql`
- `161_harden_hidden_free_billing_offer.sql`
- `162_repair_generation_projection_workflow_reload.sql`
- `163_add_legal_policy_control_plane.sql`
- `164_add_paid_signup_intent_gate.sql`
- `165_account_first_signup_intent_gate.sql`
- `166_grant_signup_hook_schema_usage.sql`
- `167_add_google_ip_signup_intent.sql`
- `168_retire_saved_creators.sql`
- `169_add_audio_companion_art_scheduler_index.sql`
- `170_add_media_files_ai_studio_source_ref_index.sql`
- `171_add_ai_generations_terminal_repair_index.sql`
- `172_schedule_worker_runs_retention.sql`
- `173_add_media_storage_lifecycle_diagnostics.sql`
- `174_remove_legacy_signup_seed_credit_grants.sql`
- `175_enforce_storage_addon_no_stack.sql`
- `176_add_app_error_events_admin_stats_source_index.sql`
- `177_optimize_admin_global_stats_v1_rpc.sql`
- `178_add_admin_stats_generated_columns.sql`
- `179_optimize_media_storage_lifecycle_summary.sql`
- `180_harden_scheduler_and_admin_error_summary.sql`
- `181_harden_admin_pricing_offer_activation_grants.sql`
- `182_add_voice_changer_staged_audio_lifecycle.sql`
- `183_fix_media_storage_lifecycle_lint.sql`
- `184_harden_media_library_bucket_limits.sql`
- `185_add_media_storage_basename_resolver_rpc.sql`
- `186_add_admin_storage_usage_snapshots.sql`
- `187_add_app_error_event_telemetry_retention.sql`
- `188_add_media_storage_usage_helper.sql`
- `189_rename_free_plan_offer_rejection_to_baseline_access.sql`
- `190_require_paid_plan_for_media_library_inserts.sql`
- `191_rename_credit_top_up_packages.sql`
- `192_reprice_credit_top_up_ladder.sql`
- `193_add_tester_report_runs.sql`
- `194_add_ai_generations_request_id_lookup_index.sql`
- `195_rename_baseline_access_catalog_display.sql`
- `196_add_browser_crash_sessions.sql`
- `197_add_browser_crash_session_review_status.sql`
- `198_allow_equal_timestamp_project_workspace_updates.sql`
- `199_repair_create_pulse_builtin_catalog.sql`
- `200_add_credit_grant_lot_expiration.sql`
- `201_harden_paid_media_library_access_contract_authority.sql`
- `202_harden_credit_grant_lot_reservation_ambiguity.sql`
- `203_add_hybervees_tester_report_review.sql`
- `204_harden_credit_grant_lot_credit_rpc_ambiguity.sql`
- `205_add_bulk_credit_grant_summary_rpc.sql`
- `206_repair_prompt_modifier_starter.sql`
- `207_exclude_unpaid_from_paid_access_statuses.sql`
- `208_repair_model_pricing_policy_version_sequence.sql`
- `209_update_storage_addon_ladder_20260707.sql`
- `210_add_admin_generation_breakdown_stats.sql`
- `211_add_admin_first_value_funnel_stats.sql`
- `212_add_issue_report_screenshots.sql`
- `213_add_billing_subscription_change_intents.sql`
- `214_add_admin_error_watch_items.sql`
- `215_add_billing_subscription_scheduled_changes.sql`
- `216_repair_pulse_text_first_builtin_catalog.sql`
- `217_repair_pulse_single_shot_builtin_catalog.sql`
- `218_add_admin_growth_cohorts_stats.sql`
- `219_add_account_storage_ownership_proof.sql`
- `220_harden_browser_crash_observability.sql`
- `221_add_voice_changer_remux_recovery_projection.sql`
- `222_add_admin_kanban_backlog_source_sync.sql`

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

5. Explicit Data API grants are mandatory for new `public` tables and routines.

- Do not rely on Supabase auto-exposure defaults for new `public` objects.
- When a migration creates a table intended for browser or server Data API access, add the least-privilege `grant` statements in the same migration.
- For service-role-only control-plane tables, explicitly revoke `public` / `anon` / `authenticated` and grant only `service_role`.
- Treat grants, RLS enablement, and policies as one unit. Missing grants fail before RLS can help.

6. Run runtime SQL security audit after migration/security changes.

- Execute `sql/check_runtime_sql_security_audit.sql` in staging/production.
- Expect `failing_checks = 0` before phase/deploy signoff.
- Treat owner drift, missing `SECURITY DEFINER`, or missing service-role execute posture on admin stats, model-pricing control-plane, agent-safety control-plane, and other operator/runtime RPCs as a release blocker, not a degradable warning.
- Treat failing schema/table/sequence grant checks as release blockers even when function execute posture is still green; those checks are the canary for role-grant collapse on hosted environments.

7. Lint SQL before merge when migrations/functions changed.

- Run: `supabase db lint --linked --schema public --fail-on warning`.
- Alternative for explicit DB target pinning: `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`.

8. Verify hosted runtime schema contract after hosted migration applies.

- Run `node scripts/check_hosted_schema_contract.mjs` against the target environment.
- The script checks migration-sensitive Project Persistence and generated-output columns such as `generation_projection.workspace_runtime_key`, `generation_projection.display_title`, `generation_projection.remux_recovery`, `project_workspace_states.checkpoint_revision`, and `project_output_display_items.display_title`.
- Prefer PostgREST `limit=0` probes when Supabase URL/API credentials are available; in hosted migration workflows, the script may use `SUPABASE_DB_URL` to verify the same required table/column contract without exposing secrets.
- Treat failures as hosted schema drift. Apply the missing forward migration or repair the environment before assuming AI Studio restore/autosave code is broken.

9. Do not use Docker-based local Supabase commands in agent workflows.

- Avoid `supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, and direct `docker` commands.

10. Hosted-runner fallback is required when `SUPABASE_DB_URL` is unavailable in local shell context.

- Use `.github/workflows/reliability-control-plane-diagnostics.yml` for read-only reliability diagnostics against `staging`/`production`.
- GitHub Environment `SUPABASE_DB_URL` must be IPv4-compatible for hosted SQL workflows; use the Supavisor session pooler URL unless the Supabase IPv4 add-on is enabled.
- Runner script authority: `scripts/reliability_control_plane_diagnostics.sh`.
- Keep mode at `warn` for first-time environment validation; use `enforce` only after baseline reliability evidence is established.
- Use `.github/workflows/cost-performance-diagnostics.yml` for read-only DB I/O, database/API egress, storage-object byte posture, scheduler activity, and media-derivative cost diagnostics against `staging`/`production`.
- Runner script authority: `scripts/cost_performance_diagnostics.sh`.
- Keep cost-performance mode at `warn` until a production baseline artifact has been reviewed. The hosted workflow intentionally excludes `sql/check_media_storage_cleanup_manifest.sql` because that local-review manifest can print raw storage paths for delete candidates.
- Use `.github/workflows/apply-control-plane-ops-sql.yml` for environment-scoped scheduler and maintenance SQL apply operations (`configure_bypass_secret`, `configure_generation_recovery_cron_secret`, `configure_generation_recovery_scheduler`, `configure_media_derivative_scheduler`, `configure_admin_user_health_fleet_scheduler`, `configure_internal_billing_renewal_scheduler`, `configure_cron_job_run_details_retention`, `analyze_hot_database_tables`).
- Use `.github/workflows/apply-hosted-sql-migration.yml` for numbered hosted migrations such as `sql/migrations/172_schedule_worker_runs_retention.sql`.

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
