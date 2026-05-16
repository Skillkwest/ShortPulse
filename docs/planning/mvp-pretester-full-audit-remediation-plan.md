---
title: MVP Pre-Tester Full Audit Remediation Plan
status: Active
owner: Product + Engineering
created: 2026-02-14
last_updated: 2026-02-14
---

# MVP Pre-Tester Full Audit Remediation Plan

Purpose: convert the full product audit into an execution runbook that can be tracked to completion before external tester rollout.

## Baseline Snapshot (2026-02-14)
- `cd frontend && npm run type-check`: pass.
- `cd frontend && npm run test`: pass (`39` files, `159` tests).
- `cd frontend && npm run build`: pass.
- `cd frontend && npm run docs:check`: pass.
- `cd frontend && npm run validate`: fail because ESLint scans generated Playwright artifacts and reports thousands of errors.
- `cd frontend && npm audit --audit-level=moderate`: not runnable in current network-restricted environment.

## Baseline Findings Register (2026-02-14)
Source: full-app audit run completed on 2026-02-14.

Critical:
- Reservation RPCs are `SECURITY DEFINER` and trust caller-supplied `p_user_id` without explicit auth binding.
  Evidence paths: `sql/migrations/002_add_generation_credit_reservations.sql`, `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`
  Risk: cross-user reserve/release/capture attempts if execute grants are too broad.

High:
- Internal helper modules are publicly emitted as API routes under `/api/_utils/*`.
  Evidence paths: `frontend/lib/server/api/auth.ts`, `frontend/lib/server/api/stripe.ts`, `frontend/lib/server/api/generationBilling.ts`
  Risk: unnecessary public attack surface and accidental behavior exposure.
- Stripe checkout/portal URLs are derived from request origin/host headers.
  Evidence paths: `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/portal.ts`
  Risk: host-header/origin injection in redirect URLs.

Medium:
- Stripe webhook signature verification lacks explicit timestamp tolerance rejection.
  Evidence path: `frontend/lib/server/api/stripe.ts`
  Risk: replay window broader than necessary.
- Upload validation trusts MIME/header metadata only.
  Evidence paths: `frontend/pages/api/upload-image.ts`, `frontend/pages/api/upload-video.ts`
  Risk: disguised file content bypassing type checks.
- `validate` gate is unreliable because ESLint scans generated Playwright artifacts.
  Evidence paths: `frontend/eslint.config.mjs`, `.github/workflows/ci.yml`
- Duplicate auth verification between middleware and route handlers adds avoidable latency.
  Evidence paths: `frontend/proxy.ts`, `frontend/lib/server/api/auth.ts`
- API coverage gaps for Stripe, upload handlers, and admin routes.
  Evidence path: `frontend/tests/api/`
- Modularization debt in oversized/high-churn files.
  Evidence paths: `legacy standalone Media Library page`, `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`, `frontend/lib/server/api/generationBilling.ts`, `frontend/lib/falClient.ts`

Documentation/SOP drift:
- Architecture/local development docs still describe the app as client-only.
  Evidence paths: `docs/architecture-overview.md`, `docs/local-development.md`
- Frontend architecture doc describes AI Studio page as thin orchestrator despite current size/complexity.
  Evidence path: `docs/frontend-architecture.md`
- Missing internal API docs coverage for `/api/media/resolve-previews`.
  Evidence paths: `frontend/pages/api/media/resolve-previews.ts`, `docs/api/api-internal-routes.md`
- Billing RLS audit script expectations drift from schema policy reality for `stripe_event_log`.
  Evidence paths: `sql/audit_billing_credit_rls.sql`, `sql/create_billing_credit_tables.sql`
- Legacy Character SOPs remain in active index and can cause confusion.
  Evidence paths: `docs/archive/sops/sop_character_generation.md`, `docs/archive/sops/sop_character_identity.md`, `docs/sops/README.md`

## Scope Lock For This Plan
In scope:
- Security hardening for billing, auth boundaries, API surface, and upload validation.
- Reliability gates (lint/CI/test coverage) needed for stable MVP release quality.
- Modularity and maintainability improvements for oversized files and repeated provider code.
- Documentation/SOP alignment, de-duplication, and archival hygiene.

Out of scope:
- New product features and UI redesign beyond what is required for reliability and maintainability.
- Net-new Stripe/subscription pipeline changes while the temporary pause is active.

## Temporary Pause Note (2026-02-14)
- Stripe/subscription pipeline work is paused until explicitly resumed.
- Do not start new Stripe checkout/portal/webhook/subscription tasks in this plan during the pause window.
- Stripe/subscription findings and completed evidence remain documented here for history; remaining Stripe/subscription items move to deferred backlog status.

Resume criteria (must all be true before pause lift):
- Product + Engineering explicitly record pause-lift approval in `docs/change_log.md` and this plan.
- Deferred Phase 5 task for `stripe_event_log` RLS audit reconciliation is re-scoped with owner + verification commands.
- Stripe-focused API regression suite is green (`stripe-checkout`, `stripe-portal`, `stripe-webhook`) in CI before merge.
- Canonical Stripe app URL + webhook timestamp tolerance controls remain unchanged and documented.

## Release Gate
All `P0` items must be complete before external tester access.

## Missing-Anything Audit (2026-02-14)
- Active-scope unchecked items: `0`.
- Remaining unchecked checklist item count: `1` (Stripe/subscription billing RLS reconciliation), currently paused by scope policy.
- Active-scope release blockers: none identified in this audit pass.
- Verification state: `validate`, `build`, and `docs:check` currently passing after Phase 4 closeout.
- Next-step hardening completed: fast CI auth-regression lane added for auth-boundary/status-ownership tests.
- Pause-governance completed: explicit Stripe/subscription resume criteria now documented in this plan.
- Protected-route runtime sampling completed with real authenticated traffic (`/api/billing/credit-packages`), and evidence is documented in monitoring notes.
- Staging-host p50/p95 capture remains pending due missing/unresolved staging app base URL in current workspace context.
- Staging-capture blocker reduced: probe now supports Supabase token bootstrap (short-lived user create/sign-in/delete), so only staging host URL resolution remains.
- Token-bootstrap path validated end-to-end on local runtime sample (`token_source=supabase_bootstrap` plus confirmed cleanup log).
- Operator handoff path validated: `frontend` npm shortcut `latency:protected-route` executes bootstrap flow + cleanup successfully.

## Current Sprint Focus (2026-02-14, refreshed after Phase 4 closeout)
Goal: keep release gates stable while active-scope remediation phases remain complete.

1. `P1` Preserve consolidated auth-boundary behavior and monitor for regressions.
   Definition of done: protected-route middleware context remains the primary auth path and fast + full CI tests keep duplicate-lookup regressions blocked.
   Evidence paths: `frontend/proxy.ts`, `frontend/lib/server/api/auth.ts`, `frontend/tests/api/auth-latency-benchmark.test.ts`, `.github/workflows/ci.yml`
2. `P1` Keep ownership-safety assertions in status polling routes.
   Definition of done: provider status routes continue rejecting non-owned request IDs under middleware-authenticated context.
   Evidence paths: `frontend/pages/api/kei/task-status.ts`, `frontend/pages/api/fal/status.ts`, `frontend/lib/server/api/falStatusProxy.ts`, `frontend/tests/api/kei-task-status.auth-context.test.ts`, `frontend/tests/api/kei-task-status.ownership.test.ts`, `frontend/tests/api/fal-status.auth-context.test.ts`, `frontend/tests/api/fal-status.ownership.test.ts`

Recent completion carried forward:
- `P0` staging migration `014_harden_generation_reservation_rpc_security.sql` completed and verified on 2026-02-14.
- Phase 3 modularization targets completed on 2026-02-14 (`media-library.tsx`, `ai-studio.tsx`, `generationBilling.ts`, `falClient.ts`).
- Phase 4 performance/API-efficiency targets completed on 2026-02-14 (auth-boundary consolidation + latency benchmark + ownership-safety verification).

Validation commands for this sprint:
- `cd frontend && npm run type-check`
- `cd frontend && npm run test`
- `cd frontend && npm run validate`
- `cd frontend && npm run build`
- `cd frontend && npm run docs:check`

## High-Level Recommendations (Non-Blocking)
1. [x] Keep auth-boundary regression tests (`auth-helper`, `proxy-internal-utils`, KEI/Fal auth-context ownership, auth latency benchmark) in fast CI paths so duplicate-lookup/security regressions fail early.
   Evidence path: `.github/workflows/ci.yml`
2. [ ] Capture one real staging p50/p95 sample for protected routes to complement synthetic benchmark evidence before external tester rollout.
   Current status: completed credentialed runtime sample against local running app; probe now supports automatic token bootstrap; pending direct staging-host run once a resolvable staging base URL is provided.
   Ready-to-run command: `cd frontend && SHORTPULSE_STAGING_BASE_URL=<staging-host> npm run latency:protected-route -- --path /api/billing/credit-packages --samples 30 --warmup 5 --bootstrap-token-from-supabase`
   Evidence paths: `scripts/capture_protected_route_latency.mjs`, `docs/monitoring.md`
3. [x] Define explicit resume criteria for the paused Stripe/subscription backlog item to avoid ambiguity when pause is lifted.
   Evidence path: `docs/planning/mvp-pretester-full-audit-remediation-plan.md`

### AI Studio First Split Boundary (Selected)
Selected seam:
- Agent composer and attachment lifecycle controller currently embedded in `frontend/pages/ai-studio.tsx` (send/refine/enhance/describe + drag-drop attachment handlers + busy/error state plumbing).

Why this seam first:
- It is high-churn and internally cohesive.
- It has a clear interface boundary (`agentInput`, `agentAttachments`, send/enhance/describe handlers, attachment DnD handlers, busy/error flags).
- It can be extracted without changing generation core APIs in `useAiStudioState`.

Execution status:
- Completed: extracted to `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts` with page integration.
- Completed: added focused hook tests for attachment normalization/limits and composer state transitions.
- Completed: extracted agent send/refine/enhance/describe orchestration to `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts` with page integration.
- Completed: extracted agent apply/select/use-question + message/chat interaction handlers to `frontend/features/ai-studio/hooks/useAiStudioAgentInteractions.ts` with page integration.
- Completed: extracted generation submit/click-lock/regenerate orchestration to `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` with page integration.
- Completed: extracted character-mode bundle refresh/submission override/fallback telemetry orchestration to `frontend/features/ai-studio/hooks/useAiStudioCharacterModeController.ts` with page integration.
- Completed: extracted character-mode list/bundle loading effects and model-enforcement toggling to `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts` with page integration.
- Completed: extracted reference asset actions (download/save/generate-from-reference) to `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts` with page integration.
- Completed: extracted optimistic debit/failure reconciliation effects and handlers to `frontend/features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation.ts` with page integration.
- Completed: extracted workspace UI action handlers and prompt-reference generate policy to `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts` with page integration and focused tests.
- Completed: extracted page-level derived config (template view/model filtering/prompt routing/pricing params) to `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`; `frontend/pages/ai-studio.tsx` reduced to `797` lines.
- Completed: extracted `useAiStudioState` output lifecycle/stale cleanup/failure normalization into `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` with focused hook tests.
- Completed: extracted `useAiStudioState` workflow settings hydrate/restore/persist logic into `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts` with focused hook tests.
- Completed: extracted `useAiStudioState` reference input state + modal/selection orchestration into `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts` with focused hook tests; `frontend/features/ai-studio/hooks/useAiStudioState.ts` reduced to `954` lines.
- Completed: extracted `useAiStudioState` generation prompt/reference input composition for submit/regenerate paths into `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts` with focused hook tests; `frontend/features/ai-studio/hooks/useAiStudioState.ts` reduced to `835` lines.
- Completed: extracted `useAiStudioState` task polling/submission orchestration into `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts` with focused hook tests; `frontend/features/ai-studio/hooks/useAiStudioState.ts` reduced to `643` lines.
- Completed: extracted text/image/video properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` with focused hook tests; `frontend/pages/ai-studio.tsx` reduced to `747` lines.
- Completed: extracted character properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts` with focused hook tests; `frontend/pages/ai-studio.tsx` reduced to `745` lines.
- Completed: extracted reference-canvas prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts` with focused hook tests.
- Completed: extracted studio-preview prop composition and detail-modal action wiring from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts` with focused hook tests.

Next pass target:
- Hold completed Phase 3/Phase 4 scope stable while paused Stripe/subscription backlog remains deferred.
- Maintain auth-boundary and status-ownership regression coverage as route/provider integrations evolve.

Evidence paths:
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentInteractions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCharacterModeController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioOptimisticDebitReconciliation.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceSelectionState.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterPanelProps.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPreviewDetailProps.test.ts`

## Workstreams

### Phase 1 (P0): Security Blockers
Goal: close all high-risk security gaps before tester traffic.

Checklist:
- [x] Harden reservation RPCs to bind caller identity (`auth.uid()`) to `p_user_id` and fail closed on mismatch.
  Evidence paths: `sql/migrations/002_add_generation_credit_reservations.sql`, `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`, `sql/migrations/014_harden_generation_reservation_rpc_security.sql`
- [x] Explicitly lock execute grants for reservation/capture/release RPCs (revoke broad grants, grant intended roles only).
  Evidence paths: `sql/migrations/002_add_generation_credit_reservations.sql`, `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`, `sql/migrations/014_harden_generation_reservation_rpc_security.sql`
- [x] Remove public routability of internal API helpers by moving `frontend/pages/api/_utils/*` into non-route server modules.
  Evidence paths: `frontend/lib/server/api/`, `frontend/proxy.ts`
- [x] Replace request-derived Stripe redirect origin handling with allowlisted canonical app URL env var.
  Evidence paths: `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/portal.ts`, `frontend/lib/server/api/stripe.ts`
- [x] Add Stripe webhook timestamp tolerance checks in addition to event-id idempotency.
  Evidence path: `frontend/lib/server/api/stripe.ts`
- [x] Add server-side magic-byte content validation for image/video uploads.
  Evidence paths: `frontend/lib/server/uploadSignature.ts`, `frontend/pages/api/upload-image.ts`, `frontend/pages/api/upload-video.ts`
- [x] Apply and verify migration `014_harden_generation_reservation_rpc_security.sql` in staging.
  Evidence paths: `sql/migrations/014_harden_generation_reservation_rpc_security.sql`, `docs/change_log.md`

Exit criteria:
- No critical/high unresolved security findings remain.
- SQL privilege posture and auth checks are documented and verified in staging.

### Phase 2 (P0): Reliability Gates
Goal: make quality gates deterministic and enforceable for release.

Checklist:
- [x] Exclude generated Playwright artifacts from ESLint scope (`playwright-report`, `test-results`) and verify lint only targets source.
  Evidence path: `frontend/eslint.config.mjs`
- [x] Restore strict CI lint enforcement (remove temporary soft-fail behavior).
  Evidence path: `.github/workflows/ci.yml`
- [x] Re-run `npm run validate` and capture passing output in release notes.
  Evidence: `2026-02-14` run passed (`lint`, `type-check`, `test`).
- [x] Add API tests for currently uncovered critical handlers: Stripe (checkout/portal/webhook), uploads (image/video), and admin routes (users/errors/errors-status/credits-adjust).
  Evidence paths: `frontend/tests/api/stripe-checkout.test.ts`, `frontend/tests/api/stripe-portal.test.ts`, `frontend/tests/api/stripe-webhook.test.ts`, `frontend/tests/api/upload-image-route.test.ts`, `frontend/tests/api/upload-video-route.test.ts`, `frontend/tests/api/admin-users.test.ts`, `frontend/tests/api/admin-errors.test.ts`, `frontend/tests/api/admin-errors-status.test.ts`, `frontend/tests/api/admin-credits-adjust.test.ts`

Exit criteria:
- `validate`, `build`, and core API test suite pass in CI.
- Lint failures block merges again.

### Phase 3 (P1): Modularization And Maintainability
Goal: reduce change risk and improve developer velocity by splitting oversized files.

Checklist:
- [x] Extract shared media tab/cache/search/signing helpers from `legacy standalone Media Library page` into a feature logic module.
  Evidence paths: `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts`, `frontend/features/media-library/logic/__tests__/mediaLibraryPageHelpers.test.ts`
- [x] Extract focused-file modal move-option derivation into shared move routing logic.
  Evidence paths: `frontend/features/media-library/logic/mediaMoveRouting.ts`, `frontend/features/media-library/logic/__tests__/mediaMoveRouting.test.ts`, `legacy standalone Media Library page`
- [x] Extract media-tab cache reconciliation for moved rows into shared Media Library logic.
  Evidence paths: `frontend/features/media-library/logic/mediaMoveCache.ts`, `frontend/features/media-library/logic/__tests__/mediaMoveCache.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library modal image zoom/pan controller into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaModalImageZoom.ts`, `frontend/features/media-library/hooks/__tests__/useMediaModalImageZoom.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library file-modal CRUD handlers (open/close, rename, single-delete) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaFileModalCrud.ts`, `frontend/features/media-library/hooks/__tests__/useMediaFileModalCrud.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library bulk-selection move orchestration (eligible-row derivation, destination options, move-batch/cache reconciliation, and feedback) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaBulkMoveController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaBulkMoveController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library preview signing/hydration pass orchestration (batch prioritization, resolver fallback, perf telemetry) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library tab fetch/cache orchestration (prompt loading, media-page fetch, stale-cache policy, and load-more observer wiring) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaTabDataController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaTabDataController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library upload pipeline controllers (drag/drop intake, optimistic placeholders, upload/insert/sign reconciliation) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaUploadController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library prompt-modal CRUD handlers (open/close, edit-save, prompt delete, and prompt-modal error routing) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaPromptModalCrud.ts`, `frontend/features/media-library/hooks/__tests__/useMediaPromptModalCrud.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library bulk-delete orchestration (selected-row confirmation flow, prompt/media delete routing, storage cleanup, and cache reconciliation) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaBulkDeleteController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaBulkDeleteController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library single-file modal move orchestration (move request, signed-preview refresh, cache reconciliation, and move-menu/error UI state) into a dedicated hook.
  Evidence paths: `frontend/features/media-library/hooks/useMediaSingleMoveController.ts`, `frontend/features/media-library/hooks/__tests__/useMediaSingleMoveController.test.ts`, `legacy standalone Media Library page`
- [x] Extract Media Library modal render blocks (focused-file preview/edit modal and saved-prompt edit modal) into dedicated feature components.
  Evidence paths: `frontend/features/media-library/components/MediaFileModal.tsx`, `frontend/features/media-library/components/MediaPromptModal.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library delete-confirm render blocks (single-file delete and bulk-selected delete dialogs) into a shared feature component.
  Evidence paths: `frontend/features/media-library/components/MediaDeleteConfirmModal.tsx`, `frontend/features/media-library/components/__tests__/MediaDeleteConfirmModal.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library prompt/media gallery render blocks (prompt card grid, media card grid, and load-more control) into dedicated feature components.
  Evidence paths: `frontend/features/media-library/components/MediaPromptGrid.tsx`, `frontend/features/media-library/components/MediaAssetGallery.tsx`, `frontend/features/media-library/components/__tests__/MediaPromptGrid.test.tsx`, `frontend/features/media-library/components/__tests__/MediaAssetGallery.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library gallery actions block (section heading, selection controls, bulk-move menu, and bulk-move feedback notices) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaGalleryActions.tsx`, `frontend/features/media-library/components/__tests__/MediaGalleryActions.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library filter/search tab-strip block (tab toggles, visible-count chip, and search input behavior) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaFiltersPanel.tsx`, `frontend/features/media-library/components/__tests__/MediaFiltersPanel.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library upload-stage block (drag/drop intake surface, file picker, selected-file summary, and storage usage card) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaUploadStage.tsx`, `frontend/features/media-library/components/__tests__/MediaUploadStage.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library page header hero block (title/description plus storage + plan status cards) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaLibraryHeader.tsx`, `frontend/features/media-library/components/__tests__/MediaLibraryHeader.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library gallery section shell (action toolbar wiring, loading/empty state messaging, and prompt/media grid branch composition) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaGallerySection.tsx`, `frontend/features/media-library/components/__tests__/MediaGallerySection.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library modal stack (single-file delete confirm, bulk-delete confirm, focused-file modal, and focused-prompt modal composition) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaLibraryModalStack.tsx`, `frontend/features/media-library/components/__tests__/MediaLibraryModalStack.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library filters-row shell (dashboard nav prefab card + filter/search panel composition) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaFiltersRow.tsx`, `frontend/features/media-library/components/__tests__/MediaFiltersRow.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library workspace content composition (header/upload/filters/gallery section ordering and prop-group wiring) into a dedicated feature component.
  Evidence paths: `frontend/features/media-library/components/MediaLibraryWorkspaceContent.tsx`, `frontend/features/media-library/components/__tests__/MediaLibraryWorkspaceContent.test.tsx`, `legacy standalone Media Library page`
- [x] Extract Media Library data-side-effect helpers (media event logging, delete-path collection, and storage-path removal batching) into a dedicated logic module.
  Evidence paths: `frontend/features/media-library/logic/mediaLibraryDataEffects.ts`, `frontend/features/media-library/logic/__tests__/mediaLibraryDataEffects.test.ts`, `legacy standalone Media Library page`
- [x] Extract `ai-studio` agent composer/attachment lifecycle state and drag-drop handlers into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` agent send/refine/enhance/describe orchestration into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` agent interaction handlers (apply/select/use-question/message/chat controls) into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioAgentInteractions.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentInteractions.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` generation submit/click-lock/regenerate orchestration into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` character-mode bundle refresh/submission override/fallback telemetry orchestration into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioCharacterModeController.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeController.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` character-mode list/bundle loading effects and model-enforcement toggling into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` reference asset actions (download/save/generate-from-reference) into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` optimistic debit/failure reconciliation effects and handlers into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioOptimisticDebitReconciliation.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract remaining `ai-studio` workspace UI action handlers (tool/file selection, model modal wiring, prompt setter routing) and prompt-reference generate policy into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` page-level derived config (template view detection, model option filtering, prompt routing, pricing param shaping) into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `useAiStudioState` output lifecycle/stale cleanup/failure normalization into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- [x] Extract `useAiStudioState` workflow settings hydrate/restore/persist logic into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- [x] Extract `useAiStudioState` reference input state + modal/selection orchestration into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceSelectionState.test.ts`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- [x] Extract `useAiStudioState` generation prompt/reference input composition into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- [x] Extract `useAiStudioState` task polling/submission orchestration into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- [x] Extract `ai-studio` text/image/video properties-panel prop composition into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` character properties-panel prop composition into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterPanelProps.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` reference-canvas prop composition into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Extract `ai-studio` studio-preview prop composition + detail-modal action wiring into a dedicated hook.
  Evidence paths: `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioPreviewDetailProps.test.ts`, `frontend/pages/ai-studio.tsx`
- [x] Split `legacy standalone Media Library page` into page orchestration + feature modules for tab data, modal actions, and performance/signing logic.
  Evidence paths: `legacy standalone Media Library page`, `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`, `frontend/features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts`
- [x] Split `frontend/pages/ai-studio.tsx` into focused controllers (character mode, agent orchestration, generation submission, UI composition).
  Evidence paths: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/hooks/useAiStudioCharacterModeController.ts`, `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`, `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`, `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
- [x] Split `frontend/features/ai-studio/hooks/useAiStudioState.ts` into smaller hooks by concern for this pass (output lifecycle, workflow settings, reference/modal state, prompt/reference composition, task orchestration).
- [x] Split `frontend/lib/server/api/generationBilling.ts` into reservation RPC adapter, ownership resolver, settlement/capture service, and pricing param derivation.
  Evidence paths: `frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/generationBilling/reservationRpcAdapter.ts`, `frontend/lib/server/api/generationBilling/ownershipResolver.ts`, `frontend/lib/server/api/generationBilling/settlementService.ts`, `frontend/lib/server/api/generationBilling/pricingParams.ts`, `frontend/tests/api/generation-billing.reservations.test.ts`
- [x] Convert `frontend/lib/falClient.ts` from many repeated submit/status wrappers to a registry-driven generic client API.
  Evidence paths: `frontend/lib/falClient.ts`, `frontend/pages/api/fal/`, `frontend/tests/pages/ai-studio.character-mode.test.tsx`, `frontend/tests/api/fal-status.ownership.test.ts`
- [x] Set measurable modularity targets: no core source file above `800` lines in this pass; no new file above `500` lines without explicit rationale in doc comments.
  Evidence paths: `legacy standalone Media Library page` (`743` lines), `frontend/pages/ai-studio.tsx` (`756` lines), `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts` (`446` lines)

Exit criteria:
- High-churn files are decomposed with behavior preserved.
- Existing tests still pass and new tests cover moved business logic.

### Phase 4 (P1): Performance And API Efficiency
Goal: remove avoidable latency and operational overhead.

Checklist:
- [x] Remove duplicated Supabase auth lookups where middleware and route-level checks both call `/auth/v1/user`; choose one authoritative path per route family.
  Evidence paths: `frontend/proxy.ts`, `frontend/lib/server/api/auth.ts`, `frontend/lib/server/api/protectedApiPaths.ts`, `frontend/tests/api/auth-helper.test.ts`, `frontend/tests/api/proxy-internal-utils.test.ts`
- [x] Measure and document p50/p95 latency impact before and after auth-boundary consolidation.
  Evidence paths: `frontend/tests/api/auth-latency-benchmark.test.ts` (recent sampled range with `40` iterations and `12ms` mocked upstream delay: `proxy-context p50=0.07–0.08ms`, `p95=0.25–0.72ms`; `fallback p50=13.16–13.28ms`, `p95=13.30–14.61ms`), `docs/monitoring.md`
- [x] Confirm generation status polling remains ownership-safe after auth flow simplification.
  Evidence paths: `frontend/tests/api/kei-task-status.auth-context.test.ts`, `frontend/tests/api/kei-task-status.ownership.test.ts`, `frontend/tests/api/fal-status.auth-context.test.ts`, `frontend/tests/api/fal-status.ownership.test.ts`, `frontend/pages/api/kei/task-status.ts`, `frontend/pages/api/fal/status.ts`

Exit criteria:
- Auth-protected APIs show lower median latency without reducing security guarantees.

### Phase 5 (P0): Documentation And SOP Alignment
Goal: make docs accurate, non-conflicting, and operationally useful for release.

Checklist:
- [x] Update docs that still describe the app as purely client-only now that server API routes are core to architecture.
  Evidence paths: `docs/architecture-overview.md`, `docs/local-development.md`
- [x] Update architecture docs that currently describe AI Studio as "thin orchestrator" to reflect current complexity and split plan.
  Evidence path: `docs/frontend-architecture.md`
- [x] Add missing API route documentation for `/api/media/resolve-previews`.
  Evidence path: `docs/api/api-internal-routes.md`
- [ ] Reconcile billing RLS audit script expectations with actual schema policies for `stripe_event_log`. (`Paused` until Stripe/subscription pipeline work resumes)
  Evidence paths: `sql/audit_billing_credit_rls.sql`, `sql/create_billing_credit_tables.sql`
- [x] Archive or clearly segregate legacy Character SOPs to reduce operational confusion.
  Evidence paths: `docs/archive/sops/sop_character_generation.md`, `docs/archive/sops/sop_character_identity.md`, `docs/sops/README.md`
- [x] Add this plan and completion status updates to `docs/change_log.md` as phases close.

Exit criteria:
- No major doc contradictions remain between architecture, runbooks, and code reality.
- SOP index clearly separates active and legacy operational guidance.

## Verification Protocol
Security verification:
- run SQL migration checks in staging
- run billing/RLS audit SQL and confirm expected policies/status
- execute hostile-path tests for unauthorized provider request IDs and cross-user attempts

Engineering verification:
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- `cd frontend && npm run test`
- `cd frontend && npm run build`

Documentation verification:
- `cd frontend && npm run docs:check`
- manual review of `docs/README.md` and `docs/planning/README.md` indexes

## Task Tracking Grid
- `P0` security blockers: `Complete`
- `P0` reliability gates: `Complete`
- `P0` documentation alignment required for release: `Complete` (active scope; paused Stripe/subscription backlog item tracked separately)
- `P1` modularization: `Complete`
- `P1` performance/API efficiency: `Complete`
- `Paused` Stripe/subscription pipeline backlog: `Active pause`

## Sign-Off Criteria For Tester Launch
- All active-scope `P0` items complete.
- CI quality gates are deterministic and passing.
- Security-sensitive paths are tested and documented.
- Core docs and SOPs match current implementation and release process.

## Change Log
- 2026-02-14: Initial remediation runbook created from full-app audit findings.
- 2026-02-14: Implemented Phase 1 security hardening for reservation RPC auth/grants, helper relocation from `pages/api/_utils` to `lib/server/api`, Stripe base URL + webhook tolerance, and upload magic-byte validation.
- 2026-02-14: Completed Phase 2 reliability gates by restoring deterministic lint scope, re-enabling strict CI lint enforcement, passing `npm run validate`, and adding API tests for Stripe/upload/admin handler coverage gaps.
- 2026-02-14: Started Phase 3 modularization by extracting shared Media Library tab/cache/search/signing helpers into `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts` and wiring page usage.
- 2026-02-14: Re-centered this plan with a current sprint focus block and extracted modal move-option derivation into shared media move routing logic with unit coverage.
- 2026-02-14: Selected the first `ai-studio` split seam (agent composer + attachment lifecycle) and documented the extraction target/validation scope.
- 2026-02-14: Continued `ai-studio` modularization by extracting optimistic debit/failure reconciliation into `useAiStudioOptimisticDebitReconciliation` and validating with focused hook tests plus full `validate`/`build`/`docs:check`.
- 2026-02-14: Implemented the first `ai-studio` split seam by moving agent composer/attachment lifecycle state + drag-drop handlers into `useAiStudioAgentComposer` with direct hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting agent send/refine/enhance/describe orchestration into `useAiStudioAgentOrchestration` and wiring page integration.
- 2026-02-14: Continued `ai-studio` modularization by extracting remaining agent apply/select/use-question/message/chat interaction handlers into `useAiStudioAgentInteractions` with focused hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting generation submit/click-lock/regenerate orchestration into `useAiStudioGenerationController` with focused hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting character-mode bundle refresh/submission override/fallback telemetry orchestration into `useAiStudioCharacterModeController` with focused hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting character-mode list/bundle loading effects and model-enforcement toggling into `useAiStudioCharacterModeLifecycle` with focused hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting reference asset actions (download/save/generate-from-reference) into `useAiStudioReferenceAssetActions` with focused hook tests.
- 2026-02-14: Continued `ai-studio` modularization by extracting workspace UI action handlers + prompt-reference generate policy into `useAiStudioWorkspaceActions`, and page-level derived config into `useAiStudioPageDerivations`, with focused hook tests and `frontend/pages/ai-studio.tsx` reduced to `797` lines.
- 2026-02-14: Started `useAiStudioState` concern split by extracting output lifecycle/stale cleanup/failure normalization into `useAiStudioOutputLifecycle` with focused hook tests and full validation/build/docs checks.
- 2026-02-14: Continued `useAiStudioState` concern split by extracting workflow settings hydrate/restore/persist into `useAiStudioWorkflowSettings` with focused hook tests and full validation/build/docs checks.
- 2026-02-14: Continued `useAiStudioState` concern split by extracting reference input state + modal/selection orchestration into `useAiStudioReferenceSelectionState` with focused hook tests and full validation/build/docs checks.
- 2026-02-14: Continued `useAiStudioState` concern split by extracting generation prompt/reference input composition into `useAiStudioGenerationPromptComposer` with focused hook tests and full validation/build/docs checks.
- 2026-02-14: Continued `useAiStudioState` concern split by extracting task polling/submission orchestration into `useAiStudioTaskOrchestration` with focused hook tests and full validation/build/docs checks.
- 2026-02-14: Added temporary pause scope for Stripe/subscription pipeline work and marked remaining Stripe/subscription doc reconciliation as deferred.
- 2026-02-14: Continued `frontend/pages/ai-studio.tsx` decomposition by extracting text/image/video panel prop composition into `useAiStudioPanelProps` with focused hook tests and full `validate`/`build` verification.
- 2026-02-14: Continued `frontend/pages/ai-studio.tsx` decomposition by extracting character panel prop composition into `useAiStudioCharacterPanelProps` with focused hook tests and full `validate`/`build` verification.
- 2026-02-14: Continued `frontend/pages/ai-studio.tsx` decomposition by extracting reference-canvas prop composition into `useAiStudioReferenceCanvasProps` and preview/detail-modal wiring into `useAiStudioPreviewDetailProps`, each with focused hook tests.
- 2026-02-14: Completed active Phase 5 doc-alignment tasks by removing stale client-only/thin-orchestrator wording, adding `/api/media/resolve-previews` route coverage, and segregating legacy Character SOPs in the SOP index.
- 2026-02-14: Applied staging migration `014_harden_generation_reservation_rpc_security.sql` via Supabase CLI (`project_ref=jwmcytzyhcvacjwqtynn`) and verified remote migration history includes version `014`; fetched remote migration statements and confirmed all five RPCs include auth-binding checks and explicit revoke/grant execute hardening to `service_role`.
- 2026-02-14: Refreshed sprint focus and release tracking after P0 closeout so remaining work points at `P1` modularization (`media-library.tsx`, `generationBilling.ts`, `falClient.ts`) while keeping paused Stripe/subscription items explicitly out of active-scope release blockers.
- 2026-02-14: Continued `media-library` modularization by extracting moved-row cache reconciliation into `frontend/features/media-library/logic/mediaMoveCache.ts` with focused unit tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting modal image zoom/pan state and interaction handlers into `frontend/features/media-library/hooks/useMediaModalImageZoom.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting file-modal CRUD handlers (open/close, rename, single-delete) into `frontend/features/media-library/hooks/useMediaFileModalCrud.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting bulk-selection move orchestration into `frontend/features/media-library/hooks/useMediaBulkMoveController.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting preview signing/hydration pass orchestration into `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` with focused hook tests and page integration.
- 2026-02-14: Completed `generationBilling` modularization split by extracting reservation RPC adapter, ownership resolver, settlement/capture service, and pricing-param derivation into `frontend/lib/server/api/generationBilling/*` modules while keeping `frontend/lib/server/api/generationBilling.ts` as orchestration.
- 2026-02-14: Completed `falClient` modularization pass by replacing repeated submit/status wrappers with a registry-driven generic endpoint client while preserving existing exported submit/status helpers.
- 2026-02-14: Continued `media-library` modularization by extracting tab fetch/cache orchestration into `frontend/features/media-library/hooks/useMediaTabDataController.ts` and upload pipeline controllers into `frontend/features/media-library/hooks/useMediaUploadController.ts`, with focused hook tests and full `validate`/`build`/`docs:check` verification.
- 2026-02-14: Continued `media-library` modularization by extracting saved-prompt modal CRUD orchestration into `frontend/features/media-library/hooks/useMediaPromptModalCrud.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting bulk-delete confirmation/delete orchestration into `frontend/features/media-library/hooks/useMediaBulkDeleteController.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting single-file modal move orchestration into `frontend/features/media-library/hooks/useMediaSingleMoveController.ts` with focused hook tests and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting focused-file and saved-prompt modal render blocks into `frontend/features/media-library/components/MediaFileModal.tsx` and `frontend/features/media-library/components/MediaPromptModal.tsx` with page integration.
- 2026-02-14: Continued `media-library` modularization by extracting single-file and bulk-selected delete-confirm dialog render blocks into shared component `frontend/features/media-library/components/MediaDeleteConfirmModal.tsx` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting prompt-grid and media-grid/load-more render blocks into `frontend/features/media-library/components/MediaPromptGrid.tsx` and `frontend/features/media-library/components/MediaAssetGallery.tsx` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the gallery heading/action toolbar and bulk-move feedback notices into `frontend/features/media-library/components/MediaGalleryActions.tsx` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the filter/search tab-strip block into `frontend/features/media-library/components/MediaFiltersPanel.tsx` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the upload-stage block into `frontend/features/media-library/components/MediaUploadStage.tsx` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the page header hero block into `frontend/features/media-library/components/MediaLibraryHeader.tsx` with focused component test coverage and page integration.
- 2026-02-14: Stabilized `validate` type-check flow by replacing closure-captured failure context in `useAiStudioOutputLifecycle` with deterministic `findOutputById` context lookup before metadata reporting.
- 2026-02-14: Continued `media-library` modularization by extracting the gallery section shell into `frontend/features/media-library/components/MediaGallerySection.tsx`, moving action-toolbar wiring and state-branch rendering out of `legacy standalone Media Library page` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the modal stack into `frontend/features/media-library/components/MediaLibraryModalStack.tsx`, moving delete-confirm and focused modal composition out of `legacy standalone Media Library page` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting the filters-row shell into `frontend/features/media-library/components/MediaFiltersRow.tsx`, moving dashboard-nav and filter-panel composition out of `legacy standalone Media Library page` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting workspace content composition into `frontend/features/media-library/components/MediaLibraryWorkspaceContent.tsx`, consolidating header/upload/filters/gallery ordering and prop-group wiring outside `legacy standalone Media Library page` with focused component test coverage and page integration.
- 2026-02-14: Continued `media-library` modularization by extracting media event logging and storage delete-path helpers into `frontend/features/media-library/logic/mediaLibraryDataEffects.ts`, removing side-effect utility internals from `legacy standalone Media Library page` with focused logic test coverage and page integration.
- 2026-02-14: Completed active `media-library` page split by extracting preview/signing/viewport runtime into `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts` with focused hook coverage, reducing `legacy standalone Media Library page` to `743` lines and closing Phase 3 modularity checklist targets for `media-library.tsx` + `ai-studio.tsx`.
- 2026-02-14: Started Phase 4 auth-boundary consolidation by centralizing protected-path rules in `frontend/lib/server/api/protectedApiPaths.ts`, reusing middleware-authenticated user context headers in `requireApiUser/getOptionalApiUser/requireAdminUser`, and keeping non-protected-route fallback verification; validated with new auth/proxy tests plus full `validate`.
- 2026-02-14: Completed Phase 4 by capturing synthetic auth-boundary latency evidence (`proxy-context p50=0.07ms/p95=0.25ms` vs fallback `p50=13.28ms/p95=13.42ms`) and adding middleware-auth-context ownership tests for `kei/task-status`, then validating with full `validate` and `docs:check`.
- 2026-02-14: Extended Phase 4 ownership-safety verification by adding middleware-auth-context regression coverage for `fal/status` so both KEI and Fal status polling paths enforce provider-request ownership after auth-boundary consolidation.
- 2026-02-14: Completed a missing-anything audit pass; confirmed active-scope checklist has no unchecked items and retained only the explicitly paused Stripe/subscription backlog item.
- 2026-02-14: Added a fast CI auth-regression lane (`auth-helper`, `proxy-internal-utils`, `kei-task-status.auth-context`, `fal-status.auth-context`, `auth-latency-benchmark`) so auth-boundary and ownership regressions fail before the full suite.
- 2026-02-14: Added explicit pause-lift resume criteria for deferred Stripe/subscription backlog work to remove ambiguity on when the remaining Phase 5 item can restart.
- 2026-02-14: Added a staging protected-route latency capture script (`scripts/capture_protected_route_latency.mjs`) and monitoring runbook instructions so one real p50/p95 sample can be recorded with authenticated staging traffic.
- 2026-02-14: Captured a credentialed runtime latency sample on `/api/billing/credit-packages` against the running app (`http://127.0.0.1:3000`) with a short-lived Supabase test-user token (`p50=222.99ms`, `p95=291.78ms`, `statuses=200:30`) and cleaned up the temporary user after sampling.
- 2026-02-14: Enhanced the protected-route latency probe with optional Supabase token bootstrap (temporary user create/sign-in/delete), and updated monitoring/local-env docs so staging capture execution now only depends on resolving the staging app base URL.
- 2026-02-14: Verified bootstrap mode for the protected-route latency probe (`--bootstrap-token-from-supabase`) against the running app; sample run logged `p50=246.50ms`, `p95=274.55ms`, and confirmed temporary-user cleanup via `supabase_bootstrap_user_deleted=true`.
- 2026-02-14: Added `frontend` npm shortcut `latency:protected-route` and documented the exact staging capture command so recommendation #2 can be executed immediately once staging host URL is available.
- 2026-02-14: Verified the npm shortcut handoff flow (`cd frontend && npm run latency:protected-route -- ... --bootstrap-token-from-supabase`) against the running app; sample run logged `p50=228.38ms`, `p95=248.98ms`, and confirmed cleanup via `supabase_bootstrap_user_deleted=true`.
