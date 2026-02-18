# ShortPulse Change Log

Append new entries at the end of this file; each entry should include date (UTC) and a brief summary of completed work.

## 2025-12-11
- Read all project MD docs (color system, naming log, performance index) to align scope and palette.
- Initialized backend FastAPI service with models, ingestion pipeline (Apify), percentile scoring, and scheduler.
- Added Alembic migration and SQL script for Supabase tables (`reels_raw_events`, `reels_latest_state`).
- Built Next.js frontend with dark palette, scatter visualization (Recharts), highlighting top performers.
- Added setup instructions, env sample with Supabase host, and repo ignores.
- Added API reference, deployment guide, and run visibility docs; added `/ingest/status` endpoint, basic percentile test, and pytest dependency.

## 2025-12-11 (later)
- Pulled `origin/main`, resolved merge artifacts, and cleaned tracked build outputs (`frontend/.next`, `node_modules`, Python `__pycache__`, `.DS_Store`).
- Created project-root `.env` (Supabase connection, Apify token + actor), ensured backend loads env correctly, and standardized on Python 3.11 venv for compatibility.
- Verified backend boots (`uvicorn backend.app.main:app --reload`) and `/health` responds `ok`; confirmed frontend boots via `npm run dev`.
- Updated branding from ShortFlow to ShortPulse across frontend (title, meta, badge), backend app title, docs, schema comments, and package docstring; recorded env + naming changes.

## 2026-02-05
- Rebuilt the frontend into a simplified dashboard hub with three cards (Performance Analytics, Creator Studio placeholder, Media Library placeholder) and quick stats on time ranges/signals/security.
- Added dedicated Performance Analytics page with 7d/30d/90d windows, refresh + sample dataset, preview grid (dummy thumbnails), outlier list, and enhanced scatter empty-state handling.
- Added Creator Studio and Media Library placeholder pages with secure/user-isolation messaging for future wiring to Supabase auth/storage.
- Extended README and documentation overview to reflect new routes and surfaces; added empty-state messaging in scatter.

## 2026-12-12
- Redesigned landing page for conversion (hero clean-up, pricing section matching reference, three-step timeline, feature tiles, refreshed testimonials).
- Removed unused hero snapshot panel, simplified typography to system stack, and reduced rounded-card clutter; pricing cards now float on dark background with teal checks.
- Standardized dark palette (panels at #1c1f20, removed brown/amber gradients), updated docs to note palette rule.
- Updated FAQ, CTA, and button styles; adjusted spacing/radii across landing to improve breathing room.
- Removed the tracked 100MB Next SWC binary from history, force-pushed `main`, and synced `sandbox/playground`; kept `.env.local` untracked.
- Re-ran pricing and steps sections to match reference visuals; thinned typography and set font stack to system UI.

## 2026-12-13
- Created architecture/conventions docs (`frontend-architecture`, `styles-structure`, `backend-architecture`, `conventions`, `sop_new_feature_modularization`) plus testing, contributor, data dictionary, and security checklist; updated documentation overview.
- Refactored auth page to match the reference UI (icons, teal CTA, polished inputs), enabled Supabase session persistence/auto-refresh, added info messaging for sign-up confirmation, and redirect to dashboard after sign-in.
- Removed demo-credentials footer text and cleaned back navigation: media library, saved creators, and performance pages now link back to the dashboard.

## 2026-12-14
- Iterated dashboard UX: reordered tool cards, refreshed card imagery, tuned hover/spacing, added "Searches" status chip, enforced plan-color rules (Free white, Media green, Studio teal, Business amber).
- Added logout confirmation modal to the dashboard profile menu; signing out returns to landing.

## 2027-01-01
- Rebuilt AI Studio canvas: fixed left rail with logo/back link, simplified header bar, and unified panel styling (`rgba(201,205,214,0.08)` card treatment).
- Expanded Create tool panel with Enhance/Image/Video actions, fixed dropdown rows for aspect/model, and added Save prompt/Media library quick actions plus aligned icons and themed selects.
- Rebalanced layout spacing (padding, gutters, equal-height panels) and documented the refreshed toolbar workflow in the AI Studio docs.
- Refined welcome hero: overlapping art with centered Quick Start card; ensured button cards have controllable image sizing.
- Created Profile page with left-nav (profile/account/billing), plan badge, and logout modal; added shared styles for profile layout and modals.
- Applied full-bleed hero art backgrounds to Performance, Media Library, and Saved Creators top cards using the latest PNGs.

## 2026-12-31
- Performance Analytics: rewrote the Top videos cards so the hero score, views, and outlier metrics are more prominent with centered widgets, teal-only rank badges, and grid-aligned platform/niche rows whose pills now shrink to their text.
- Added the floating “Sort” dropdown in the list header so the feed can be reordered by score, views, outlier, velocity, or engagement while keeping the refresh CTA spaced apart; results count now lives beside the primary search bar.
- Introduced a Clear button on the numeric filters row plus teal-framed pill styling updates, and boosted spacing around the sorting control plus the hero helper copy, background, and card border finishes to match the rest of the app.
- Documentation: refreshed the hero helper copy in `performance/constants.ts` to describe the on-page scoring and filtering workflow.

## 2026-12-14 (later)
- Polished hover affordances: header stat cards now show a pointer cursor with teal-outline lift on hover; avatar/profile card mirrors the same motion.
- Restored Quick Start card interactivity while keeping hero art non-interactive; card now shows pointer cursor and retains lift/outline hover effect.
- Kept existing hero image sizing/position intact while adjusting hover states; no visual regression to artwork placement.

## 2026-12-14 (saved-creators polish + TikTok link debugging)
- Saved Creators hero now uses the updated Gray.png at full opacity (removed dark overlays) and spacing harmonized across back link, hero, intake, and list (24px rhythm). Dashboard Saved Creators tool card also points to the refreshed Gray.png.
- Intake/input UX: custom platform dropdown, dark handle input with subdued autofill, thinner text; alignment/spacing adjustments across cards/tables; uniform gaps between stacked panels.
- Saved list table: converted to spreadsheet layout with row-level borders (no bleed under actions), circular avatar badges with teal outline/dark fill/muted teal outline icon, and profile/remove actions right-aligned.
- Header chips: plan card icon changed to circular check; searches and plan chips share hover lift/outline/pointer behavior.
- TikTok profile links hardened: sanitized handles (strip zero-width/nbsp/whitespace, drop leading @, URL-encode), platform normalization, `?lang=en`, `referrerPolicy=no-referrer`; noted persistent failure in ChatGPT Atlas despite working in Chrome. Added known-issues entry for Atlas TikTok link failure.
- Documentation: added `docs/sops/sop_saved_creators.md` describing data flow, layout, link building, avatar rules, spacing, and known TikTok issue; added `docs/known-issues.md` entry for TikTok-in-Atlas error with mitigation attempts listed.
- Assets: updated `frontend/public/Gray.png` from master root and wired it to both Saved Creators hero and dashboard Saved Creators card.

## 2026-12-14 (media library refresh)
- Mirrored Saved Creators hero onto Media Library with new title/lede, plan chip, and a Media Storage header card (using dashboard hover affordance) plus swapped hero art to `media-library-hero.png` copied from the root reference.
- Unified Media Library background to saved-creators dark theme; flattened upload hero and media panels to saved-creator card styling via `media-panel` class and body override.
- Aligned panel spacing (18px rhythm), adjusted upload card padding/gaps, and recolored panel backgrounds to the shared ash-08 tone.
- Refined upgrade (“Need more storage?”) button: brand amber text, warmer/darker glow, hover lift with controlled brightness.
- Added `docs/sops/sop_media_library_ui.md` covering header composition, media panel styling, upload spacing, upgrade hover rules, and asset locations.

## 2026-12-29
- Removed the backend entirely (FastAPI, Alembic, API docs) and rewrote the repo to be frontend-only with Supabase client usage; updated README, env sample, schemas, security/testing/contributor docs, and documentation overview accordingly.
- Renamed `progress_log.md` to `change_log.md` and updated all references.
- Added user-triggered data actions on the Performance page (refresh/rescore/reset), rebuilt demo scoring logic client-side, and retitled the hero to “Performance Analytics.”
- Reworked dashboard hero visuals: separated cards from art, adjusted image size/position, matched dashboard background to saved creators, tweaked quick-start card hovers, outlines, and plan colors; added workflow lessons card alongside onboarding.
- Updated workflow/onboarding card hover lift and outline styling (amber outline, no glow) for consistency with other tiles.
- Swapped the dashboard header text mark for the new brand logo asset and sized it to fit the app bar.

## 2026-12-29 (later)
- Iterated dashboard hero art positioning (drip image sizing and right-shift) while keeping cards above it; aligned image center with welcome card center.
- Replaced the header logo with the provided `ShortPulse Logo.png`, scaled it up, and repositioned it right within the app bar without resizing the bar.
- Refined quick-start card hover motion to match other tiles and kept the workflow card amber outline thin.
- Set dashboard body background to match Saved Creators; kept performance hero title simplified to “Performance Analytics.”

## 2026-12-29 (performance & dashboard polish)
- Performance page: kept the hero stats row (searches + plan) and relocated the “Refresh videos” CTA into the Top videos card header with right alignment; added live refresh timestamp and action pill support.
- Styling polish: unified filter button outlines for date/platform pills, bumped refresh CTA padding for a larger hit area, and increased spacing above the Top videos grid for better breathing room.
- Dashboard header: reordered stat cards to Media Storage → Searches → AI credits → Plan, with profile remaining last.

## 2026-12-31 (AI Studio rebuild)
- Rebuilt `/ai-studio` into a Photoshop-style workspace: left tool rail, center preview + recent rail, right properties panel; header uses mirrored AI Studio art with inline AI credits (sparkle icon) and Plan (shield icon) cards on a single row and back-to-dashboard above.
- Hero copy simplified to “AI Studio”; removed amber hero overlay in favor of full-image treatment; stat cards now opaque to avoid bleed-through.
- Preview panel gradient switched to a dark charcoal blend (no amber glow); toolbar hover glows removed for calmer idle state.
- Documentation: updated `docs/product/shortpulse_ai_studio.md` with the current UI snapshot and layout description.

## 2027-01-02 (AI Studio create flow & preview polish)
- Refined Create step cards: increased padding/gaps, added numbered “Select mode / Frame & model / Write your prompt” flow with conditional steps (Enhance hides frame/model), dynamic Generate icon per mode, and left-aligned toolbar icon centering.
- Added Reference Canvas/Studio Preview layout tweaks: reference card header now empty by default, and Studio Preview hosts two compact drop zones (file + text) with subdued icon/text, top-left aligned and resizable; drop zones restyled/darkened and resized for better balance.
- Adjusted panel grid widths (wider Reference column, narrower Studio Preview) and multiple drop-zone size reductions; introduced transparent reference-drop surface to remove extra containers.
- Renamed toolbar “Image-to-Image” tool to “AI reGen” and swapped its icon to the swap-style `ArrowFatLinesRight` for clearer regen semantics.

## 2027-01-02 (later, AI Studio drag/drop & cards)
- Reference Canvas now supports draggable previews: generated image cards carry a background image; prompt-mode cards carry text. Both can be dragged into Studio Preview drop zones (images into Image Reference, text into Prompt).
- Studio Preview drop zones hide outlines/content when populated; Image Reference shows the dropped image and Prompt shows dropped text. Added cover/background sizing for image drops.
- Reference Canvas panel made transparent, with its grid in a scrollable container; five-column card grid, zero gaps. Recent grid tightened to 8-wide with smaller gaps.
- Prompt textarea scrollbar restyled to a thin, minimal thumb. Added dummy preview placeholders for generated items to simulate media.

## 2027-01-03 (AI Studio recreate flow + drop targets)
- Replaced the Image Regen edit panel with a two-step Recreate card (Drop Image, Drop prompt) mirroring the Create steps, including numbered badges, carded drop zones, and persistent Save/Regenerate actions.
- Added auto-seeding rules: first generated image/prompt populate the Studio Preview drop zones when empty; Save Prompt captures the current prompt as a text card; external image files can be drag-dropped directly into the Reference Canvas grid and seed previews.
- Added a compact square preview above the drop zones, refined Recreate card spacing, and realigned buttons inside the card; removed the Recreate card from the Studio Preview column to reduce clutter.

## 2027-01-04 (AI Studio create/recreate polish)
- Added subtitles and spacing refinements to the Create and Recreate tool headers; tightened header/subtitle gaps for consistency.

## 2026-02-05
- Added MVP stabilization plan and aligned docs to current MVP scope (post‑MVP notes, route map, release checklist, testing guidance, and palette rule placement).
- Expanded doc index coverage and cleaned stale SOP references; clarified file-size guidance as advisory.

## 2026-02-05 (later)
- Phase 1 pricing work: credits now debit for image tool runs and prompt refine/describe flows; video duration/resolution/audio controls are wired into pricing and submissions; model media type supports image-to-video.
- Added Change Impact Auditor agent doc and two maintenance skills (pricing audit + doc index).
- Added `docs:check` script hook and documented maintenance skill usage in the agent playbook.

## 2027-01-05 (AI Studio accent + controls polish)
- Centralized AI Studio accent theming behind a single `--ai-accent-base` variable to drive badges, toolbar icons, hover outlines, and primary/active button gradients; updated borders and hover states to inherit from the shared token.
- Refined badge and toolbar UX: step badges now have fixed square dimensions (no oval deformation on resize) and optional onboarding badges are hidden until the onboarding flow is reintroduced.
- Button polish: Generate button enlarged with inline credit count + sparkle indicator, hover lift increased, text color aligned with active tab styling, and accent gradients applied to mode toggles/primary actions.
- Control affordances: aspect ratio and model selectors now share the accent-hover outline/motion, and drop-zone/selection borders respect the unified accent variable.
- Documentation-only note: placeholder media fetch failures remain known during prototyping; no functional change yet.
- Flattened the Recreate flow: pulled action buttons into Step 3, stacked the drop zones vertically with two extra image slots, and added plus-only placeholders; resized and fine-tuned drop zone spacing and aspect ratios.
- Replaced the prompt drop surface with a typed textarea (scrollable, matching Create textarea sizing/styling) and aligned its height to the Create Step 3 input.
- Show the generated prompt under Studio Preview as a scrollable card (label removed) and styled the Studio Preview column with the same card treatment and spacing as the Create column while leaving the Reference Canvas un-carded.

## 2027-01-19 (AI Studio toolbar + model picker overhaul)
- Simplified the AI Studio toolbar to top-level Create and Pulse actions with nested Image to Image / Image to Video that reveal only when Pulse is selected; default state now hides cards until a tool is chosen.
- Restored the header container in a condensed form (half height), removed the title/helper copy and plan/credit stat cards, and flattened the header/logo borders to blend with their backgrounds.
- Enlarged primary toolbar labels, compacted edit child buttons, and made the Generate button taller with larger text.
- Replaced model dropdowns with a “Select model here” button that opens an anchored modal of nine dummy models; modal now stays aligned to the trigger, includes a left-edge pointer to the trigger, and repositions on resize/scroll.
- Centered the Reference Canvas empty state and right-aligned media actions; darkened UI text and dropzone borders per recent polish.

## 2027-01-05 (AI Studio reference details & cleanup)
- Removed the Recent panel from `/ai-studio` to give more room to the workspace and Reference Canvas.
- Added a reference detail modal: double-clicking a canvas card opens media details; prompt references use a simplified text-first layout with a scrollable prompt body, while image/video references keep the preview + metadata layout. Save-to-Media button is UI-only.
- Added a toggleable reference indicator in Create Step 2 (manual toggle; only visible in Prompt mode) and made reference cards open the new modal on double-click.
- Raised the Reference Canvas scroll height to show more rows without scrolling.

## 2027-01-09
- Added an “Image to Video” tool beside Create/Organize by reusing the existing recreate card layout so the same steps (Add Image, Choose Frame & Model, Add Prompt + Save/Regenerate actions) are available with focused copy.
- Prevented the image-to-image prompt dropzone from auto-filling with generated prompts (it now only displays what the user types or drops) and slightly reduced its height for tighter spacing.
- Swapped the Image-to-Image toolbar icon for `ImageSquare` to better match the image-focused workflow.

## 2027-01-10
- Reorganized the workspace to make `ShortPulse/` the canonical product repo, moved non-runtime artifacts into `assets/`, and archived legacy duplicates under `archive/`.
- Added layered agent instructions and context minimization (`AGENTS.md`, `ShortPulse/AGENTS.md`, scoped `AGENTS.md` files, plus `.codexignore`/`.cursorignore`/`.ignore`).
- Added a docs navigation hub and professional repo references: `docs/README.md`, `docs/repo-structure.md`, ADR system (`docs/adr/`), and new foundational docs (`docs/architecture-overview.md`, `docs/local-development.md`, `docs/release-checklist.md`, `docs/troubleshooting.md`, `docs/glossary.md`).
- Moved brainstorming and design rationale docs into `docs/brainstorming/` and `docs/design/` to keep `docs/` discoverable.
- Added collaboration scaffolding: GitHub CI workflow for frontend lint/build, PR template, issue templates, and CODEOWNERS.
- Added repo meta docs: `LICENSE` (proprietary), `ROADMAP.md`, and `CHANGELOG.md` (wrapper pointing to this log).
- Fixed frontend build issues (ESLint config + TypeScript fixes in `frontend/pages/dashboard.tsx`) and verified `npm run lint` + `npm run build` pass.
- Updated env templates to reflect the client-only architecture and restored the `sop_performance_ai_detection.md` into canonical `docs/`.

## 2026-01-17
- Pruned duplicate changelog wrappers (`CHANGELOG.md` and a legacy docs-level wrapper) to keep `docs/change_log.md` as the single source of truth.
- Updated README and docs index to point to the canonical changelog.

## 2026-01-21
- Modularized `/ai-studio`: moved state/logic into `frontend/features/ai-studio/` (types/constants, state hook, toolbar/create/regen panels, reference canvas, preview, anchored model + detail modals) and kept the page as a slim orchestrator.
- Split the monolithic `workspace-ai-studio.css` into scoped sheets (`ai-studio-layout/canvas/controls/dropzones/panels/modals/responsive.css`) and wired them through `globals.css`.
- Updated docs to reflect the new AI Studio structure and style split (`docs/frontend-architecture.md`, `docs/styles-structure.md`); linted frontend (existing Next `<img>` warnings remain in unrelated pages).

## 2027-01-22 (AI Studio toolbar + regen/footer refresh)
- Rebuilt the AI Studio toolbar into labeled sections (Generate, Shortcuts, Creations) with new shortcut/creation entries (Templates, Workflows, My Generations, Community) and added Pulse child tools (Image, Video, Enhance, Character) plus a conditional child divider; unified icon colors via `--ai-accent` and refreshed active/hover styling.
- Added hide-layout modes for template-like tools: selecting Templates, Workflows, My Generations, or Community now collapses the content columns while keeping the rail visible.
- Updated recreate (image/video) footer to mirror Create: media-library and save-prompt ghost buttons plus a larger Generate CTA; brightened prompt text and tweaked Generate sizing for better alignment.
- Introduced toolbar profile/section spacing tweaks, kept accent-driven iconography (including Globe for Community and Person for Character), and ensured Pulse children render above shortcut sections.

## 2027-01-23 (AI Studio integrations, credits, and UX polish)
- Wired Kie.ai and Fal.ai model integrations through server-side proxies, added model filtering by mode (image vs. video), and mapped aspect ratios to provider-specific size params (Fal Flux Dev uses width/height aligned to the selected aspect).
- Added a Supabase-backed credit system (ledger + hook) with auto-seed, per-generation debit for Fal Flux Dev, and a live credit display embedded in the AI Studio header; Generate buttons show dynamic costs.
- Improved media UX: reference detail modal now renders full images with object-fit contain (no cropping) and matches item aspect; Reference Grid shows animated spinners for in-progress items and ignores non-image drops to prevent blank cards.
- Hardened drag/drop flows: prefer state URLs over blob URLs, filter non-image drops in the grid, and surface status/error chips with clearer overlay behavior.

## 2027-01-24 (AI Studio prompt + describe consolidation)
- Prompts: removed redundant prompt docs (now archived in `docs/archive/ai-studio-prompts.md`) and codified `frontend/lib/agentPromptsConfig.ts` as the single source of truth. Updated the SOP to reflect gpt-4.1-nano defaults and prompt ownership.
- Image-to-Text: when the toggle is on, the describe-image agent (Agent 2) always runs—even if the prompt box has text—so the textarea is populated from the describe result. Imported images dropped into Reference Grid/Studio Preview now seed the describe flow.
- Errors & credits: added a dismissible error banner in AI Studio; Generate buttons show computed credit estimates (or “—” if unknown). Image/video runs debit credits immediately; prompt-refine/describe flows debit after API responses using observed/estimated tokens.
- API defaults: `/api/ai/generate-prompt` and `/api/ai/describe-image` default to `gpt-4.1-nano` when env vars are unset.

## 2027-01-25 (Credit gating + documentation reminder)
- Image/video generation requires a sufficient credit balance before debiting; the Generate CTA disables and the SOP now notes the credit check so the banner can prompt a top-up.
- Added a comment near `modelOptions` reminding maintainers to keep the `docs/sops/sop_image_generation.md` supported-model table in sync when adding providers/models.
- Video pipeline hardening: added routing for text-to-video models and allowed dropped/imported images (blob/data URLs) to be used for image-to-video submissions by normalizing inputs before provider calls.

## 2026-01-24 (AI model references)
- Added a dedicated `docs/api/api-responses.md` guide covering the OpenAI Responses API payloads, tools, and best practices alongside `docs/api/api-chat-completions.md` in the docs index.
- Documented Fal.ai model workflows (`docs/api/api-fal-veo3.md`, `docs/api/api-fal-flux-dev.md`, `docs/api/api-fal-nano-banana-pro.md`, `docs/api/api-fal-seedream-4-5.md`, `docs/api/api-fal-seedance-1-5-pro.md`) so every queue/task/callback path is captured plus the backend `kei/task-status` proxy.
- Added the new API references to `docs/README.md` under the API Reference section for a single navigation surface.

## 2027-01-27 (AI Studio model pricing + integrations)
- Introduced Google Veo 3.1 (Fal) with 8s default, 1080p/audio-on pricing; wired Fal queue submission and per-second cost strategy.
- Updated model order in selectors and ensured env template documents KEI/FAL keys.

## 2026-02-03
- Updated Image-to-Video (Recreate) UI to use two primary reference frames (First frame + Last frame) and hide secondary dropzones for video models; added on-card labels for clarity.
- Added MiniGenerateButton to the Agent Chat input row beside Send for faster prompt generation actions.
- Updated `docs/sops/sop_video_generation.md` to reflect the first/last frame workflow requirement for image-to-video.
- Temporarily hid the AI Studio toolbar “Creations” section (My Generations/Community); the toolbar file still contains the buttons and this note should be the reminder to revert once they need to be visible again.

## 2026-02-06
- Added Kling 3.0 Pro image-to-video (Fal) with per-second pricing, new Fal proxy routes, and AI Studio wiring for defaults and submissions.
- Documented Kling 3.0 Pro API usage and updated AI Studio pricing + SOP tables to include the new model.

## 2026-02-07

## 2026-02-16
- Hardened `/api/ai/studio-agent` runtime: added flow-aware routing (text fast path + orchestration path), refusal-safe behavior (no synthetic `applyPrompt` on refusal), request timeouts, and structured stage telemetry.
- Follow-up hardening pass: removed non-text routing dependence on `NEXT_PUBLIC_AGENT_V2`, added bounded timeout parsing for `STUDIO_AGENT_TIMEOUT_MS`, and added runtime API tests for mixed-flow orchestration, timeout fallback, refusal canonical preservation, and text fast-path behavior.
- Replaced in-memory canonical prompt continuity with Supabase-backed persistence via migration `018_add_ai_agent_conversation_state.sql` and server adapter `frontend/lib/server/api/agentConversationState.ts` (TTL + per-user cap pruning).
- Consolidated chat image handling to one client request + server-owned vision summary stage; removed client-side chat attachment describe fan-out.
- Removed question-action surfaces end to end (`AgentActions.questions`, UI question chips/handlers, related tests and wiring).
- Updated agent prompt contracts (`STUDIO_AGENT_SYSTEM`/`THINKER`/`FORMATTER`) to enforce no-question behavior and aligned formatter message/apply-prompt contract.
- Added planning and architecture records for the hardening work (`docs/planning/ai-studio-agent-pipeline-hardening-plan.md`, `docs/adr/0012-ai-studio-agent-runtime-hardening.md`) and refreshed SOP/API docs to match runtime behavior.
- Added Kling 3.0 Pro text-to-video (Fal) with per-second pricing, new Fal proxy submit route, and AI Studio wiring for defaults and submissions.
- Documented the Kling 3.0 Pro text-to-video API and updated AI Studio SOP tables + pricing notes.

## 2026-02-11
- Reorganized docs into category folders: `docs/api/`, `docs/sops/`, `docs/product/`, `docs/planning/`, and `docs/archive/`; added section indexes for each folder.
- Updated repo-wide doc links and refreshed `docs/README.md`, `docs/documentation_overview.md`, and `docs/repo-structure.md` to match the new information architecture.
- Resolved ADR numbering collision by renaming the AI Studio agent ADR to `docs/adr/0006-ai-studio-agent-api.md` and updating references.
- Added missing operational baseline docs: `docs/monitoring.md`, `docs/disaster-recovery.md`, and `docs/performance.md`.
- Updated docs validation script (`scripts/check_docs_links.js`) to validate API references from `docs/api/`.

## 2026-02-11 (later)
- Added `docs/adr/0007-ai-studio-agent-tooling-strategy.md` to codify the product decision: ship media analysis and prompt optimization now, run evaluation in shadow mode, and defer MCP until objective adoption gates are met.
- Added `docs/planning/ai-studio-agent-tooling-phased-plan.md` with concrete rollout phases, tool contracts, telemetry requirements, security guardrails, and MCP adoption checklist.
- Updated `docs/sops/sop_ai_studio_agent.md`, `docs/planning/README.md`, and `docs/README.md` so the strategy and plan are discoverable and operationally durable.

## 2026-02-12
- Ran a repo-wide documentation audit against the live route/API/schema surface and identified missing coverage for internal API contracts, provider incident response, and credit reservation schema details.
- Added `docs/api/api-internal-routes.md` to document first-party Next.js API families, auth boundaries (`frontend/proxy.ts` + route-level guards), environment dependencies, and maintenance expectations.
- Added `docs/sops/sop_provider_incident_response.md` with Fal/OpenAI/Stripe triage, diagnostics queries, mitigation steps, and post-incident requirements.
- Updated schema/security/ops docs to include reservation billing lifecycle requirements: `docs/data-dictionary.md`, `docs/security-checklist.md`, `docs/local-development.md`, `docs/database-migrations.md`, `docs/monitoring.md`, and `docs/troubleshooting.md`.

## 2026-02-14
- Updated docs indexes and cross-links so new docs are discoverable from `docs/README.md`, `docs/api/README.md`, `docs/sops/README.md`, and `docs/documentation_overview.md`.

## 2026-02-12 (dashboard hidden tool reminders)
- Removed the dashboard “Temporarily hidden” reminder row and the small Saved Creators/Performance pills from the Tools section so hidden surfaces have no in-app visual footprint.
- Preserved the actual feature routes; this changelog entry is the documentation reminder that those links are intentionally hidden from the dashboard UI.

## 2026-02-12 (character placeholder navigation)
- Added a temporary `/character-soon` placeholder page and routed the dashboard Character card to it while the full Character workflow remains staged.
- Updated route documentation in `README.md` and `docs/routes.md` so the temporary Character navigation is explicit.

## 2026-02-13
- Completed Character Manager terminology migration follow-through: standardized app/UI copy on **Character Sheet** and added regression coverage so `/character` keeps the label stable (`frontend/features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx`).
- Added backward-compatible schema migration `sql/migrations/012_add_character_sheet_aliases_and_compat.sql` plus rollback script to introduce `character_sheet_*` aliases while keeping legacy `reference_pack_*` fields synchronized.
- Updated Character Manager persistence to use canonical `character_sheet_id`/`active_character_sheet_id` fields and canonical metadata key `character_sheet_assignments`, while dual-writing legacy aliases for compatibility.
- Added ADR `docs/adr/0011-character-sheet-terminology-policy.md` to codify naming policy and migration posture.
- Updated migration/docs inventory to include latest Character Manager migrations and compatibility semantics (`docs/database-migrations.md`, `docs/data-dictionary.md`, `docs/README.md`).

## 2026-02-13 (later)
- Added `sql/check_character_sheet_alias_drift.sql` to provide a reusable diagnostics query for Character Sheet vs legacy Reference Pack alias mismatch detection.
- Expanded operational docs with alias drift troubleshooting/monitoring and post-migration verification guidance (`docs/troubleshooting.md`, `docs/monitoring.md`, `docs/database-migrations.md`).
- Added deprecation-planning backlog items for removing legacy `reference_pack_*` aliases after monitored stability (`docs/planning/backlog.md`).
- Attempted `npm -C frontend run db:migrate`; command failed in this workspace because Supabase CLI is not linked to a project ref.

## 2026-02-13 (planning archive cleanup)
- Archived the 10-slot Character Manager redesign planning doc by moving `docs/planning/character-manager-character-sheet-plan.md` to `docs/archive/character-manager-character-sheet-plan.md`.
- Updated planning/docs indexes to remove active-planning references and list the archived location (`docs/planning/README.md`, `docs/README.md`, `docs/archive/README.md`).
- Updated `docs/adr/0010-character-manager-character-sheet-architecture.md` to remove the fixed 10-slot requirement language and reference the current phased Character Manager contract.

## 2026-02-13 (character sheet assignment persistence)
- Wired Character Manager Character Sheet assignments to persist in Supabase character metadata via `saveCharacterManagerCharacterSheetAssignments`, including canonical + compatibility alias keys.
- Updated `/character` shell state to load and save drop-zone assignments through `useCharacterManagerDraft` so assign/replace/swap survives refresh and character switching.
- Added/updated Character Manager tests to cover persisted assignment behavior, clear/reupload behavior, and 8-reference cap stability.
- Updated docs to reflect persisted Character Sheet assignments (`README.md`, `docs/routes.md`, `docs/sops/sop_character_manager_operations.md`).

## 2026-02-14 (AI Studio Create Character Mode injection)
- Implemented Create-only Character Mode payload wiring in `/ai-studio`: selected Character Manager description + Character Sheet assignments now resolve to best-effort hidden prompt/reference injection for Seedream 4.5 Edit at forced highest resolution.
- Added explicit display-vs-submission prompt separation in task submission so hidden character context is sent to providers without leaking into UI-visible output prompt text.
- Added shared Character Mode payload helpers (`resolveCharacterSheetReferenceUrls`, `composeCharacterModePrompt`, `mergeCharacterAndUserReferences`) and regression tests for ordering, prompt composition, dedupe, and submission behavior.
- Preserved non-blocking fallbacks: missing selected character, missing description, or missing Character Sheet refs no longer block generation and now run prompt-only or partial injection.
- Updated operational docs for the new generation-driving contract (`docs/sops/sop_image_generation.md`, `docs/sops/sop_character_manager_operations.md`) and added implementation plan artifact (`docs/planning/ai-studio-character-mode-injection-plan.md`, now archived at `docs/archive/planning/ai-studio-character-mode-injection-plan.md`).

## 2026-02-14 (AI Studio Character Mode hardening)
- Added stale Character Mode bundle refresh before Create submit/regenerate so Character Sheet signed URLs are reloaded when bundle age exceeds threshold, reducing expiry-related submission failures.
- Added client breadcrumbs for Character Mode fallback telemetry (`character_mode_injection_fallback`) and refresh lifecycle (`character_mode_bundle_refresh_before_submit`, `character_mode_bundle_refresh_failed`) to improve ops/debug visibility.
- Added page-level integration coverage for `/ai-studio` Create submission wiring (`frontend/pages/__tests__/ai-studio.character-mode.test.tsx`) to verify hidden prompt/reference injection and stale-refresh behavior.

## 2026-02-14 (Character pipeline audit follow-through)
- Added migration `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql` and documented it as required in `docs/database-migrations.md` to prevent reservation RPC failures (`column reference "source_ref" is ambiguous`) in Fal submit paths.
- Hardened billing API error exposure so generation credit failures now return a safe user-facing message while preserving server-side diagnostic logs (`frontend/lib/server/api/generationBilling.ts` + `frontend/tests/api/generation-billing.reservations.test.ts`).
- Added Playwright-backed E2E audit baseline for auth -> Character Manager -> AI Studio character mode submit (`frontend/tests/e2e/character-pipeline.audit.js`) and wired `npm run test:e2e:character`.
- Updated operations/testing docs to include the new migration + audit command (`docs/sops/sop_billing_credits_operations.md`, `docs/testing-guide.md`, `docs/planning/audit-progress.md`).

## 2026-02-14 (MVP pre-tester full audit remediation plan)
- Added `docs/planning/mvp-pretester-full-audit-remediation-plan.md` as the execution runbook for security hardening, reliability gates, modularization, performance, and docs/SOP alignment before external tester rollout.
- Updated planning and docs indexes so the plan is discoverable from `docs/planning/README.md` and `docs/README.md`.
- Verified docs integrity via `cd frontend && npm run docs:check`.

## 2026-02-14 (MVP audit skills)
- Added three execution skills for repeated audit/remediation work: `skills/skill-mvp-security-audit/`, `skills/skill-mvp-modularization-pass/`, and `skills/skill-mvp-docs-sop-governance/`.
- Added skill metadata files (`agents/openai.yaml`) for each new skill to support skill picker usage.
- Updated skill discoverability in `docs/README.md` and `docs/agent-playbook.md`.

## 2026-02-14 (stabilization plan archived)
- Archived `docs/planning/mvp-stabilization-plan.md` to `docs/archive/mvp-stabilization-plan.md` and marked it superseded.
- Updated planning/docs/archive indexes and agent references to point to `docs/planning/mvp-pretester-full-audit-remediation-plan.md` as the active pre-tester execution source.

## 2026-02-14 (Phase 1 security hardening start)
- Hardened generation reservation RPCs with caller-binding checks and explicit execute grants in `sql/migrations/002_add_generation_credit_reservations.sql` and `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`; added upgrade migration `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Hardened Stripe billing routes to use canonical `APP_BASE_URL` for checkout/portal redirects and added webhook timestamp tolerance checks (`frontend/lib/server/api/stripe.ts`, `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/portal.ts`).
- Added server-side magic-byte validation for image/video uploads via `frontend/lib/server/uploadSignature.ts` and wired it into `frontend/pages/api/upload-image.ts` and `frontend/pages/api/upload-video.ts`.
- Relocated internal API helper modules from `frontend/pages/api/_utils/` to `frontend/lib/server/api/` and added a middleware denylist for `/api/_utils/*` in `frontend/proxy.ts` as a fail-closed guard.
- Added targeted tests for new hardening behavior (`frontend/tests/api/stripe-utils.test.ts`, `frontend/tests/api/upload-signature.test.ts`, `frontend/tests/api/proxy-internal-utils.test.ts`) and updated env/migration docs.

## 2026-02-14 (UI/UX remediation planning separation)
- Added `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` as a dedicated UI/UX remediation execution track separate from `mvp-pretester-full-audit-remediation-plan.md`.
- Updated `docs/planning/README.md` to index the standalone UI/UX stabilization plan.

## 2026-02-14 (Phase 2 reliability gates complete)
- Updated lint scope to ignore generated Playwright artifacts in `frontend/eslint.config.mjs` (`playwright-report/**`, `test-results/**`) and removed CI lint soft-fail from `.github/workflows/ci.yml`.
- Added missing API handler coverage for Phase 2: `frontend/tests/api/stripe-checkout.test.ts`, `frontend/tests/api/stripe-portal.test.ts`, `frontend/tests/api/stripe-webhook.test.ts`, `frontend/tests/api/upload-image-route.test.ts`, `frontend/tests/api/upload-video-route.test.ts`, `frontend/tests/api/admin-users.test.ts`, `frontend/tests/api/admin-errors.test.ts`, `frontend/tests/api/admin-errors-status.test.ts`, and `frontend/tests/api/admin-credits-adjust.test.ts`.
- Verified reliability gate with `cd frontend && npm run validate` passing (`lint`, `type-check`, `test`).

## 2026-02-14 (UI/UX sprint tickets + UX-0 baseline kit)
- Added `docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md` with one sprint-ready ticket per UI/UX checklist item, including owner role, estimate, and dependency.
- Added UX-0 execution artifacts: `docs/planning/mvp-ui-ux-phase0-baseline-qa-checklist.md` and `docs/planning/mvp-ui-ux-phase0-baseline-capture-template.md`.
- Updated indexes and source plan references so the new ticket/QA artifacts are discoverable from `docs/planning/README.md`, `docs/README.md`, and `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md`.

## 2026-02-14 (UI/UX owner assignment kickoff)
- Added `docs/planning/mvp-ui-ux-issue-board.md` as the execution board of record with current assignee mappings, UX-0 status, and acceptance evidence links.
- Updated the source UI/UX stabilization plan to mark UX-0 board mapping + ownership confirmation checklist items complete.
- Updated planning/doc indexes and sprint-ticket metadata to point to the owner-assigned issue board.

## 2026-02-14 (UI/UX baseline capture run: dashboard + ai-studio)
- Executed a real UX-0 baseline capture pass against local app routes `/dashboard` and `/ai-studio` at `1440`, `1024`, `768`, and `390` widths.
- Added filled baseline evidence report `docs/archive/mvp-ui-ux-phase0-baseline-report-2026-02-14-dashboard-ai-studio.md` with artifact paths and initial findings.
- Updated UI/UX plan + issue board to reflect partial completion of `UX0-01` and linked the report as current acceptance evidence.

## 2026-02-14 (UI/UX baseline completion + keyboard pass kickoff)
- Completed UX-0 screenshot matrix across all priority routes (`/dashboard`, `/ai-studio`, `/media-library`, `/profile`, `/performance`) at `1440`, `1024`, `768`, and `390`.
- Added consolidated report `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md` with full artifact table and first-pass keyboard baseline findings.
- Updated UI/UX issue board and source plan status: `UX0-01` marked done; `UX0-02` moved to in-progress with blockers logged (no media cards present, no visible downgrade action in billing section for cancel-modal path).

## 2026-02-14 (UI/UX keyboard baseline rerun with seeded media)
- Re-ran UX-0 keyboard baseline with forced media upload seeding and subscription-section targeting to reduce false blockers in modal checks.
- Updated full baseline report findings: AI Studio generate keypath exercised, Media Library modal opened but did not close on Escape in this run, and profile subscription modal path remained blocked by account-state controls not being visible.
- Updated UI/UX source plan and issue board notes to reflect narrowed blocker scope and latest keyboard evidence.

## 2026-02-14 (AI Studio state seam: reference selection + modal wiring)
- Extracted reference input state and modal/selection orchestration from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceSelectionState.test.ts` for tool-routed reference updates, indicator toggling guardrails, and model modal open/close behavior.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark the seam complete and set the next `useAiStudioState` split target.

## 2026-02-14 (AI Studio state seam: generation prompt/reference composition)
- Extracted generate/regenerate prompt + reference input composition from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts` for override precedence, video reference-mode behavior, regenerate empty-prompt guardrails, and reference-pool ordering.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark this seam complete and move the next `useAiStudioState` target to task polling/submission orchestration.

## 2026-02-14 (AI Studio state seam: task polling/submission orchestration)
- Extracted polling lifecycle, deferred autosave finalization, status retry handling, and submission wiring from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts` for deferred autosave completion, missing-task retry guardrail, and retry poll restart behavior.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark the `useAiStudioState` concern split complete for this pass and move the next target to `frontend/pages/ai-studio.tsx` controller decomposition.

## 2026-02-14 (AI Studio page seam: panel props composition)
- Extracted text/image/video properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts` for derived generation flags, nullable preview resolution, and Kling voice slot update behavior.
- Aligned `AiStudioPageContent` text-panel prop typing with `TextPropertiesPanel` props to prevent type drift and verified quality gates with `cd frontend && npm run validate` and `cd frontend && npm run build`.

## 2026-02-14 (AI Studio page seam: character panel props composition)
- Extracted Character tool properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterPanelProps.test.ts` for identity-build eligibility derivation and action handler routing.
- Verified quality gates with `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (AI Studio page seams: reference canvas + preview/detail wiring)
- Extracted reference-canvas prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`.
- Extracted studio-preview prop composition + detail-modal action wiring from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`.
- Added focused hook tests in `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts` and `frontend/features/ai-studio/hooks/__tests__/useAiStudioPreviewDetailProps.test.ts` and re-ran targeted AI Studio seam coverage.

## 2026-02-14 (P0 docs alignment + plan status sync)
- Updated architecture/local-dev docs to remove stale client-only wording and reflect internal API-route architecture (`docs/architecture-overview.md`, `docs/local-development.md`).
- Updated frontend architecture guidance to remove stale "thin orchestrator" wording for AI Studio and reflect ongoing seam extraction (`docs/frontend-architecture.md`).
- Added missing `/api/media/resolve-previews` coverage to internal API route docs (`docs/api/api-internal-routes.md`).
- Segregated legacy Character SOPs from active SOPs in the SOP index (`docs/sops/README.md`).
- Re-synced remediation tracking docs: updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md`, `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md`, and `docs/planning/mvp-ui-ux-issue-board.md` to match completed reliability/doc-governance status and current seam progress.
- Confirmed `P0` staging migration verification remains blocked in this workspace pending Supabase CLI environment readiness (`supabase status` failed: Docker daemon unavailable).

## 2026-02-14 (staging migration 014 applied + verified)
- Applied `sql/migrations/014_harden_generation_reservation_rpc_security.sql` to staging project `jwmcytzyhcvacjwqtynn` via Supabase CLI using a temporary workdir migration push.
- Verified remote migration history includes `014` with `supabase migration list --workdir /tmp/sp-supabase-run --debug`.
- Pulled remote migration statements (`supabase migration fetch --workdir /tmp/sp-supabase-run --yes --debug`) and decoded the stored SQL payload, confirming all five reservation RPCs include `auth.uid()` caller-binding checks and explicit grant hardening (`revoke ... from public, anon, authenticated` + `grant execute ... to service_role`).

## 2026-02-14 (P0 UX tooling closure + plan refresh)
- Expanded `.github/pull_request_template.md` with a UI accessibility checklist and explicit before/after screenshot requirement for `P0` UX layout/navigation fixes, completing `UX6-03` and `UX6-04`.
- Updated `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` to mark UX-6 tooling cleanup complete and logged the completion milestone.
- Updated `docs/planning/mvp-ui-ux-issue-board.md` to mark `UX6-01` through `UX6-04` complete with consolidated evidence references.
- Removed remaining stale `client-only` wording in active contributor/testing guidance (`docs/agent-playbook.md`, `docs/testing-guide.md`).
- Refreshed `docs/planning/mvp-pretester-full-audit-remediation-plan.md` current sprint focus to the next `P1` modularization targets (`media-library.tsx`, `generationBilling.ts`, `falClient.ts`) and marked active-scope `P0` documentation alignment complete.

## 2026-02-14 (Media Library modularization seam: move-cache reconciliation)
- Extracted moved-row cache reconciliation logic from `frontend/pages/media-library.tsx` into `frontend/features/media-library/logic/mediaMoveCache.ts`.
- Added focused unit coverage in `frontend/features/media-library/logic/__tests__/mediaMoveCache.test.ts` for destination-query matching behavior, cross-tab row removal, and cache no-op guardrails.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: modal image zoom/pan controller)
- Extracted modal image zoom/pan state and interaction handlers from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaModalImageZoom.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaModalImageZoom.test.ts` for keyboard zoom toggles, non-image guardrails, and pointer pan/capture lifecycle behavior.
- Updated `frontend/pages/media-library.tsx` to consume the new hook and reduced page length to `2871` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: file-modal CRUD controller)
- Extracted file-modal CRUD handlers (open/close, rename, single-delete) from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaFileModalCrud.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaFileModalCrud.test.ts` for modal lifecycle, rename update flow, and single-delete state reconciliation.
- Updated `frontend/pages/media-library.tsx` to consume the new hook and reduced page length to `2820` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: bulk move controller)
- Extracted bulk-selection move orchestration (eligible-row derivation, destination option gating, move-batch request handling, cache reconciliation, and feedback state) from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaBulkMoveController.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaBulkMoveController.test.ts` for selection filtering, success-path cache/state updates, and request-failure error surfacing.
- Updated `frontend/pages/media-library.tsx` to consume the new hook and reduced page length to `2634` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: preview signing/hydration controller)
- Extracted preview signing/hydration pass orchestration (row prioritization, batch signing, resolver fallback, and failure telemetry) from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts` for successful signing application, unresolved fallback behavior, and in-flight guardrails.
- Updated `frontend/pages/media-library.tsx` to consume the new hook and reduced page length to `2473` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Generation billing modularization split)
- Split `frontend/lib/server/api/generationBilling.ts` into focused modules under `frontend/lib/server/api/generationBilling/`: `pricingParams.ts`, `reservationRpcAdapter.ts`, `ownershipResolver.ts`, `settlementService.ts`, plus shared `types.ts`/`utils.ts`/`errorGuards.ts`.
- Kept `frontend/lib/server/api/generationBilling.ts` as the route-facing orchestrator and public export surface (`chargeGenerationRequest`, ownership resolver, settlement/capture entry points), reducing it to `249` lines.
- Re-ran targeted API tests for reservation fallback + ownership enforcement (`frontend/tests/api/generation-billing.reservations.test.ts`, `frontend/tests/api/fal-status.ownership.test.ts`, `frontend/tests/api/kei-task-status.ownership.test.ts`) and full quality gates (`cd frontend && npm run validate`, `cd frontend && npm run build`, `cd frontend && npm run docs:check`).

## 2026-02-14 (Fal client registry-driven conversion)
- Reworked `frontend/lib/falClient.ts` from many repeated submit/status wrappers into a registry-driven endpoint client with shared generic submit/status handlers and per-endpoint route/validation metadata.
- Preserved existing exported helper API names used by the app (`submitFal*` and `fetchFal*Status`) so no call-site changes were required; retained Veo image-to-video status `405 -> GET` fallback behavior inside registry config.
- Reduced `frontend/lib/falClient.ts` to `523` lines and verified compatibility via targeted Fal/UI tests plus full quality gates (`cd frontend && npm run validate`, `cd frontend && npm run build`, `cd frontend && npm run docs:check`).

## 2026-02-14 (Media Library modularization seam: tab-data/cache + upload pipeline controllers)
- Extracted media-tab fetch/cache orchestration from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaTabDataController.ts` (prompt loading, tab-page fetch/cursor handling, stale-cache policy, and load-more observer wiring).
- Extracted upload pipeline controllers from `frontend/pages/media-library.tsx` into `frontend/features/media-library/hooks/useMediaUploadController.ts` (drag/drop and picker intake, optimistic placeholders, storage upload + row insert + preview-sign reconciliation).
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaTabDataController.test.ts` and `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts`.
- Updated `frontend/pages/media-library.tsx` to consume both hooks and reduced page length to `2093` lines (from `2473`).
- Re-ran quality gates: `cd frontend && npm run validate` (`78` files, `273` tests), `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Admin error telemetry hardening: immutable events + generation route coverage)
- Added immutable per-occurrence storage via `sql/migrations/015_add_app_error_events.sql` (plus rollback), and updated bootstrap SQL (`sql/create_app_error_logs_table.sql`) so operator telemetry now has both grouped incidents (`app_error_logs`) and raw events (`app_error_events`).
- Hardened shared error logging (`frontend/lib/server/api/appErrorLogs.ts`) to write events first, link events to incidents, tolerate missing request headers, and degrade safely when Supabase admin clients are unavailable in test/nonconfigured environments.
- Expanded generation-scope server logging coverage across billing + provider routes (`frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`, `frontend/pages/api/ai/*`, `frontend/pages/api/kei/*`, `frontend/pages/api/fal/veo-image-to-video-*.ts`) so handled `4xx/5xx`, upstream failures, transport exceptions, and ownership denials are all recorded.
- Updated admin/API/docs surfaces for the new scope and storage model (`frontend/pages/api/admin/errors.ts`, `frontend/features/admin/components/ErrorIncidentsPanel.tsx`, `frontend/pages/admin/index.tsx`, `docs/monitoring.md`, `docs/data-dictionary.md`, `docs/api/api-internal-routes.md`, `docs/database-migrations.md`, `docs/local-development.md`, `README.md`).
- Validation pass: `npm -C frontend run type-check`; targeted `vitest` suites for admin errors, AI/KEI auth+ownership, generation billing reservations, Fal status ownership, and AI Studio lifecycle hook; targeted `eslint` on touched telemetry/admin files; `npm -C frontend run docs:check`.

## 2026-02-14 (Admin synthetic incident trigger for UI visibility checks)
- Added admin-only route `frontend/pages/api/admin/errors-test.ts` to generate synthetic app/generation incidents (tagged in metadata) for smoke-testing telemetry ingestion and admin UI visibility.
- Added Errors-tab controls in `frontend/features/admin/components/ErrorIncidentsPanel.tsx` and wiring in `frontend/pages/admin/index.tsx` to trigger synthetic incidents and auto-refresh open incident results.
- Added API coverage in `frontend/tests/api/admin-errors-test.test.ts` and updated operator docs (`docs/monitoring.md`, `docs/api/api-internal-routes.md`, `README.md`).

## 2026-02-14 (Admin Errors V2: raw event stream + synthetic controls)
- Added admin-only event-stream API `frontend/pages/api/admin/error-events.ts` backed by `app_error_events` with filters (`scope`, `severity`, `source`, `search`, `synthetic`), pagination, and operational summaries (`lastHour`, `last24h`, app/generation split, high-severity 24h).
- Expanded Admin Errors UI (`frontend/pages/admin/index.tsx`, `frontend/features/admin/components/ErrorIncidentsPanel.tsx`) to include:
  - grouped incident table (`app_error_logs`) and
  - raw per-occurrence event stream (`app_error_events`) with independent pagination and copyable event payloads.
- Added synthetic-event operator controls in the shared filter bar (`real + synthetic`, `real only`, `synthetic only`) and unified refresh/test-trigger behavior so smoke-test incidents are immediately visible.
- Added incident-aware event enrichment and operator detail workflow: event rows now include linked incident status, event detail modal exposes stack/metadata, and incident status can be resolved/ignored/reopened directly from event context.
- Added 15-minute event-spike thresholding to `/api/admin/error-events` (total/high/generation breach flags), surfaced with Admin alert cards and configurable env vars in `frontend/.env.example`.
- Hardened operator reliability: `/api/admin/error-events` alert summaries now always use real (non-synthetic) traffic regardless UI filters, and Admin Errors tab auto-refreshes telemetry on a 30-second interval while active.
- Added route test coverage in `frontend/tests/api/admin-error-events.test.ts` and re-ran targeted admin API tests, type-check, lint, and docs index checks.

## 2026-02-14 (Phase 4 auth-boundary consolidation + verification)
- Centralized protected API routing rules in `frontend/lib/server/api/protectedApiPaths.ts` and reused them across middleware (`frontend/proxy.ts`) and API auth helpers (`frontend/lib/server/api/auth.ts`) to prevent boundary-rule drift.
- Eliminated duplicate protected-route Supabase user lookups by reusing middleware-authenticated context headers in `requireApiUser/getOptionalApiUser/requireAdminUser`, while preserving fallback token verification for non-protected routes.
- Added coverage for middleware context behavior and spoof-resistance boundaries in `frontend/tests/api/auth-helper.test.ts` and `frontend/tests/api/proxy-internal-utils.test.ts`.
- Added synthetic latency benchmark evidence in `frontend/tests/api/auth-latency-benchmark.test.ts` showing middleware-context auth path `p50=0.07ms/p95=0.25ms` vs fallback verification `p50=13.28ms/p95=13.42ms` (40 samples, 12ms mocked upstream delay), and documented it in `docs/monitoring.md`.
- Added middleware-auth-context ownership regression coverage for KEI status polling in `frontend/tests/api/kei-task-status.auth-context.test.ts`; ownership checks continue to block non-owned task IDs.
- Added middleware-auth-context ownership regression coverage for Fal status polling in `frontend/tests/api/fal-status.auth-context.test.ts`; Fal status polling still blocks non-owned request IDs.

## 2026-02-14 (Docs cleanup pass: legacy character docs archived)
- Moved legacy Character SOPs from active operations into archive folders: `docs/archive/sops/sop_character_generation.md` and `docs/archive/sops/sop_character_identity.md`.
- Moved legacy Character product build guide into archive: `docs/archive/product/character_workflow_build_guide.md`.
- Updated docs indexes and references to keep active docs clean and links intact (`docs/README.md`, `docs/sops/README.md`, `docs/archive/README.md`, `docs/sops/sop_character_manager_operations.md`, and `docs/planning/mvp-pretester-full-audit-remediation-plan.md`).
- Added archive-status notes inside moved docs and documented archive subfolder structure (`docs/archive/sops/`, `docs/archive/product/`).

## 2026-02-14 (Plan follow-through: auth-regression CI lane + pause criteria)
- Added a fast auth-regression lane to frontend CI (`.github/workflows/ci.yml`) that runs `auth-helper`, `proxy-internal-utils`, `kei-task-status.auth-context`, `fal-status.auth-context`, and `auth-latency-benchmark` before the full suite.
- Re-ran the targeted auth regression suite (`11` tests) and confirmed pass.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` with explicit Stripe/subscription pause-lift resume criteria and synced non-blocking recommendation status.

## 2026-02-14 (Staging latency capture workflow for auth-boundary release evidence)
- Added `scripts/capture_protected_route_latency.mjs` to capture real protected-route latency samples (`p50`/`p95`, status distribution, success rate) from staging with a real bearer token.
- Updated `docs/monitoring.md` with a staging latency capture runbook, default route (`/api/billing/credit-packages`), env requirements, example commands, and evidence-recording instructions.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to track recommendation #2 as pending execution with tooling complete and explicit evidence paths.

## 2026-02-14 (Protected-route runtime latency sample captured with real auth)
- Executed `scripts/capture_protected_route_latency.mjs` against the running app (`http://127.0.0.1:3000`) on `/api/billing/credit-packages` using a real Supabase bearer token from a short-lived, email-confirmed test user.
- Sample result (`30` measured requests, `5` warmup): `p50=222.99ms`, `p95=291.78ms`, `min=204.88ms`, `max=294.34ms`, `success_rate=100.0%`, `statuses=200:30`.
- Cleaned up the temporary Supabase test user immediately after the run and recorded evidence/status updates in `docs/monitoring.md` and `docs/planning/mvp-pretester-full-audit-remediation-plan.md`.

## 2026-02-14 (Latency probe hardening: auto token bootstrap + env alignment)
- Enhanced `scripts/capture_protected_route_latency.mjs` with optional `--bootstrap-token-from-supabase` mode that creates a short-lived confirmed user via Supabase admin API, signs in for a bearer token, and auto-deletes the user after sampling.
- Added base URL fallback support (`APP_BASE_URL`) and documented the bootstrap path in `docs/monitoring.md`.
- Updated `docs/local-development.md` and `frontend/.env.example` to include staging-latency helper env vars (`SHORTPULSE_STAGING_BASE_URL`, `SHORTPULSE_STAGING_BEARER_TOKEN`) for repeatable operator runs.
- Synced remediation-plan status to reflect that staging capture now only depends on resolving the staging app host URL.

## 2026-02-14 (Latency probe bootstrap-mode verification)
- Ran `scripts/capture_protected_route_latency.mjs` with `--bootstrap-token-from-supabase` against `http://127.0.0.1:3000` to validate the new automated token flow end to end.
- Result (`8` measured requests, `2` warmup) on `/api/billing/credit-packages`: `p50=246.50ms`, `p95=274.55ms`, `success_rate=100.0%`, `statuses=200:8`.
- Confirmed temporary-user cleanup via emitted probe log `supabase_bootstrap_user_deleted=true`.

## 2026-02-14 (Latency probe operator handoff hardening)
- Added `frontend` script shortcut `npm run latency:protected-route` that wraps `scripts/capture_protected_route_latency.mjs` for repeatable operator runs.
- Updated `docs/monitoring.md`, `docs/local-development.md`, and `docs/planning/mvp-pretester-full-audit-remediation-plan.md` with a copy/paste staging capture command that uses `SHORTPULSE_STAGING_BASE_URL` plus `--bootstrap-token-from-supabase`.
- Attempted automatic staging-host discovery against common domains; no resolvable staging host was found in current workspace context, so the final staging p50/p95 capture remains pending URL confirmation.
- Validated the npm handoff command end to end against the running app (`5` measured requests, `1` warmup) with result `p50=228.38ms`, `p95=248.98ms`, `success_rate=100.0%`, and confirmed temp-user cleanup.

## 2026-02-14 (Docs governance hardening: link + legacy placement checks)
- Replaced `scripts/check_docs_links.js` with a broader docs integrity checker that now validates:
  - API docs are indexed in `docs/README.md`.
  - Markdown links resolve across repository markdown files.
  - `Status: Legacy` markers exist only under `docs/archive/`.
- Added `npm run docs:check` to CI in `.github/workflows/ci.yml` so docs integrity and archive-governance checks run on PRs/pushes.
- Updated `docs/documentation_overview.md` with explicit lifecycle states (`Active`, `Working`, `Archived`) and concrete archive requirements.

## 2026-02-15 (Credit-pricing guardrails + reservation metadata audit follow-up)
- Preserved reservation metadata on capture across all generation reservation migrations (`002`, `013`, `014`) and added SQL regression coverage in `frontend/tests/sql/generation-reservation-metadata.test.ts`.
- Expanded generation billing tests to assert debit/reservation metadata includes a full pricing breakdown (`usd_raw`, `raw_credits`, `billed_credits`, `billed_usd`) and remains in parity with `computeCostForModel`.
- Added UI guidance in AI Studio generation surfaces that estimates are billed in 5-credit increments (model modal, text/reference generate controls, prompt-reference card).
- Added pricing guardrail tests to enforce MVP model-option policy (no KEI-backed model options) and 5-credit rounding invariants across registered model defaults; updated `docs/product/ai-studio-pricing.md` to document `rawCredits`/`usdRaw` contract and KEI MVP exclusion.
- Added admin ledger audit support: new route `GET /api/admin/credits/ledger` with optional `source` filtering (for example, `source=generation_charge`), `/admin` UI table for selected-user recent credit transactions, visibility for generation `pricing_breakdown` metadata (raw vs billed credits/USD), and legacy-schema fallback reads for pre-v2 `ai_credit_ledger` deployments.

## 2026-02-15 (AI Studio media-library modal flicker/stutter fix)
- Removed a state feedback loop in `MediaLibraryModal` where `files` updates wrote back into tab cache on every render, causing repeated rerenders and visible modal instability under uploaded-image hydration.
- Added a hard retry cap for unresolved signed-preview batches (max 3 attempts per media item) to stop continuous re-sign churn on broken/unresolvable rows.
- Stabilized packed media-grid rendering by removing `content-visibility` intrinsic-size collapsing on modal cards, reducing column collapse/reflow flicker while previews load.
- Added regression coverage in `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx` to assert unresolved signing retries stop after the cap.
- Expanded regression coverage to verify the same signing retry cap behavior across all media tabs (`Uploaded Images`, `Uploaded Videos`, `AI Studio Generations`, `Private`).
- Added regression coverage for `Saved Prompts` to ensure prompt-only tab navigation does not trigger media signing work.

## 2026-02-15 (character-mode telemetry promotion + video URL freshness hardening)
- Promoted Character Mode refresh/fallback signals to first-class event telemetry by emitting `telemetry.character_mode` occurrences through `reportAppError` from `useAiStudioCharacterModeController`; to keep volume lean, fallback events are emitted for `bundle_unavailable` only.
- Updated server error logging to store `telemetry.*` occurrences in `app_error_events` without creating grouped `app_error_logs` incidents, preventing admin open-incident noise while keeping per-occurrence visibility.
- Extended `/api/admin/error-events` with signal filtering (`signal` query param), Character Mode frequency counters (1h/24h for refresh-empty and bundle-unavailable fallback), and operational-summary hygiene to exclude telemetry sources from threshold breach metrics.
- Added an Admin Event Stream Character Mode telemetry panel with one-click stream filters for `character_mode_reference_refresh_empty` and `bundle_unavailable` fallback frequency.
- Hardened video reference submit prep by refreshing Kling element video URLs pre-submit (not only motion-control video URLs), with expanded `videoHandlers` coverage for refresh success/failure.
- Character Mode submission now degrades to description-only injection when reference URL refresh returns empty, instead of forcing `bundle_unavailable` for that path.

## 2026-02-15
- Completed a focused media-library isolation security audit (RLS, storage policies, media API routes, and client preview/signing paths) with hardening changes for fail-closed behavior.
- Added migration `sql/migrations/017_harden_media_storage_path_shape.sql` (+ rollback) to enforce shape-safe user-scoped media paths (`no ../`, no backslashes, no leading slash) for `media_files` and derivative path hints/rows where present.
- Tightened preview fallback behavior to only allow direct URLs that resolve to the authenticated user namespace by threading user-scoped filtering through `resolveMediaDirectPreviewUrls` and `/api/media/resolve-previews`.
- Added explicit user filter on Media Library prompt reads (`media_prompts`) and refreshed security/ops docs (`docs/security-checklist.md`, `docs/database-migrations.md`, `docs/monitoring.md`, `docs/troubleshooting.md`, `docs/api/api-internal-routes.md`).

## 2026-02-15
- Added `docs/sops/sop_sql_migration_operations.md` as the canonical SQL operations runbook (SQL file taxonomy, migration intent, safe re-run/idempotency guidance, media-isolation hardening loop, verification queries, common error handling for `42501` and `23514`, and staging->production promotion checklist).
- Updated SOP/doc indexes to include the new runbook: `docs/sops/README.md` and `docs/README.md`.

## 2026-02-15
- Audited SQL docs/SOP linkage and tightened cross-references to the canonical SQL runbook (`docs/sops/sop_sql_migration_operations.md`) from `docs/database-migrations.md`, `docs/security-checklist.md`, `docs/monitoring.md`, and `README.md`.
- Fixed `docs/troubleshooting.md` media scope triage SQL snippet to match current drift criteria and valid SQL syntax (`empty`, `leading slash`, non-user-scoped, traversal, backslash).
- Added SQL-folder entry pointers to the canonical runbook from `sql/migrations/README.md`, `sql/check_media_storage_scope_drift.sql`, and `sql/storage_policies.sql` to reduce operator drift when starting from SQL files.

## 2026-02-15 (Character Sheet preset tabs in Character Manager + AI Studio)
- Added persistent Character Sheet preset tabs (`1..4`) to the shared Character Manager workflow used by both `/character` and AI Studio Character panel.
- Introduced `characters.metadata.character_sheet_presets_v1` contract with active preset tracking plus per-zone media references (`portrait`, `close_up`, `front_shot`, `back_shot`), including legacy initialization from `character_sheet_assignments`.
- Updated Character Manager persistence/hook/UI to support preset switching, per-preset zone assignment, direct zone uploads, and media cleanup safeguards so QuickSwap Deck removals do not orphan preset references.
- Updated AI Studio Character Mode injection to prefer active preset references, keep legacy fallback behavior, and always reload the selected character snapshot before Create/Text generate.
- Added/updated tests for preset metadata normalization, Character Manager preset tab behavior, Character Mode payload resolution, lifecycle/controller refresh behavior, and AI Studio page integration.
- Updated SOP/data docs (`docs/sops/sop_character_manager_operations.md`, `docs/sops/sop_image_generation.md`, `docs/data-dictionary.md`) for the new preset contract and generation path.

## 2026-02-17 (AI Studio expert workflow hardening + expert CSS reorganization)
- Hardened expert generation orchestration in `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` and `frontend/features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation.ts`: removed output-generate guardrail bypass, aligned busy/lock checks, added optimistic-debit timestamp metadata, and prevented stale orphan debit assignment.
- Added and updated AI Studio regression coverage for guardrail parity, stale debit cleanup, feature-flag behavior, output-generate eligibility parity, and character-mode picker close/reset paths across:
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioOptimisticDebitReconciliation.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`,
  `frontend/features/ai-studio/components/__tests__/TextPropertiesPanel.test.tsx`,
  and `frontend/tests/pages/ai-studio.character-mode.test.tsx`.
- Replaced dev-only expert gating with `NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI` runtime parsing defaults in `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` and added the variable to `frontend/.env.example`.
- Reorganized expert styling into focused modules and rewired global imports:
  `frontend/styles/ai-studio-create-expert.tokens.css`,
  `frontend/styles/ai-studio-create-expert-chat.css`,
  `frontend/styles/ai-studio-create-expert-output-generate.css`,
  `frontend/styles/ai-studio-create-expert-composer.css`,
  `frontend/styles/ai-studio-create-expert-controls.css`,
  `frontend/styles/ai-studio-create-expert-motion.css`,
  `frontend/styles/ai-studio-create-expert-responsive.css`,
  and `frontend/styles/globals.css`.
- Verification gates passed:
  `cd frontend && npm run type-check`,
  `cd frontend && npm run test -- features/ai-studio`,
  `cd frontend && npm run test -- tests/pages/ai-studio.character-mode.test.tsx`.

## 2026-02-17 (describe-image reliability + security hardening)
- Hardened `POST /api/ai/describe-image` with URL preflight safeguards: HTTPS-only enforcement, localhost/private-IP blocking, DNS private-address resolution blocking, redirect-chain validation, and image content-type verification prior to OpenAI vision requests.
- Added configurable trusted host enforcement for describe-image via `OPENAI_DESCRIBE_ALLOWED_HOSTS` and `OPENAI_DESCRIBE_REQUIRE_ALLOWED_HOSTS`, with `NEXT_PUBLIC_SUPABASE_URL` host auto-trusted to support signed media URLs.
- Improved OpenAI resilience with transient upstream retry (429/5xx/network-style errors), model-capability fallback retry to `OPENAI_VISION_FALLBACK_MODEL`, and clearer upstream source classification (`rate_limited`, `upstream_unavailable`, `upstream_error`).
- Reduced generation false-failure risk by extending terminal-state detection in polling (`done`, `complete`, `finished`, cancellation variants) in `useAiStudioTasks`.
- Added regression coverage in:
  `frontend/tests/api/describe-image.route.test.ts` and
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`.
- Updated env/docs references for new describe-image hardening controls in:
  `frontend/.env.example`,
  `docs/deployment.md`,
  `docs/api/api-internal-routes.md`,
  and `docs/sops/sop_text_generation.md`.

## 2026-02-17 (documentation governance + backlog recovery)
- Completed a docs-only governance pass and added `docs/planning/documentation-audit-2026-02-17.md` as the audit artifact (planning classification matrix, contradiction-detection method, and strict backlog evidence matrix).
- Created `docs/archive/planning/` and moved completed/superseded plans out of active planning:
  `docs/archive/planning/ai-studio-character-mode-injection-plan.md`,
  `docs/archive/planning/media-library-move-tabs-plan.md`,
  and `docs/archive/planning/mvp-pre-tester-anchor-plan.md`.
- Updated planning/archive indexes to reflect active vs archived locations (`docs/planning/README.md`, `docs/README.md`, `docs/archive/README.md`, `docs/archive/planning/README.md`).
- Reconciled stale route/scope wording in `README.md`, `docs/routes.md`, and `docs/release-checklist.md` (performance staged visibility wording, current performance-demo behavior, and Character Manager reference-limit wording).
- Audited backlog with strict evidence and checked off verifiable completions:
  Stripe billing-portal flow and auth/media-library API test coverage updates in `docs/planning/backlog.md`; also classified remaining items as open, blocked external dependency, or paused policy scope.

## 2026-02-17 (AI Studio character panel open behavior)
- Updated AI Studio shell collapse policy so selecting Character (`canvas`/`character`) now collapses the left properties panel to its minimum width immediately on tool switch (`frontend/features/ai-studio/logic/shellResize.ts`).
- Removed shell column easing while Character is open by disabling `grid-template-columns` transition under `.ai-shell-character-open` (`frontend/styles/ai-studio-layout.css`).
- Expanded shell-resize regression coverage for Character collapse behavior (`frontend/features/ai-studio/logic/__tests__/shellResize.test.ts`), and verified with:
  `cd frontend && npm run test -- features/ai-studio/logic/__tests__/shellResize.test.ts`.

## 2026-02-17 (AI Studio reference grid performance run)
- Replaced AI Studio local upload preview ingestion from full base64 payloads to object-URL-first handling in `frontend/features/ai-studio/logic/stateParsers.ts`, with deterministic object URL cleanup in `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added bounded-session soft archive behavior for Reference Grid outputs (default active cap: 500) with restore controls and archive telemetry (`media.grid.archive.transition`) via `frontend/features/ai-studio/hooks/useAiStudioState.ts` and `frontend/features/ai-studio/components/ReferenceCanvas.tsx`.
- Tightened Reference Grid rendering/autoplay budgets and adaptive preview routing (preview vs full path fields) in `frontend/features/ai-studio/components/ReferenceCanvas.tsx`, plus high-density CSS cost controls in `frontend/styles/ai-studio-canvas.css`.
- Added reference-grid telemetry events (`media.grid.render.commit`, `media.grid.longtask.sample`, `media.grid.memory.sample`, `media.grid.archive.transition`) in `frontend/lib/mediaPerfTelemetry.ts` and logging call sites in `ReferenceCanvas`/state archive transitions.
- Added explicit adaptive-preview rollback control (`NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW`) and wired archive restore transitions into `media.grid.archive.transition` telemetry in `frontend/features/ai-studio/components/ReferenceCanvas.tsx` and `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added normalized output lookup/update fast-path wiring (`NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE`) and selector helpers in `frontend/features/ai-studio/hooks/useAiStudioState.ts` + `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`, and added per-tick batching for poll-driven output patches in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
- Reduced output update churn by improving `updateOutputById` to targeted index replacement in `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` and adding progress-update backpressure/deduplication in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
- Extended output metadata/types for performance-aware behavior (`mediaSource`, `previewTier`, preview/full storage paths, archive metadata) in `frontend/features/ai-studio/types.ts` and wired through relevant output creation/update flows.
- Updated operational docs for triage and tuning in `docs/troubleshooting.md` and `docs/sops/sop_media_performance_operations.md`.
- Added/updated targeted tests: `frontend/features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts`.
