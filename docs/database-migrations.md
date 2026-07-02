# Database Migrations

Purpose: define a consistent migration workflow for Supabase schema changes.

For operator run order, diagnostics loops, and common SQL error playbooks, use:

- `docs/sops/sop_sql_migration_operations.md`

## Supabase tooling policy

- Use Supabase CLI for Supabase access in this repo.
- Do not use Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
- For hosted operations, require explicit target pinning (`--linked`, `--project-ref`, or `--db-url`).

## Migration layout

- Canonical folder: `sql/migrations/`
- Naming pattern: `NNN_short_description.sql` (e.g., `001_initial_schema.sql`)
- Keep legacy bootstrap scripts in `sql/` unchanged for historical reference.
- Canonical truth policy: migration files are source-of-truth for current runtime contracts; `docs/supabase_full_schema.sql` is a bootstrap snapshot and may lag between refreshes.

## Create a migration

1. Pick the next migration number.
2. Add forward SQL under `sql/migrations/NNN_description.sql`.
3. Add matching rollback SQL under `sql/migrations/rollback/NNN_description_rollback.sql` when feasible.
4. Include RLS/storage/index updates in the same migration when they are part of the same feature.

## Local/staging test flow

1. Apply migration in local/staging Supabase project.
2. Run:
   ```bash
   cd frontend
   npm run validate
   npm run build
   npx supabase db lint --linked --schema public --fail-on warning
   # or: npx supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning
   ```
3. Validate impacted flows (auth, AI Studio billing/debits, media library, admin routes).

## CLI workflow

When Supabase CLI is installed:

```bash
cd frontend
npm run db:migrate
```

Current guardrail policy:

- `npm run db:migrate` is intentionally blocked for hosted promotion.
- Reason: canonical migration authority is `sql/migrations/`, while default Supabase CLI push posture targets `supabase/migrations/`.
- For hosted staging/production promotion, use environment-pinned SQL apply paths (for example, `psql "$SUPABASE_DB_URL" -f sql/migrations/<NNN_file>.sql`) and the existing environment-gated GitHub workflows.
- Preferred hosted runner path for arbitrary canonical migrations: dispatch [`apply-hosted-sql-migration.yml`](../.github/workflows/apply-hosted-sql-migration.yml) with:
  - `target_environment=staging|production`
  - `sql_file=sql/migrations/<NNN_file>.sql` or `sql/migrations/rollback/<NNN_file>_rollback.sql`
  - `confirm_token=apply-hosted-sql`
- The hosted apply workflow verifies `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning` after the migration so schema drift is caught immediately.
- For production-targeted one-off Supabase CLI commands, require explicit target pinning with `--project-ref <production-ref>`.
- Do not run `npm run db:reset` in normal agent workflows; this command defaults to local Docker-backed reset behavior.

## Production deploy workflow

1. Apply migrations to staging and verify.
2. Schedule production migration window.
3. Apply production migrations.
4. Deploy app code dependent on the migration.
5. Run post-deploy smoke checks.

Recurring storage add-on no-stack guard:

- Before applying `sql/migrations/175_enforce_storage_addon_no_stack.sql`, run `sql/check_billing_storage_addon_no_stack_drift.sql` against the target database and resolve any aggregate drift it reports.
- The migration updates the plan/storage catalog to the July 1, 2026 storage ladder, closes old public storage add-on acquisition offers, seeds missing-Stripe replacement offers as non-public, clamps quota math to one unit, and intentionally fails if current billable storage add-on rows are stacked per user or have quantity other than one.

Safety posture:

- Keep the local default Supabase link on staging.
- Do not rely on implicit linked-project targeting for production operations.

## Rollback strategy

- Preferred: run paired rollback migration.
- Fallback: execute targeted corrective SQL and redeploy the previous known-good app revision.
- Always document migration failures and corrections in project docs.

## Auth signup gate

Account-first Google/email signup requires `sql/migrations/164_add_paid_signup_intent_gate.sql`, `sql/migrations/165_account_first_signup_intent_gate.sql`, `sql/migrations/166_grant_signup_hook_schema_usage.sql`, and `sql/migrations/167_add_google_ip_signup_intent.sql`, plus the hosted Supabase Auth Before User Created hook pointed at `public.hook_shortpulse_signup_intent(event jsonb)`. Migration `165` keeps the prior paid-hook name as a compatibility wrapper, but the canonical hook is `hook_shortpulse_signup_intent`; migration `166` grants the hosted Auth hook role schema usage so it can resolve the public hook function. Migration `167` adds the Google-only short-lived IP-bound fallback used when the signup button opens OAuth before the app knows the selected Google email. The paired rollbacks for `165` and `167` are under `sql/migrations/rollback/`; disable the hosted hook before rolling back these auth-hook migrations.

## Current required migration set (billing + generation)

For environments bootstrapped from `docs/supabase_full_schema.sql`, apply these migrations to match current API behavior:

1. `sql/migrations/001_add_studio_10000_credit_package.sql`
2. `sql/migrations/002_add_generation_credit_reservations.sql`
3. `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`
4. `sql/migrations/014_harden_generation_reservation_rpc_security.sql`
5. `sql/migrations/015_add_app_error_events.sql`
6. `sql/migrations/016_harden_media_storage_path_scope.sql`
7. `sql/migrations/017_harden_media_storage_path_shape.sql`

If upgrading from a legacy ledger schema, also apply:

8. `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`

If enabling the Media Library Private tab, also apply:

9. `sql/migrations/003_add_private_media_source.sql`
10. `sql/migrations/004_add_private_media_integrity_checks.sql`

If enabling the derivative-first media optimization architecture (virtualized grid + variant hints), also apply:

11. `sql/migrations/005_add_media_processing_and_variants.sql`
12. `sql/migrations/006_backfill_media_variant_hints.sql`
13. `sql/migrations/007_harden_media_source_and_usage_rpc.sql`
14. `sql/migrations/050_add_media_list_search_cursor_indexes.sql`
15. `sql/migrations/065_add_media_derivative_processing_fields.sql`
16. `sql/migrations/066_add_media_derivative_processing_rpcs.sql`

If enabling admin fleet health automation (daily active-user triage snapshots), also apply:

17. `sql/migrations/067_add_admin_user_health_fleet_automation.sql`

Character Panel Media Isolation (canonical character-owned assets decoupled from Media Library) requires:

18. `sql/migrations/068_add_character_media_assets_isolation.sql`

If enabling provider-attached stale reservation cleanup hardening (service-role-only execute posture), also apply:

19. `sql/migrations/069_harden_provider_attached_stale_cleanup_execute_grants.sql`

If enabling Character Manager (character sheets + generation history), also apply:

14. `sql/migrations/008_add_character_manager_foundation.sql`

If Media Library cards still show blank placeholders in legacy environments, also apply:

15. `sql/migrations/009_repair_legacy_media_storage_paths.sql`

If enabling stricter Character Manager media integrity (source/path/metadata + cross-table trigger), also apply:

16. `sql/migrations/010_harden_character_reference_media_integrity.sql`
17. `sql/migrations/011_add_character_description_to_characters.sql`
18. `sql/migrations/012_add_character_sheet_aliases_and_compat.sql`
19. `sql/migrations/018_add_ai_agent_conversation_state.sql`

If enabling AI Studio Fal reliability rollout (modular submit/retrieval + reconciler), also apply:

20. `sql/migrations/019_add_generation_recovery_fields.sql`
21. `sql/migrations/020_generation_runtime_convergence.sql`
22. `sql/migrations/021_generation_state_machine_constraints.sql`
23. `sql/migrations/022_generation_persist_idempotency.sql`
24. `sql/migrations/023_generation_reconciler_claims.sql`
25. `sql/migrations/024_fal_webhook_inbox.sql`
26. `sql/migrations/025_generation_recovery_leases.sql`
27. `sql/migrations/026_generation_recovery_transition_guards.sql`
28. `sql/migrations/027_fix_reservation_rpc_on_conflict_ambiguity.sql`
29. `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
30. `sql/migrations/029_fix_conversation_state_upsert_ambiguity.sql`
31. `sql/migrations/030_fix_conversation_state_upsert_conflict_target.sql`
32. `sql/migrations/031_release_stale_generation_reservations.sql`
33. `sql/migrations/032_admit_and_reserve_generation_credits.sql`
34. `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql`
35. `sql/migrations/034_add_generation_submit_queue.sql`
36. `sql/migrations/035_exclude_queued_reservations_from_stale_cleanup.sql`
37. `sql/migrations/036_fix_queue_claim_locking.sql`
38. `sql/migrations/037_expand_recovery_claim_provider_scope.sql`
39. `sql/migrations/038_harden_queue_claim_active_dispatching_guard.sql`
40. `sql/migrations/039_admin_error_status_atomic_update.sql`
41. `sql/migrations/040_harden_runtime_rpc_execute_grants.sql`
42. `sql/migrations/041_harden_released_reservation_recapture_semantics.sql`
43. `sql/migrations/042_harden_queue_recovery_rpc_execute_grants.sql`
44. `sql/migrations/043_add_user_preferences_media_autosave_enabled.sql`
45. `sql/migrations/044_add_ai_studio_sessions_persistence.sql`
46. `sql/migrations/045_add_character_quickswap_deck.sql`
47. `sql/migrations/046_fix_character_quickswap_storage_scope_check.sql`
48. `sql/migrations/047_add_agent_safety_policy_control_plane.sql`
49. `sql/migrations/048_harden_agent_safety_policy_control_plane_grants.sql`
50. `sql/migrations/049_enforce_expert_default_beginner_mode.sql` (historical legacy `beginner_mode` preference migration; removed from current schema by migration `120`)
51. `sql/migrations/051_add_agent_safety_policy_version_rpc.sql`
52. `sql/migrations/052_extend_queue_recovery_provider_scope_to_kie.sql`
53. `sql/migrations/053_fix_ai_studio_session_upsert_ambiguity.sql`
54. `sql/migrations/054_add_provider_attached_stale_reservation_cleanup.sql`
55. `sql/migrations/055_add_user_preferences_expert_edit_preset_panel_labels.sql`
56. `sql/migrations/056_add_user_preferences_expert_edit_preset_ids_and_custom_presets.sql`
57. `sql/migrations/057_add_user_preferences_ai_studio_deleted_style_ids.sql`
58. `sql/migrations/058_add_user_preferences_ai_studio_style_details_overrides.sql`
59. `sql/migrations/059_add_user_preferences_ai_studio_character_quickswap_tip_hidden.sql`
60. `sql/migrations/060_add_media_folders_and_membership.sql`
61. `sql/migrations/061_backfill_media_image_dimensions_metadata.sql`
62. `sql/migrations/062_add_dashboard_announcements.sql`
63. `sql/migrations/063_add_media_folder_canvas_states.sql`
64. `sql/migrations/064_backfill_media_files_from_storage_objects.sql`
65. `sql/migrations/065_add_media_derivative_processing_fields.sql`
66. `sql/migrations/066_add_media_derivative_processing_rpcs.sql`
67. `sql/migrations/067_add_admin_user_health_fleet_automation.sql`
68. `sql/migrations/068_add_character_media_assets_isolation.sql`
69. `sql/migrations/069_harden_provider_attached_stale_cleanup_execute_grants.sql`
70. `sql/migrations/070_harden_queue_claim_collision_advisory_lock.sql`
71. `sql/migrations/071_add_ai_generation_outputs.sql`
72. `sql/migrations/072_add_generation_attempts.sql`
73. `sql/migrations/073_add_media_folder_hierarchy.sql`
74. `sql/migrations/074_add_generation_worker_ops.sql`
75. `sql/migrations/075_add_generation_worker_leases.sql`
76. `sql/migrations/076_add_generation_projection_publication_and_observation_tables.sql`
77. `sql/migrations/077_add_generation_projection_source_ref.sql`
78. `sql/migrations/078_add_generation_fields_to_queue_claim.sql`
79. `sql/migrations/079_add_queued_dispatch_success_commit_rpc.sql`
80. `sql/migrations/080_add_elements_library_foundation.sql`
81. `sql/migrations/081_add_generation_observation_inbox_claim_rpc.sql`
82. `sql/migrations/082_add_user_preferences_ai_studio_saved_voices.sql`
83. `sql/migrations/083_add_user_preferences_ai_studio_saved_pulses.sql`
84. `sql/migrations/084_harden_billing_profile_and_stripe_event_rls.sql`
85. `sql/migrations/085_add_billing_plan_offers_and_subscription_contracts.sql`
86. `sql/migrations/086_add_internal_comp_billing_contract_support.sql`
87. `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`
88. `sql/migrations/088_fix_paid_entitlement_fallbacks_and_offer_catalog.sql`
89. `sql/migrations/089_add_projects_foundation.sql`
90. `sql/migrations/090_add_user_preferences_ai_studio_style_panel_ids.sql`
91. `sql/migrations/091_add_project_workspace_states.sql`
92. `sql/migrations/092_add_project_asset_associations.sql`
93. `sql/migrations/093_add_project_generation_associations.sql`
94. `sql/migrations/094_add_project_media_folders.sql`
95. `sql/migrations/095_add_project_media_folder_canvas_states.sql`
96. `sql/migrations/096_add_model_pricing_control_plane.sql`
97. `sql/migrations/097_retire_model_pricing_rounding_exceptions.sql`
98. `sql/migrations/098_add_billing_plan_creation_metadata.sql`
99. `sql/migrations/099_add_admin_global_stats_rpcs.sql`
100.  `sql/migrations/100_add_admin_global_stats_v1_rpc.sql`
101.  `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
102.  `sql/migrations/102_add_admin_growth_stats_v1.sql`
103.  `sql/migrations/103_sanitize_project_workspace_conversational_runtime.sql`
104.  `sql/migrations/104_add_user_media_compliance_acceptances.sql`
105.  `sql/migrations/105_enforce_spendable_balance_for_direct_generation_charges.sql`
106.  `sql/migrations/106_add_annual_billing_intervals_and_credit_allocation_cursors.sql`
107.  `sql/migrations/107_add_generation_abandonments.sql`
108.  `sql/migrations/108_retire_legacy_ai_studio_pulses.sql`
109.  `sql/migrations/109_add_generation_projection_project_id.sql`
110.  `sql/migrations/110_add_admin_kanban_foundation.sql`
111.  `sql/migrations/111_harden_admin_kanban_audit_integrity.sql`
112.  `sql/migrations/112_repair_model_pricing_control_plane_seed.sql`
113.  `sql/migrations/113_add_admin_kanban_review_status.sql`
114.  `sql/migrations/114_add_dashboard_offers.sql`
115.  `sql/migrations/115_remove_global_model_pricing_rounding.sql`
116.  `sql/migrations/116_add_atomic_admin_pricing_offer_activation_rpcs.sql`
117.  `sql/migrations/117_add_create_pulse_builtin_control_plane.sql`
118.  `sql/migrations/118_canonicalize_character_metadata_media_ids.sql`
119.  `sql/migrations/119_require_character_media_id_on_character_links.sql`
120.  `sql/migrations/120_remove_legacy_onboarding_user_preference.sql` (removes deprecated `user_preferences.beginner_mode`; current schema state)
121.  `sql/migrations/121_add_agent_prompt_runtime_control_plane.sql`
122.  `sql/migrations/122_retire_character_sheet_alias_compat.sql`
123.  `sql/migrations/123_add_audio_companion_art_projection_fields.sql`
124.  `sql/migrations/124_add_generation_projection_save_error.sql`
125.  `sql/migrations/125_add_expert_edit_system_preset_control_plane.sql`
126.  `sql/migrations/126_seed_standard_runtime_prompt.sql`
127.  `sql/migrations/127_add_generation_projection_transcript_text.sql`
128.  `sql/migrations/128_add_user_owned_custom_voices.sql`
129.  `sql/migrations/129_backfill_user_owned_custom_voices_from_preferences.sql`
130.  `sql/migrations/130_quarantine_legacy_migrated_custom_voice_ownership.sql`
131.  `sql/migrations/131_add_user_issue_reports.sql`
132.  `sql/migrations/132_harden_public_data_api_default_privileges.sql`
133.  `sql/migrations/133_restore_model_pricing_policy_function_grants.sql`
134.  `sql/migrations/135_add_media_folder_count_rpcs.sql`
135.  `sql/migrations/136_restore_global_media_folder_authority.sql`
136.  `sql/migrations/137_retire_project_media_folder_authority.sql`
137.  `sql/migrations/138_retire_character_quickswap_tip_preference.sql`
138.  `sql/migrations/139_add_motion_reference_video_generation_leases.sql`
139.  `sql/migrations/140_add_admitted_reference_image_variant.sql`
140.  `sql/migrations/141_harden_storage_entitlement_helper_grants.sql`
141.  `sql/migrations/142_add_model_pricing_custom_row_manifests.sql`
142.  `sql/migrations/143_add_project_workspace_snapshot_freshness_guard.sql`
143.  `sql/migrations/144_retire_media_folder_canvas_states.sql`
144.  `sql/migrations/145_add_project_output_display_items.sql`
145.  `sql/migrations/146_harden_control_plane_scheduler_timeouts.sql`
146.  `sql/migrations/147_add_plan_concurrency_entitlements.sql`
147.  `sql/migrations/148_add_generation_projection_workflow_reload.sql`
148.  `sql/migrations/149_add_generation_projection_workspace_runtime_key.sql`
149.  `sql/migrations/150_restore_dashboard_announcement_publish_grants.sql`
150.  `sql/migrations/151_add_ai_studio_builtin_style_control_plane.sql`
151.  `sql/migrations/152_add_audio_generation_display_title.sql`
152.  `sql/migrations/153_add_dashboard_tutorials.sql`
153.  `sql/migrations/154_add_dashboard_tutorial_thumbnail_uploads.sql`
154.  `sql/migrations/155_add_dashboard_tutorial_thumbnail_display_derivatives.sql`
155.  `sql/migrations/156_add_user_preferences_deleted_builtin_presets.sql`
156.  `sql/migrations/157_add_generation_projection_error_payload.sql`
157.  `sql/migrations/158_disable_signup_seed_credit_grants.sql`
158.  `sql/migrations/159_repair_historical_generation_project_convergence.sql`
159.  `sql/migrations/160_repair_global_media_library_visibility.sql`
160.  `sql/migrations/161_harden_hidden_free_billing_offer.sql`
161.  `sql/migrations/162_repair_generation_projection_workflow_reload.sql`
162.  `sql/migrations/163_add_legal_policy_control_plane.sql`
163.  `sql/migrations/164_add_paid_signup_intent_gate.sql`
164.  `sql/migrations/165_account_first_signup_intent_gate.sql`
165.  `sql/migrations/166_grant_signup_hook_schema_usage.sql`
166.  `sql/migrations/167_add_google_ip_signup_intent.sql`
167.  `sql/migrations/168_retire_saved_creators.sql`
168.  `sql/migrations/169_add_audio_companion_art_scheduler_index.sql`
169.  `sql/migrations/170_add_media_files_ai_studio_source_ref_index.sql`
170.  `sql/migrations/171_add_ai_generations_terminal_repair_index.sql`
171.  `sql/migrations/172_schedule_worker_runs_retention.sql`
172.  `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql`
173.  `sql/migrations/174_remove_legacy_signup_seed_credit_grants.sql`
174.  `sql/migrations/175_enforce_storage_addon_no_stack.sql`
175.  `sql/migrations/176_add_app_error_events_admin_stats_source_index.sql`
176.  `sql/migrations/177_optimize_admin_global_stats_v1_rpc.sql`
177.  `sql/migrations/178_add_admin_stats_generated_columns.sql`
178.  `sql/migrations/179_optimize_media_storage_lifecycle_summary.sql`
179.  `sql/migrations/180_harden_scheduler_and_admin_error_summary.sql`
      Rollback files:


    - `sql/migrations/rollback/019_add_generation_recovery_fields_rollback.sql`
    - `sql/migrations/rollback/020_generation_runtime_convergence_rollback.sql`
    - `sql/migrations/rollback/021_generation_state_machine_constraints_rollback.sql`
    - `sql/migrations/rollback/022_generation_persist_idempotency_rollback.sql`
    - `sql/migrations/rollback/023_generation_reconciler_claims_rollback.sql`
    - `sql/migrations/rollback/024_fal_webhook_inbox_rollback.sql`
    - `sql/migrations/rollback/025_generation_recovery_leases_rollback.sql`
    - `sql/migrations/rollback/026_generation_recovery_transition_guards_rollback.sql`
    - `sql/migrations/rollback/027_fix_reservation_rpc_on_conflict_ambiguity_rollback.sql`
    - `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
    - `sql/migrations/rollback/029_fix_conversation_state_upsert_ambiguity_rollback.sql`
    - `sql/migrations/rollback/030_fix_conversation_state_upsert_conflict_target_rollback.sql`
    - `sql/migrations/rollback/039_admin_error_status_atomic_update_rollback.sql`
    - `sql/migrations/rollback/043_add_user_preferences_media_autosave_enabled_rollback.sql`
    - `sql/migrations/rollback/044_add_ai_studio_sessions_persistence_rollback.sql`
    - `sql/migrations/rollback/045_add_character_quickswap_deck_rollback.sql`
    - `sql/migrations/rollback/046_fix_character_quickswap_storage_scope_check_rollback.sql`
    - `sql/migrations/rollback/047_add_agent_safety_policy_control_plane_rollback.sql`
    - `sql/migrations/rollback/049_enforce_expert_default_beginner_mode_rollback.sql`
    - `sql/migrations/rollback/055_add_user_preferences_expert_edit_preset_panel_labels_rollback.sql`
    - `sql/migrations/rollback/056_add_user_preferences_expert_edit_preset_ids_and_custom_presets_rollback.sql`
    - `sql/migrations/rollback/057_add_user_preferences_ai_studio_deleted_style_ids_rollback.sql`
    - `sql/migrations/rollback/058_add_user_preferences_ai_studio_style_details_overrides_rollback.sql`
    - `sql/migrations/rollback/059_add_user_preferences_ai_studio_character_quickswap_tip_hidden_rollback.sql`
    - `sql/migrations/rollback/138_retire_character_quickswap_tip_preference_rollback.sql`
    - `sql/migrations/rollback/139_add_motion_reference_video_generation_leases_rollback.sql`
    - `sql/migrations/rollback/140_add_admitted_reference_image_variant_rollback.sql`
    - `sql/migrations/rollback/117_add_create_pulse_builtin_control_plane_rollback.sql`
    - `sql/migrations/rollback/118_canonicalize_character_metadata_media_ids_rollback.sql`
    - `sql/migrations/rollback/119_require_character_media_id_on_character_links_rollback.sql`
    - `sql/migrations/rollback/082_add_user_preferences_ai_studio_saved_voices_rollback.sql`
    - `sql/migrations/rollback/085_add_billing_plan_offers_and_subscription_contracts_rollback.sql`
    - `sql/migrations/rollback/086_add_internal_comp_billing_contract_support_rollback.sql`
    - `sql/migrations/rollback/087_add_storage_entitlements_and_recurring_storage_addons_rollback.sql`
    - `sql/migrations/rollback/107_add_generation_abandonments_rollback.sql`
    - `sql/migrations/rollback/110_add_admin_kanban_foundation_rollback.sql`
    - `sql/migrations/rollback/111_harden_admin_kanban_audit_integrity_rollback.sql`
    - `sql/migrations/rollback/060_add_media_folders_and_membership_rollback.sql`
    - `sql/migrations/rollback/061_backfill_media_image_dimensions_metadata_rollback.sql`
    - `sql/migrations/rollback/064_backfill_media_files_from_storage_objects_rollback.sql`
    - `sql/migrations/rollback/065_add_media_derivative_processing_fields_rollback.sql`
    - `sql/migrations/rollback/066_add_media_derivative_processing_rpcs_rollback.sql`
    - `sql/migrations/rollback/067_add_admin_user_health_fleet_automation_rollback.sql`
    - `sql/migrations/rollback/068_add_character_media_assets_isolation_rollback.sql`
    - `sql/migrations/rollback/069_harden_provider_attached_stale_cleanup_execute_grants_rollback.sql`
    - `sql/migrations/rollback/070_harden_queue_claim_collision_advisory_lock_rollback.sql`
    - `sql/migrations/rollback/073_add_media_folder_hierarchy_rollback.sql`
    - `sql/migrations/rollback/074_add_generation_worker_ops_rollback.sql`
    - `sql/migrations/rollback/075_add_generation_worker_leases_rollback.sql`
    - `sql/migrations/rollback/076_add_generation_projection_publication_and_observation_tables_rollback.sql`
    - `sql/migrations/rollback/077_add_generation_projection_source_ref_rollback.sql`
    - `sql/migrations/rollback/078_add_generation_fields_to_queue_claim_rollback.sql`
    - `sql/migrations/rollback/079_add_queued_dispatch_success_commit_rpc_rollback.sql`
    - `sql/migrations/rollback/102_add_admin_growth_stats_v1_rollback.sql`
    - `sql/migrations/rollback/081_add_generation_observation_inbox_claim_rpc_rollback.sql`
    - `sql/migrations/rollback/083_add_user_preferences_ai_studio_saved_pulses_rollback.sql`
    - `sql/migrations/rollback/100_add_admin_global_stats_v1_rpc_rollback.sql`
    - `sql/migrations/rollback/101_fix_admin_stats_and_pricing_rpc_lint_rollback.sql`
    - `sql/migrations/rollback/084_harden_billing_profile_and_stripe_event_rls_rollback.sql`
    - `sql/migrations/rollback/090_add_user_preferences_ai_studio_style_panel_ids_rollback.sql`
    - `sql/migrations/rollback/091_add_project_workspace_states_rollback.sql`
    - `sql/migrations/rollback/092_add_project_asset_associations_rollback.sql`
    - `sql/migrations/rollback/096_add_model_pricing_control_plane_rollback.sql`
    - `sql/migrations/rollback/093_add_project_generation_associations_rollback.sql`
    - `sql/migrations/rollback/094_add_project_media_folders_rollback.sql`
    - `sql/migrations/rollback/095_add_project_media_folder_canvas_states_rollback.sql`
    - `sql/migrations/rollback/136_restore_global_media_folder_authority_rollback.sql`
    - `sql/migrations/rollback/137_retire_project_media_folder_authority_rollback.sql`
    - `sql/migrations/rollback/097_retire_model_pricing_rounding_exceptions_rollback.sql`
    - `sql/migrations/rollback/098_add_billing_plan_creation_metadata_rollback.sql`
    - `sql/migrations/rollback/099_add_admin_global_stats_rpcs_rollback.sql`
    - `sql/migrations/rollback/103_sanitize_project_workspace_conversational_runtime_rollback.sql`
    - `sql/migrations/rollback/104_add_user_media_compliance_acceptances_rollback.sql`
    - `sql/migrations/rollback/108_retire_legacy_ai_studio_pulses_rollback.sql`
    - `sql/migrations/rollback/120_remove_legacy_onboarding_user_preference_rollback.sql`
    - `sql/migrations/rollback/122_retire_character_sheet_alias_compat_rollback.sql`
    - `sql/migrations/rollback/127_add_generation_projection_transcript_text_rollback.sql`
    - `sql/migrations/rollback/128_add_user_owned_custom_voices_rollback.sql`
    - `sql/migrations/rollback/129_backfill_user_owned_custom_voices_from_preferences_rollback.sql`
    - `sql/migrations/rollback/130_quarantine_legacy_migrated_custom_voice_ownership_rollback.sql`
    - `sql/migrations/rollback/131_add_user_issue_reports_rollback.sql`
    - `sql/migrations/rollback/143_add_project_workspace_snapshot_freshness_guard_rollback.sql`
    - `sql/migrations/rollback/152_add_audio_generation_display_title_rollback.sql`
    - `sql/migrations/rollback/153_add_dashboard_tutorials_rollback.sql`
    - `sql/migrations/rollback/154_add_dashboard_tutorial_thumbnail_uploads_rollback.sql`
    - `sql/migrations/rollback/155_add_dashboard_tutorial_thumbnail_display_derivatives_rollback.sql`
    - `sql/migrations/rollback/156_add_user_preferences_deleted_builtin_presets_rollback.sql`
    - `sql/migrations/rollback/157_add_generation_projection_error_payload_rollback.sql`
    - `sql/migrations/rollback/173_add_media_storage_lifecycle_diagnostics_rollback.sql`
    - `sql/migrations/rollback/174_remove_legacy_signup_seed_credit_grants_rollback.sql`
    - `sql/migrations/rollback/175_enforce_storage_addon_no_stack_rollback.sql`
    - `sql/migrations/rollback/177_optimize_admin_global_stats_v1_rpc_rollback.sql`
    - `sql/migrations/rollback/178_add_admin_stats_generated_columns_rollback.sql`
    - `sql/migrations/rollback/179_optimize_media_storage_lifecycle_summary_rollback.sql`
    - `sql/migrations/rollback/180_harden_scheduler_and_admin_error_summary_rollback.sql`

Hosted SQL lint note:

- Apply `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql` when linked-hosted lint surfaces the legacy admin stats `model_id` ambiguity or the `rollback_model_pricing_policy()` `%rowtype` warning.
- Apply `sql/migrations/102_add_admin_growth_stats_v1.sql` to provision `growth_attribution_identities` and `get_admin_growth_stats_v1()` before expecting `/admin/stats` Marketing/Sales lenses to load beyond safe fallback values.
- Apply `sql/migrations/104_add_user_media_compliance_acceptances.sql` before enforcing the protected-route media agreement gate so acceptance records can be stored and replayed by version.
- Apply `sql/migrations/112_repair_model_pricing_control_plane_seed.sql` if `/admin/pricing` can load the model-pricing workspace but credit conversion or markup changes do not persist because `model_pricing_policy_runtime` is missing its singleton row. Verify with `sql/check_model_pricing_control_plane.sql`.
- Apply `sql/migrations/142_add_model_pricing_custom_row_manifests.sql` before expecting `/admin/pricing` custom variant rows to persist through the model-pricing control plane alongside policy saves/rollbacks.
- Temporary rollout note for migration `142`: app code may fall back to the legacy 6-argument `apply_model_pricing_policy` RPC only while the submitted custom-row manifest is empty. That compatibility exists solely to bridge mixed hosted environments during the `142` rollout and should be removed after all hosted environments have `142` plus the matching grant repair from `133_restore_model_pricing_policy_function_grants.sql`.

Billing safety note:

- Migration `013_fix_generation_reservation_rpc_ambiguity.sql` is required to avoid
  `column reference "source_ref" is ambiguous` failures in reservation-mode Fal submit paths.
- Migration `014_harden_generation_reservation_rpc_security.sql` is required to enforce
  reservation RPC caller binding + execute grant hardening.
- Migration `019_add_generation_recovery_fields.sql` adds minimal recovery-state durability
  (`failure_reason_code`, `recovery_state`, retry timing fields, and reconciler indexes) without a new attempts table in v1.
- Migrations `020`-`023` converge runtime assumptions (no missing-column fallback), enforce status transitions,
  add media persistence idempotency keys, and provide `SKIP LOCKED` reconciler claim semantics.
- Migration `024_fal_webhook_inbox.sql` adds durable webhook idempotency/audit ingestion state.
- Migration `025_generation_recovery_leases.sql` adds claim leases to prevent concurrent re-processing of the same generation.
- Migration `026_generation_recovery_transition_guards.sql` keeps strict status transitions while allowing bounded recovery `fail -> success` convergence.
- Migration `027_fix_reservation_rpc_on_conflict_ambiguity.sql` resolves remaining reservation RPC ambiguity paths caused by
  `source_ref` output parameter name collisions inside `ON CONFLICT` clauses.
- Migration `018_add_ai_agent_conversation_state.sql` introduces canonical prompt continuity persistence.
- Migration `028_harden_ai_agent_conversation_state_security.sql` hardens conversation-state RPC grants, bounded TTL/cap policy, deterministic pruning, and cleanup operations.
- Migration `029_fix_conversation_state_upsert_ambiguity.sql` resolves PL/pgSQL name-collision ambiguity in conversation-state upsert delete path.
- Migration `030_fix_conversation_state_upsert_conflict_target.sql` resolves PL/pgSQL name-collision ambiguity in upsert `ON CONFLICT` targeting.
- Migration `031_release_stale_generation_reservations.sql` adds conservative stale reservation cleanup for pre-submit holds.
- Migration `032_admit_and_reserve_generation_credits.sql` adds flagged atomic admission+reserve evaluation in one DB transaction.
- Migration `033_fix_atomic_admission_rpc_ambiguity.sql` adds PL/pgSQL conflict-resolution posture (`#variable_conflict use_column`) to the atomic RPC after `42702` ambiguity failures observed in local validation.
- Migration `034_add_generation_submit_queue.sql` adds durable submit queue storage plus enqueue/claim RPCs for server-authoritative over-cap admission.
- Migration `035_exclude_queued_reservations_from_stale_cleanup.sql` hardens stale cleanup so active queued reservations are not auto-released.
- Migration `036_fix_queue_claim_locking.sql` rewrites queue claim selection to avoid PostgreSQL `FOR UPDATE` + window-function incompatibility (`0A000`) in dispatch batching.
- Migration `037_expand_recovery_claim_provider_scope.sql` broadens recovery claim filtering from exact `provider='fal'` to `provider like 'fal%'` so legacy Fal provider aliases are not stranded outside reconciler execution.
- Migration `038_harden_queue_claim_active_dispatching_guard.sql` prevents queue claim conflicts by excluding users that already hold an active unexpired `dispatching` lease, avoiding intermittent queue-status kick-dispatch `500` paths.
- Migration `039_admin_error_status_atomic_update.sql` adds an atomic admin incident-status RPC so event promotion/linking and status metadata updates cannot partially apply.
- Migration `040_harden_runtime_rpc_execute_grants.sql` enforces service-role-only execute grants for critical runtime/admin RPCs by revoking residual `anon`/`authenticated`/`public` execute privileges.
- Migration `041_harden_released_reservation_recapture_semantics.sql` stores reservation `release_finality` metadata (`conditional` default, `waived` explicit) and allows success-path recapture from released reservations when finality is not waived.
- Migration `042_harden_queue_recovery_rpc_execute_grants.sql` enforces service-role-only execute grants for queue/recovery enqueue and claim RPCs (`enqueue_generation_submit`, `claim_generation_submit_queue_batch`, `claim_generation_recovery_batch`).
- Migration `043_add_user_preferences_media_autosave_enabled.sql` adds `user_preferences.media_autosave_enabled` with a non-null default (`true`) so server/client autosave policy enforcement has a durable per-user contract.
- Migration `044_add_ai_studio_sessions_persistence.sql` adds durable AI Studio session snapshot persistence (`ai_studio_sessions`) with service-role-only save/get/list/prune RPCs and deterministic per-user cap/TTL pruning semantics.
- Migration `045_add_character_quickswap_deck.sql` adds dynamic Character Manager QuickSwap persistence (`character_quick_swap_items`), `character_quickswap` media-source integrity checks, and deterministic legacy backfill with 500-active archive behavior.
- Migration `046_fix_character_quickswap_storage_scope_check.sql` corrects the `character_quick_swap_items` storage-scope check to allow user-scoped character paths used by deterministic legacy backfill (not only `/quickswap/`-prefixed paths).
- Migration `073_add_media_folder_hierarchy.sql` adds explicit parent/child ancestry support to `media_folders` (`parent_folder_id`), sibling-scoped name uniqueness, same-user parent FK enforcement, and recursive cycle protection. Current panel UI may still use proxy navigation until the ancestry cutover lands.
- Migration `047_add_agent_safety_policy_control_plane.sql` adds agent safety policy version/runtime/event persistence with service-role RPCs for active/read, activate, and rollback operations.
- Migration `048_harden_agent_safety_policy_control_plane_grants.sql` hardens control-plane RPC execute posture to service-role-only.
- Migration `051_add_agent_safety_policy_version_rpc.sql` adds service-role-only policy version creation RPC support (`create_agent_safety_policy_version`) and audit event type expansion (`version_created`).
- Migration `052_extend_queue_recovery_provider_scope_to_kie.sql` updates queued-submit persistence to store provider family from enqueue inputs and broadens recovery claims from Fal-only to Fal/Kie provider families.
- Migration `053_fix_ai_studio_session_upsert_ambiguity.sql` resolves an ambiguity defect in AI Studio session snapshot upsert semantics to keep persistence writes deterministic.
- Migration `054_add_provider_attached_stale_reservation_cleanup.sql` adds a service-role-only RPC to release clearly stale provider-attached reserved holds and supports automated cleanup from the generation-recovery route.
- Migration `055_add_user_preferences_expert_edit_preset_panel_labels.sql` adds durable account-level Expert Edit preset panel label persistence (`user_preferences.expert_edit_preset_panel_labels`) with seeded defaults for new and existing users.
- Migration `056_add_user_preferences_expert_edit_preset_ids_and_custom_presets.sql` adds canonical Expert Edit preset ID allocation persistence (`user_preferences.expert_edit_preset_panel_ids`) plus preset override persistence (`user_preferences.expert_edit_custom_presets`) while preserving legacy label fallback compatibility.
- Migration `057_add_user_preferences_ai_studio_deleted_style_ids.sql` adds durable per-user Styles Library deletion persistence (`user_preferences.ai_studio_deleted_style_ids`) so deleted styles stay hidden across sessions/devices.
- Migration `156_add_user_preferences_deleted_builtin_presets.sql` adds durable per-user deletion persistence for admin-owned AI Studio built-ins (`user_preferences.expert_edit_deleted_system_preset_ids`, `user_preferences.ai_studio_deleted_builtin_pulse_ids`) so deleted Prompt Presets and Pulses can be restored per account without storing global built-in definitions in user preference payloads.
- Migration `157_add_generation_projection_error_payload.sql` adds `generation_projection.error_payload` for user-scoped raw provider/client failure detail shown in generated-output detail views.
- Migration `158_disable_signup_seed_credit_grants.sql` disables hidden-baseline signup credit grants so new users must select a paid Stripe-backed plan before receiving plan credits.
- Migration `161_harden_hidden_free_billing_offer.sql` forces the hidden `free` billing tier and offers to zero credits, zero storage, zero concurrency, no Stripe price, and non-acquisition status; it also blocks service-role activation of free or zero-price public plan offers.
- Migration `174_remove_legacy_signup_seed_credit_grants.sql` inserts bounded compensating debits for remaining retired `signup_seed` ledger grants, installs a trigger that rejects future positive `signup_seed` inserts, and reasserts that the hidden `free` tier/offers carry no credits, storage, concurrency, or public acquisition value.
- Migration `058_add_user_preferences_ai_studio_style_details_overrides.sql` adds durable per-user Styles Library metadata override persistence (`user_preferences.ai_studio_style_details_overrides`) for editing `style`, `title`, `referenceImageName`, and `stylePrompt` values.
- Migration `059_add_user_preferences_ai_studio_character_quickswap_tip_hidden.sql` added durable per-user Character panel QuickSwap guidance visibility persistence (`user_preferences.ai_studio_character_quickswap_tip_hidden`) before the embedded QuickSwap UX was retired.
- Migration `138_retire_character_quickswap_tip_preference.sql` removes the now-unused `user_preferences.ai_studio_character_quickswap_tip_hidden` column from the current schema contract.
- Migration `140_add_admitted_reference_image_variant.sql` adds the `media_asset_variants.variant_kind = 'admitted_reference_25mb'` constraint value for durable generated-image product-use admission derivatives. These derivatives do not change media storage accounting; the original `media_files` row remains the full-quality authority.
- Migration `141_harden_storage_entitlement_helper_grants.sql` revokes direct customer execute grants on `resolve_media_storage_base_limit_bytes(uuid)` and `resolve_media_storage_addon_limit_bytes(uuid)` so only `service_role` can call the arbitrary-user entitlement helpers. Authenticated clients must continue using `get_media_storage_quota_summary()`.
- Migration `082_add_user_preferences_ai_studio_saved_voices.sql` adds durable per-user AI Studio saved-voice persistence (`user_preferences.ai_studio_saved_voices`) so created ElevenLabs voices survive refreshes and provider outages.
- Migration `090_add_user_preferences_ai_studio_style_panel_ids.sql` adds durable per-user Styles Library ordering persistence (`user_preferences.ai_studio_style_panel_ids`) so the primary library panel and right-rail Styles chooser share one canonical tile order.
- Migration `104_add_user_media_compliance_acceptances.sql` adds versioned per-user media agreement acceptance records (`user_media_compliance_acceptances`) so the protected-route compliance gate can store one-time acceptance history with the accepted timestamp, IP address, and user agent.
- Migration `105_enforce_spendable_balance_for_direct_generation_charges.sql` hardens `enforce_credit_ledger_insert()` so direct generation debits cannot spend credits already reserved by active generation reservations.
- Migration `106_add_annual_billing_intervals_and_credit_allocation_cursors.sql` adds annual billing interval support plus per-contract credit-allocation cursors so yearly subscriptions and recurring grants stay idempotent across renewals and replays.
- Migration `109_add_generation_projection_project_id.sql` adds `generation_projection.project_id` plus a project-scoped read index so project Reference Grid reads can resolve generated outputs without depending solely on junction repair timing.
- Migration `110_add_admin_kanban_foundation.sql` adds shared admin kanban persistence (`admin_kanban_items`, `admin_kanban_activity`) with RLS enabled, service-role-only table access, soft archive semantics, and activity logging for admin task-board mutations.
- Migration `111_harden_admin_kanban_audit_integrity.sql` moves admin kanban mutations into service-role-only transactional RPCs, restricts activity parent deletion, and makes move activity logging row-lock accurate under concurrent transitions.
- Migration `sql/migrations/113_add_admin_kanban_review_status.sql` adds the `review` board status to admin kanban item/activity constraints and the service-role move RPC.
- Migration `060_add_media_folders_and_membership.sql` adds user-owned Media Library folders (`media_folders`) and scoped media/prompt membership junctions (`media_folder_media_items`, `media_folder_prompt_items`) for AI Studio folder-based organization.
- Migration `061_backfill_media_image_dimensions_metadata.sql` canonicalizes legacy image-dimension metadata keys to `metadata.width`, `metadata.height`, and `metadata.aspect_ratio` so masonry surfaces can render true image ratios consistently.
- Migration `062_add_dashboard_announcements.sql` adds global dashboard announcement persistence with one-active-row enforcement, authenticated active-only reads, and service-role-only publish RPC semantics for admin-managed broadcasts.
- Migration `150_restore_dashboard_announcement_publish_grants.sql` restores service-role execute access for the dashboard announcement publish RPC while keeping public, anon, and authenticated browser roles denied.
- Migration `151_add_ai_studio_builtin_style_control_plane.sql` adds the service-role-only `ai_studio_builtin_style_runtime` singleton control-plane table for global built-in AI Studio Styles edited from `/admin/agent-instructions` and read by authenticated runtime clients through `/api/ai/built-in-styles`.
- Migration `163_add_legal_policy_control_plane.sql` adds service-role-only version/runtime/event tables plus `get_active_legal_policy` and `publish_legal_policy` RPCs for runtime-backed public legal policy pages edited from `/admin/legal`.
- Migration `153_add_dashboard_tutorials.sql` adds the admin-managed `dashboard_tutorials` table for signed-in dashboard tutorial cards with active ordered reads, service-role writes, an atomic service-role reorder RPC, HTTPS thumbnail metadata, and no Supabase image transformations.
- Migration `154_add_dashboard_tutorial_thumbnail_uploads.sql` adds the private `dashboard_tutorial_thumbnails` bucket plus stored-thumbnail columns so admins can upload local GIF/image/video tutorial thumbnail source files without Supabase image transformations.
- Migration `sql/migrations/155_add_dashboard_tutorial_thumbnail_display_derivatives.sql` adds durable display-derivative and poster metadata for dashboard tutorial thumbnails so dashboard reads can sign small app-owned display objects while preserving uploaded originals as source material.
- Migration `063_add_media_folder_canvas_states.sql` added per-user/per-folder Media Library canvas snapshot persistence (`media_folder_canvas_states`) with folder-owner scoped cascade deletion before the folder-canvas runtime was retired.
- Migration `064_backfill_media_files_from_storage_objects.sql` backfills missing durable `media_files` rows from `storage.objects` for All Media completeness (idempotent user/path insert checks, transient/character/variant exclusions, and rollback-target metadata tagging).
- Migration `065_add_media_derivative_processing_fields.sql` adds image-derivative retry/lease control fields on `media_files`, an insert-default trigger that marks new image rows `pending`, and claim/backlog indexes for derivative workers.
- Migration `066_add_media_derivative_processing_rpcs.sql` adds service-role-only derivative claim/update RPCs (`claim_media_derivative_batch`, `mark_media_derivative_ready`, `mark_media_derivative_failed`) using `SKIP LOCKED` claim semantics.
- Migration `067_add_admin_user_health_fleet_automation.sql` adds scheduled admin fleet-risk snapshot persistence and service-role maintenance RPC posture for the admin-user-health control plane.
- Migration `068_add_character_media_assets_isolation.sql` adds `character_media_assets`, dual-reference compatibility columns (`character_media_id`) on Character Manager linkage tables, containment-safe integrity checks, and backfill for slot/quickswap/profile/preset character assets.
- Migration `118_canonicalize_character_metadata_media_ids.sql` rewrites `characters.metadata` profile-image and preset references onto canonical `character_media_id` keys and strips legacy metadata linkage keys.
- Migration `119_require_character_media_id_on_character_links.sql` backfills any remaining slot/QuickSwap row linkage onto `character_media_assets`, retires row-level `media_file_id` coupling from the live Character Manager path, and hardens slot/QuickSwap integrity around required `character_media_id`.
- Migration `119_require_character_media_id_on_character_links.sql` backfills remaining slot and QuickSwap linkage rows onto `character_media_assets`, removes legacy `media_file_id` dependence on those tables, and requires `character_media_id` going forward.
- Migration `122_retire_character_sheet_alias_compat.sql` removes the legacy `reference_pack_*` compatibility bridge after verified zero-drift audits across staging and production, scrubs legacy metadata keys, drops alias sync triggers/constraints, and removes the retired alias columns.
- Migration `069_harden_provider_attached_stale_cleanup_execute_grants.sql` hardens `release_stale_provider_attached_generation_reservations` execute posture to service-role-only.
- Migration `095_add_project_media_folder_canvas_states.sql` adds `project_media_folder_canvas_states` so Media Library custom-folder canvas snapshots can persist by `user_id + project_id + folder_id` on project routes while the legacy user-scoped folder canvas table remains in place for non-project surfaces.
- Migration `136_restore_global_media_folder_authority.sql` backfills project-scoped Media Library folder trees, memberships, and folder-canvas snapshots into the canonical global `media_folders*` and `media_folder_canvas_states` authority, preserving folder ids and suffixing only imported sibling-name collisions.
- Migration `137_retire_project_media_folder_authority.sql` removes the obsolete project-scoped Media Library folder tables and count RPC after the global authority backfill and runtime cutover are verified.
- Migration `144_retire_media_folder_canvas_states.sql` removes the retired `media_folder_canvas_states` table after the Media Library folder-canvas runtime, APIs, and tests were deleted and the shared right-rail Canvas became the only shipped canvas surface.
- Migration `145_add_project_output_display_items.sql` adds large-project output display records plus checkpoint revision freshness support for project workspace snapshots, backfills display rows from existing rich project snapshots, and adds a display-row trigger that preserves newest-source writes while keeping per-output versions monotonic.
- Migration `146_harden_control_plane_scheduler_timeouts.sql` hardens the recovery and admin-fleet Supabase scheduler HTTP calls with explicit `60000ms` timeouts and restores the missing `service_role` execute grant for `create_agent_safety_policy_version(...)`.
- Migration `147_add_plan_concurrency_entitlements.sql` adds versioned plan concurrency entitlements to billing offers and subscriber contracts, seeds the `starter/media/studio/business` `1/2/4/8` active-generation ladder, and sets non-public baseline fallback generation concurrency to `0`.
- Migration `160_repair_global_media_library_visibility.sql` repairs hosted All Media completeness with a temp-table-free durable storage backfill, including first-class audio storage classes, so production pooler behavior cannot strand global Media Library rows.
- Migration `169_add_audio_companion_art_scheduler_index.sql` adds a narrow claim index for the audio companion-art scheduler's existing `NULL`/`pending`/`failed` work predicate so empty scheduler passes do not repeatedly scan `generation_projection`.
- Migration `170_add_media_files_ai_studio_source_ref_index.sql` adds a narrow AI Studio media lookup index for generation-owned recovery and reconciliation reads by `user_id + source_ref`.
- Migration `171_add_ai_generations_terminal_repair_index.sql` adds a narrow terminal-generation scan index for the generation projection repair loop's existing `success`/`fail` + `completed_at` predicate.
- Migration `172_schedule_worker_runs_retention.sql` schedules daily hosted pg_cron retention for completed `ok` rows in the service-role-only `worker_runs` generation control-plane run ledger after 30 days, preserving incomplete/running rows and error rows. The migration does not perform one-time historical cleanup; production cleanup remains an explicit operator step with before/after proof.
- Migration `176_add_app_error_events_admin_stats_source_index.sql` adds a narrow partial source/user/time index for the telemetry rows read by admin global and growth stats RPCs, avoiding repeated full scans of the append-only `app_error_events` incident stream.
- Migration `177_optimize_admin_global_stats_v1_rpc.sql` keeps the `/api/admin/stats/global` payload contract intact while removing TOAST-heavy `ai_generations.metadata` from the shared generation CTE inside `get_admin_global_stats_v1()` and isolating autosave metadata reads to their own aggregate.
- Migration `178_add_admin_stats_generated_columns.sql` adds generated scalar projections for the admin stats autosave decision and generation-projection style/character/reference flags, then points `get_admin_global_stats_v1()` at those scalars so dashboard reads do not repeatedly reopen TOAST-heavy JSON payloads.
- Migration `180_harden_scheduler_and_admin_error_summary.sql` adds the missing explicit `60000ms` timeout to the internal billing renewals scheduler and provisions service-role-only `get_admin_error_events_summary_v1(...)` so `/api/admin/error-events` can load fixed summary counters through one aggregate RPC instead of many hot-table exact-count calls.
- Migration `173_add_media_storage_lifecycle_diagnostics.sql` adds the service-role-only `voice_source_lifecycle` proof table plus the aggregate Media Library storage lifecycle diagnostic RPC used by the disabled-by-default internal dry-run route. It returns counts/bytes by lifecycle class without raw object paths or user ids and does not delete storage objects.
- Migration `179_optimize_media_storage_lifecycle_summary.sql` keeps that aggregate Media Library lifecycle RPC contract intact while staging storage rows and reference rows through temp tables so hosted dry-run reporting avoids the prior timeout-prone all-in-one CTE plan.
- Migration `175_enforce_storage_addon_no_stack.sql` updates base plan storage to `0/5/25/75/150 GB`, refreshes recurring storage add-on metadata to `10/50/100/250 GB` self-serve plus `500 GB` manual review, closes old public storage add-on offers until matching Stripe Prices are activated, clamps add-on quota math to one unit, and adds the database guard for one current billable recurring storage add-on per user with quantity exactly one; run `sql/check_billing_storage_addon_no_stack_drift.sql` before applying it.
- Read-write hosted-Supabase maintenance script `sql/configure_cron_job_run_details_retention_supabase.sql` prunes old `cron.job_run_details` rows, compacts the pruned table, and schedules daily retention; the active-status index is documented as an owner-only follow-up if retention alone does not reduce pg_cron status-update scan I/O enough.
- Read-only performance diagnostics script `sql/check_media_preview_variant_coverage_and_size.sql` reports source-class counts, variant-hint coverage, and p50/p90 size distributions for Media Library preview-risk triage.
- Read-only derivative backlog diagnostics script `sql/check_media_derivative_processing_backlog.sql` reports image-row processing status/attempt distributions as aggregate buckets only, without row ids, user ids, or storage paths in hosted artifacts.
- Read-only Character Media V2 diagnostics script `sql/check_character_media_isolation_backfill.sql` reports `character_media_assets` coverage, unmapped legacy linkage rows, and profile/preset metadata completeness.

## Media storage scope verification (post-017)

After applying migrations `016_harden_media_storage_path_scope.sql` and `017_harden_media_storage_path_shape.sql`:

1. Run drift diagnostics:
   - Execute `sql/check_media_storage_scope_drift.sql`.
2. Confirm every row reports `mismatch_count = 0`.
3. If any mismatch remains:
   - Run `sql/migrations/009_repair_legacy_media_storage_paths.sql` (safe to re-run).
   - Re-run `sql/check_media_storage_scope_drift.sql`.

## Character Sheet compatibility verification (post-012 / pre-122)

After applying migration `012_add_character_sheet_aliases_and_compat.sql`:

1. Run drift diagnostics:
   - Execute `sql/check_character_sheet_alias_drift.sql`.
2. Confirm every row reports `mismatch_count = 0`.
3. If any mismatch remains, re-run migration `012` and validate trigger health before promoting to production.

Deprecation note:

- Legacy aliases (`active_reference_pack_id`, `reference_pack_id`, `reference_pack_assignments`) were intentionally supported only until migration `122_retire_character_sheet_alias_compat.sql` was applied.
- For any future environment that has not yet applied `122`, do not apply it until drift checks stay at zero and legacy-only rows stay at zero.

## Character Sheet alias retirement (post-122)

After applying migration `122_retire_character_sheet_alias_compat.sql`:

1. Run the read-only readiness/drift audit again:
   - Execute `sql/check_character_sheet_alias_drift.sql`, or
   - Run `npm -C frontend run audit:character-sheet-alias-readiness` with the target environment credentials.
2. Confirm every `mismatch_count` remains `0`.
3. Confirm no legacy-only rows remain in `characters.metadata`, `character_reference_images`, `character_generation_jobs`, or character-reference `media_files` metadata.

Retirement note:

- Legacy alias columns/keys are removed by migration `122`.
- Migration `122_retire_character_sheet_alias_compat.sql` is expected to remain safe on environments where the legacy alias columns were already retired; its preflight skips alias drift checks once those columns are absent.
- `npm -C frontend run audit:character-sheet-alias-readiness` is safe before and after retirement; after migration `122` it reports `aliasColumnsPresent: false` for the retired compatibility columns.
- `character_reference_packs` remains the table name; only the compatibility aliases are retired.
