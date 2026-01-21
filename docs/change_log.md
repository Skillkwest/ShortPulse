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
- Iterated dashboard UX: reordered tool cards, refreshed card imagery, tuned hover/spacing, added “Searches” status chip, enforced plan-color rules (Free white, Media green, Pro teal, Creative Suite amber).
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
- Documentation: added `docs/sop_saved_creators.md` describing data flow, layout, link building, avatar rules, spacing, and known TikTok issue; added `docs/known-issues.md` entry for TikTok-in-Atlas error with mitigation attempts listed.
- Assets: updated `frontend/public/Gray.png` from master root and wired it to both Saved Creators hero and dashboard Saved Creators card.

## 2026-12-14 (media library refresh)
- Mirrored Saved Creators hero onto Media Library with new title/lede, plan chip, and a Media Storage header card (using dashboard hover affordance) plus swapped hero art to `media-library-hero.png` copied from the root reference.
- Unified Media Library background to saved-creators dark theme; flattened upload hero and media panels to saved-creator card styling via `media-panel` class and body override.
- Aligned panel spacing (18px rhythm), adjusted upload card padding/gaps, and recolored panel backgrounds to the shared ash-08 tone.
- Refined upgrade (“Need more storage?”) button: brand amber text, warmer/darker glow, hover lift with controlled brightness.
- Added `docs/sop_media_library_ui.md` covering header composition, media panel styling, upload spacing, upgrade hover rules, and asset locations.

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
- Documentation: updated `docs/shortpulse_ai_studio.md` with the current UI snapshot and layout description.

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
- Pruned duplicate changelog wrappers (`CHANGELOG.md`, `docs/CHANGELOG.md`) to keep `docs/change_log.md` as the single source of truth.
- Updated README and docs index to point to the canonical changelog.
