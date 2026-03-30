# ShortPulse v1

Short-form analytics and creative workspace surfaces built on Next.js with Supabase auth/storage and internal API routes for provider proxying, billing, uploads, and runtime orchestration.

## Tech

- Frontend: Next.js (pages router), Phosphor icons, modular CSS.
- Auth/storage: Supabase client with persisted sessions, `saved_creators` table, and a private `media_library` bucket.
- Analytics: In-browser scoring of a demo cohort with user-triggered refresh and filtering controls.
- AI Studio providers: Next.js API routes under `/api/fal/*` proxy Fal and Kie submit/status requests (server-side keys required). Fal routes include Seedream/Nano Banana/Kling/Veo families plus FLUX Fill inpaint routes (`/api/fal/flux-pro-fill-submit`, `/api/fal/flux-pro-fill-status`) and Bria background remove routes (`/api/fal/bria-background-remove-submit`, `/api/fal/bria-background-remove-status`). Kie routes are exposed at `/api/fal/kie-veo-submit`, `/api/fal/kie-veo-status`, `/api/fal/kie-kling-submit`, and `/api/fal/kie-kling-status`.
- AI Studio session persistence APIs: authenticated save/get/list routes under `/api/ai/sessions/*` provide server-side durable snapshot persistence (`POST /api/ai/sessions/save`, `GET /api/ai/sessions/:sid`, `GET /api/ai/sessions?limit=&cursor=`) behind `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` (default enabled). Client persistence gates are centralized under `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED` (master switch; default enabled) plus scoped controls (`NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED`, `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED`, `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED`, `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`, `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED`) so disabled mode is applied consistently across write, restore, and session-list paths.
- AI Studio style extraction helper route: authenticated `POST /api/ai/extract-style` extracts reusable style descriptors plus a creative style title from uploaded/dropped images used in Styles Library create flows, with trusted-host URL preflight and model retry/fallback handling.
- AI Studio safety-control runtime knobs are centrally gated: `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default true, server pre-provider gate for `/api/ai/studio-agent`), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATE_PROMPT_ENABLED` (default true), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default true), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default true), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), shared/scoped field-mode overrides (`STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATE_PROMPT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT`), client mirrors (`NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`), `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` (default false), `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` (default `production_normalized`), `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` (default false), `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` (bounded `1..168`, default `24`), and control-plane runtime sync controls `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (default true) plus `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (bounded `1000..60000`, default `5000`).
- Kie provider routes remain runtime-gated (fail-closed by default): `SHORTPULSE_KIE_INTEGRATION_ENABLED=false` disables Kie submit/status calls unless explicitly enabled and allowlisted.
- Fal runtime v2 operational routes: `/api/fal/webhook` (signature-verified webhook ingestion), `/api/fal/queue-status` (authenticated read-only queued-submit status handoff that now distinguishes `queued` vs `dispatching` pre-provider phases), and `/api/internal/generation-recovery/run` (cron-secret protected reconciler + queue dispatcher trigger).
- Local generation worker helper: `npm -C frontend run dev:generation-worker` runs the shared generation control-plane loop directly in local development, writes a heartbeat under `frontend/.tmp/`, and is required for localhost queue mode to drain.
- Media derivative operations route: `/api/internal/media-derivatives/run` (cron-secret protected image-derivative worker that claims `media_files` image rows, generates local `sharp` derivatives, and writes `thumb_*` variants under `media_asset_variants`).
- Queue/recovery scheduling is externalized: configure Supabase Cron to call `/api/internal/generation-recovery/run` every minute via `sql/configure_generation_recovery_scheduler_supabase.sql`; keep `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` configured for auth.
- Local AI Studio media uploads: `/api/upload-image` and `/api/upload-video` are compatibility adapters for transient reference uploads. They reuse the shared server-authoritative upload validation/storage path, preserve legacy `{ url, path, size }` responses, and emit usage telemetry for sunset review.
- Media Library server-authoritative uploads: `/api/media/upload` validates destination + file signature server-side, writes user-scoped storage paths, persists `media_files` rows, and returns signed preview metadata from the canonical derivative-first path (flagged by `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`).
- Media Library server-authoritative URL copy fallback: `/api/media/copy-from-url` performs authenticated trusted-host remote fetch + storage persistence when browser-side media fetch is blocked (CORS/security/network families).
- Media preview signing: `/api/media/sign-batch` signs user-scoped authoritative preview paths in a single authenticated request with surface-aware preview-profile headers (route/modal/panel). Transform-backed delivery is compatibility-only and disabled by default unless both `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED=true` and `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED=true`.
- AI Studio Media Library folder APIs: `/api/media/folders/list|create|rename|delete|membership-batch` plus `/api/media/prompts/list` provide user-scoped folder CRUD, membership assign/unassign/move operations (`all_items` remains virtual root), and prompt pagination for the left-panel Media Library surface. Folder-canvas persistence APIs are `/api/ai/media-folder-canvas/[folderId]` (load) and `/api/ai/media-folder-canvas/save` (save).
- Billing/credits: Supabase-backed plan/profile/credit ledger model with Stripe-ready checkout, portal, webhook routes, and authenticated credit snapshot reads at `/api/credits/snapshot` (available + pending reservation holds).
- Ops telemetry: authenticated app/runtime failures can be ingested at `/api/log/client-error`, viewed as grouped incidents via `/api/admin/errors`, and inspected as raw occurrences via `/api/admin/error-events`; admins can update one (`/api/admin/errors-status`) or many (`/api/admin/errors-status-bulk`) incident statuses and smoke-test visibility via `/api/admin/errors-test`.
- Admin access gating: `/api/admin/access` provides lightweight server-authoritative admin access checks so admin pages do not depend on `/api/admin/users` list fetches for authorization gating.
- Admin fleet health automation: `/api/internal/admin-user-health-fleet/run` runs a bounded active-user fleet scan (cron-secret protected), persists compact snapshots/findings, and optionally emits report-only incidents (`source=ops.user_health_fleet`).
- Admin fleet health report API: `/api/admin/user-health-fleet` returns latest (or selected) fleet run summaries, findings, and paginated user snapshots with filter/search support.
- Dashboard announcements: authenticated users read the active global dashboard bulletin via `/api/announcements/active`; admins manage current state with `/api/admin/announcements/current|publish|clear`.
- Agent safety control-plane admin APIs: `/api/admin/agent-safety-policy/active`, `/api/admin/agent-safety-policy/activate`, `/api/admin/agent-safety-policy/rollback`, and `/api/admin/agent-safety-policy/version` provide authenticated profile activation/rollback/version controls with cooldown-aware rollback safety.
- Optional alert tuning: set `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, and `SHORTPULSE_ADMIN_ALERT_GENERATION_15M` to control Admin event-spike thresholds; set `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_CRITICAL_RISK` and `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_WARNING_COST_WITHOUT_SUCCESS_CENTS` for fleet report-only incident escalation thresholds.

## Setup

1. Copy `frontend/.env.example` to `frontend/.env.local` (or export the values in your shell) and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_KEY`
   - optional provider key for Kie routes: `KIE_API_KEY` (or `SHORTPULSE_KIE_API_KEY`)
2. Install and run the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   This starts the Next.js app, including server API routes under `frontend/pages/api/*`.
   If local queue mode is enabled (`SHORTPULSE_FAL_QUEUE_ENABLED=true` and `APP_BASE_URL=http://localhost:3000`), run the generation worker in a second terminal:
   ```bash
   cd frontend
   npm run dev:generation-worker
   ```

## Optional Supabase bootstrap

- Supabase tooling policy: use Supabase CLI for Supabase access and avoid Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
- Saved creators: run `sql/create_saved_creators_table.sql` to add the `saved_creators` table with RLS.
- Media library: run `sql/storage_policies.sql` to create the private `media_library` bucket and folder-scoped storage policies. The UI also expects a `media_files` table (see `docs/supabase_full_schema.sql` for a combined script).
- Private tab support: run `sql/migrations/003_add_private_media_source.sql` and `sql/migrations/004_add_private_media_integrity_checks.sql` to enforce `media_files.source` values and private path/file-type integrity.
- Billing + credits: run `sql/create_billing_credit_tables.sql` to provision plans, credit packages, billing profiles, ledger, and signup allocation triggers.
- Legacy billing environments: run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` to add `source/source_ref/metadata/created_by` columns and compatibility triggers before using `/admin` credit adjustments.
- App error telemetry: run `sql/create_app_error_logs_table.sql` and `sql/migrations/015_add_app_error_events.sql` to provision grouped incidents plus immutable per-occurrence events.
- SQL migration operations SOP: `docs/sops/sop_sql_migration_operations.md` (canonical run order, drift/repair loop, and common SQL error fixes).

## Manual data actions

- Performance Analytics (`/performance`) provides a demo refresh + filtering workflow for the sample dataset.
- Root entry (`/`) now routes users through `/dashboard` (unauthenticated users are redirected to `/auth` by the dashboard guard).
- Saved Creators and Media Library actions write/read directly through the Supabase client from the frontend (Saved Creators is post‑MVP).

## Frontend surfaces

- **Dashboard (`/dashboard`)**: Launchpad with plan/status chips and a `New Project` quick action into AI Studio. The hero helper slot renders an active global announcement when one exists, and fails soft to default helper copy otherwise. Set `NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS=false` to temporarily restore legacy quick-start/workflow cards, tools grid, footer helper text, and Searches header metric during redesign work.
- **Performance Analytics (`/performance`)**: Authenticated demo analytics surface (staged rollout; dashboard currently points to `/performance-soon`).
- **Performance Placeholder (`/performance-soon`)**: Temporary landing page that explains the analytics workspace is still under construction.
- **Saved Creators (`/saved-creators`)**: Post‑MVP (Coming Soon); per-user handle list.
- **Media Library (`/media-library`)**: Upload/download/delete/rename/move files across media tabs in a private Supabase bucket, including a Private image tab (`<auth.uid()>/private/images/...`).
- **Profile (`/profile`)**: Profile/account/billing UI with plan badges, Stripe billing actions, credit purchase entry points, and an AI Studio media autosave account setting.
- **AI Studio (`/ai-studio`)**: Creative canvas for prompt systems, model/aspect selection, previewing, and saving image/video outputs. Session identity uses `?sid=<uuid>`; plain `/ai-studio` creates a new session id. Beginner mode is temporarily force-disabled and toggle controls are hidden by runtime policy flags. Expert Edit properties panel is the default Edit experience; set `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` to force legacy Edit panel fallback. Set `NEXT_PUBLIC_AI_STUDIO_MARKUP_MODEL_LOCK_ENABLED=true` to lock Markup tool model branding/submission to Pulse Markup v1 (disabled by default). Set `NEXT_PUBLIC_AI_STUDIO_MARKUP_COLLAPSED_OPEN_MODAL_ENABLED=true` to prototype collapsed `Tools` opening expanded Markup modal directly; closing modal re-collapses tools (disabled by default). Set `NEXT_PUBLIC_AI_STUDIO_MARKUP_STROKE_SECONDARY_REFERENCE_ENABLED=true` to attach a second Markup-only reference input containing flattened layers plus markup strokes when strokes are present (disabled by default). Set `NEXT_PUBLIC_AI_STUDIO_EDIT_GENERATION_MODE_TOGGLE_ENABLED=true` to show a selector-row Standard/Inpaint/Markup generation mode toggle (disabled by default). Expert Edit prompt supports direct secondary-slot references via `@img1`, `@img2`, and `@img3` tokens, including drag-to-insert from the secondary reference slots and an anchored picker that opens from bare `@` or `Tab` when populated references exist, defaults to the first populated reference, cycles with `Tab`, and inserts the selected token on `Enter`. When `NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED=true`, the Create chat lane defaults to the backend-gated direct OpenAI bypass and can forward staged image attachments as multimodal input so users can ask for image descriptions that return generation-ready prompts.
  Double-clicking image/video references in the Reference Grid or Quick Slot Inventory opens the detail modal, where `Save` persists that media into `All Media` in the Media Library and sits to the left of `Download`.
  On refresh/new session in non-canvas workflows, the right-rail `Canvas` panel starts hidden by default. The AI Studio Character properties panel now lands on `Character Profile` first and serves as the primary character-management surface; the standalone `/character` route remains the secondary entrypoint. The embedded Character panel keeps leaner QuickSwap chrome than `/character` by omitting the legacy helper paragraph and hiding the collapse toggle in expert mode.
  `Libraries -> Media Library` opens a primary left-panel Media Library surface (tool id `media-library`) with root/custom folder organization and media/prompt browse/add flows; `All Media` is the master folder and target UX renders inline tabs (`Images`, `Videos`, `Prompts`) within the same root folder (masonry for media with true aspect ratio, prompt text cards), with near-bottom infinite scroll auto-load on media tabs and one global root media paginator footer retained as manual fallback. Gesture runtime (`NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED`) enables custom drag ghosts, right-click media ingest from `All Media`, and root permanent delete actions. Double-clicking `All Media` image/video cards opens a preview-only detail modal (no ingest side effects). Custom-folder canvas spaces are always enabled for user folders, with independent camera/scene persistence (`user + folder`) and Shift-drag export behavior via `/api/ai/media-folder-canvas/[folderId]` + `/api/ai/media-folder-canvas/save`. Set `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false` to fallback to the legacy modal path during staged rollback.
  `Shortcuts -> Styles` opens the primary left-panel Styles Library and keeps the right rail in reference-grid-only mode; the first style tile is a fixed `None` slot and cannot be edited, deleted, or reordered. The right-rail Styles panel mirrors this with the same `None` tile as the first option. The Styles Library supports drag/drop reordering of custom style cards in-grid, drag/drop image intake from your computer/Reference Grid/Quick Slot (from visible right-rail surfaces) to auto-create custom styles, and an `Add Style` tile that opens a create-style modal. Direct Canvas image drag-out is deferred in V1. Clicking a real style card in the Styles Library opens an edit modal for `Style`, `Reference Image`, and `Style Prompt` without changing the active Create/Edit workflow style; only right-rail Styles tile selection applies styles to generation workflows, and selecting a right-rail style closes that panel immediately. Dropped/uploaded reference images are center-cropped to a square for the style preview card. `Shortcuts -> Presets` opens the primary left-panel Presets Library using the Expert Edit preset catalog with `Custom 1`, `Custom 2`, and `Custom 3` placeholder tiles plus a full-size `Create New Preset` tile. Clicking a preset card opens an edit modal for preset name + prompt text. Each preset card includes a top-right delete button that opens a yes/no confirmation modal before permanently deleting that preset from the user library. Clicking `Create New Preset` opens the modal in create mode for the next custom slot (`Custom 4+`). Saves persist via the shared per-user preset override preference.
  New-style creation from image intake now auto-runs style extraction to populate `Style Prompt`, auto-generates a style title for the new card name fields, and analyzes from the best available source image while keeping manual prompt editing available.
  When a style is selected in Create/Edit, the style prompt is appended to the hidden generation submission prompt while preserving the visible user prompt text.
  The left toolbar includes a `Sessions` action that lists recent persisted sessions and supports explicit save-and-switch restoration back into AI Studio.
- **Character Manager (`/character`)**: Character creation and management workspace with persisted reference intake and persisted character-sheet assignments. Character Sheet preset tabs are dynamic (`1..10`): new users start with only tab `1` labeled `Double click me`, `+` adds tabs, double-click rename autosaves per user/character, and tabs after `1` can be deleted via `X` with confirmation (removes that tab's saved preset references). Character Profile description is also preset-scoped per active tab and persists in metadata. AI Studio Character Mode injects active-tab description first, then falls back to legacy character description when empty. The same preset-tab behavior is used in the AI Studio Character Properties panel via shared shell logic. Beginner toggle controls are temporarily hidden by the same runtime policy used by AI Studio.
- **Character Placeholder (`/character-soon`)**: Legacy fallback landing page retained during Character Manager rollout.
- **Admin (`/admin`)**: Internal operator dashboard (operator-role access) with manual credit adjustment controls, per-user recent credit transaction audit (including billed-vs-raw pricing metadata), a live app-error incident feed, and an Announcements tab for publishing/clearing the one active dashboard bulletin.
- **Admin User Health (`/admin/user-health`)**: Operator diagnostics page for user-level generation + credit-drainage health checks (lookup by user id or email, findings, and recommended next actions).
- **Admin Fleet Health (`/admin/user-health-fleet`)**: Operator fleet triage page for active-user hourly health snapshots, risk/severity/finding filters, and direct drill-down links into per-user health and generation trace workflows.

## Security

- Only the Supabase anon key is used on the client; never share the service role key.
- Enable RLS on `saved_creators` and `media_files` (per-user isolation) and keep the `media_library` bucket private with paths prefixed by `auth.uid()`.
- Route protection: `/dashboard`, `/performance`, `/performance-soon`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/creator-studio`, `/character`, `/character-soon`, and `/admin` expect authenticated sessions and redirect to `/auth` when missing.
- API protection: announcement routes, provider proxy routes, media routes, billing routes, upload routes, and admin routes require bearer-authenticated Supabase sessions.

## Testing

- Unit tests:
  ```bash
  cd frontend
  npm run test
  ```
- Full validation:
  ```bash
  cd frontend
  npm run validate
  ```
- One-pass repo sweep (major CI-aligned breakpoints):
  ```bash
  bash scripts/run_repo_sweep.sh
  ```
- Dead-code guard rail:
  ```bash
  cd frontend
  npm run deadcode:check
  ```
- E2E harness command (add specs incrementally):
  ```bash
  cd frontend
  npm run test:e2e
  ```

## Docs

- Start at `docs/README.md`.
- Character Manager operations runbook: `docs/sops/sop_character_manager_operations.md`.
- SQL migration operations runbook: `docs/sops/sop_sql_migration_operations.md`.
- Expert Edit prompt reference tokens runbook: `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`.
- AI Studio session persistence (full canvas durability) packet:
  - SOP: `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
  - ADR: `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`

## Repo layout

- `frontend/`: Next.js app
- `docs/`: documentation
- `sql/`: Supabase bootstrap scripts

## Roadmap / changelog

- Roadmap: `ROADMAP.md`
- Changelog: `docs/change_log.md`

-
