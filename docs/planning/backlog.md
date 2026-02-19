# ShortPulse Backlog

Last audited: 2026-02-19

How to use:
- Keep this list execution-focused and current.
- Mark completed items with `[x]` and keep evidence links inline.
- Move major outcomes into `docs/change_log.md`.
- Keep section structure locked (no urgency/priority sub-sections).

Structure (locked):
- `General`
- `Dashboard`
- `Media Library`
- `Character Manager`
- `AI Studio`
- `Profile Page`
- `Stripe and Payment Pipelines`
- `Performance Analytics`
- `Research`
- `Done (verified in repo)`

Tooling audit references:
- `docs/planning/tooling-audit-2026-02-16.md`

## General
- [ ] Build a complete, polished collection of small delete buttons.
- [ ] Build a complete, polished collection of small download buttons.
- [ ] Build a complete, polished collection of small save buttons.
- [ ] Define a prefab management system to keep reusable prefabs organized, easy to find, and consistently maintained over time.

## Dashboard
- [ ] Replace hard-coded usage counters with live client state (searches/storage/credits).
- [ ] Redesign the Dashboard with a polished UI pass and thoroughly organize its styling structure for long-term maintainability.

## Media Library
- [ ] Make tooltip/url treatments resilient for long links (truncate/ellipsis where needed).
- [ ] Media Library: redesign the header bar and refresh small info cards to pull real account-level details.
- [ ] Media Library: fully optimize image loading and experiment with tooling options for masonry-style display.
- [ ] Media Library: improve pagination behavior and controls across media tabs as part of optimization.
- [ ] Media Library: increase spacing in uploaded-images card header rows to fix cramped title/button layout.
- [ ] Media Library: restyle text prompt cards in the `Saved Prompts` tab.

## Character Manager
- [ ] Align Character Manager styling with the AI Studio character workflow so the manager page and properties panel feel cohesive.
- [ ] Redesign Character Manager with a more polished UI, modeled after the AI Studio character workflow experience.

## AI Studio
- [ ] AI Studio: Fal reliability rollout (submit + retrieval modular core, shadow -> canary). Tracker: `docs/planning/ai-studio-fal-reliability-rollout.md`.
- [ ] AI Studio Fal reliability rollout - Phase 0 (Baseline + UX Freeze). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-0-baseline--ux-freeze`
- [x] AI Studio Fal reliability rollout - Phase 1 (Retrieval Correctness Hotfix). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-1-retrieval-correctness-hotfix`
  Evidence: `frontend/lib/server/api/falStatusProxy.ts`, `frontend/tests/api/fal-status-proxy.test.ts`
- [x] AI Studio Fal reliability rollout - Phase 2 (Veo I2V Drift Removal). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-2-veo-i2v-drift-removal`
  Evidence: `frontend/pages/api/fal/veo-image-to-video-submit.ts`, `frontend/pages/api/fal/veo-image-to-video-status.ts`, `frontend/tests/api/fal-submit-proxy.test.ts`
- [ ] AI Studio Fal reliability rollout - Phase 3 (Modular Core Shadow Mode). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-3-modular-core-shadow-mode`
- [ ] AI Studio Fal reliability rollout - Phase 4 (Persistence Decoupling). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-4-persistence-decoupling`
- [ ] AI Studio Fal reliability rollout - Phase 5 (Reconciler + Admin Repair). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-5-reconciler--admin-repair`
- [ ] AI Studio Fal reliability rollout - Phase 6 (Canary Rollout). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-6-canary-rollout`
- [ ] AI Studio Fal reliability rollout - Phase 7 (Lean Hardening Add-ons). `docs/planning/ai-studio-fal-reliability-rollout.md#phase-7-lean-hardening-add-ons`
- [ ] AI Studio Fal reliability rollout - complete docs/runbook pass and post-rollout audit checklist. `docs/planning/ai-studio-fal-reliability-rollout.md#plan-audit-checklist`
- [ ] AI Studio: run staging smoke tests for aspect-ratio contract (verify submit payload and returned dimensions for Seedream `5:4`, `4:5`, `3:2`, `2:3`, `21:9`).
- [ ] AI Studio: add periodic model API contract re-verification workflow (monthly or model-change trigger) and bump `verifiedAt` with source links.
- [ ] AI Studio: alter existing e2e coverage for aspect clamping + submit-time `effective_aspect` consistency after the contract overhaul.
- [ ] AI Studio: trim the aspect-ratio dropdown by removing extraneous ratio options and keeping only supported defaults.
- [ ] AI Studio: update reference grid styling and adjust `Add files` / `Media library` button colors.
- [ ] AI Studio: change placeholder `generating` and `loading preview` reference cards to a lighter gray background for better visual contrast.
- [ ] AI Studio: increase normal-state color saturation for the reference-grid `Add files` and `Media library` buttons (current state appears too gray/desaturated).
- [ ] AI Studio: remove the blue gradient overlay from the quick-slot inventory background.
- [ ] AI Studio: fix expanded media modal labels so images imported from Media Library are consistently labeled as images (never videos).
- [ ] AI Studio: correct local computer import media typing so uploaded images render and behave as images throughout the expanded media modal.
- [ ] AI Studio: test header title color updates and add a sparkle icon next to the `AI Studio` title.
- [ ] AI Studio: preload character workflow identities and saved references when entering from Dashboard so character assets are cached across workflow switches.
- [ ] AI Studio: persist the selected character in the `Character Properties` panel across mode switches, and default back to that selected profile instead of the base default profile.
- [ ] AI Studio: make `CharacterManager` open instantly (no open animation) and tune properties panel sizing.
- [ ] AI Studio: in Beginner mode, make the `Create Properties` panel resize to its minimum width when `Create Primary` is clicked.
- [ ] AI Studio: add a `Canvas` button that opens a free-form canvas for dragging/dropping images and text prompts to visually organize ideas.
- [ ] AI Studio: clean up beginner-mode copy across all properties panels.
- [ ] AI Studio: investigate and polish rare one-off full-grid flash in Reference Grid/Quick Slot under adaptive hydration churn (non-blocking follow-up after Adaptive Media V2 phase pass).

## Profile Page
- [ ] Add targeted automated tests for saved creators critical flows (auth + media library coverage already exists).
- [ ] Add account setting: "Show Beginner Mode Toggle" (control visibility of the beginner toggle card, not just mode state).
- [ ] Add account setting: "Auto-save generated media to Media Library" toggle so users can disable automatic saves and reduce media-library bloat.
- [ ] Add CSV import/export for saved creators.

## Stripe and Payment Pipelines
- [ ] Create Stripe price IDs for updated tiers/packages and populate `billing_plans.stripe_price_id` + `billing_credit_packages.stripe_price_id` in Supabase.
- [ ] Run and sign off Subscription tab end-to-end validation (upgrade/downgrade/cancel + webhook sync + renewal credits).

## Performance Analytics
- [ ] Build out performance analytics.

## Research
- [ ] Evaluate `react-masonry-css` for media library packed grid to preserve masonry visual density while restoring left-to-right reading order. Scoped spike before implementation.
  Reference: `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`, `docs/planning/tooling-audit-2026-02-16.md` §1
- [ ] Evaluate `next/image` with a custom Supabase loader for media gallery thumbnails (WebP/AVIF, responsive srcset, lazy loading). Pairs with ADR-0009 derivative variants.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §2
- [ ] Explore live data sources or edge functions if backend capabilities are reintroduced.
- [ ] Run ML experiments for early performance prediction once real data is available.

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
- [x] Configure Stripe Billing Portal for subscription update/cancel behavior (`/profile?section=subscription` flow).
  Evidence: `frontend/pages/profile.tsx`, `frontend/pages/api/billing/stripe/portal.ts`, `frontend/tests/api/stripe-portal.test.ts`
- [x] Add targeted automated tests for auth + media library critical API flows.
  Evidence: `frontend/tests/api/auth-helper.test.ts`, `frontend/tests/api/auth-guarded-ai-kei-routes.test.ts`, `frontend/tests/api/media-sign-batch.test.ts`, `frontend/tests/api/media-move.test.ts`
- [x] AI Studio: add CI parity checks for model registry and submission payload contracts.
  Evidence: `frontend/features/ai-studio/logic/__tests__/modelApiContracts.test.ts`, `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
