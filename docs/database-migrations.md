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
- For production-targeted one-off Supabase CLI commands, require explicit target pinning with `--project-ref <production-ref>`.
- Do not run `npm run db:reset` in normal agent workflows; this command defaults to local Docker-backed reset behavior.

## Production deploy workflow

1. Apply migrations to staging and verify.
2. Schedule production migration window.
3. Apply production migrations.
4. Deploy app code dependent on the migration.
5. Run post-deploy smoke checks.

Safety posture:
- Keep the local default Supabase link on staging.
- Do not rely on implicit linked-project targeting for production operations.

## Rollback strategy

- Preferred: run paired rollback migration.
- Fallback: execute targeted corrective SQL and redeploy the previous known-good app revision.
- Always document migration failures and corrections in project docs.

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

If enabling Character Panel Media Isolation V2 (character-owned assets decoupled from Media Library), also apply:

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
50. `sql/migrations/049_enforce_expert_default_beginner_mode.sql`
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
75. Rollback files:
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
- Migration `049_enforce_expert_default_beginner_mode.sql` forces expert-first mode defaults by setting `user_preferences.beginner_mode` default to `false` and backfilling existing rows to `false`; rollback restores only the new-row default (`true`).
- Migration `051_add_agent_safety_policy_version_rpc.sql` adds service-role-only policy version creation RPC support (`create_agent_safety_policy_version`) and audit event type expansion (`version_created`).
- Migration `052_extend_queue_recovery_provider_scope_to_kie.sql` updates queued-submit persistence to store provider family from enqueue inputs and broadens recovery claims from Fal-only to Fal/Kie provider families.
- Migration `053_fix_ai_studio_session_upsert_ambiguity.sql` resolves an ambiguity defect in AI Studio session snapshot upsert semantics to keep persistence writes deterministic.
- Migration `054_add_provider_attached_stale_reservation_cleanup.sql` adds a service-role-only RPC to release clearly stale provider-attached reserved holds and supports automated cleanup from the generation-recovery route.
- Migration `055_add_user_preferences_expert_edit_preset_panel_labels.sql` adds durable account-level Expert Edit preset panel label persistence (`user_preferences.expert_edit_preset_panel_labels`) with seeded defaults for new and existing users.
- Migration `056_add_user_preferences_expert_edit_preset_ids_and_custom_presets.sql` adds canonical Expert Edit preset ID allocation persistence (`user_preferences.expert_edit_preset_panel_ids`) plus preset override persistence (`user_preferences.expert_edit_custom_presets`) while preserving legacy label fallback compatibility.
- Migration `057_add_user_preferences_ai_studio_deleted_style_ids.sql` adds durable per-user Styles Library deletion persistence (`user_preferences.ai_studio_deleted_style_ids`) so deleted styles stay hidden across sessions/devices.
- Migration `058_add_user_preferences_ai_studio_style_details_overrides.sql` adds durable per-user Styles Library metadata override persistence (`user_preferences.ai_studio_style_details_overrides`) for editing `style`, `title`, `referenceImageName`, and `stylePrompt` values.
- Migration `059_add_user_preferences_ai_studio_character_quickswap_tip_hidden.sql` adds durable per-user Character panel QuickSwap guidance visibility persistence (`user_preferences.ai_studio_character_quickswap_tip_hidden`) so high-density deck users do not repeatedly see the same embedded tip bubble.
- Migration `060_add_media_folders_and_membership.sql` adds user-owned Media Library folders (`media_folders`) and scoped media/prompt membership junctions (`media_folder_media_items`, `media_folder_prompt_items`) for AI Studio folder-based organization.
- Migration `061_backfill_media_image_dimensions_metadata.sql` canonicalizes legacy image-dimension metadata keys to `metadata.width`, `metadata.height`, and `metadata.aspect_ratio` so masonry surfaces can render true image ratios consistently.
- Migration `062_add_dashboard_announcements.sql` adds global dashboard announcement persistence with one-active-row enforcement, authenticated active-only reads, and service-role-only publish RPC semantics for admin-managed broadcasts.
- Migration `063_add_media_folder_canvas_states.sql` adds per-user/per-folder Media Library canvas snapshot persistence (`media_folder_canvas_states`) with folder-owner scoped cascade deletion.
- Migration `064_backfill_media_files_from_storage_objects.sql` backfills missing durable `media_files` rows from `storage.objects` for All Media completeness (idempotent user/path insert checks, transient/character/variant exclusions, and rollback-target metadata tagging).
- Migration `065_add_media_derivative_processing_fields.sql` adds image-derivative retry/lease control fields on `media_files`, an insert-default trigger that marks new image rows `pending`, and claim/backlog indexes for derivative workers.
- Migration `066_add_media_derivative_processing_rpcs.sql` adds service-role-only derivative claim/update RPCs (`claim_media_derivative_batch`, `mark_media_derivative_ready`, `mark_media_derivative_failed`) using `SKIP LOCKED` claim semantics.
- Migration `067_add_admin_user_health_fleet_automation.sql` adds scheduled admin fleet-risk snapshot persistence and service-role maintenance RPC posture for the admin-user-health control plane.
- Migration `068_add_character_media_assets_isolation.sql` adds `character_media_assets`, dual-reference compatibility columns (`character_media_id`) on Character Manager linkage tables, containment-safe integrity checks, and backfill for slot/quickswap/profile/preset character assets.
- Migration `069_harden_provider_attached_stale_cleanup_execute_grants.sql` hardens `release_stale_provider_attached_generation_reservations` execute posture to service-role-only.
- Read-only performance diagnostics script `sql/check_media_preview_variant_coverage_and_size.sql` reports source-class counts, variant-hint coverage, and p50/p90 size distributions for Media Library preview-risk triage.
- Read-only derivative backlog diagnostics script `sql/check_media_derivative_processing_backlog.sql` reports image-row processing status/attempt distributions and top retry/exhausted candidates.
- Read-only Character Media V2 diagnostics script `sql/check_character_media_isolation_backfill.sql` reports `character_media_assets` coverage, unmapped legacy linkage rows, and profile/preset metadata completeness.

## Media storage scope verification (post-017)

After applying migrations `016_harden_media_storage_path_scope.sql` and `017_harden_media_storage_path_shape.sql`:

1. Run drift diagnostics:
   - Execute `sql/check_media_storage_scope_drift.sql`.
2. Confirm every row reports `mismatch_count = 0`.
3. If any mismatch remains:
   - Run `sql/migrations/009_repair_legacy_media_storage_paths.sql` (safe to re-run).
   - Re-run `sql/check_media_storage_scope_drift.sql`.

## Character Sheet compatibility verification (post-012)

After applying migration `012_add_character_sheet_aliases_and_compat.sql`:

1. Run drift diagnostics:
   - Execute `sql/check_character_sheet_alias_drift.sql`.
2. Confirm every row reports `mismatch_count = 0`.
3. If any mismatch remains, re-run migration `012` and validate trigger health before promoting to production.

Deprecation note:
- Legacy aliases (`active_reference_pack_id`, `reference_pack_id`, `reference_pack_assignments`) remain intentionally supported during rollout.
- Do not remove legacy aliases until drift checks stay at zero through at least one full release cycle across all environments.
