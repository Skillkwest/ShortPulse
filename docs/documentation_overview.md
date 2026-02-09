# Documentation Overview & Needs

Current docs:
- `README.md`: setup, env, frontend-only architecture, manual data actions.
- `docs/README.md`: documentation index (start here).
- `docs/agents/change-impact-auditor.md`: scope + doc impact checklist.
- `docs/mvp-stabilization-plan.md`: procedural MVP plan and scope lock.
- `docs/repo-structure.md`: canonical repo layout and where to put new work.
- `docs/architecture-overview.md`: system at a glance (client-only + Supabase flows).
- `docs/local-development.md`: local setup and canonical commands.
- `docs/release-checklist.md`: pre-merge quality and safety checks.
- `docs/troubleshooting.md`: common setup/build/auth/Supabase failure modes and fixes.
- `docs/known-issues.md`: tracked issues and environment-specific failures.
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
- `docs/api-fal-kling-3-pro-image-to-video.md`: Fal.ai Kling 3.0 Pro image-to-video queue reference.
- `docs/api-fal-kling-3-pro-text-to-video.md`: Fal.ai Kling 3.0 Pro text-to-video queue reference.
- `docs/api-fal-veo3-image-to-video.md`: Fal.ai Veo 3.1 image-to-video queue reference.
- `docs/api-fal-seedream-4-5-edit.md`: Fal.ai Seedream 4.5 image-to-image/edit queue reference.
- `docs/sop_performance_ai_detection.md`: performance analytics scoring vs. AI labeling contract (non-ranking).
- `docs/sop_media_library_ui.md`, `docs/sop_saved_creators.md`: UI and data flow specifics for those pages.
- `docs/sop_ai_studio_agent_chat_ops.md`: operational runbook for AI Studio chat agent (UI entry points, context pipeline, fallbacks, validation).
- `docs/supabase_full_schema.sql`: combined Supabase schema for `saved_creators`, `media_files`, and the private media bucket policies.
- Frontend routes: `/dashboard`, `/ai-studio`, `/media-library`, `/profile`, `/admin` (see README for summary). `/saved-creators` and `/performance` are post‑MVP.
- Palette constraints live in `docs/styles-structure.md` (single source).
- `docs/adr/`: architecture decision records (ADRs).
- `docs/design/`: design rationale docs (palette, systems).
- `docs/brainstorming/`: non-authoritative early concepts and research notes.
- `docs/sop_ai_studio_index.md`: hub for AI Studio vertical SOPs (text/image/video) and shared defaults.
- `docs/sop_billing_credits_operations.md`: billing/credits migration and admin adjustment runbook.
- `skills/skill-pricing-audit/SKILL.md` + `skills/skill-doc-index/SKILL.md`: lightweight maintenance skills.

Recommended additions:
- Light-weight frontend test harness once priority components stabilize.
- More examples of Supabase row-level policy patterns for new tables if added.
- Use ADRs (`docs/adr/`) as durable decisions are made.
- Add an automated schema health check endpoint for billing tables in each environment.

Status: Docs now reflect the frontend-only architecture; keep them updated alongside UI and Supabase schema changes.
