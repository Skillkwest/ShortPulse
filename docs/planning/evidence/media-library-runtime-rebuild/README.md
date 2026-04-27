# Media Library Runtime Rebuild Evidence

Purpose: store execution evidence packets for the 2026-03-28 Media Library runtime rebuild program.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `phase`
4. `surface_scope`
5. `commands_run`
6. `results`
7. `risk_class`
8. `rollback_note`
9. `linked_pr_or_commit`
10. `task_contract_checklist`
11. `audit_findings` (`blocking`, `non-blocking`, `deferred`)
12. `follow_up_actions`

## Naming format
Use dated packet names:
1. `YYYY-MM-DD-<slice-id>-<short-topic>.md`

## Closeout rule
- `MLR-0-S2` is not complete until the evidence set includes both:
  1. the automated characterization bundle for route, modal, panel, signing, and store seams
  2. heavy media-library browser repro coverage across route, modal, and panel on large datasets

## Linked docs
1. `docs/archive/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md`
2. `docs/archive/planning/media-library-runtime-rebuild-tracker-2026-03-28.md`
3. `docs/sops/sop_media_library_ui.md`
4. `docs/sops/sop_ai_studio_media_library_operations.md`

## Packets
1. `docs/planning/evidence/media-library-runtime-rebuild/2026-03-28-mlr-0-s2-characterization-and-freeze-repro-baseline.md`
2. `docs/planning/evidence/media-library-runtime-rebuild/2026-03-28-mlr-0-s2-heavy-browser-repro-packet.md`
3. `docs/planning/evidence/media-library-runtime-rebuild/2026-03-28-mlr-5-s2-closeout-audit.md`
