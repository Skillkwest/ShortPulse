# SOP Index

Purpose: operational runbooks for recurring engineering and product workflows.

## Scope
- AI Studio generation workflows.
- Billing and credits operations.
- Route/domain-specific UI workflows.
- Modularization and new-model ingestion procedures.

## Authoring rules
- Keep SOPs procedural and implementation-aware.
- Link to source-of-truth code paths instead of copying large code blocks.
- Prefer a stable structure: scope, prerequisites, workflow, error handling, maintenance.
- If the process is durable architecture (not only operation), add/update an ADR in `docs/adr/`.

## Naming
- Use `sop_<domain>.md`.
- Put new SOPs in this folder and add them to `docs/README.md`.

## Active SOPs
- `docs/sops/sop_character_manager_operations.md` (canonical `/character` runbook)
- `docs/sops/sop_ai_studio_index.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_agent_chat_ops.md`
- `docs/sops/sop_adaptive_media_change_control.md`
- `docs/sops/sop_text_generation.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_video_generation.md`
- `docs/sops/sop_saved_creators.md`
- `docs/sops/sop_media_library_ui.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/sops/sop_media_performance_operations.md`
- `docs/sops/sop_performance_ai_detection.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/sops/sop_provider_incident_response.md`
- `docs/sops/sop_new_model_ingestion.md`
- `docs/sops/sop_new_feature_modularization.md`
- `docs/sops/sop_naming_canonicalization_rollback.md`

## Archived Legacy SOPs (reference only)
- `docs/archive/sops/sop_character_generation.md` (legacy pipeline context; superseded by `docs/sops/sop_character_manager_operations.md`)
- `docs/archive/sops/sop_character_identity.md` (legacy pipeline context; superseded by `docs/sops/sop_character_manager_operations.md`)
