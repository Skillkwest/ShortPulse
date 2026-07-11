# Model Pricing Grid Billed-Credit Authority Plan

## Planning frame

- Objective: make the model-pricing grid calculator the canonical publisher of customer billed-credit pricing, then make customer display and server debit consume the same published result.
- Owner/lane: solo owner/operator; model-pricing calculator and downstream AI Studio billing lane. The admin pricing page remains the authoring surface and `chargeGenerationRequest` remains the debit enforcement boundary.
- Approved scope: model-pricing policy publication, canonical variant/quantity selection, client display lookup, server debit lookup, activation validation, focused tests, and authority documentation.
- Protected behavior: keep the current admin pricing-grid UX and calculator inputs; preserve existing customer-facing AI Studio UX; preserve pricing-policy version conflict handling and pre-provider fail-closed behavior.
- Approved quantity rules:
  - GPT Image 2 pricing is per generated image by normalized output resolution. Kie supports 1-16 input references but does not price by reference count.
  - Seedance pricing must distinguish no-video-input from video-input rows and apply validated output duration plus validated input-video duration where the provider contract bills both.
  - Other duration/count/character-priced models may apply only their explicitly published grid quantity rule.
- Non-goals: subscription/catalog/Stripe pricing, credit grants or reimbursements, provider integration behavior, unrelated admin UI work, mobile work, production deployment, commits, pushes, or policy activation.
- Source of truth:
  - `docs/adr/0088-admin-priced-billed-credit-authority.md`
  - `docs/adr/0100-pricing-policy-submit-handshake.md`
  - `frontend/features/admin/PricingModelWorkbookTable.tsx`
  - `frontend/features/admin/pricingWorkbookMath.ts`
  - `frontend/lib/model-runtime/pricingPolicy.ts`
  - `frontend/lib/model-runtime/pricingGridBilledCredits.ts`
  - `frontend/lib/model-runtime/modelPricingVariants.ts`
  - `frontend/lib/model-runtime/createImageBilledCredits.ts`
  - `frontend/lib/model-runtime/editImageBilledCredits.ts`
  - `frontend/lib/model-runtime/videoBilledCredits.ts`
  - `frontend/lib/server/api/generationBilling.ts`
  - `frontend/lib/server/api/generationBilling/pricingParams.ts`
  - `frontend/lib/server/api/modelPricingControlPlane.ts`
- Proof requirements: focused unit and route tests must prove calculator publication, variant/quantity selection, client/server equality, missing-authority rejection before reservation/provider dispatch, stale-policy rejection, custom-row participation, and no runtime provider-cost/markup fallback on customer-billable paths.
- Implementation stop condition: stop when local code and focused validation prove the canonical authority contract. Do not activate a production policy, deploy, commit, push, or claim production proof. Stop earlier if preserving existing live prices requires an unapproved pricing decision.

## Current repo truth

1. The grid's `Billed credits` column is calculated from admin-controlled provider cost/rate, conversion, markup, and rounding inputs.
2. Runtime lookup still recalculates from those inputs when an explicit billed-credit override is absent.
3. Images receive runtime-only materialized overrides, while video/audio remain permissive.
4. Active custom rows are persisted separately but are not consistently folded into runtime billing authority.
5. GPT Image 2 correctly needs one customer price per normalized output resolution; reference count is an input limit, not a provider price dimension.
6. Seedance correctly distinguishes video-input rows and calculates billable input plus output duration, but compiled provider rates can still become a debit fallback.
7. Generic image workflow classification can construct both create and edit candidates and use client quote evidence to select between them.
8. Kie documents GPT Image 2 at `$0.03` for 1K, `$0.05` for 2K, and `$0.08` for 4K per generated image. The stale 4K `$0.05` test must use `$0.08`.

## Recommended design

The active policy must contain a published billing artifact produced by the admin grid calculator at policy-apply time.

Each billable variant publishes one of:

- fixed billed credits per generation/output; or
- a self-contained quantity rule containing derived cost credits per unit, the applied markup snapshot, final rounding increment, and an explicit quantity basis.

Runtime may select the exact server-derived variant and execute the published quantity rule. The rule preserves the existing workbook's two-stage rounding: round total cost credits, then apply the snapshotted markup and final rounding increment. Runtime must not consult provider USD, conversion scale, separate authoring markup fields, or compiled provider-rate constants.

Published quantity bases are limited to explicit product contracts such as output count, output duration, input-video duration, text characters, or source-audio duration. Missing or ambiguous published authority fails closed.

## Implementation sequence

### Batch 1: policy publication contract

1. Extend the normalized model-pricing policy types with an explicit published billing rule per variant.
2. Add one canonical server-safe publisher that converts the current admin calculator result into published fixed/rate rules.
3. Fold active custom rows into the published artifact.
4. Validate completeness, positivity, uniqueness, supported quantity basis, and variant coverage before policy activation.
5. Keep provider cost, markup, conversion, and margin values as calculator/economics inputs only.

### Batch 2: exact variant and quantity authority

1. Keep GPT Image 2 reference count out of billing identity while validating the provider's 1-16 input limit separately.
2. Make the grid calculator publish one billed result for each supported GPT Image 2 output-resolution/aspect normalization row.
3. Preserve Seedance no-video and with-video variant separation.
4. Publish Seedance's calculator-derived rate rule and apply only normalized output duration plus validated input-video duration for the with-video contract.
5. Carry every billing-relevant quantity through the canonical request/context builder so client display and server debit resolve identical inputs.

### Batch 3: strict runtime consumption

1. Make submit routes pass exact server-owned workflows (`create_image`, `edit_image`, `video`, `audio`).
2. Require exactly one server-derived canonical candidate.
3. Use client pricing evidence only for equality/version checks, never candidate selection.
4. Make client display, optimistic balance checks, submit evidence, and server debit read the same published billing artifact.
5. Remove customer-billing fallback to provider-cost, markup, conversion, rounding, or compiled provider-rate calculations.
6. Preserve HTTP 409 stale/mismatch handling and reject missing authority before reservation/provider submission.

### Batch 4: validation and documentation

1. Add policy-publisher tests for fixed and quantity rules, custom rows, missing rows, duplicates, and invalid rules.
2. Add GPT Image 2 tests proving 1-16 references do not alter price while resolution/aspect normalization selects the documented 1K/2K/4K provider cost.
3. Add Seedance duration/reference matrix tests for no-video and with-video rows, minimum/default/maximum output duration, and input-video duration.
4. Add route-contract tests proving exact workflow classification and zero reservation/provider calls on authority failure.
5. Add exhaustive active-model/variant client-display-to-server-debit parity coverage.
6. Register pricing drift and authority checks in `validate:local` and required CI.
7. Update ADR 0088 and pricing SOP wording so `Billed credits` is clearly the published calculator result, not a manually typed field and not a runtime recalculation.

## Migration and release boundary

Existing active policies do not contain the new published artifact. Implementation must include a deterministic dry-run migration that derives a candidate artifact from the active grid calculator inputs and reports every changed or missing row. The migration must not activate anything automatically.

A later production operation must review the dry-run, publish/activate the complete policy through the canonical admin apply path, deploy the strict reader in the documented order, and verify fresh image/video/audio rows. Temporary compatibility, if unavoidable for deployment ordering, must be version-scoped to the pre-migration policy, explicitly observable, and removed immediately after activation; it must never silently recalculate a missing row in the new policy.

## Implementation proof boundary

Local completion proves source correctness and automated parity. It does not prove current production policy completeness or live debit behavior. Production closure requires a separately authorized deployment and policy activation followed by fresh authenticated billable traffic with complete pricing observability and zero display/debit deltas.
