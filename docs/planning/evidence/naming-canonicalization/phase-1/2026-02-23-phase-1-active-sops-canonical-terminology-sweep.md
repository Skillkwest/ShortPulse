# Naming Canonicalization Phase 1 Active SOP Canonical Terminology Sweep

## Metadata
- Date: 2026-02-23
- Phase: 1 (Active docs canonicalization)
- Slice: Active SOP canonical terminology follow-up sweep
- Owner: Frontend + Docs Governance

## Scope
1. Canonicalized active SOP references:
- `TextPropertiesPanel` -> `CreatePropertiesPanel`
- `ReferenceCanvas` -> `ReferenceGrid`
2. Updated active SOP code-path references from legacy wrapper files to canonical file ownership paths where applicable.
3. Kept historical docs (`docs/change_log.md`, planning history, archive docs) unchanged by policy.

## Changed Files
- `docs/sops/sop_video_generation.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_text_generation.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_agent_chat_ops.md`
- `docs/sops/sop_media_performance_operations.md`
- `docs/sops/sop_ai_studio_index.md`
- `docs/sops/sop_adaptive_media_change_control.md`

## Validation
- `npm -C frontend run docs:check` - Pass
- Canonical path existence checks:
  - `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` - Pass
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx` - Pass

## Notes
- This is a docs-only naming sweep; no runtime code, UI behavior, or styling was changed.
