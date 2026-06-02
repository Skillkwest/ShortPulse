# 2026-05-31 Pricing Grid Gap Notes

Purpose: preserve concrete missing-row follow-ups discovered during the AI usage billed-credit authority migration, without changing Scott's pricing page implementation.

## Scott To-Do

### GPT Image 2 Multi-Ref Create

- Add pricing-grid `Billed credits` rows for `GPT Image 2` Create when total refs are more than `1`.
- Start with this exact row:
  - `Create`
  - `GPT Image 2`
  - `16:9`
  - `medium`
  - `3 refs`
  - `high fidelity`
  - `no mask`
- Then add the other intended aspect / quality combinations for GPT multi-ref Create.

## Confirmed Gap

### GPT Image 2 Create Character Mode with 3 input refs

- Surface: `Create`
- Workflow shape: GPT Image 2 Create Character Mode
- Operation shape: edit-like priced Create run
- Current priced params:
  - `model_id = gpt-image-2`
  - `aspect = 16:9` in the confirmed audit case
  - `resolution = medium` in the confirmed audit case
  - `input_image_count = 3`
  - `input_fidelity = high`
- Current state:
  - no authored canonical `Billed credits` row exists for this configuration in the pricing grid/runtime-authority path
  - runtime must fail closed for this configuration instead of inventing a fallback billed price
- Decision update:
  - this is now confirmed as an intentional distinct priced variant, not a runtime over-specific lookup bug
  - runtime should stay strict and fail closed until Scott authors this billed-row family

## Why This Matters

- The new runtime-authority rule requires product display and server debit to read Scott's final pricing-grid `Billed credits` output.
- If a billed configuration has no authored row, runtime must not silently fall back to shared-policy math or helper-model estimates.
- This gap is a pricing-grid coverage issue, not a pricing-page calculator rewrite lane.

## Follow-Up When Filling Pricing Grid Gaps

Add canonical `Billed credits` coverage for GPT Image 2 Create Character Mode rows that use multiple injected input refs, starting with:

- `gpt-image-2`
- Create / edit-like priced lane
- `resolution = medium`
- `aspect = 16:9`
- `input_image_count = 3`
- `input_fidelity = high`
- `mask_present = false`

Then expand coverage to the other intended aspect / quality combinations if product wants those configurations billable.

### GPT Image 2 Distinct Multi-Ref Create Variant Family

- Confirmed authority decision:
  - GPT multi-ref Create is a distinct variant family and should not collapse onto the base GPT edit row
- Repo-backed runtime finding:
  - current runtime authority materializes GPT edit-like Create rows only for `input_image_count = 1`
  - any intended billable GPT Create variant with `input_image_count > 1` currently has no canonical authored billed row to match
  - Character Mode naturally reaches this family because its canonical look payload is ordered around up to three look zones (`portrait`, `close_up`, `front_shot`)
- Canonical row family to author:
  - `model_id = gpt-image-2`
  - Create / edit-like priced lane
  - `input_image_count > 1`
  - `input_fidelity = high`
  - `mask_present = false` unless masked Create is intentionally billable as a separate row family
- Highest-priority confirmed runtime block:
  - `aspect = 16:9`
  - `resolution = medium`
  - `input_image_count = 3`
- Expansion guidance for Scott later:
  - add the intended aspect combinations
  - add the intended quality combinations (`low`, `medium`, `high`)
  - add the intended multi-ref counts if product wants more than one billed tier inside the multi-ref family
  - keep this as a pricing-grid coverage lane, not a runtime fallback lane

### GPT Image 2 Create Coverage Boundary (Current Runtime Behavior)

- Safe/covered today:
  - plain GPT Create text-to-image rows
  - GPT Create edit-like rows where the effective canonical variant stays at `input_image_count = 1`
- Fail-closed today:
  - GPT Create distinct multi-ref variants where `input_image_count > 1`
- Interpretation:
  - this is expected fail-closed behavior under the admin-priced billed-credit authority contract
  - do not loosen runtime to guess or collapse these rows unless Scott explicitly changes the pricing-authority decision

## Pricing Grid Review Notes For Scott

These are not runtime-authority gaps. They are retained pricing-panel review notes for Scott to inspect later inside the admin pricing grid/calculator surface.

### Nano Banana Pro 4K versus 2K

- Surface: pricing grid review
- Model: `Nano Banana Pro`
- Current grid observation:
  - `1K = 8`
  - `2K = 8`
  - `4K = 15`
- Review note:
  - `2K` currently prices the same as `1K`
  - this may be intentional flat-tier behavior, but keep it flagged for manual pricing review when Scott revisits the panel

### Seedream 4.5 4K versus 2K

- Surface: pricing grid review
- Model: `Seedream 4.5`
- Current grid observation:
  - `2K = 4`
  - `4K = 4`
- Review note:
  - `4K` currently prices the same as `2K`
  - per product expectation, `4K` likely should cost more than `2K`
  - keep this as a Scott pricing-panel follow-up, not a runtime rewrite lane

## Hold For Scott Decision

### Nano Banana 2 Edit Character Mode runtime failure despite visible base row

- Surface: `Create`
- Pricing/debit lane: image-to-image-priced Character Mode path
- Model family: `Nano Banana 2`
- Effective submit model: `fal-ai/nano-banana-2/edit`
- Observed runtime failure:
  - `"No pricing strategy is configured for 'the provider-ai/nano-banana-2/edit'."`
- Important context:
  - the pricing grid does contain the visible base `Nano Banana 2 Edit` billed rows:
    - `0.5K / auto = 4`
    - `1K / auto = 5`
    - `2K / auto = 7`
    - `4K / auto = 8`
- Current interpretation:
  - open question whether runtime should collapse this Character Mode edit-like path onto the existing base `Nano Banana 2 Edit` row
  - or whether Scott wants more specific Character Mode edit rows authored later
- Decision status:
  - wait for Scott's call before choosing between:
    - runtime lookup simplification onto the existing base row
    - more specific pricing-grid row coverage for Character Mode edit variants
