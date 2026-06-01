# ShortPulse Backlog

Last audited: 2026-05-30
Status: active

How to use:

- Keep this list execution-focused and current.
- Start with `docs/planning/execution-authority.md` before opening a new lane.
- Open new work only from a catalog weakness, a known issue, a failing test/live repro, or a blocker discovered inside the current lane.
- For launch-readiness sequencing, keep this backlog aligned with the current Copperknot queue and systems catalog rather than treating it as an isolated planning surface.
- If a newer source of truth contradicts this file, update this backlog before using the stale item to justify work.
- In this file, "below launch-readiness target" means the current readiness docs still treat that workflow or system as not yet ready to ship with confidence.
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

- [x] Define a retained validation matrix by program so closeout checks stop being chosen ad hoc from the full script corpus.
      Evidence: `docs/planning/validation-matrix-by-program-2026-05-11.md`, `docs/planning/execution-authority.md`, `docs/planning/README.md`, `docs/testing-guide.md`

## Program 1: Runtime And Money

- [x] Current-branch canonical runtime convergence: freeze one live runtime contract, classify dead rollout posture, then remove or demote stale active env/docs before touching broader runtime cleanup.
      Evidence: `docs/planning/current-branch-canonical-runtime-convergence-2026-05-07.md`, `frontend/.env.example`, `docs/deployment.md`, `docs/local-development.md`, `docs/operator-map.md`, `docs/sops/sop_provider_incident_response.md`, `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- [x] AI Studio runtime V2 closeout: publish Seedream shadow parity report.
      Evidence: `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-parity-report.md`, `frontend/package.json`, `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md`
- [ ] Generation recovery / settlement: recheck the current recovery and settlement path against the live runtime evidence before treating it as permanently closed.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/ship-readiness-scoreboard.md`
- [x] AI Studio runtime V2 closeout: retire legacy HMAC webhook fallback from the active runtime contract and docs.
      Evidence: `frontend/lib/server/api/falWebhook.ts`, `frontend/pages/api/fal/webhook.ts`, `frontend/tests/api/fal-webhook-signature.test.ts`, `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`, `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- [x] AI Studio: keep server-side admission control and shared-provider rate-limit protection aligned with the live V2 docs.
      Evidence: `docs/adr/0026-ai-studio-generation-admission-control.md`, `docs/planning/ai-studio-generation-admission-rollout-plan.md`, `docs/sops/sop_provider_incident_response.md`, `docs/sops/sop_generation_recovery_diagnostics.md`, `docs/monitoring.md`, `docs/operator-map.md`
- [ ] AI Studio project/workspace persistence: tighten restore boundaries and rerun confidence on the persistence workflow, which is still below launch-readiness target.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/catalog.md`
- [x] AI Studio: add periodic model API contract re-verification workflow (monthly or model-change trigger) and bump `verifiedAt` with source links.
      Evidence: `docs/sops/sop_model_api_contract_reverification.md`, `docs/api/README.md`, `scripts/check_model_catalog_parity.js`
- [ ] AI Studio: add dedicated e2e coverage for aspect clamping + submit-time `effective_aspect` consistency beyond the current unit/payload contract matrix.
- [ ] Media ingest / save: audit upload, finalize, and save ownership and close the current release-path persistence gap that is still below launch-readiness target.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/ship-readiness-scoreboard.md`
- [ ] Core data persistence: audit schema and persistence risk on release-critical paths, then define the next focused hardening pass.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/ship-readiness-scoreboard.md`
- [ ] Storage / file delivery: audit signed delivery and original-vs-variant scope, then close the current file-delivery gap that is still below launch-readiness target.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/ship-readiness-scoreboard.md`
- [ ] Provider integrations: rerun shared provider contract normalization and hardening for the provider work that is still below launch-readiness target.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/ship-readiness-scoreboard.md`
- [ ] Add the missing authored billed-credit pricing-grid row for GPT Image 2 Create Character Mode with 3 input refs, and keep runtime fail-closed until that canonical row exists.
- [ ] Create Stripe price IDs for updated tiers/packages and populate `billing_plans.stripe_price_id` + `billing_credit_packages.stripe_price_id` in Supabase.
- [ ] Run and sign off Subscription tab end-to-end validation (upgrade/downgrade/cancel + webhook sync + renewal credits).

## Program 2: Media And Reference Integrity

- [ ] Media Library: finish the remaining long-link tooltip/url resilience gaps beyond the current truncation/ellipsis coverage.
- [ ] Media Library: redesign the header bar and refresh small info cards to pull real account-level details.
- [ ] Media Library: continue transform-free image-loading optimization and improve derivative/preview coverage on dense grid surfaces.
- [ ] Media Library: resolve the remaining pagination/search trust gaps across media tabs, especially no-match image-search copy that currently reads like total data loss.
- [ ] AI Studio: change placeholder `generating` and `loading preview` reference cards to a lighter gray background for better visual contrast.

## Program 3: Structural Decomposition

- [ ] Split oversized AI Studio orchestration surfaces once the current runtime and media behavior is stable, focusing on `frontend/features/ai-studio/routes/AiStudioRouteApp.tsx` and `frontend/features/ai-studio/components/AiStudioPageContent.tsx` now that `frontend/pages/ai-studio.tsx` is only a thin dynamic entry.
- [ ] Split oversized AI Studio properties-panel surfaces once behavior is stable, starting with `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx` and `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`.
- [ ] Split oversized shared runtime modules into smaller ownership seams once convergence behavior is stable, starting with `frontend/lib/server/falIntegration/recoveryExecution.ts` and `frontend/lib/server/api/falStatusProxy.ts`.
- [ ] Revisit typography foundation cleanup after the low-risk Google Fonts import removal: decide whether system fonts should become the canonical primary stack, then normalize remaining hard-coded `Inter` / `Satoshi` references and refresh the related design inventory docs.
      Reference: `frontend/styles/foundation.css`, `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`, `frontend/features/elements-manager/components/ElementsDescriptionEditorCard.tsx`, `docs/design/ai-studio-style-inventory.md`

## Program 4: Workflows And Product Surfaces

- [ ] Elements workflow: resolve approved-panel and runtime-health issues, then rerun confidence on the workflow, which is still below launch-readiness target.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/catalog.md`
- [ ] Characters workflow: reassess continuity and persistence trust, then rerun the workflow after progress on Elements and project/workspace persistence.
      Reference: `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`, `docs/systems/catalog.md`
- [ ] Build a complete, polished collection of small delete buttons.
- [ ] Build a complete, polished collection of small save buttons.
- [ ] Finish the Dashboard redesign pass by retiring the remaining staged/legacy posture and tightening the long-term styling structure.
- [ ] Align Character Manager styling with the AI Studio character workflow so the manager page and properties panel feel cohesive.
- [ ] Redesign Character Manager with a more polished UI, modeled after the AI Studio character workflow experience.

## Program 5: Release Confidence And Research

## Done (verified in repo)

- [x] Classify legacy planning docs into `active`, `retained evidence`, `working history`, and `archive candidate` buckets, then move the clear archive candidates out of the active planning path in bounded batches.
      Evidence: `docs/planning/README.md`, `docs/planning/execution-authority.md`, `docs/archive/planning/README.md`
- [x] Auth boundary: retire `SHORTPULSE_ADMIN_EMAILS` as admin authority and require explicit Supabase `app_metadata` admin/operator roles for privileged API access.
      Evidence: `frontend/lib/server/api/auth.ts`, `frontend/pages/api/admin/access.ts`, `frontend/tests/api/auth-helper.test.ts`, `frontend/tests/api/admin-access.test.ts`, `docs/supabase_auth_setup.md`, `docs/security-checklist.md`

- [x] AI Studio model-platform cleanup: complete the `ModelModal` shared-metadata phase and stop at the explicit product-policy boundary.
      Evidence: `docs/archive/planning/model-modal-policy-phase-plan-2026-05-10.md`, `frontend/features/ai-studio/components/ModelModal.tsx`, `frontend/features/ai-studio/logic/modelModalPresentation.ts`, `frontend/features/ai-studio/components/__tests__/ModelModal.test.tsx`, `frontend/features/ai-studio/logic/__tests__/modelModalPresentation.test.ts`, `scripts/model_doctor.js`
- [x] AI Studio model-platform cleanup: complete the Fal route-surface reduction phase and keep generated `/api/fal/*` wrappers as the intended ownership model for the current system phase.
      Evidence: `docs/archive/planning/fal-route-surface-reduction-phase-plan-2026-05-11.md`, `scripts/lib/fal_route_inventory.js`, `scripts/sync_fal_route_wrappers.js`, `frontend/tests/api/fal-route-inventory-regression.test.ts`, `frontend/tests/api/model-catalog-route-coverage.test.ts`, `docs/sops/sop_new_model_ingestion.md`, `README.md`
- [x] Add platform filter tabs (IG/TikTok/YT) on Performance.
      Evidence: `frontend/features/performance/components/FilterBars.tsx`
- [x] Integrate Media Library UI polish (error banners, retry behavior, empty states).
      Evidence: `historical implementation`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- [x] Improve Media Library preview modal sizing/fit for mixed media.
      Evidence: `historical implementation`, `frontend/styles/workspace-media.css`
- [x] Add client-side logging/error surfacing for Supabase-heavy flows.
      Evidence: `historical implementation`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/lib/appErrorReporter.ts`
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
- [x] AI Studio: resolve the historical Reference Grid -> Styles internal image-drop blocker and rerate the lane with fresh runtime evidence.
      Evidence: `docs/known-issues.md`, `docs/systems/catalog.md`, `frontend/tests/e2e/ai-studio-style-drop.audit.js`
- [x] AI Studio: treat Media Library imports and local uploaded image blobs as images throughout the expanded media modal, never videos.
      Evidence: `frontend/features/ai-studio/components/__tests__/DetailModal.test.tsx`
- [x] AI Studio: trim the global aspect-ratio dropdown to supported defaults and lock deprecated ratio removal in contract coverage.
      Evidence: `frontend/features/ai-studio/constants.ts`, `frontend/features/ai-studio/logic/__tests__/modelApiContracts.test.ts`
- [x] AI Studio: expose the shared right-rail `Canvas` toggle in the live header.
      Evidence: `frontend/features/ai-studio/components/AiStudioPageContent.tsx`, `README.md`, `docs/routes.md`
- [x] AI Studio: persist the selected character in the `Character Properties` panel across mode switches, and default back to that selected profile instead of the base default profile.
      Evidence: `frontend/features/character-manager/logic/selectedCharacterPersistence.ts`, `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`, `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`, `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- [x] Add account setting: "Auto-save generated media to Media Library" toggle so users can disable automatic saves and reduce media-library bloat.
      Evidence: `frontend/features/profile/components/ProfilePreferenceToggleCard.tsx`, `frontend/pages/profile.tsx`, `frontend/tests/pages/profile.account-settings.test.tsx`
