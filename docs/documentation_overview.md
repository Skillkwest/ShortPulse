# Documentation Overview & Needs

Current docs:
- `README.md`: setup, env, endpoints, visualization summary.
- `docs/sop_ingestion_and_refresh.md`: runbook for Apify → Supabase ingestion.
- `docs/frontend-architecture.md`: frontend layout and feature module pattern.
- `docs/styles-structure.md`: CSS split, responsibilities, and import order.
- `docs/backend-architecture.md`: FastAPI layout, ingestion flow, and endpoints.
- `docs/conventions.md`: code/comment/style guardrails and size limits.
- `docs/sop_new_feature_modularization.md`: checklist for adding features within the modular structure.
- `docs/testing-guide.md`: how/when to run and add tests (current focus: backend logic).
- `docs/contributor-guide.md`: collaboration expectations, reviews, migrations.
- `docs/data-dictionary.md`: core tables and derived metric definitions.
- `docs/security-checklist.md`: required auth/authorization controls and RLS expectations.
- `docs/backlog.md`: idea/task backlog.
- `docs/progress_log.md`: session log.
- `docs/api_reference.md`: endpoint details and sample payloads.
- `docs/deployment_guide.md`: how to deploy backend/frontend with envs and process guidance.
- `docs/run_visibility.md`: what to monitor and how to check ingestion health.
- Frontend routes: `/` dashboard hub, `/performance` analytics view, `/creator-studio` placeholder, `/media-library` placeholder (see README for summary).
- Dark UI palette: avoid any #21211e / #1f201c / #1e1e1b range; use #1c1f20 as the panel/base tone across surfaces.

Recommended additions:
- **Testing Guide**: how to run unit tests (metrics math, ingestion mapping) and any linting/formatting.
- **Contributor Guide**: branching/PR expectations, code style, and how to add migrations safely.
- **Data Dictionary**: fields in `reels_raw_events` and `reels_latest_state` with meaning and types, plus derived metrics definitions.

Status: Core setup, modular architecture, styling, and feature SOP docs are present; add the remaining recommended docs as we stabilize deployments and API usage.
