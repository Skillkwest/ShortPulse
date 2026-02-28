# Unified Phase 11: Fal to Kie Video Migration

Status: In Progress
Owner: Engineering

## Objective
Deliver this phase with no regressions, no duplicated logic, and complete docs/evidence traceability.

## In Scope
1. Items defined in `docs/planning/shortpulse-unified-buildout-master-plan.md` for Phase 11.
2. Tests and documentation updates directly required by those items.

## Out of Scope
1. Unrelated feature work.
2. Broad refactors not required for this phase objective.

## Implementation Slices
1. Slice A: smallest safe functional increment.
2. Slice B: test hardening and edge-case completion.
3. Slice C: docs + evidence + tracker update.

## Current Slice Status
1. Slice A in progress:
- Added Phase 11 shadow/canary readiness + threshold template:
  - `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`
- Added read-only SQL metrics packet for baseline/canary windows:
  - `sql/check_phase11_shadow_canary_metrics.sql`
- Shadow window 1 execution started (UTC 2026-02-27 18:46:07) with live log:
  - `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-shadow-window-1-live-log.md`
- Added explicit shadow checkpoint run packet (UTC-aware) + canonical no-regression gate command in Slice A evidence docs:
  - `npm -C frontend run test:phase11:fal-regression`
  - section `G) One-row gate summary` from `sql/check_phase11_shadow_canary_metrics.sql`
- Locked observation framing for first Kie migration execution:
  - baseline capture,
  - shadow parity window,
  - two canary observation windows,
  - explicit promote/hold/rollback decision criteria.
- No provider cutover executed in this slice (planning and evidence scaffold only).
2. Slice B complete (engineering hardening):
- Added provider-neutral canonical payload identity module:
  - `frontend/lib/server/providerIntegration/canonicalProviderPayload.ts`
- Wired canonical request/event/status parsing into current Fal paths:
  - `frontend/lib/server/api/falSubmitTargeting.ts`
  - `frontend/pages/api/fal/webhook.ts`
- Added focused regression coverage for alias compatibility:
  - `frontend/lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts`
  - `frontend/tests/api/fal-submit-proxy.test.ts`
  - `frontend/tests/api/fal-webhook-route.test.ts`
- Added provider-aware recovery probe dispatch seam:
  - `frontend/lib/server/providerIntegration/recoveryProviderDispatcher.ts`
  - `frontend/lib/server/falIntegration/recoveryExecution.ts`
  - `frontend/lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts`
  - `frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
- Added provider-aware submit dispatch seam:
  - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
  - `frontend/lib/server/api/falSubmitProxy.ts`
  - `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`
- Added provider-aware status/result dispatch seam:
  - `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
  - `frontend/lib/server/api/falStatusProxy.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts`
- Added provider-aware payload semantics seam for status/result interpretation:
  - `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
  - `frontend/lib/server/providerIntegration/providerKey.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts`
  - `frontend/lib/server/api/falStatusProxy.ts` now consumes payload status/response/media/policy parsing via provider boundary.
- Aligned Fal recovery probe internals to provider status/payload boundaries:
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
  - Probe path now reuses provider status/result dispatch + provider payload parsing contracts.
- Added explicit Fal route inventory regression gate:
  - `frontend/tests/api/fal-route-inventory-regression.test.ts`
  - Freezes expected `/api/fal/*` route inventory and route-module default exports during Slice B refactors.
- Added provider-owned status topology resolver and recovery probe integration:
  - `frontend/lib/server/providerIntegration/statusProviderTopology.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts` now resolves model status bases via provider topology contract.
- Extracted provider-owned response-url probe dispatch and rewired status/recovery probe runtime:
  - `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts` (`resolveProviderResponseUrls`, `dispatchProviderResponseProbeRequest`)
  - `frontend/lib/server/falIntegration/statusProxyRuntime.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
  - `frontend/lib/server/api/falStatusProxy.ts` now passes provider context into shared response probe runtime.
- Extracted provider-owned polling session policy and rewired recovery probing to shared abort lifecycle:
  - `frontend/lib/server/providerIntegration/statusProviderPolling.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts` now uses provider/model timeout resolution + one shared abort signal across status/response/result probes.
- Extracted provider-owned status/result selection policy and rewired Fal callers:
  - `frontend/lib/server/providerIntegration/statusProviderSelection.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderSelection.test.ts`
  - `frontend/lib/server/api/falStatusProxy.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
  - `frontend/lib/server/falIntegration/retrievalEngine.ts` remains as a compatibility wrapper delegating to provider-owned selection.
- Extracted provider-owned lifecycle + retry policy and rewired Fal callers:
  - `frontend/lib/server/providerIntegration/statusProviderPolicy.ts`
  - `frontend/lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts`
  - `frontend/lib/server/api/falStatusProxy.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
  - `frontend/lib/server/falIntegration/statusProxyRuntime.ts` remains a Fal compatibility wrapper delegating to provider-owned policy.
- Aligned queued submit dispatch path to shared provider submit boundary:
  - `frontend/lib/server/api/generationQueue/dispatch.ts`
  - `frontend/lib/server/api/__tests__/generationQueue.dispatch.test.ts`
  - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
3. Slice C complete:
- Phase-11 evidence, stage, and tracker docs updated for each Slice B increment with validation logs and rollback-safe notes.

## Deferred Kie Model Targets (Not Yet Implemented)
1. Google VEO 3.1 Fast Image-to-Video.
2. Kling 3.0.
3. Apply only after primary-source Kie API contract review and with Fal no-regression gates passing before and after adapter insertion.

## Validation Gates
1. 
> shortflow@1.0.0 lint
> eslint .
2. 
> shortflow@1.0.0 type-check
> tsc --noEmit
3. 
> shortflow@1.0.0 build
> next build

▲ Next.js 16.1.6 (Turbopack)
- Environments: .env.local

  Running TypeScript ...
  Creating an optimized production build ...
✓ Compiled successfully in 1815.7ms
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/18) ...
  Generating static pages using 9 workers (4/18) 
  Generating static pages using 9 workers (8/18) 
  Generating static pages using 9 workers (13/18) 
✓ Generating static pages using 9 workers (18/18) in 96.3ms
  Finalizing page optimization ...

Route (pages)
┌ ○ /
├   /_app
├ ○ /404
├ ○ /admin
├ ○ /admin/generation-trace
├ ○ /ai-studio
├ ƒ /api/admin/credits/adjust
├ ƒ /api/admin/credits/ledger
├ ƒ /api/admin/error-events
├ ƒ /api/admin/errors
├ ƒ /api/admin/errors-status
├ ƒ /api/admin/errors-test
├ ƒ /api/admin/generation-recovery/replay
├ ƒ /api/admin/generation-trace
├ ƒ /api/admin/users
├ ƒ /api/ai/describe-image
├ ƒ /api/ai/generate-prompt
├ ƒ /api/ai/studio-agent
├ ƒ /api/billing/credit-packages
├ ƒ /api/billing/stripe/checkout
├ ƒ /api/billing/stripe/portal
├ ƒ /api/billing/stripe/webhook
├ ƒ /api/credits/snapshot
├ ƒ /api/fal/flux2-edit-status
├ ƒ /api/fal/flux2-edit-submit
├ ƒ /api/fal/flux2-status
├ ƒ /api/fal/flux2-submit
├ ƒ /api/fal/flux2klein-status
├ ƒ /api/fal/flux2klein-submit
├ ƒ /api/fal/flux2pro-edit-status
├ ƒ /api/fal/flux2pro-edit-submit
├ ƒ /api/fal/flux2pro-status
├ ƒ /api/fal/flux2pro-submit
├ ƒ /api/fal/kling-status
├ ƒ /api/fal/kling-v3-image-to-video-status
├ ƒ /api/fal/kling-v3-image-to-video-submit
├ ƒ /api/fal/kling-v3-text-submit
├ ƒ /api/fal/nano-banana-edit-status
├ ƒ /api/fal/nano-banana-edit-submit
├ ƒ /api/fal/nano-banana-pro-edit-status
├ ƒ /api/fal/nano-banana-pro-edit-submit
├ ƒ /api/fal/nano-banana-pro-status
├ ƒ /api/fal/nano-banana-pro-submit
├ ƒ /api/fal/nano-banana-status
├ ƒ /api/fal/nano-banana-submit
├ ƒ /api/fal/queue-status
├ ƒ /api/fal/seedance-i2v-status
├ ƒ /api/fal/seedance-i2v-submit
├ ƒ /api/fal/seedance-status
├ ƒ /api/fal/seedance-submit
├ ƒ /api/fal/seedream-edit-submit
├ ƒ /api/fal/seedream-status
├ ƒ /api/fal/seedream-submit
├ ƒ /api/fal/sora-status
├ ƒ /api/fal/sora-submit
├ ƒ /api/fal/status
├ ƒ /api/fal/submit
├ ƒ /api/fal/veo-first-last-frame-submit
├ ƒ /api/fal/veo-image-to-video-status
├ ƒ /api/fal/veo-image-to-video-submit
├ ƒ /api/fal/veo-status
├ ƒ /api/fal/veo-submit
├ ƒ /api/fal/webhook
├ ƒ /api/internal/generation-recovery/run
├ ƒ /api/log/client-error
├ ƒ /api/media/move
├ ƒ /api/media/move-batch
├ ƒ /api/media/resolve-previews
├ ƒ /api/media/sign-batch
├ ƒ /api/upload-image
├ ƒ /api/upload-video
├ ○ /auth
├ ○ /character
├ ○ /character-soon
├ ○ /creator-studio
├ ○ /dashboard
├ ○ /landing
├ ○ /media-library
├ ○ /onboarding
├ ○ /performance
├ ○ /performance-soon
├ ○ /profile
└ ○ /saved-creators

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
4. 
> shortflow@1.0.0 docs:check
> cd .. && node scripts/check_docs_links.js && node scripts/check_docs_semantic_drift.js && node scripts/check_migration_doc_parity.js && node scripts/check_archive_manifest.js && node scripts/check_model_catalog_parity.js && node scripts/check_naming_canonical_drift.js

Documentation checks passed.
Semantic drift checks passed.
Migration/doc parity checks passed.
Archive manifest checks passed.
Model catalog parity checks passed.
Naming canonical drift checks passed.
5. Domain-specific suites tied to touched files.
6. Fresh Fal no-regression + provider polling suites (`2026-02-28`):
```bash
npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts
npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts tests/api/fal-kling-v3-image-to-video-submit.test.ts tests/api/fal-kling-v3-image-to-video-status.test.ts tests/api/fal-kling-v3-text-submit.test.ts tests/api/fal-kling-v3-text-status.test.ts tests/api/fal-veo3-submit.test.ts tests/api/fal-veo3-status.test.ts tests/api/fal-queue-status.test.ts tests/api/fal-status-proxy.test.ts lib/server/falIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/runtimeFlags.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts
```
Result: pass.
7. Fresh provider-selection no-regression suite (`2026-02-28`):
```bash
npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderSelection.test.ts lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-route-inventory-regression.test.ts
npm -C frontend run type-check
npm -C frontend run lint
npm -C frontend run build
```
Result: pass.
8. Fresh provider-policy no-regression suite (`2026-02-28`):
```bash
npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-route-inventory-regression.test.ts
npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts tests/api/fal-kling-v3-image-to-video-submit.test.ts tests/api/fal-kling-v3-image-to-video-status.test.ts tests/api/fal-kling-v3-text-submit.test.ts tests/api/fal-kling-v3-text-status.test.ts tests/api/fal-veo3-submit.test.ts tests/api/fal-veo3-status.test.ts tests/api/fal-queue-status.test.ts tests/api/fal-status-proxy.test.ts lib/server/falIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/runtimeFlags.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts lib/server/providerIntegration/__tests__/statusProviderSelection.test.ts lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts
npm -C frontend run type-check
npm -C frontend run lint
npm -C frontend run docs:check
npm -C frontend run build
```
Result: pass.
9. Canonical no-regression commands (ongoing gate):
```bash
npm -C frontend run test:phase11:fal-regression
npm -C frontend run validate:phase11:fal-regression
```
Use these instead of manually retyping long test command lists for subsequent Phase 11 work.

## Targeted Research Checkpoint
If this phase touches external contracts/standards, add a short research note with primary-source links under:
- `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`

## Required Docs Updates
1. Update  phase status.
2. Add evidence summary in phase-11 folder.
3. Update impacted SOP/API/ADR/change-log docs.

## Exit Criteria
1. All validation gates green.
2. Tracker status updated.
3. Evidence note committed.
4. Rollback note documented.
5. Shadow parity and canary windows pass phase thresholds with explicit signoff packet.

## Rollback Plan
1. Revert only the PR slice(s) from this phase.
2. Keep previous stable phase baseline intact.
