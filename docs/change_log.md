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

## 2026-02-18
- Implemented AI Studio reference-grid stabilization v4 runtime controls:
  - selector-backed page output decoupling flag path (`NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`)
  - strict preview/full URL ladder resolver with safe legacy fallback
  - image hydration/decode inflight budgeting and runtime queue metrics
  - dynamic virtualization windowing with density/pressure-aware overscan and RAF scroll sync
  - dense visual simplify mode for 40+ references
  - perf watchdog + memory guard degrade levels with hysteresis and debug data attributes
- Updated perf harness behavior:
  - `runReferenceGridAudit` default scenarios now include 20/50/60/100/300
  - added grid metrics (`rendered_item_count`, hydration queue, decode inflight)
  - introduced 60-count grid gates and preserved existing shell gates
  - fixed shell section commit sampling so reference and preview commits are measured independently
- Extended save/persistence delivery metadata for AI Studio media saves and threaded the new shape through persistence/task orchestration consumers.
- Added docs for the v4 rollout and architecture decisions:
  - `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
  - `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
  - updated `docs/sops/sop_media_performance_operations.md`

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
- Migrated AI Studio output storage to canonical normalized collections (`outputOrder` + `outputById`, plus archived equivalents) as the primary in-memory state in `frontend/features/ai-studio/hooks/useAiStudioState.ts`, with array views retained as derived compatibility outputs.
- Added a browser-native reference-grid performance harness with explicit 100/300/500 gates exposed via `window.__shortpulseAiStudioPerf.runReferenceGridAudit()` (with `seedReferenceGrid`/`clearReferenceGrid` helpers) in `frontend/pages/ai-studio.tsx`, removing Playwright dependence for this audit flow.
- Reduced output update churn by improving `updateOutputById` to targeted index replacement in `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` and adding progress-update backpressure/deduplication in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
- Extended output metadata/types for performance-aware behavior (`mediaSource`, `previewTier`, preview/full storage paths, archive metadata) in `frontend/features/ai-studio/types.ts` and wired through relevant output creation/update flows.
- Updated operational docs for triage and tuning in `docs/troubleshooting.md` and `docs/sops/sop_media_performance_operations.md`.
- Added/updated targeted tests: `frontend/features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts`.

## 2026-02-18 (AI Studio shell decoupling + DnD backpressure)
- Added a dedicated shell DnD controller hook with RAF-throttled drop-mode updates to reduce dragover churn in `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`, and wired it into `frontend/features/ai-studio/components/AiStudioPageContent.tsx`.
- Added selector-style output access hook `frontend/features/ai-studio/hooks/useAiStudioSelectors.ts` and used it in `frontend/pages/ai-studio.tsx` to provide stable non-grid output lookups.
- Reduced non-grid prop churn by memoizing/stabilizing panel and preview/reference prop composition in `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`, `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`, and `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`.
- Added browser-native shell interaction perf auditing via `window.__shortpulseAiStudioPerf.runStudioShellAudit()` in `frontend/pages/ai-studio.tsx` with explicit toolbar/panel/drop gates.
- Added shell high-density cost controls and feature-flag documentation updates in `frontend/styles/ai-studio-layout.css`, `docs/sops/sop_media_performance_operations.md`, and `docs/troubleshooting.md`.
- Added ADR `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md` and regression coverage for new hooks in:
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioSelectors.test.ts`.

## 2026-02-18 (AI Studio selector-subscribed shell isolation v3)
- Added selector-subscribed output state in `frontend/features/ai-studio/hooks/aiStudioOutputStore.ts` (`useSyncExternalStore`) with output indexes, targeted selectors, and visible-window helpers.
- Integrated output-store snapshot publishing into `frontend/features/ai-studio/hooks/useAiStudioState.ts`, and added state APIs (`getOutputById`, `subscribeOutputs`, `getOutputSnapshot`) for non-grid consumers.
- Removed broad output-array coupling from key non-grid hooks by migrating to id lookups:
  `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`,
  `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`,
  `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`,
  and page orchestration updates in `frontend/pages/ai-studio.tsx`.
- Split shell rendering into isolated boundaries:
  `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`,
  `frontend/features/ai-studio/components/AiStudioToolbarRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioPropertiesRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioPreviewRail.tsx`,
  and refactored `frontend/features/ai-studio/components/AiStudioPageContent.tsx` to use them.
- Upgraded shell perf auditing in `frontend/pages/ai-studio.tsx` and `frontend/features/ai-studio/logic/perfAuditGates.ts`:
  scenarios now include `20/50/60/100/300`,
  section render/commit fields,
  non-grid rerender-per-status-tick metrics,
  and 60-reference shell gates.
- Added shell section render counter instrumentation in `frontend/features/ai-studio/logic/shellRenderCounters.ts`.
- Added RAF-based status flush + transition scheduling for non-urgent poll churn in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts` behind `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`.
- Tuned dense-shell CSS cost controls in `frontend/styles/ai-studio-layout.css`.
- Added rollout flags to `frontend/.env.example`:
  `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`,
  `NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT`,
  `NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS`,
  `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`.
- Added planning/architecture docs:
  `docs/planning/ai-studio-shell-render-isolation-v3-plan.md`,
  `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`,
  and updated `docs/sops/sop_media_performance_operations.md`.
- Added and updated regression tests:
  `frontend/features/ai-studio/hooks/__tests__/aiStudioOutputStore.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts`,
  `frontend/features/ai-studio/logic/__tests__/perfAuditGates.test.ts`.

## 2026-02-18 (AI Studio reference-grid performance profile freeze)
- Stabilized virtualization behavior for 40-60 reference sessions by tightening overscan at 40-59 and adding high-density max-column clamping in:
  `frontend/features/ai-studio/logic/referenceGridVirtualization.ts` and `frontend/features/ai-studio/components/ReferenceCanvas.tsx`.
- Fixed perf gate handling so missing reference-grid long-task samples (`null`) are treated as pass-with-note instead of false failure in:
  `frontend/features/ai-studio/logic/perfAuditGates.ts` and `frontend/features/ai-studio/logic/__tests__/perfAuditGates.test.ts`.
- Reduced audit contamination by switching long-task observers to live-only sampling (removed buffered history) in `frontend/pages/ai-studio.tsx`.
- Added production-opt-in perf harness runtime control (`NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME`) so release-mode audits can run intentionally while default production exposure remains off (`frontend/pages/ai-studio.tsx`, `frontend/.env.example`).
- Promoted the current reference-grid/shell stability profile to repo defaults in `frontend/.env.example`.
- Updated operational docs and ADR references for stable profile, production audit procedure, and rollback-safe runtime toggles:
  `docs/sops/sop_media_performance_operations.md`,
  `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf gate automation + profile centralization)
- Added centralized AI Studio perf-profile flag resolver (`stable`/`legacy`) with explicit override support in:
  `frontend/features/ai-studio/logic/perfProfileFlags.ts`.
- Migrated performance-sensitive flag reads to shared profile constants across:
  `frontend/features/ai-studio/components/ReferenceCanvas.tsx`,
  `frontend/features/ai-studio/components/AiStudioPageContent.tsx`,
  `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`,
  `frontend/pages/ai-studio.tsx`.
- Added regression coverage for profile fallback/override behavior in:
  `frontend/features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`.
- Added authenticated production-mode AI Studio perf audit runner:
  `frontend/tests/e2e/ai-studio-perf.audit.js`,
  npm script `test:perf:ai-studio`,
  and CI workflow job `ai_studio_perf_gate` in `.github/workflows/ci.yml`.
- Added CI skip-notice job `ai_studio_perf_gate_notice` so missing audit secrets are explicit in workflow summaries instead of silent skips.
- Updated env and SOP/ADR docs for profile-driven defaults and CI perf gating:
  `frontend/.env.example`,
  `docs/sops/sop_media_performance_operations.md`,
  `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf governance polish)
- Added PR template perf-gate checklist items for AI Studio-impacting changes in `.github/pull_request_template.md`.
- Added invalid profile warning + stable fallback hardening for `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE` in `frontend/features/ai-studio/logic/perfProfileFlags.ts`.
- Added fallback behavior test coverage in `frontend/features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`.

## 2026-02-18 (AI Studio perf gate staged enforcement hardening)
- Hardened CI perf gating in `.github/workflows/ci.yml` with PR change-scoping for AI Studio perf-impacting files, plus staged gate mode control via repository variable `AI_STUDIO_PERF_GATE_MODE` (`warn` or `enforce`).
- Updated operations guidance for CI gate scoping and staged enforcement rollout in `docs/sops/sop_media_performance_operations.md`.
- Updated ADR operational notes to document PR change-scoped perf gating and repository-variable enforcement mode in `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf release-check command)
- Added a single-command production perf release check script in `frontend/scripts/ai-studio-perf-release-check.mjs` that runs build/start/audit/teardown with explicit guardrails.
- Added npm script `perf:ai-studio:release-check` in `frontend/package.json`.
- Updated runbook docs to standardize usage and optional fast rerun/port overrides:
  `docs/sops/sop_media_performance_operations.md`,
  `docs/testing-guide.md`,
  `docs/local-development.md`.

## 2026-02-19 (Adaptive Media V2 phase verification checkpoint)
- Fixed adaptive hydration fallback/source matching in `frontend/features/ai-studio/components/ReferenceCanvas.tsx` so storage-key candidates are no longer treated as renderable URLs during hydration fallback resolution, eliminating stuck `loading preview...`/`generating...` cards in Quick Slot and Reference Grid drag/drop scenarios.
- Hardened optimized preview equivalence matching for `/_next/image` sources so hydration state remains stable across quick-slot and all-refs surfaces.
- Completed current regression gate run for this checkpoint:
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`
  - `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx`
  - `npm -C frontend run test -- referenceGridMedia.test.ts referenceGridMedia.parity.test.ts`
  - `npm -C frontend run test -- MediaLibraryModal.test.tsx`
  - `npm -C frontend run test -- CharacterManagerShell.behavior.test.tsx`
- Updated rollout tracking artifacts:
  - `docs/planning/adaptive-media-v2-migration-checklist.md` (Phase 3 and Phase 5 verification marked complete + current QA status notes)
  - `docs/planning/backlog.md` (added non-blocking follow-up for rare one-off grid flash stabilization pass).

## 2026-02-19 (Adaptive Media V2 regression guardrails)
- Added dedicated adaptive regression gate script in `frontend/package.json`:
  - `test:adaptive-v2-gate`
  - runs lint/type-check plus targeted adaptive suites for Reference Grid, Media Library modal, Character Manager, parity, and policy.
- Added path-scoped CI job `adaptive_media_gate` in `.github/workflows/ci.yml`:
  - runs `test:adaptive-v2-gate` for PRs touching adaptive-critical paths
  - auto-skips with summary note when no adaptive-impacting files changed.
- Updated ownership/review policy in `.github/CODEOWNERS` with explicit Adaptive Media V2 critical path entries.
- Updated PR process in `.github/pull_request_template.md` with an Adaptive Media V2 gate checklist section.
- Added adaptive change-control SOP:
  - `docs/sops/sop_adaptive_media_change_control.md`
  - linked from `docs/sops/README.md` and referenced by `docs/sops/sop_media_performance_operations.md`.
- Added adaptive merge-gate skill:
  - `skills/adaptive-change-gate/SKILL.md`
  - documented in `docs/README.md` and `docs/agent-playbook.md`.

## 2026-02-19 (AI Studio Fal reliability rollout documentation kickoff)
- Added execution tracker `docs/planning/ai-studio-fal-reliability-rollout.md` with phase gates, acceptance criteria, rollout controls, kill switch, and test strategy for modular submit/retrieval rollout.
- Added ADR `docs/adr/0019-fal-modular-submit-retrieval-reliability.md` to lock architecture, alternatives, rollout constraints, and reversal criteria.
- Added migration artifacts for reliability state hardening:
  - `sql/migrations/019_add_generation_recovery_fields.sql`
  - `sql/migrations/rollback/019_add_generation_recovery_fields_rollback.sql`
- Updated operational docs for recovery/replay/rebuild route governance and incident runbook coverage:
  - `docs/api/api-internal-routes.md`
  - `docs/sops/sop_provider_incident_response.md`
  - `docs/sops/sop_ai_studio_index.md`
- Updated planning/schema/index docs for execution tracking and migration governance:
  - `docs/planning/backlog.md`
  - `docs/data-dictionary.md`
  - `docs/database-migrations.md`
  - `docs/planning/README.md`
  - `docs/README.md`
- Rollout phase completion status: no implementation phases are marked completed yet; per-phase gate outcomes and rollback decisions will be appended here as each phase closes.

## 2026-02-19 (AI Studio Fal reliability rollout Phase 1 + Phase 2 implementation)
- Implemented deterministic alias-sweep selection and retrieval hardening in the shared status proxy:
  - migrated payload parsing helpers into `frontend/lib/server/falIntegration/falAdapter.ts`
  - added deterministic status/result candidate ranking in `frontend/lib/server/falIntegration/retrievalEngine.ts`
  - updated `frontend/lib/server/api/falStatusProxy.ts` to complete alias sweeps before no-media settlement and prefer best media-bearing candidates.
- Implemented shared submit fallback chain support:
  - added submit target contracts in `frontend/lib/server/falIntegration/contracts.ts`
  - added submit fallback engine in `frontend/lib/server/falIntegration/submitEngine.ts`
  - extended `frontend/lib/server/api/falSubmitProxy.ts` to support ordered `submitTargets` with deterministic fallback semantics.
- Removed bespoke Veo image-to-video route logic and migrated both routes to shared proxies:
  - `frontend/pages/api/fal/veo-image-to-video-submit.ts`
  - `frontend/pages/api/fal/veo-image-to-video-status.ts`
  - added shared Veo profile/alias registry entry in `frontend/lib/server/falIntegration/modelProfiles.ts`.
- Added/updated regression tests:
  - `frontend/tests/api/fal-status-proxy.test.ts` (alias conflict + media precedence case)
  - `frontend/tests/api/fal-submit-proxy.test.ts` (submit fallback chain behavior).
- Validation evidence:
  - `npm -C frontend run test -- tests/api/fal-status-proxy.test.ts tests/api/fal-submit-proxy.test.ts`
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`

## 2026-02-19 (AI Studio generation runtime stabilization pivot documentation)
- Added stabilization execution addendum:
  - `docs/planning/ai-studio-generation-runtime-stabilization.md`
- Updated primary reliability rollout tracker with explicit pivot section and execution constraints:
  - `docs/planning/ai-studio-fal-reliability-rollout.md`
- Updated AI Studio backlog with stabilization tasks S0-S4:
  - `docs/planning/backlog.md`
- Purpose of this pivot:
  - stop ad-hoc generation patching,
  - enforce one runtime boundary for submit/retrieve/persist/billing flow,
  - gate further phase expansion until golden-path reliability is proven.

## 2026-02-19 (AI Studio generation runtime stabilization S0 traceability implementation)
- Added submission/generation trace identifiers to AI Studio output lifecycle and persistence metadata:
  - `frontend/features/ai-studio/types.ts`
  - `frontend/features/ai-studio/logic/ids.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- Added admin generation trace API endpoint for stitched timeline debugging by `generationId`, `requestId`, or `traceId`:
  - `frontend/pages/api/admin/generation-trace.ts`
  - `frontend/tests/api/admin-generation-trace.test.ts`
- Added a local operator UI surface for trace inspection:
  - `frontend/pages/admin/generation-trace.tsx`
  - linked from `frontend/pages/admin/index.tsx`
- Updated internal API docs:
  - `docs/api/api-internal-routes.md`
- Validation evidence:
  - `npm -C frontend run test -- admin-generation-trace useAiStudioTaskSubmission useAiStudioTaskOrchestration useAiStudioTasks`
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`

## 2026-02-19 (AI Studio generation runtime stabilization S1 persistence + replay recovery)
- Added server-authoritative generation persistence at submit time so successful Fal submits always create/attach an `ai_generations` row:
  - `frontend/lib/server/api/generationSubmitPersistence.ts`
  - wired via `frontend/lib/server/api/falSubmitProxy.ts`
  - regression coverage in `frontend/tests/api/fal-submit-proxy.test.ts`.
- Hardened client generation-linking to avoid duplicate generation rows by reusing existing records by `request_id`:
  - `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`.
- Improved admin generation trace resilience and discoverability:
  - fallback when `ai_generations` recovery columns are missing (legacy schema compatibility),
  - trace lookup by `metadata.source_ref`,
  - coverage updates in `frontend/tests/api/admin-generation-trace.test.ts`.
- Added operator replay route for stuck Fal generations:
  - `POST /api/admin/generation-recovery/replay`
  - source: `frontend/pages/api/admin/generation-recovery/replay.ts`
  - behavior: resolve generation by `generationId`/`requestId`, re-poll provider aliases, persist recovered media to storage + `media_files`, and repair `ai_generations` status/recovery metadata.
  - tests: `frontend/tests/api/admin-generation-recovery-replay.test.ts`.
- Updated migration 019 for safe rollout on dirty historical data:
  - `sql/migrations/019_add_generation_recovery_fields.sql`
  - now deduplicates `(user_id, request_id)` rows deterministically before creating unique index.
- Updated internal route docs:
  - `docs/api/api-internal-routes.md` (moved replay route from planned to implemented).
- Validation evidence:
  - `npm -C frontend run test -- admin-generation-recovery-replay admin-generation-trace fal-submit-proxy useAiStudioTaskSubmission useAiStudioTaskOrchestration useAiStudioTasks`
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`

## 2026-02-19 (AI Studio stabilization scope note: runtime admission control + rate-limit protection)
- Updated stabilization addendum to explicitly mark generation capacity/rate-limit resilience as in-scope:
  - `docs/planning/ai-studio-generation-runtime-stabilization.md`
  - added `Capacity and Rate-limit Protection (In Scope)` section with:
    - runtime per-user/per-model submit caps,
    - provider `429`/`5xx` retry/backoff with jitter and `Retry-After`,
    - lightweight per-model circuit-breaker behavior,
    - explicit deferral of full durable internal queue architecture until after S1/S2 gates.
- Updated backlog tracking so rate-limit protection is a visible pre-canary requirement:
  - `docs/planning/backlog.md`

## 2026-02-20
- Locked AI Studio generation runtime v2 execution and governance: added ADR `0020` plus authoritative planning/audit docs (`docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`, `docs/planning/ai-studio-generation-runtime-audit-2026-02-20.md`) and archived superseded planning docs.
- Implemented server runtime flag wiring (`frontend/lib/server/api/falRuntimeFlags.ts`) and documented rollout flags in `frontend/.env.example`, `docs/deployment.md`, and API/SOP references.
- Unified Fal terminal billing settlement to one API (`settleGenerationOutcome`) and switched status proxy settlement to the unified path; direct-debit fallback is now emergency-only via `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED`.
- Added webhook-first Fal ingestion route (`POST /api/fal/webhook`) with signature verification helper (`frontend/lib/server/api/falWebhook.ts`) and explicit proxy webhook exception.
- Added protected internal reconciler trigger route (`POST /api/internal/generation-recovery/run`) with `x-shortpulse-cron-secret` auth and runtime-flag-gated claim/requeue/exhaust logic.
- Removed runtime missing-column fallback behavior in generation persistence paths (`generationSubmitPersistence` and admin replay update path) to align with schema convergence requirements.
- Added SQL migrations `020`-`023` for recovery convergence, status transition enforcement, persistence idempotency index, and `SKIP LOCKED` reconciler claim function.
- Expanded test coverage for new auth boundaries/routes and updated status-proxy settlement tests to the unified settlement API.

## 2026-02-20 (runtime v2 audit-corrected implementation)
- Implemented Fal webhook verification cutover controls with JWKS/Ed25519 support and dual-mode fallback (`SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE`, `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`), plus callback-base wiring (`SHORTPULSE_PUBLIC_API_BASE_URL`) and submit-time `fal_webhook` registration.
- Added durable webhook inbox/idempotency pipeline and migrations `024_fal_webhook_inbox.sql` (+ rollback), and rewired `/api/fal/webhook` to ingest event records before terminal side effects.
- Added shared runtime recovery execution engine (`frontend/lib/server/falIntegration/recoveryExecution.ts`) and wired webhook, status proxy terminal sync, internal reconciler, and admin replay to the same execution path.
- Added lease-based reconciler claims migration `025_generation_recovery_leases.sql` (+ rollback) and guarded recovery transition migration `026_generation_recovery_transition_guards.sql` (+ rollback).
- Completed thin-client lifecycle cutover by removing client-side generation lifecycle writes from AI Studio orchestration hooks/persistence flow.
- Added/updated tests for Fal webhook signature verification, webhook route ingestion path, reconciler execution route, status proxy integration, submit proxy behavior, and orchestration hook behavior; lint + type-check passing.
- Updated runtime docs/indices (planning, ADR, API/internal routes, deployment, data dictionary, migration docs, schema snapshot, and env example) to reflect the new source of truth.

## 2026-02-20 (governance realignment foundation)
- Added governance rollout artifacts under `docs/planning/` for inventory, overlap audit, feasibility, master rollout proposal, stage execution docs, CI policy checks, implementation tracker, and final validation summary.
- Added forward SQL hardening migration `sql/migrations/028_harden_ai_agent_conversation_state_security.sql` plus rollback pair for conversation-state retention clamps, deterministic pruning, service-role execute posture, and cleanup helper function.
- Updated migration/security/data-dictionary/runbook docs to include `018` + `028` conversation-state contracts and bounded retention policy.
- Introduced docs governance automation scripts: `scripts/check_docs_semantic_drift.js`, `scripts/check_migration_doc_parity.js`, and `scripts/check_archive_manifest.js`; wired into `npm -C frontend run docs:check`.
- Added CI jobs `docs_semantic_drift`, `migration_parity`, `archive_manifest_check`, and `sql_lint` with warn/enforce mode toggles.
- Aligned active architecture guidance by removing stale client-only wording from `README.md` and `frontend/AGENTS.md`.

## 2026-02-23
- Added the documentation-first Reference Grid Foundation Program package:
  - `docs/planning/ai-studio-reference-grid-modularization-program.md`
  - `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
  - `docs/planning/evidence/reference-grid-modularization/README.md`
  - `docs/planning/evidence/reference-grid-modularization/phase-report-template.md`
  - phase evidence folders `phase-0` through `phase-6`
- Added `docs/adr/0022-reference-grid-domain-modular-architecture.md` to formalize modular domain boundaries and strangler migration contracts.
- Updated SOP governance for reference-grid modularization controls:
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/sops/sop_adaptive_media_change_control.md`
  - `docs/sops/sop_ai_studio_index.md`
- Updated documentation indexes for discoverability:
  - `docs/planning/README.md`
  - `docs/README.md`
  - `docs/adr/README.md`
- Expanded guardrail scripts for reference-grid modularization rollout lanes:
  - `scripts/check_architecture_boundaries.js`
  - `scripts/check_size_budgets.js`
- Added CI env wiring for staged reference-grid guardrail modes in `.github/workflows/ci.yml`:
  - `REFERENCE_GRID_BOUNDARY_MODE`
  - `REFERENCE_GRID_SIZE_BUDGET_MODE`
- Began Reference Grid Foundation Program Phase 1 implementation:
  - Added canonical reference-domain modules under `frontend/features/ai-studio/reference-domain/` (`types`, `reducer`, `selectors`, `adapters`, `index`).
  - Added domain unit coverage: `referenceDomain.reducer.test.ts` and `referenceDomain.adapters.test.ts`.
  - Adopted shared output collection normalization helpers in `frontend/features/ai-studio/hooks/useAiStudioState.ts` to start runtime-safe migration with behavior parity.
- Added phase evidence artifact: `docs/planning/evidence/reference-grid-modularization/phase-1/2026-02-23-phase-01-domain-core-foundation.md`.
- Updated tracker state to reflect Phase 0 completion and Phase 1 progress in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
- Implemented Reference Grid Foundation Program Phase 2 ingestion unification:
  - Added canonical ingestion module `frontend/features/ai-studio/reference-ingestion/` with source-tagged `ReferenceIngestionInput` contracts and unified builder (`buildStudioOutputsFromReferenceInput`).
  - Routed ingestion entrypoints in `frontend/features/ai-studio/hooks/useAiStudioState.ts` (file add, paste prompt/media, library media/prompt, agent prompt) through the canonical ingestion adapter.
  - Added ingestion acceptance-matrix tests in `frontend/features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts` and validated no-regression targeted suites.
- Added phase evidence artifact: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-ingestion-unification-foundation.md`.
- Updated tracker progress for phase alignment in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
- Added phase-2 post-implementation audit + external benchmark artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-post-implementation-audit-and-external-benchmark.md`
  - Captures residual ingress/projection deltas and official best-practice comparison links before Phase 3 promotion.
- Applied Phase 2 ingestion hardening before Phase 3 kickoff:
  - preserved library-media full-vs-preview URL intent in canonical ingestion (`resultUrls` carries full URL hint while `previewUrl` remains preview contract).
  - propagated picker/drop source through file ingestion mapping and added source parity coverage.
  - normalized duplicate file handling across picker/drop uploads in `mapUploadsFromFiles`.
  - corrected media-library selection payload to preserve `previewStoragePath` and `fullStoragePath` separation.
- Added hardening evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hardening-ingestion-contract-parity.md`
- Closed remaining Phase 2 kickoff-hold deltas:
  - added keyboard quick-slot reorder path on curated cards (`ArrowUp` / `ArrowDown`) with curated interaction tests.
  - added integration coverage for media-library add -> quick-slot reorder/remove -> archive overflow -> restore lifecycle.
- Added hold-closure evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hold-closure-integration-and-keyboard-parity.md`
- Started Phase 3 projection-semantics foundation:
  - added `frontend/features/ai-studio/reference-projections/` module (state contracts, transitions, selectors, compatibility adapter, unit tests).
  - rewired curated delete suppression in `useAiStudioState` to explicit projection-state transitions with legacy hidden-flag compatibility mirroring.
  - updated output-store bridge tests for projection-based suppression behavior.
- Added phase-3 foundation evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-foundation.md`
- Closed Phase 3 projection semantics:
  - wired explicit `removedFromAllRefsIds` projection state through `useAiStudioState` -> page wiring -> `ReferenceCanvas`.
  - switched all-refs visibility computation in `ReferenceCanvas` to projection selector contracts with legacy fallback compatibility.
  - removed implicit hidden-delete cleanup coupling and finalized suppressed deletions on quick-slot detach via lifecycle path.
  - expanded parity coverage for explicit suppression behavior in projection, canvas curated, and state output-store bridge suites.
- Added phase-3 closeout evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-closeout.md`
- Started Phase 4 media runtime unification with shared runtime policy foundation:
  - added `frontend/lib/mediaPreviewRuntimePolicy.ts` for centralized sign-budget resolution and retry-cap helpers.
  - rewired `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts` route budget resolution to the shared policy module.
  - rewired modal/route preview-error retry gates and modal sign-batch cap checks to shared policy helpers:
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
  - added dedicated policy unit tests:
    - `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimePolicy.test.ts`
- Added phase-4 foundation evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-foundation.md`
- Continued Phase 4 media runtime unification (slice 2 controller parity):
  - generalized `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` with configurable surface/relevance/enabled/cap options.
  - removed duplicated sign-pass runtime effect from `frontend/features/ai-studio/components/MediaLibraryModal.tsx` and routed modal signing passes through the shared controller hook.
  - preserved modal no-regression sign-attempt cap via shared controller option (`maxSignAttemptsPerItem`) and shared policy constant.
  - added controller test coverage for signing-pass enable gating in `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`.
- Added phase-4 slice-2 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-controller-parity-slice-2.md`
- Continued Phase 4 media runtime unification (slice 3 preview-recovery parity):
  - added shared recovery controller `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts` for signed-url refresh, retry-cap handling, and hydrate fallback.
  - rewired route runtime (`frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`) and modal runtime (`frontend/features/ai-studio/components/MediaLibraryModal.tsx`) to shared recovery callbacks.
  - preserved modal optimizer fallback behavior using controller `beforeRetry` callback seam.
  - added shared recovery controller tests in `frontend/features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts`.
- Added phase-4 slice-3 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-preview-recovery-controller-slice-3.md`
- Continued Phase 4 media runtime unification (slice 4 preview-resolver API parity):
  - added shared preview resolver module `frontend/features/media-library/logic/mediaPreviewResolver.ts` for `/api/media/resolve-previews` request/response normalization.
  - rewired route and modal unresolved-preview resolver callbacks to shared helper:
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
  - added shared resolver unit tests in `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`.
- Added phase-4 slice-4 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-preview-resolver-api-parity-slice-4.md`
- Continued Phase 4 media runtime unification (slice 5 selection-url resolver parity):
  - rewired modal media selection URL signing in `frontend/features/ai-studio/components/MediaLibraryModal.tsx` to shared helper `resolveSignedSelectionUrl` from `frontend/features/media-library/logic/mediaPreviewResolver.ts`.
  - removed duplicated modal selection signing candidate logic while preserving canonical `storage_path` priority and fallback behavior.
  - expanded shared resolver tests for canonical-first ordering, fallback signing, and deduped candidate resolution in `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`.
- Added phase-4 slice-5 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-selection-url-resolver-parity-slice-5.md`
- Continued Phase 4 media runtime unification (slice 6 shared runtime helper parity):
  - added `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts` for shared sign-path resolution, resolve-previews application, and storage-download hydration helpers.
  - rewired both modal and route runtime callbacks to shared helpers:
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
  - added shared helper tests in `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimeShared.test.ts`.
- Closed Phase 4 media runtime unification:
  - marked phase checklist + exit validation complete and resolved runtime parity blocker (`RG-DEP-03`) in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
  - aligned tracker risk state by marking modal/route runtime divergence (`Risk #4`) as `Mitigated`.
  - added closeout evidence artifact:
    - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-closeout.md`
- Started Phase 5 canvas + state decomposition (slice 1 foundation):
  - extracted reference-card rendering from `frontend/features/ai-studio/components/ReferenceCanvas.tsx` into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`.
  - extracted clipboard/paste parsing and media normalization into `frontend/features/ai-studio/reference-grid/controllers/referenceGridClipboard.ts`.
  - added controller unit coverage at `frontend/features/ai-studio/reference-grid/controllers/__tests__/referenceGridClipboard.test.ts`.
  - reduced `ReferenceCanvas.tsx` from 3489 lines to 2902 lines while preserving behavior parity in existing ReferenceCanvas suites.
- Added phase-5 slice-1 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-foundation-slice-1.md`
- Continued Phase 5 canvas decomposition (slice 2 controller extraction):
  - extracted document-level paste capture and pointer priming controller into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridClipboardController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume controller hook callbacks and removed in-component document listener orchestration for clipboard/pointer handling.
  - preserved no-regression behavior in existing ReferenceCanvas paste/curated/selector suites.
- Added phase-5 slice-2 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-controller-slice-2.md`
- Continued Phase 5 canvas decomposition (slice 3 drop-controller extraction):
  - extracted canvas drag/drop orchestration and document drag cleanup listeners into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCanvasDropController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed drop handlers.
  - preserved no-regression behavior in ReferenceCanvas and AI Studio page drop-path suites.
- Added phase-5 slice-3 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-drop-controller-slice-3.md`
- Continued Phase 5 canvas decomposition (slice 4 curated-controller extraction):
  - extracted curated quick-slot drag/drop and keyboard reorder orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume curated controller hook callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-4 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-curated-controller-slice-4.md`
- Continued Phase 5 canvas decomposition (slice 5 scroll-controller extraction):
  - extracted all-refs/curated scroll orchestration (RAF-throttled virtual metrics updates + scroll telemetry sampling) into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `handleAllRefsScroll` and `handleCuratedScroll` callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-5 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-scroll-controller-slice-5.md`
- Continued Phase 5 canvas decomposition (slice 6 virtual-metrics controller extraction):
  - extracted virtual grid measurement and resize-observer orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed virtual-metrics orchestration for all-refs and quick-slot surfaces.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-6 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-virtual-metrics-controller-slice-6.md`
- Continued Phase 5 canvas decomposition (slice 7 video-lifecycle controller extraction):
  - extracted video node registration, visibility observer lifecycle, stale-node pruning, and autoplay detach cleanup into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVideoLifecycleController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `registerVideoNode` and lifecycle orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-7 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-video-lifecycle-controller-slice-7.md`
- Continued Phase 5 canvas decomposition (slice 8 autoplay-budget controller extraction):
  - extracted responsive/network/device autoplay budget policy orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayBudgetController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay budget runtime policy.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-8 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-budget-controller-slice-8.md`
- Continued Phase 5 canvas decomposition (slice 9 telemetry controller extraction):
  - extracted render-commit, longtask observer, and telemetry-backpressure policy effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed telemetry orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-9 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-telemetry-controller-slice-9.md`
- Continued Phase 5 canvas decomposition (slice 10 autoplay-events controller extraction):
  - extracted autoplay started/stopped telemetry handlers into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayEventController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay event callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-10 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-events-controller-slice-10.md`
- Continued Phase 5 canvas decomposition (slice 11 archive-controls component extraction):
  - extracted header/archive inline/archive panel presentation into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx`.
  - rewired split and non-split `ReferenceCanvas` surfaces to consume shared archive controls component.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-11 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-archive-controls-component-slice-11.md`
- Continued Phase 5 canvas decomposition (slice 12 card-drag controller extraction):
  - extracted card drag start/end protocol handlers into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardDragController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed card drag handlers.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-12 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-drag-controller-slice-12.md`
- Continued Phase 5 canvas decomposition (slice 13 loaded-media controller extraction):
  - extracted loaded-media callback bookkeeping and notification fan-out into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadedMediaController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `markLoaded` callback.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-13 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-loaded-media-controller-slice-13.md`
- Continued Phase 5 canvas decomposition (slice 14 sections component extraction):
  - extracted split/non-split quick-slot/all-refs layout rendering into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasSections.tsx`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to pass section view-model props and rendered card nodes into shared sections component.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-14 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-sections-component-slice-14.md`
- Continued Phase 5 canvas decomposition (slice 15 card-render controller extraction):
  - extracted per-card action wiring and curated/all-refs card-node mapping into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `curatedCardNodes` and `allRefsCardNodes`.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-15 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-render-controller-slice-15.md`
- Continued Phase 5 canvas decomposition (slice 16 preview-swap telemetry controller extraction):
  - extracted preview swap metric tracking/reset effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed preview swap telemetry orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-16 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-preview-swap-telemetry-controller-slice-16.md`
- Continued Phase 5 canvas decomposition (slice 17 loading-visual controller extraction):
  - extracted loading/spinner derivation into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadingVisualController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed loading/spinner sets and loading count.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-17 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-loading-visual-controller-slice-17.md`
- Continued Phase 5 canvas decomposition (slice 18 autoplay-selection controller extraction):
  - extracted visible-video prioritization, autoplay-enabled id selection, and related runtime ref-sync effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplaySelectionController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay selection orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-18 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-selection-controller-slice-18.md`
- Continued Phase 5 canvas decomposition (slice 19 drop-helpers controller extraction):
  - extracted media-file normalization, drop-mode detection, and FileList helper primitives into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed drop helper callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-19 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-drop-helpers-controller-slice-19.md`
- Continued Phase 5 canvas decomposition (slice 20 image-hydration controller extraction):
  - extracted hydration queue/decode runtime, adaptive local transcode path, stale-id pruning, and hydration object URL cleanup into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `imageHydrationState`, `enqueueImageHydration`, and queue-prune API.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-20 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-image-hydration-controller-slice-20.md`
- Continued Phase 5 canvas decomposition (slice 21 viewport-projection controller extraction):
  - extracted virtual-window derivation, hard viewport cap projection, visible slices, spacer heights, and near-viewport derivation into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed projection outputs.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-21 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-viewport-projection-controller-slice-21.md`
- Continued Phase 5 canvas decomposition (slice 22 card-items controller extraction):
  - extracted visible card-item URL/preview derivation, hydration-source matching, and transformed adaptive preview counting into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed card-item derivations.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-22 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-items-controller-slice-22.md`
- Continued Phase 5 canvas decomposition (slice 23 hydration-queue controller extraction):
  - extracted active/visible/near-viewport hydration enqueue scheduling and queue-prune orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed hydration queue scheduling.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-23 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-hydration-queue-controller-slice-23.md`
- Continued Phase 5 decomposition (slice 24 media-library-modal extraction):
  - extracted Media Library modal model/types/constants/helpers into `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`.
  - extracted prompt/media grid rendering and modal chrome controls into:
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptGrid.tsx`
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryModalControls.tsx`
  - rewired `frontend/features/ai-studio/components/MediaLibraryModal.tsx` to consume extracted modules while preserving behavior.
  - reduced `MediaLibraryModal.tsx` to 796 lines (under the 800-line size target).
- Added phase-5 slice-24 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-media-library-modal-decomposition-slice-24.md`
- Continued Phase 5 decomposition (slice 25 ai-studio-state reference-ingestion actions extraction):
  - extracted agent/paste/library/file ingestion callbacks and agent-context projection into `frontend/features/ai-studio/hooks/useAiStudioReferenceIngestionActions.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed ingestion actions.
- Added phase-5 slice-25 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-reference-ingestion-actions-slice-25.md`
- Continued Phase 5 decomposition (slice 26 ai-studio-state reference-grid actions extraction):
  - extracted soft-archive/restore + curated projection action bundle into `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed archive/projection actions.
- Added phase-5 slice-26 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-reference-grid-actions-slice-26.md`
- Continued Phase 5 decomposition (slice 27 ai-studio-state object-url lifecycle extraction):
  - extracted output blob URL tracking and revocation lifecycle into `frontend/features/ai-studio/hooks/useAiStudioOutputObjectUrlLifecycle.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed object URL lifecycle.
  - reduced `useAiStudioState.ts` to 872 lines.
- Added phase-5 slice-27 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-object-url-lifecycle-slice-27.md`

## 2026-02-23 (reference-grid phase 5 slice 28 + closeout)
- Continued Phase 5 decomposition by extracting `useAiStudioState` output/store bridge, projection lifecycle effects, model-option derivation, optimistic placeholder actions, and output-store selector wrappers into dedicated hooks.
- Rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume extracted hooks while preserving no-regression behavior and selector-store compatibility.
- Closed target hotspot size budgets: `ReferenceCanvas.tsx` 834 (<=900), `MediaLibraryModal.tsx` 796 (<=800), and `useAiStudioState.ts` 641 (<=650).
- Added Phase 5 slice-28 evidence and Phase 5 closeout artifacts:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-output-collection-and-projection-effects-slice-28.md`
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-and-state-decomposition-closeout.md`
- Updated tracker to mark Phase 5 complete and link new evidence artifacts.

## 2026-02-23 (reference-grid phase 6 slice 1)
- Started Phase 6 guardrail cleanup by fixing CI wrapper mode resolution for `architecture_boundary` and `size_budget` so reference-grid enforce-mode flags cannot be masked by global warn-mode wrappers.
- Updated `.github/workflows/ci.yml` to derive `EFFECTIVE_MODE` from both global and reference-grid gate variables for boundary and size checks.
- Added Phase 6 slice-1 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-guardrail-effective-mode-alignment-slice-1.md`

## 2026-02-23 (reference-grid phase 6 slice 2)
- Added Phase 6 enforce-cycle preflight evidence after two consecutive local green cycles under enforce-mode boundary and size settings.
- Captured promotion-ready status for reference-grid guardrails pending CI repository-variable toggle and enforce-cycle capture.
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-enforce-cycle-preflight-slice-2.md`

## 2026-02-23 (reference-grid phase 6 slice 3)
- Retired temporary compatibility toggle `NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE` and removed its fallback branch from `useAiStudioState`; normalized output fast-path is now always on.
- Updated operational/env docs to remove the retired flag reference:
  - `frontend/.env.example`
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/troubleshooting.md`
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-dead-flag-retirement-normalized-state-slice-3.md`

## 2026-02-23 (reference-grid phase 6 slice 4)
- Promoted repository guardrail variables to enforce mode for `sleepyseamonster/ShortPulse`:
  - `REFERENCE_GRID_BOUNDARY_MODE=enforce`
  - `REFERENCE_GRID_SIZE_BUDGET_MODE=enforce`
- Captured enforcement promotion evidence:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-repo-variable-enforce-promotion-slice-4.md`

## 2026-02-23 (reference-grid phase 6 slice 5)
- Added `workflow_dispatch` trigger to `.github/workflows/ci.yml` as a temporary CI control-plane unblock to capture required Phase 6 enforce-cycle evidence on `reference-grid-audit`.
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-ci-dispatch-unblock-slice-5.md`

## 2026-02-23 (reference-grid phase 6 slice 6)
- Fixed CI deadcode failure by removing obsolete legacy adapter and orphan test:
  - deleted `frontend/features/ai-studio/hooks/stateAdapters/agentReferenceOutputs.ts`
  - deleted `frontend/features/ai-studio/hooks/stateAdapters/__tests__/agentReferenceOutputs.test.ts`
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-deadcode-remediation-agent-reference-adapter-slice-6.md`

## 2026-02-23 (reference-grid phase 6 closeout)
- Completed Phase 6 guardrails/cleanup and marked the reference-grid modularization program complete.
- Captured two successful CI enforce cycles on `reference-grid-audit` after promotion and cleanup:
  - run `22314518609` (success)
  - run `22314737402` (success)
- Added Phase 6 closeout evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-guardrails-and-cleanup-closeout.md`

## 2026-02-24 (AI Studio agent failure-path hardening)
- Added shared failure-policy module `frontend/features/agent-runtime/studioAgentFailurePolicy.ts` to centralize failure classification (`safety_refusal`, `infra_transient`, `infra_runtime`, `auth_config`, `invalid_request`), user-lane resolution, and bounded retry backoff+jitter helpers.
- Hardened `/api/ai/studio-agent` coordinator to:
  - apply bounded retries for transient upstream failures,
  - keep safety refusal + SFW rewrite behavior,
  - return assistant fallback success payloads (`200`) for runtime/provider failure lanes,
  - preserve explicit non-200 errors for auth/config/invalid-request lanes,
  - emit telemetry for fallback outcomes (`outcome_class: fallback_infra`) with retry metadata.
- Hardened `/api/ai/describe-image` legacy service to mirror the same user-lane policy: safety refusal/rewrite as success, runtime/provider failures as safe fallback description (`200`), explicit non-200 for validation/auth/config errors.
- Expanded regression coverage:
  - `frontend/features/agent-runtime/__tests__/studioAgentFailurePolicy.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/tests/api/describe-image.route.test.ts`
  - `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`
- Updated ops docs to reflect the new failure contract:
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`

## 2026-02-24 (AI Studio reliability hardening follow-up)
- Normalized fast-path transport throws into classified failure objects in `frontend/features/agent-runtime/studioAgentFastPathTurn.ts` so coordinator retries/fallback policy handles throw and non-throw failures consistently.
- Split runtime timeout budgets in `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts` and `/api/ai/studio-agent` wiring:
  - added `STUDIO_AGENT_VISION_TIMEOUT_MS`
  - added `STUDIO_AGENT_TURN_TIMEOUT_MS`
  - preserved backward compatibility by inheriting `STUDIO_AGENT_TIMEOUT_MS` when split values are unset.
- Updated coordinator turn execution to use dedicated turn budget (`turnTimeoutMs`) for fast-path and v2 generation lanes (`frontend/features/agent-runtime/studioAgentCoordinator.ts`).
- Hardened reference-grid optimizer failover in `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts` by adding session-level source fail cache and failover telemetry counters; emitted through existing telemetry controller path.
- Replaced drag ghost clone-and-strip with a dedicated ghost builder in `frontend/features/ai-studio/utils/dragDrop.ts` and added defensive dragging CSS suppression for action overlays in `frontend/styles/ai-studio-canvas.css`.
- Added provider-download timeout/abort handling in `frontend/features/ai-studio/logic/referenceDownload.ts` and kept hook orchestration focused in `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`.
- Expanded regression coverage:
  - `frontend/features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/features/ai-studio/utils/__tests__/dragDrop.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- Added evidence note:
  - `docs/planning/evidence/agent/phase-5/2026-02-24-phase-5-runtime-timeout-split-and-failover-hardening.md`

## 2026-02-24 (AI Studio default-model foundation + reliability delta closeout)
- Added canonical Create model-selection policy module:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - centralizes Create/Image filtering and startup default precedence.
- Wired shared policy into AI Studio hooks:
  - `frontend/features/ai-studio/hooks/useAiStudioAllowedModelOptions.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- Locked Create startup restore precedence:
  - preserve valid saved model
  - fallback to `fal-ai/bytedance/seedream/v4.5/text-to-image` when saved model is missing/invalid for Create + Image.
- Hardened residual parse/body exception paths:
  - `frontend/features/agent-runtime/studioAgentFastPathTurn.ts`
  - `frontend/features/ai-agent/logic/studioAgentThinkerFormatter.ts`
  - parse/body-read failures now normalize to typed stage failures instead of bubbling to route-level exceptions.
- Expanded regression coverage:
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
  - `frontend/features/ai-agent/logic/__tests__/studioAgentThinkerFormatter.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- Added ADR:
  - `docs/adr/0025-ai-studio-create-startup-model-precedence.md`
- Added evidence note:
  - `docs/planning/evidence/agent/phase-5/2026-02-24-phase-5-default-model-foundation-and-reliability-delta-closeout.md`

## 2026-02-25 (AI Studio safety-policy track: image payload minimum-restriction alignment)
- Centralized image generation safety payload defaults in:
  - `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`
- Updated image submit handlers to use shared policy-driven safety payloads:
  - `frontend/features/ai-studio/hooks/taskSubmission/defaultHandlers.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`
- Aligned runtime defaults to minimum-restriction payload settings for supported image models:
  - FLUX.2 + FLUX.2 Lite + FLUX.2 Edit: `enable_safety_checker: false`
  - FLUX.2 Pro + FLUX.2 Pro Edit: `enable_safety_checker: false`, `safety_tolerance: "5"`
  - Seedream 4.5 text/edit: `enable_safety_checker: false`
- Expanded regression coverage:
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
- Synced docs with runtime behavior:
  - `docs/sops/sop_ai_studio_index.md`
  - `docs/sops/sop_image_generation.md`
  - `docs/api/api-fal-flux-2.md`
  - `docs/api/api-fal-flux-2-klein-9b.md`
  - `docs/api/api-fal-seedream-4-5.md`

## 2026-02-25 (AI Studio safety-policy track closeout verification)
- Completed Workstream C closeout for Foundational Hardening Program v2 with official fal.ai verification across image models.
- Added formal verification evidence and full-gate results:
  - `docs/planning/evidence/agent/phase-5/2026-02-25-phase-5-safety-policy-verification-closeout.md`
- Corrected Seedream text model catalog doc source to fal canonical endpoint:
  - `frontend/lib/model-runtime/modelCatalog.ts`
  - updated from `.../seedream/v4.5/api` to `.../seedream/v4.5/text-to-image/api`
- Executed full regression gates (all pass):
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`
  - `npm -C frontend run test`
  - `npm -C frontend run build`

## 2026-02-25 (AI Studio reference-grid prompt card generation decoupling)
- Removed the reference-card Generate pill from the Reference Grid prompt cards and deleted its render-path wiring:
  - `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
  - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Unwired prompt-card generation plumbing from page orchestration and reference-grid prop composition:
  - `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`
  - `frontend/pages/ai-studio.tsx`
- Removed dead reference-card generate styling and retained agent-output generate styling on chat surfaces:
  - `frontend/styles/ai-studio-canvas.css`
- Updated regression tests for the new contract (no per-card generate callbacks/flags):
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.paste.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`
- Updated SOPs to document prompt-card reuse behavior and primary-generate-only workflow:
  - `docs/sops/sop_text_generation.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`

## 2026-02-25 (AI Studio Create Character Mode model picker filtering)
- Updated the shared create/image model-selection policy so Character Mode hides `FLUX.2 Lite` in the Create model picker while preserving existing startup/default precedence:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
  - `frontend/pages/ai-studio.tsx`
- Added regression coverage for policy-level Character Mode filtering and page-level derived model options:
  - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
- Synced Character Mode behavior documentation:
  - `docs/sops/sop_image_generation.md`

## 2026-02-25 (Character selection persistence across Character Manager and AI Studio)
- Added shared selected-character persistence helpers with local-storage backing:
  - `frontend/features/character-manager/logic/selectedCharacterPersistence.ts`
- Updated Character Manager draft bootstrap to prefer persisted selection and keep persistence current after character switches:
  - `frontend/features/character-manager/logic/characterManagerPersistence.ts`
  - `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- Updated AI Studio Create Character Mode lifecycle to hydrate and persist `selectedCharacterId` using the same shared persistence key:
  - `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`
- Added/updated regression coverage:
  - `frontend/features/character-manager/logic/__tests__/selectedCharacterPersistence.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`
  - `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- Updated docs/runbooks:
  - `docs/sops/sop_character_manager_operations.md`
  - `docs/sops/sop_image_generation.md`
  - `docs/planning/backlog.md`

## 2026-02-25 (AI Studio prompt output structure tuning for Create Properties)
- Tuned active prompt policy definitions to enforce data-backed ordering for generation-ready output:
  - `style+subject -> action/pose -> environment -> lighting -> composition/camera -> texture/color`
  - default style anchor `photorealistic editorial` when user style is unspecified
  - concise, cohesive paragraph target (`~40-90 words` unless explicitly requested longer)
  - explicit ban on label-style fragments and recap/meta phrasing (`Colors:`, `Textures visible:`, `Summary:`, `The prompt now includes...`)
- Applied policy updates across all active text-producing paths:
  - `frontend/lib/agentPromptsConfig.ts`
    - `OPENAI_PROMPT_SYSTEM`
    - `STUDIO_AGENT_SYSTEM`
    - `STUDIO_AGENT_THINKER`
- Added regression assertions for prompt policy integrity and refusal invariants:
  - `frontend/lib/__tests__/agentPromptsConfig.test.ts`
- Added runtime contract guards to ensure tuned prompts preserve prompt-only envelope behavior:
  - `frontend/tests/api/studio-agent.runtime.test.ts`
    - semantic-ready fast path keeps `message` + `actions.applyPrompt` only
    - single-stage semantic refusal remains actionless and preserves canonical prompt
- No API schema/interface changes; refusal text and action contract remain unchanged.

## 2026-02-27 (unified build-out baseline)
- Fixed a baseline TypeScript blocker in `frontend/tests/api/fal-webhook-signature.test.ts` by setting `queueMaxWaitSeconds` in the `FalRuntimeFlags` test fixture.
- Added unified build-out planning artifacts:
  - `docs/planning/shortpulse-unified-buildout-master-plan.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-overlap-matrix.md`
  - `docs/planning/shortpulse-unified-decision-log.md`
  - `docs/planning/stages/unified-phase-00-...` through `unified-phase-12-...`
  - `docs/planning/evidence/unified-buildout/` with per-phase evidence placeholders and Phase 00 baseline note.
- Updated documentation indexes (`docs/README.md`, `docs/planning/README.md`) to include unified build-out artifacts.
- Added a secret-exposure response control note in `docs/security-checklist.md` to require immediate key rotation/revocation and evidence capture.

## 2026-02-27 (unified buildout phase-01 slice-a-b)
- Repaired stale guardrail targeting by replacing legacy `ReferenceCanvas.tsx` paths with canonical `ReferenceGrid.tsx` in CI adaptive filters, size-budget checks, and CODEOWNERS critical-path ownership.
- Tightened naming guard configuration by removing missing-file allowlist entries from `scripts/check_naming_legacy_usage.js` while keeping compatibility-token detection active for live bridge paths.
- Added dedicated CI `type_check` lane and new `secret_scan` lane (`SECRET_SCAN_MODE=warn|enforce`) in `.github/workflows/ci.yml`.
- Added repository-level high-confidence secret exposure scanner at `scripts/check_secret_exposure.js` and documented policy updates in `docs/planning/ci-policy-checks.md`.
- Captured Phase 01 evidence and tracker status updates under `docs/planning/evidence/unified-buildout/phase-01/` and `docs/planning/shortpulse-unified-buildout-tracker.md`.

## 2026-02-27 (unified buildout phase-02 auth slice-a-b)
- Implemented token-first auth hardening by splitting API auth internals into `authTokenVerifier.ts` (bearer parsing + Supabase `/auth/v1/user` verification) and `authProxyContext.ts` (advisory proxy header extraction/merge only).
- Reworked `requireApiUser`/`getOptionalApiUser` orchestration in `frontend/lib/server/api/auth.ts` so proxy headers cannot authorize protected routes without bearer verification under normal mode.
- Added emergency-only proxy fallback switch `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS` (default `false`) and documented it in API/security docs and `.env.example`.
- Expanded protected API path coverage to include `/api/log/` for middleware-route alignment.
- Updated auth boundary tests to cover fail-closed behavior, mismatch handling, and emergency override behavior.

## 2026-02-27 (unified buildout phase-02 admin access slice-c-d)
- Added `GET /api/admin/access` for lightweight server-authoritative admin gating, including explicit `accessVia` source (`role|allowlist|none`) and stable 403 denied payload.
- Added shared admin gate hook `frontend/features/admin/logic/useAdminAccess.ts` and rewired `/admin` and `/admin/generation-trace` to use it, removing authorization coupling to `/api/admin/users` list-fetch success.
- Added `resolveAdminAccessVia` to auth helpers and retained token-first fail-closed auth semantics from phase-02 slice-a-b.
- Added API route coverage for `/api/admin/access` in `frontend/tests/api/admin-access.test.ts` and updated auth helper coverage for allowlist access resolution.
- Updated docs/tracker/evidence for Phase 02 completion (`docs/api/api-internal-routes.md`, `README.md`, unified tracker/stage/evidence artifacts).

## 2026-02-27
- Phase 03 queue/recovery integrity hardening (in progress): added checked queue mutation result contracts in `generationQueue/service.ts`, added transition-guard enforcement in `generationQueue/dispatch.ts`, and tightened fallback recovery claiming in `/api/internal/generation-recovery/run` with compare-and-set predicates.
- Added targeted fault-path tests for transition safeguards: `generationQueue.dispatch.integrity.test.ts`, extended `generationQueue.service.test.ts`, and extended `internal-generation-recovery-run.test.ts` fallback-CAS coverage.
- Updated unified phase docs/tracker/evidence and provider incident SOP with queue transition guard diagnostics.
- Phase 03 follow-up: closed the existing-`request_id` queue reconciliation gap by requiring reservation submit confirmation before queue-row removal, with guarded retry/exhaust fallback and new integrity tests for the branch.

## 2026-02-27 (unified buildout phase-04 slice-a-b)
- Added `providerTrustPolicy` runtime guard module to centralize trusted Fal outbound URL validation and host allowlisting (`SHORTPULSE_FAL_TRUSTED_HOSTS`).
- Enforced trusted URL checks in Fal submit/status/recovery paths:
  - submit target validation in `submitEngine.ts`,
  - trusted queue-base filtering in `falStatusProxy.ts`,
  - trusted response probe filtering in `statusProxyRuntime.ts`,
  - trusted status/result/retry base validation in `recoveryProviderProbe.ts`,
  - trusted webhook-target augmentation filtering in `falSubmitTargeting.ts`.
- Added targeted regression coverage for trust-policy behavior:
  - `providerTrustPolicy.test.ts`,
  - `submitEngine.test.ts`,
  - `recoveryProviderProbe.test.ts`,
  - `statusProxyRuntime.test.ts` (untrusted probe skip),
  - `fal-status-proxy.test.ts` (fail-closed untrusted queue base).
- Updated unified plan/tracker/stage/evidence docs for Phase 04 Slice A/B and added provider incident SOP diagnostics for trusted outbound URL guard failures.

## 2026-02-27 (unified buildout phase-04 slice-d)
- Added queue-status read-only rollout control `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED` (default `true` for compatibility).
- Updated `GET /api/fal/queue-status` to skip dispatch-kick side effects when rollout flag is `false`, while preserving existing response contract and status-read behavior.
- Added targeted compatibility tests:
  - `frontend/tests/api/fal-queue-status.test.ts` (read-only mode + legacy kick mode assertions),
  - `frontend/lib/server/api/__tests__/falRuntimeFlags.test.ts` (new flag default/override parsing),
  - `frontend/tests/api/fal-webhook-signature.test.ts` fixture update for new runtime flag shape.
- Updated rollout docs and runbooks:
  - `frontend/.env.example`,
  - `docs/api/api-internal-routes.md`,
  - `docs/sops/sop_provider_incident_response.md`,
  - `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md`,
  - `docs/planning/evidence/unified-buildout/phase-04/*`,
  - `docs/planning/shortpulse-unified-buildout-tracker.md`.

## 2026-02-27 (unified buildout phase-04 canary readiness packet)
- Added explicit Phase 04 canary-readiness evidence for `/api/fal/queue-status` read-only rollout:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-readiness.md`.
- Updated Phase 04 stage doc with rollout checklist, rollback triggers, and verification criteria:
  - `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md`.
- Updated evidence index and tracker notes to reflect canary handoff status:
  - `docs/planning/evidence/unified-buildout/phase-04/README.md`,
  - `docs/planning/shortpulse-unified-buildout-tracker.md`.
- Updated deployment env inventory for Phase 04 controls:
  - `docs/deployment.md` (`SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED`, `SHORTPULSE_FAL_TRUSTED_HOSTS`, queue/cleanup env set).

## 2026-02-27 (unified buildout phase-05 slice-a preview trust policy)
- Added centralized media preview trust policy module `frontend/lib/mediaPreviewTrustPolicy.ts` to enforce trusted-host and user-scope checks for direct preview URLs and Next optimizer eligibility.
- Integrated preview trust checks into:
  - `frontend/lib/mediaPreviewPath.ts` (direct fallback filtering),
  - `frontend/lib/adaptive-media/resolver.ts` (optimizer guard),
  - `frontend/features/ai-studio/logic/referenceGridMedia.ts` (optimizer guard),
  - `frontend/next.config.js` (trusted `images.remotePatterns` instead of wildcard hosts).
- Added/updated targeted tests:
  - `frontend/lib/__tests__/mediaPreviewTrustPolicy.test.ts`,
  - `frontend/lib/adaptive-media/__tests__/resolver.test.ts`,
  - `frontend/features/ai-studio/logic/__tests__/referenceGridMedia.test.ts`,
  - `frontend/tests/api/media-resolve-previews.test.ts`.
- Documented new media preview trust env controls in:
  - `frontend/.env.example`,
  - `docs/api/api-internal-routes.md`,
  - `docs/security-checklist.md`,
  - `docs/deployment.md`.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-a-media-preview-trust-policy.md`.

## 2026-02-27 (unified buildout phase-05 slice-b media upload service route)
- Added server-authoritative Media Library upload service `frontend/lib/server/mediaUploadService.ts` with:
  - multipart/raw parsing,
  - destination tab validation (`uploaded_images`, `uploaded_videos`, `private`),
  - magic-byte MIME detection + declared MIME compatibility checks,
  - destination-specific size/type enforcement,
  - scoped storage path generation + storage upload + `media_files` insert + signed preview URL response mapping.
- Added authenticated upload route `POST /api/media/upload` in `frontend/pages/api/media/upload.ts` with rollout flag gate `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`.
- Added targeted route coverage in `frontend/tests/api/media-upload.route.test.ts`.
- Updated documentation for the new route + env controls:
  - `README.md`,
  - `docs/api/api-internal-routes.md`,
  - `docs/security-checklist.md`,
  - `docs/deployment.md`,
  - `docs/sops/sop_media_library_ui.md`,
  - `frontend/.env.example`.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-b-media-upload-service-route.md`.

## 2026-02-27 (unified buildout phase-05 slice-c media upload hook migration)
- Migrated Media Library upload controller to server-authoritative upload route by default:
  - updated `frontend/features/media-library/hooks/useMediaUploadController.ts` to call `fetchWithAuth('/api/media/upload')` with per-file destination tab routing.
- Preserved temporary rollback path:
  - legacy direct Supabase upload branch retained behind `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false`.
- Added/updated upload-controller tests:
  - `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts` now covers API mode and legacy fallback mode.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-c-media-upload-hook-migration.md`.

## 2026-02-27 (unified buildout phase-05 slice-d shared query model + modal prompt scope)
- Added shared media query model module:
  - `frontend/features/media-library/logic/mediaQueryModel.ts` centralizes tab filters, search clause building, and user-scoped prompt query construction.
- Migrated duplicate query logic to the shared model in:
  - `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts`,
  - `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`,
  - `frontend/features/media-library/hooks/useMediaTabDataController.ts`.
- Fixed AI Studio media modal prompt scope drift:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx` now applies explicit `.eq('user_id', userId)` via shared query builder.
- Added/updated tests:
  - `frontend/features/media-library/logic/__tests__/mediaQueryModel.test.ts`,
  - `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`.
- Updated unified phase docs/evidence tracking:
  - `docs/planning/shortpulse-unified-buildout-tracker.md`,
  - `docs/planning/stages/unified-phase-05-media-library-security-first-hardening.md`,
  - `docs/planning/evidence/unified-buildout/phase-05/README.md`,
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-d-shared-query-model-and-modal-scope.md`.

## 2026-02-27 (unified buildout phase-05 slice-d qa follow-up)
- Stabilized `MediaLibraryModal` test harness to remove warning noise while preserving behavior coverage:
  - wrapped retry-cap timer waits in `act(...)` to prevent React test warnings,
  - supplied deterministic signed URL batch mocks for media-selection tests to avoid unresolved-preview log spam.
- Updated Phase 05 Slice D evidence with the QA follow-up validation record.

## 2026-02-27 (unified buildout phase-05 slice-e pre-closeout parity packet)
- Added Phase 05 Slice E pre-closeout parity packet:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-e-precloseout-parity-packet.md`.
- Updated Phase 05 stage/tracker/evidence index notes to reflect that closure prep is complete and Phase 05 remains blocked only on Phase 04 canary signoff.

## 2026-02-27 (unified buildout phase-04 canary execution packet template)
- Added a structured canary execution/signoff template for Phase 04 read-only queue-status rollout:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md`.
- Updated Phase 04 stage/tracker/evidence index docs to reference the execution template as the required signoff artifact before phase closure.
