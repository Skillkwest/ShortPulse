# ShortPulse Backlog

Last audited: 2026-02-13

How to use:
- Keep this list execution-focused and current.
- Mark completed items with `[x]` and keep evidence links inline.
- Move major outcomes into `docs/change_log.md`.

## Done (verified in repo)
- [x] Add platform filter tabs (IG/TikTok/YT) on Performance.
  Evidence: `frontend/features/performance/components/FilterBars.tsx`
- [x] Integrate Media Library UI polish (error banners, retry behavior, empty states).
  Evidence: `frontend/pages/media-library.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- [x] Improve Media Library preview modal sizing/fit for mixed media.
  Evidence: `frontend/pages/media-library.tsx`, `frontend/styles/workspace-media.css`
- [x] Add client-side logging/error surfacing for Supabase-heavy flows.
  Evidence: `frontend/pages/media-library.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/lib/appErrorReporter.ts`
- [x] Document Supabase bootstrap paths for media + creators.
  Evidence: `docs/local-development.md`, `docs/supabase_full_schema.sql`
- [x] Add contributor/testing guidance after adopting a harness.
  Evidence: `docs/testing-guide.md`, `docs/contributor-guide.md`

## Now (highest priority)
- [ ] Create Stripe price IDs for updated tiers/packages and populate `billing_plans.stripe_price_id` + `billing_credit_packages.stripe_price_id` in Supabase.
- [ ] Configure Stripe Billing Portal for subscription update/cancel behavior (`/profile?section=subscription` flow).
- [ ] Run and sign off Subscription tab end-to-end validation (upgrade/downgrade/cancel + webhook sync + renewal credits).
- [ ] Run explicit end-to-end RLS verification for `saved_creators` + `media_files` across two user accounts and document results.
- [ ] Add targeted automated tests for auth + saved creators + media library critical flows.
- [ ] Add account setting: "Show Beginner Mode Toggle" (control visibility of the beginner toggle card, not just mode state).

## Soon
- [ ] Add CSV import/export for saved creators.
- [ ] Add additional demo dataset variants and cohort switching on Performance.
- [ ] Replace hard-coded usage counters with live client state (searches/storage/credits).
- [ ] Make tooltip/url treatments resilient for long links (truncate/ellipsis where needed).
- [ ] Complete Performance data-actions follow-up: add status-history trail (filter reset affordance is already shipped).
- [ ] Add SOP for Performance data actions rail and demo metric recomputation behavior.
- [ ] Character Manager: monitor `character_sheet_*` vs `reference_pack_*` alias drift for one full release cycle and record evidence.
- [ ] Character Manager: ship a deprecation migration plan to remove legacy `reference_pack_*` aliases after drift monitoring is stable.

## Research / Spikes

Full audit and evaluation details: `docs/planning/tooling-audit-2026-02-16.md`

- [ ] Evaluate `react-masonry-css` for media library packed grid to preserve masonry visual density while restoring left-to-right reading order. Scoped spike before implementation.
  Reference: `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`, `docs/planning/tooling-audit-2026-02-16.md` §1
- [ ] Evaluate `next/image` with a custom Supabase loader for media gallery thumbnails (WebP/AVIF, responsive srcset, lazy loading). Pairs with ADR-0009 derivative variants.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §2
- [ ] Evaluate `@dnd-kit/core` + `@dnd-kit/sortable` for AI Studio reference canvas and agent-to-grid drag-and-drop (accessibility, touch reliability, drop animations).
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §3
- [ ] Evaluate `sonner` for unified toast notifications across generation, upload, billing, and bulk action flows.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §4
- [ ] Evaluate `yet-another-react-lightbox` to replace custom MediaFileModal zoom/pan code with a production lightbox (pinch-to-zoom, gallery nav, video support).
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §5
- [ ] Evaluate `date-fns` for consistent date formatting across media library, performance analytics, and generation history.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §6
- [ ] Evaluate `zustand` for global state management if AI Studio prop-drilling friction grows or cross-feature state access is needed.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §7
- [ ] Evaluate `zod` for API route input validation, starting with new routes and backfilling incrementally.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §8

## Later (post-MVP)
- [ ] Explore live data sources or edge functions if backend capabilities are reintroduced.
- [ ] Run ML experiments for early performance prediction once real data is available.
