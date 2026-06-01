# 2026-05-31 Pricing Grid Gap Notes

Purpose: preserve concrete missing-row follow-ups discovered during the AI usage billed-credit authority migration, without changing Scott's pricing page implementation.

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

Then expand coverage to the other intended aspect / quality combinations if product wants those configurations billable.

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
