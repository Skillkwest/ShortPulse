# ShortPulse Backlog

Last audited: 2026-05-11
Status: active

How to use:
- Keep this list execution-focused and current.
- Start with `docs/planning/execution-authority.md` before opening a new lane.
- Open new work only from a catalog weakness, a known issue, a failing test/live repro, or a blocker discovered inside the current lane.
- Mark completed items with `[x]` and keep evidence links inline.
- Move major outcomes into `docs/change_log.md`.
- Keep section structure locked (no urgency/priority sub-sections).

Structure (locked):
- `Program 0: Execution Authority`
- `Program 1: Runtime And Money`
- `Program 2: Media And Reference Integrity`
- `Program 3: Structural Decomposition`
- `Program 4: Workflows And Product Surfaces`
- `Program 5: Release Confidence And Research`
- `Done (verified in repo)`

## Program 0: Execution Authority
- [ ] Classify legacy planning docs into `active`, `retained evidence`, `working history`, and `archive candidate` buckets, then move the clear archive candidates out of the active planning path in bounded batches.
- [ ] Keep `docs/planning/execution-authority.md` aligned with the real active program set as lanes open, stop, or change ownership.
- [x] Define a retained validation matrix by program so closeout checks stop being chosen ad hoc from the full script corpus.
  Evidence: `docs/planning/validation-matrix-by-program-2026-05-11.md`, `docs/planning/execution-authority.md`, `docs/planning/README.md`, `docs/testing-guide.md`

## Program 1: Runtime And Money
- [x] Current-branch canonical runtime convergence: freeze one live runtime contract, classify dead rollout posture, then remove or demote stale active env/docs before touching broader runtime cleanup.
  Evidence: `docs/planning/current-branch-canonical-runtime-convergence-2026-05-07.md`, `frontend/.env.example`, `docs/deployment.md`, `docs/local-development.md`, `docs/operator-map.md`, `docs/sops/sop_provider_incident_response.md`, `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- [x] AI Studio runtime V2 closeout: publish Seedream shadow parity report.
  Evidence: `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-parity-report.md`, `frontend/package.json`, `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md`
- [ ] AI Studio runtime V2 closeout: pass Seedream canary gates for 72h with no duplicate settlement or persistence regressions.
  Reference: `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`, `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`
- [x] AI Studio runtime V2 closeout: retire legacy HMAC webhook fallback from the active runtime contract and docs.
  Evidence: `frontend/lib/server/api/falWebhook.ts`, `frontend/pages/api/fal/webhook.ts`, `frontend/tests/api/fal-webhook-signature.test.ts`, `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`, `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- [x] AI Studio: keep server-side admission control and shared-provider rate-limit protection aligned with the live V2 docs.
  Evidence: `docs/adr/0026-ai-studio-generation-admission-control.md`, `docs/planning/ai-studio-generation-admission-rollout-plan.md`, `docs/sops/sop_provider_incident_response.md`, `docs/sops/sop_generation_recovery_diagnostics.md`, `docs/monitoring.md`, `docs/operator-map.md`
- [ ] AI Studio: run staging smoke tests for aspect-ratio contract (verify submit payload and returned dimensions for Seedream `5:4`, `4:5`, `3:2`, `2:3`, `21:9`).
- [x] AI Studio: add periodic model API contract re-verification workflow (monthly or model-change trigger) and bump `verifiedAt` with source links.
  Evidence: `docs/sops/sop_model_api_contract_reverification.md`, `docs/api/README.md`, `scripts/check_model_catalog_parity.js`
- [ ] AI Studio: alter existing e2e coverage for aspect clamping + submit-time `effective_aspect` consistency after the contract overhaul.
- [ ] Create Stripe price IDs for updated tiers/packages and populate `billing_plans.stripe_price_id` + `billing_credit_packages.stripe_price_id` in Supabase.
- [ ] Run and sign off Subscription tab end-to-end validation (upgrade/downgrade/cancel + webhook sync + renewal credits).

## Program 2: Media And Reference Integrity
- [ ] P0 deferred incident: Reference Grid -> Styles internal image drop reliability remains unresolved; resume only with characterization-first payload capture and golden-path rebaseline.
  Reference: `docs/known-issues.md` (P0 AI Studio Reference Grid -> Styles drop reliability remains broken, deferred March 13, 2026)
- [ ] Media Library: make tooltip/url treatments resilient for long links (truncate/ellipsis where needed).
- [ ] Media Library: redesign the header bar and refresh small info cards to pull real account-level details.
- [ ] Media Library: fully optimize image loading and experiment with tooling options for masonry-style display.
- [ ] Media Library: improve pagination behavior and controls across media tabs as part of optimization.
- [ ] Media Library: increase spacing in uploaded-images card header rows to fix cramped title/button layout.
- [ ] Media Library: restyle text prompt cards in the `Saved Prompts` tab.
- [ ] AI Studio: update reference grid styling and adjust `Add files` / `Media library` button colors.
- [ ] AI Studio: change placeholder `generating` and `loading preview` reference cards to a lighter gray background for better visual contrast.
- [ ] AI Studio: increase normal-state color saturation for the reference-grid `Add files` and `Media library` buttons (current state appears too gray/desaturated).
- [ ] AI Studio: remove the blue gradient overlay from the quick-slot inventory background.
- [ ] AI Studio: fix expanded media modal labels so images imported from Media Library are consistently labeled as images (never videos).
- [ ] AI Studio: correct local computer import media typing so uploaded images render and behave as images throughout the expanded media modal.
- [ ] AI Studio: investigate and polish rare one-off full-grid flash in Reference Grid/Quick Slot under adaptive hydration churn (non-blocking follow-up after Adaptive Media V2 phase pass).

## Program 3: Structural Decomposition
- [ ] Split oversized AI Studio orchestration surfaces after the current runtime and media contracts stabilize, starting with `frontend/pages/ai-studio.tsx` and `frontend/features/ai-studio/components/AiStudioPageContent.tsx`.
- [ ] Split oversized AI Studio properties-panel surfaces after behavior locks hold, starting with `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx` and `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`.
- [ ] Split oversized shared runtime modules behind smaller ownership seams after convergence behavior stabilizes, starting with `frontend/lib/server/falIntegration/recoveryExecution.ts` and `frontend/lib/server/api/falStatusProxy.ts`.
- [ ] Define a prefab management system to keep reusable prefabs organized, easy to find, and consistently maintained over time.

## Program 4: Workflows And Product Surfaces
- [ ] Build a complete, polished collection of small delete buttons.
- [ ] Build a complete, polished collection of small download buttons.
- [ ] Build a complete, polished collection of small save buttons.
- [ ] Replace hard-coded usage counters with live client state (searches/storage/credits).
- [ ] Redesign the Dashboard with a polished UI pass and thoroughly organize its styling structure for long-term maintainability.
- [ ] Align Character Manager styling with the AI Studio character workflow so the manager page and properties panel feel cohesive.
- [ ] Redesign Character Manager with a more polished UI, modeled after the AI Studio character workflow experience.
- [ ] AI Studio: trim the aspect-ratio dropdown by removing extraneous ratio options and keeping only supported defaults.
- [ ] AI Studio: test header title color updates and add a sparkle icon next to the `AI Studio` title.
- [ ] AI Studio: preload character workflow identities and saved references when entering from Dashboard so character assets are cached across workflow switches.
- [ ] AI Studio: make `CharacterManager` open instantly (no open animation) and tune properties panel sizing.
- [ ] AI Studio: add a `Canvas` button that opens a free-form canvas for dragging/dropping images and text prompts to visually organize ideas.
- [ ] Add CSV import/export for saved creators.
- [ ] Build out performance analytics.

## Program 5: Release Confidence And Research
- [ ] Add targeted automated tests for saved creators critical flows (auth + media library coverage already exists).
- [ ] Evaluate `react-masonry-css` for media library packed grid to preserve masonry visual density while restoring left-to-right reading order. Scoped spike before implementation.
  Reference: `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`, `docs/planning/tooling-audit-2026-02-16.md` §1
- [ ] Evaluate `next/image` with a custom Supabase loader for media gallery thumbnails (WebP/AVIF, responsive srcset, lazy loading). Pairs with ADR-0009 derivative variants.
  Reference: `docs/planning/tooling-audit-2026-02-16.md` §2
- [ ] Explore live data sources or edge functions if backend capabilities are reintroduced.
- [ ] Run ML experiments for early performance prediction once real data is available.

## Done (verified in repo)
- [x] AI Studio model-platform cleanup: complete the `ModelModal` shared-metadata phase and stop at the explicit product-policy boundary.
  Evidence: `docs/planning/model-modal-policy-phase-plan-2026-05-10.md`, `frontend/features/ai-studio/components/ModelModal.tsx`, `frontend/features/ai-studio/logic/modelModalPresentation.ts`, `frontend/features/ai-studio/components/__tests__/ModelModal.test.tsx`, `frontend/features/ai-studio/logic/__tests__/modelModalPresentation.test.ts`, `scripts/model_doctor.js`
- [x] AI Studio model-platform cleanup: complete the Fal route-surface reduction phase and keep generated `/api/fal/*` wrappers as the intended ownership model for the current system phase.
  Evidence: `docs/planning/fal-route-surface-reduction-phase-plan-2026-05-11.md`, `scripts/lib/fal_route_inventory.js`, `scripts/sync_fal_route_wrappers.js`, `frontend/tests/api/fal-route-inventory-regression.test.ts`, `frontend/tests/api/model-catalog-route-coverage.test.ts`, `docs/sops/sop_new_model_ingestion.md`, `README.md`
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
- [x] AI Studio: persist the selected character in the `Character Properties` panel across mode switches, and default back to that selected profile instead of the base default profile.
  Evidence: `frontend/features/character-manager/logic/selectedCharacterPersistence.ts`, `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`, `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`, `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- [x] Add account setting: "Auto-save generated media to Media Library" toggle so users can disable automatic saves and reduce media-library bloat.
  Evidence: `frontend/features/profile/components/ProfilePreferenceToggleCard.tsx`, `frontend/pages/profile.tsx`, `frontend/tests/pages/profile.account-settings.test.tsx`
