# ShortPulse Progress Log

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
- Refined welcome hero: overlapping art with centered Quick Start card; ensured button cards have controllable image sizing.
- Created Profile page with left-nav (profile/account/billing), plan badge, and logout modal; added shared styles for profile layout and modals.
- Applied full-bleed hero art backgrounds to Performance, Media Library, and Saved Creators top cards using the latest PNGs.

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
