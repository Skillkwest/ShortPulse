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
  - `bash scripts/phase11_shadow_checkpoint_gate.sh --quick`
  - section `G) One-row gate summary` from `sql/check_phase11_shadow_canary_metrics.sql`
- Added gate-summary evaluator utility for deterministic pass/hold packet generation from SQL section `G` output:
  - `npm -C frontend run phase11:gate-eval -- --window shadow-1 --file <gate-summary.json>`
- Added UTC checkpoint window guard to prevent invalid early canary/shadow checkpoint runs:
  - `npm -C frontend run phase11:window-guard -- --window <shadow-1|canary-1|canary-2>`
- Added explicit windowed one-row gate SQL helper for deterministic checkpoint ranges:
  - `sql/check_phase11_shadow_canary_gate_summary_windowed.sql`
- Added pre-created canary live-log templates for consecutive observation windows:
  - `docs/planning/evidence/unified-buildout/phase-11/2026-03-01-phase-11-canary-window-1-live-log.md`
  - `docs/planning/evidence/unified-buildout/phase-11/2026-03-02-phase-11-canary-window-2-live-log.md`
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
- Added Kie dark-path runtime guard/config surface (disabled-by-default, allowlist + trusted-host fail-closed checks):
  - `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
  - `frontend/lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts`
  - `frontend/.env.example`
  - Kie allowlist parsing now normalizes entries, anchors wildcard prefixes to canonical Kie model ids, and rejects invalid/non-Kie patterns to keep runtime enablement fail-closed.
- Extended provider integration boundaries to support `provider="kie"` while preserving Fal behavior:
  - `frontend/lib/server/providerIntegration/providerKey.ts`
  - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
  - `frontend/lib/server/providerIntegration/recoveryProviderDispatcher.ts`
  - `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
  - `frontend/lib/server/providerIntegration/statusProviderTopology.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPolicy.ts`
  - `frontend/lib/server/providerIntegration/statusProviderSelection.ts`
  - corresponding unit suites under `frontend/lib/server/providerIntegration/__tests__/`
- Completed provider propagation across queue/recovery persistence paths (still Fal-default in production traffic):
  - `frontend/lib/server/api/generationQueue/dispatch.ts`
  - `frontend/lib/server/api/generationSubmitPersistence.ts`
  - `frontend/lib/server/falIntegration/recoveryExecution.ts`
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
- Added dark-path Kie model-contract scaffolding (no user-visible enablement):
  - `frontend/lib/model-runtime/modelCatalog.ts` (`kie-ai/veo-3.1-fast-i2v`, `kie-ai/kling-3.0`)
  - `frontend/lib/model-runtime/modelRegistry.ts` (provider=`kie` runtime entries)
  - strict fail-closed allowlist behavior in `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
  - API traceability docs: `docs/api/api-kie-veo-3-1-fast-image-to-video.md`, `docs/api/api-kie-kling-3-0.md`
- Added AI Studio model-selection fail-closed guard for Kie dark-path models:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/modelOptionsRegistry.test.ts`
  - Ensures selector options remain Fal-only by default even if Kie model options are introduced later.
- Added Kie model-contract execution boundary for submit path decoupling:
  - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
  - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
  - `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
  - `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`
  - Enforces fail-closed unsupported-model rejection and model-specific payload validation before Kie transport dispatch.
- Added Kie catalog-contract drift lock for submit constraints:
  - `frontend/lib/server/providerIntegration/kieModelContracts.ts` now reads allowed aspect/duration/resolution constraints from canonical `frontend/lib/model-runtime/modelCatalog.ts` entries instead of duplicate hardcoded arrays.
  - Fail-closed guards now reject missing/incomplete Kie catalog contract bounds in submit normalization paths.
- Added Kie model-id contract centralization across provider boundaries:
  - `frontend/lib/server/providerIntegration/kieModelIds.ts`
  - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
  - `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
  - Removes duplicate Kie model-id literals across submit/media contract modules and keeps dark-path model identity fail-closed checks aligned.
- Added provider header-contract centralization and status-contract decoupling:
  - `frontend/lib/server/providerIntegration/providerHeaderUtils.ts`
  - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPolicy.ts`
  - Removes duplicated boolean-header parsing logic and decouples Kie status model-support checks from submit-contract module exports.
- Added model-runtime Kie model-id canonicalization across runtime + provider boundaries:
  - `frontend/lib/model-runtime/providerModelIds.ts`
  - `frontend/lib/model-runtime/modelCatalog.ts`
  - `frontend/lib/model-runtime/modelRegistry.ts`
  - `frontend/lib/server/providerIntegration/kieModelIds.ts`
  - Removes remaining cross-layer duplicated Kie model-id literals by promoting one canonical runtime source.
- Added canonical Kie model-id parity guard in model-catalog governance checks:
  - `scripts/check_model_catalog_parity.js`
  - Enforces parity between `KIE_SUPPORTED_MODEL_IDS`, model catalog `provider="kie"` entries, and Kie API doc map coverage.
- Extended canonical Kie model-id parity guard to runtime registry:
  - `scripts/check_model_catalog_parity.js`
  - Enforces parity between `KIE_SUPPORTED_MODEL_IDS` and `modelRegistry` Kie provider entries.
- Extended runtime model-surface parity governance for all providers:
  - `scripts/check_model_catalog_parity.js`
  - Enforces full catalog↔registry model presence parity and provider classification parity across runtime model surfaces.
- Extended provider source-provenance governance for model catalog entries:
  - `scripts/check_model_catalog_parity.js`
  - Enforces provider-aligned `sourceUrl` host allowlist parity (`fal.ai`, `docs.kie.ai`/`kie.ai`, `platform.openai.com`/`openai.com`) to catch contract provenance drift before enablement.
- Extended model contract-completeness governance for runtime catalog entries:
  - `scripts/check_model_catalog_parity.js`
  - Enforces default-aspect membership, duration-default consistency, and required Kie contract field presence (`payloadValidation`, `allowedDurations`) before enablement.
- Added Kie status/result contract execution boundary for payload/policy decoupling:
  - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPolicy.ts`
  - `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`
  - Centralizes Kie lifecycle/status/result/retry semantics and removes inline Kie parsing duplication from shared provider payload/policy modules.
- Added Kie result media normalization boundary for recovery/status parity:
  - `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
  - `frontend/lib/server/providerIntegration/statusProviderPayload.ts` (`readProviderMediaUrls`, model-aware Kie media presence)
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
  - `frontend/lib/server/falIntegration/recoveryExecutionRuntime.ts`
  - `frontend/lib/server/falIntegration/recoveryExecution.ts`
  - `frontend/pages/api/fal/webhook.ts`
  - Consolidates provider/model-aware media URL extraction and removes duplicate parsing logic from recovery/webhook paths.
- Captured Kie Veo/Kling primary-source contract details and aligned dark-path adapter normalization:
  - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
  - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
  - `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
  - `docs/api/api-kie-veo-3-1-fast-image-to-video.md`
  - `docs/api/api-kie-kling-3-0.md`
  - Added Veo alias + generation-type normalization (`imageUrls`, `callBackUrl`, `generationType`, `seeds` range), Kling create-task payload normalization (`model` + `input`), callback `state=fail` terminal mapping, and callback `resultJson.resultUrls` media extraction support.
- Added follow-on callback/status alias convergence updates from primary-source compare pass:
  - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
  - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
  - Added `aspectRatio` submit alias handling and lifecycle fallback mapping from callback numeric `code` values (`200` completed, `501` failed) when `status/state` is absent.
- Added fixture-backed primary-source regression locks for Veo/Kling contracts:
  - `frontend/lib/server/providerIntegration/__tests__/fixtures/kieContractFixtures.ts`
  - `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
  - `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`
  - `frontend/lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts`
  - Includes callback success/failure fixture coverage and canonical `state=fail -> failed` normalization lock.
3. Slice C complete:
- Phase-11 evidence, stage, and tracker docs updated for each Slice B increment with validation logs and rollback-safe notes.

## Deferred Kie Enablement Targets (Dark-Path Implemented, Runtime Off)
1. Google VEO 3.1 Fast Image-to-Video and Kling 3.0 are implemented as dark-path contracts and integration seams, but remain non-user-visible and cutover-disabled.
2. Do not enable routing/cutover for Kie models until:
   - primary-source Kie API contract review is refreshed,
   - canary/signoff windows pass,
   - Fal no-regression gates pass before and after enablement slice.

## Validation Gates
1. `npm -C frontend run test:phase11:fal-regression`
2. `npm -C frontend run validate:phase11:fal-regression`
3. If a targeted slice needs narrower checks, run focused tests first, then still run canonical gate #2 before merge.
4. Latest canonical gate run at current HEAD: `2026-03-01` -> pass.
5. CI includes `phase11_fal_regression` lane (file-change aware on PRs, enforce/warn mode support).

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
