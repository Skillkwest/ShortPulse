# AI Studio Pricing Recalibration Phase B-C Execution Checklist (2026-03-14)

> Archived on 2026-04-27 during docs cleanup because this pricing recalibration execution checklist is fully completed and now serves as historical rollout proof rather than active planning.

Status: complete

Purpose: provide a single execution checklist for the remaining pricing recalibration work after Phase A model research approvals.

## Scope
- In scope: Phase B implementation and Phase C docs/metadata synchronization for active non-OpenAI runtime models.
- Out of scope: OpenAI model price recalculation, schema changes, and API contract changes.

## Locked Policy Snapshot
- Base conversion: `1 credit = $0.01`.
- Markup: `+3%`.
- Default rounding: `ceil(rawCredits / 5) * 5`, where `rawCredits = ceil(markedCredits)`.
- Exception rounding (no nearest-5):
  - `fal-ai/flux-2/klein/9b`
  - `fal-ai/bria/background/remove`
- Blocked-pricing rule: if official provider pricing is missing/unclear, block that model and require user-provided evidence before implementation.

## Required Inputs Before Phase B
- [x] [ai-studio-model-pricing-audit-checklist-2026-03-14.md](./ai-studio-model-pricing-audit-checklist-2026-03-14.md) is complete for all active families.
- [x] Family-by-family approval is recorded.
- [x] Provider evidence links and verification dates are present for each model.

## Phase B: Pricing Engine Implementation

### B0. Preflight
- [x] Confirm current runtime model inventory in `frontend/lib/model-runtime/modelRegistry.ts`.
- [x] Confirm provider catalog metadata in `frontend/lib/model-runtime/modelCatalog.ts`.
- [x] Confirm pricing helper coverage in `frontend/lib/model-runtime/pricingCredits.ts`.

### B1. Runtime Pricing Updates
- [x] Update strategy constants/formulas in `frontend/lib/model-runtime/pricingStrategies.ts` to approved Phase A values only.
- [x] Route all USD-to-credit conversion through `convertUsdToCredits`.
- [x] Keep markup ordering invariant: provider USD -> markup -> quantization.
- [x] Enforce model-level rounding mode using `resolveModelCreditRoundingMode`.
- [x] Verify exception models never use nearest-5 quantization.

### B2. Dynamic Settings Preservation
- [x] Preserve dynamic inputs in `frontend/lib/server/api/generationBilling/pricingParams.ts` (`duration`, `resolution`, `aspect`, `audio`, `voiceControl`, `webSearch`, size dimensions).
- [x] Validate per-model behavior over allowed runtime ranges from registry/contracts.
- [x] Confirm Kie/Fal video variants keep resolution/audio/duration handling aligned with approved formulas.

### B3. Cross-Layer Parity Gate
- [x] UI estimate parity: `computeCostForModel` outputs expected credits for representative and boundary inputs.
- [x] Server parity: `buildPricingParams(payload)` plus `computeCostForModel` matches UI estimate for same settings.
- [x] Reservation/debit parity: reserved/captured amount equals computed credits exactly.

### B4. Test Gates (must pass)
- [x] `npm -C frontend run test -- lib/model-runtime/__tests__/pricingCredits.test.ts`
- [x] `npm -C frontend run test -- features/ai-studio/logic/__tests__/pricing.test.ts`
- [x] `npm -C frontend run test -- features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts`
- [x] `npm -C frontend run test -- tests/api/generation-billing.pricing-params.test.ts`
- [x] `npm -C frontend run test -- tests/api/generation-billing.reservations.test.ts`
- [x] `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`
- [x] `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- [x] `npm -C frontend run test -- features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts`

### B5. Implementation Completion Criteria
- [x] No submit/status route contract changes.
- [x] Reservation lifecycle behavior unchanged (`reserve`, `mark submitted`, `release`, `capture`).
- [x] UI model picker/generate badges match backend debits for same settings.
- [x] No blocked-pricing model was silently implemented without evidence.

## Phase C: Docs and Metadata Synchronization
- [x] Update pricing references in:
  - `docs/product/ai-studio-pricing.md`
  - `docs/sops/sop_billing_credits_operations.md`
  - `docs/sops/sop_video_generation.md`
  - `docs/sops/sop_ai_studio_index.md`
- [x] Align active model docs under `docs/api/` with current runtime inventory.
- [x] Refresh `verifiedAt`/source references in `frontend/lib/model-runtime/modelCatalog.ts` as needed.
- [x] Keep the Phase A checklist as signed audit artifact with final decisions.
- [x] Run `npm -C frontend run docs:check`.

## Final Acceptance Gate (No Regression)
- [x] Every active non-OpenAI model has approved pricing evidence.
- [x] Runtime formulas match approved checklist values only.
- [x] Dynamic settings matrix is policy-compliant across supported options.
- [x] UI estimate, server pricing, and debit capture are in parity.
- [x] All listed tests and docs checks are green.

## Execution Log
| Date (UTC) | Owner | Action | Result | Evidence |
| --- | --- | --- | --- | --- |
| 2026-03-14 | AI agent | Checklist initialized | complete | Initial Phase B/C execution scaffold |
| 2026-03-14 | AI agent | Phase B/C execution + parity validation run | complete | `115/115` targeted pricing+billing tests passed; `npm -C frontend run docs:check` passed |
