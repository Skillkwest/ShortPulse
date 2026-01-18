# Documentation Overview & Needs

Current docs:
- `README.md`: setup, env, frontend-only architecture, manual data actions.
- `docs/README.md`: documentation index (start here).
- `docs/repo-structure.md`: canonical repo layout and where to put new work.
- `docs/architecture-overview.md`: system at a glance (client-only + Supabase flows).
- `docs/local-development.md`: local setup and canonical commands.
- `docs/release-checklist.md`: pre-merge quality and safety checks.
- `docs/troubleshooting.md`: common setup/build/auth/Supabase failure modes and fixes.
- `docs/glossary.md`: definitions for domain terms used across docs/UI.
- `docs/frontend-architecture.md`: layout and feature module pattern.
- `docs/styles-structure.md`: CSS split, responsibilities, and import order.
- `docs/conventions.md`: code/comment/style guardrails and size limits.
- `docs/sop_new_feature_modularization.md`: checklist for adding features within the modular structure.
- `docs/testing-guide.md`: how/when to test (currently manual frontend focus).
- `docs/contributor-guide.md`: collaboration expectations.
- `docs/data-dictionary.md`: Supabase tables, media schema, and demo analytics fields.
- `docs/security-checklist.md`: auth/storage isolation and RLS expectations.
- `docs/backlog.md`: idea/task backlog.
- `docs/change_log.md`: session log.
- `docs/shortpulse_ai_studio.md`: AI Studio purpose, scope, and route reference.
- `docs/sop_performance_ai_detection.md`: performance analytics scoring vs. AI labeling contract (non-ranking).
- `docs/sop_media_library_ui.md`, `docs/sop_saved_creators.md`: UI and data flow specifics for those pages.
- `docs/supabase_full_schema.sql`: combined Supabase schema for `saved_creators`, `media_files`, and the private media bucket policies.
- Frontend routes: `/dashboard`, `/performance`, `/ai-studio`, `/media-library`, `/saved-creators`, `/profile` (see README for summary).
- Dark UI palette: avoid any #21211e / #1f201c / #1e1e1b range; use #1c1f20 as the panel/base tone across surfaces.
- `docs/adr/`: architecture decision records (ADRs).
- `docs/design/`: design rationale docs (palette, systems).
- `docs/brainstorming/`: non-authoritative early concepts and research notes.

Recommended additions:
- Light-weight frontend test harness once priority components stabilize.
- More examples of Supabase row-level policy patterns for new tables if added.
- Use ADRs (`docs/adr/`) as durable decisions are made.

Status: Docs now reflect the frontend-only architecture; keep them updated alongside UI and Supabase schema changes.
