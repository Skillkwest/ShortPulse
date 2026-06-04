# Authoritative Unit Pricing Runtime Calculation Plan

Date: 2026-06-03  
Owner surface: Money Stuff  
Status: planning recommendation

## Purpose

Define the migration plan for moving AI usage pricing from "final materialized billed rows everywhere" toward "Scott-owned authoritative unit pricing plus ShortPulse runtime quantity calculation."

This plan starts with the Create panel, but it must also cover Edit, Video, Sound, and the child workflows inside those panels.

## Locked Truth

The following rules are already accepted and should not be re-debated during implementation:

- Scott's pricing page stays the authority for the base priced variant and its unit economics.
- Scott's pricing page implementation, calculator behavior, workbook math, and simulations must remain untouched by this lane.
- ShortPulse runtime is responsible for counting the real payload quantity for the workflow being submitted.
- Generate button display and actual server debit must use the same final calculated billed-credit result.
- Missing authority data must fail closed instead of falling back to guessed pricing.

## Requested Pricing Model

The target pricing model is:

1. Scott's grid defines the correct canonical variant row.
2. That row exposes the authoritative unit economics for the variant.
3. ShortPulse counts the actual quantity being sent in the real payload.
4. ShortPulse derives the final billed amount from that authority.
5. The Generate button shows that amount.
6. The debit path charges that exact same amount.

This means we are not asking Scott to author a separate manual row for every possible quantity combination when the pricing rule is truly unit-based.

## Current Repo Reality

### What already exists

- The admin pricing page already expresses the workbook math and unit-pricing intent for:
  - image families such as `gpt-image-2-per-image`, `nano-banana-2-per-image`, `seedream-per-image`, and `seedream-5-lite-per-image`
  - video families such as `veo-3-per-second`, `kling-3-per-second`, and `seedance-2-per-second`
  - sound families such as `elevenlabs-music-per-minute`, `elevenlabs-sound-effect`, `elevenlabs-text-to-speech-per-kchar`, and `elevenlabs-voice-changer-per-minute`
- The runtime pricing strategy functions already encode most of the quantity math.
- `pricingParams.ts` already normalizes the real payload dimensions we would need for a shared quantity-aware resolver.

### What does not yet exist

- The control-plane pricing policy document does not yet expose a machine-readable quantity-rule contract.
- Runtime still largely consumes either:
  - explicit `billedCreditsOverride` rows, or
  - direct strategy math through `computeCostForModel(...)`
- The admin pricing state route still exposes preview variants, not a reusable authority contract that says:
  - the unit basis for the row
  - the quantity driver to apply
  - how final billed credits should be derived from the workbook authority

## Source Of Truth

- Scott-owned pricing page and workbook math:
  - `frontend/pages/admin/pricing.tsx`
  - `frontend/pages/api/admin/pricing/state.ts`
  - `frontend/features/admin/pricingWorkbookMath.ts`
  - `frontend/features/admin/pricingAnalysis.ts`
  - `frontend/features/admin/pricingCostDocs.ts`
- Current runtime policy and pricing resolution:
  - `frontend/lib/model-runtime/pricingPolicy.ts`
  - `frontend/lib/model-runtime/pricingStrategies.ts`
  - `frontend/lib/model-runtime/pricing.ts`
  - `frontend/lib/model-runtime/materializeImageBilledCreditPolicy.ts`
- Shared workflow-normalization and debit seams:
  - `frontend/lib/server/api/generationBilling/pricingParams.ts`
  - `frontend/lib/server/api/generationBilling.ts`
- Current button-display seam:
  - `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- Current client policy distribution seam:
  - `frontend/pages/api/pricing/model-policy.ts`
- Current route-level and child-workflow pricing seams:
  - `frontend/features/ai-studio/routes/AiStudioRouteApp.tsx`
  - `frontend/features/ai-studio/components/MusicPropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/SoundEffectsPropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx`
- Current observability and support seams:
  - `frontend/pages/api/admin/generation-trace.ts`
  - `frontend/pages/api/admin/billing-diagnostics.ts`

## Architecture Gap

Today the runtime policy document can store:

- `billedCreditsOverride`
- `providerUsdOverride`
- `providerUsdPerSecondOverride`
- `markupBps`
- `creditUsdScale`
- `roundingIncrement`

But it cannot yet express:

- unit basis such as `per_image`, `per_second`, `per_minute`, or `per_1k_chars`
- quantity driver such as `input_image_count`, `duration_seconds`, `source_duration_seconds`, `generation_count`, or `text_characters`
- whether final billed credits should be:
  - operator-authored directly, or
  - workbook-derived from authoritative unit inputs plus quantity

That missing machine-readable bridge is the main reason runtime keeps collapsing back to materialized rows or direct strategy math.

## Required Decision Gate

Before implementation starts, one architectural decision must be made explicitly for each priced family:

- when Scott's authority should provide a direct final `Billed credits` value
- versus when ShortPulse should derive final billed credits from:
  - authoritative unit economics
  - authoritative markup / credit-scale / rounding rules
  - and real payload quantity

This decision cannot stay implicit, because it determines:

- which fields the authority contract must expose
- whether runtime is allowed to calculate a final billed value
- and whether production mismatches should be treated as:
  - missing authority data
  - or bad runtime quantity calculation

Default recommendation:

- use direct final `Billed credits` when Scott needs explicit manual control over the exact output
- use runtime-derived billed credits when the row is intentionally quantity-based and Scott's calculator already defines the unit rule clearly

## Target Runtime Contract

Introduce a machine-readable authority contract that preserves Scott's calculator ownership while giving ShortPulse enough structured data to derive final billed credits correctly.

Minimum required fields per authoritative priced row family:

- canonical model id
- canonical workflow or operation lane
- canonical row identity or base variant identity
- unit basis:
  - `flat`
  - `per_image`
  - `per_second`
  - `per_minute`
  - `per_1k_chars`
  - `per_50k_chars`
  - `per_1m_tokens`
- quantity driver:
  - `generation_count`
  - `input_image_count`
  - `output_image_count`
  - `duration_seconds`
  - `source_duration_seconds`
  - `input_video_count`
  - `text_characters`
  - or another explicit named driver if needed
- provider-cost authority inputs:
  - direct billed-credit override when Scott wants an exact final value
  - or authoritative unit-cost inputs plus markup/credit-scale/rounding rules when runtime should derive the total
- any fixed variant dimensions that select the row:
  - aspect
  - resolution or quality
  - audio mode
  - input fidelity
  - mask sensitivity

## Shared Runtime Resolver Plan

Build one shared quantity-aware pricing resolver that:

1. accepts normalized workflow params from `pricingParams.ts`
2. reads the new authoritative unit-pricing contract
3. resolves the canonical base priced row
4. counts the real runtime quantity for the request
5. derives final billed credits from the authority contract
6. returns one result that both button display and debit can use

This shared resolver should become the canonical runtime seam for:

- Create
- Edit
- Video
- Sound

The shared resolver must be consumed by all of these runtime surfaces, not just the main page view-model:

- top-level Generate buttons
- child workflow buttons and local property panels
- expert edit size or variant pricing helpers
- model picker and variant picker cost chips
- prompt-reference / secondary action cost surfaces
- regenerate actions and optimistic debit flows
- submit metadata and observability payloads
- server debit and reservation paths

## Freshness And Distribution Contract

The authority contract must preserve one pricing snapshot across:

- the client policy route
- button display
- submit metadata
- and debit

Do not allow one surface to read a fresher or older authority snapshot than the others.

The migration must explicitly replace or redefine the current image-only materialization behavior in:

- `frontend/pages/api/pricing/model-policy.ts`
- `frontend/lib/model-runtime/materializeImageBilledCreditPolicy.ts`

so the distributed client policy matches the new unit-pricing authority model instead of the old explicit-row image materialization model.

## Workflow Quantity Matrix

The new resolver must support these runtime quantity drivers by family:

### Image

- `GPT Image 2`
  - output image price by canonical create/edit variant
  - input-image surcharge by input count
  - optional mask surcharge when that lane is later reintroduced
- `Nano Banana 2`
  - per-image unit cost by canonical resolution tier
  - runtime quantity based on relevant image count rules for the workflow
- `Nano Banana Pro`
  - same family treatment as `Nano Banana 2`
- `Seedream 4.5`
  - per-image unit cost by canonical resolution family
- `Seedream 5 Lite`
  - per-image unit cost by canonical resolution family

### Video

- `Veo`
  - duration-sensitive or flat-per-video depending on authoritative row family
  - audio mode where applicable
- `Kling`
  - per-second with mode/audio differences
- `Seedance`
  - per-second with resolution and video-input differences

### Sound

- `Music`
  - per-minute from generated duration
  - explicit handling for batched multi-song submits so the authority path defines whether price is per request or per click
- `Sound Effects`
  - per-generation or explicit-duration per-second depending on authoritative lane
- `Voiceover`
  - per character family
- `Voice Changer`
  - per-minute from source duration

## Batch And Regenerate Semantics

The authority contract must define two additional behaviors explicitly:

### Batch semantics

For workflows where one user action can spawn multiple provider requests, define whether:

- the displayed amount is the total per click
- the debit occurs as:
  - one aggregate reservation and capture
  - or one reservation per spawned request

This is especially important for music or any future batched-generation workflow.

Observability must record whichever interpretation is chosen so generation traces do not look mismatched.

### Regenerate semantics

Regenerate actions must use the same authority path as first-run Generate actions.

That includes:

- credit guardrail checks
- optimistic debit placeholders
- displayed override cost where a child workflow supplies one
- final submit metadata
- server debit

## Migration Order

### Phase 1: Authority Contract Design

Done means:

- we define the machine-readable unit-pricing contract shape
- we choose where it lives in the pricing control-plane / admin state payload
- we define when Scott authors direct final billed credits versus when runtime derives them from unit economics
- we preserve Scott's existing calculator behavior and numbers

### Phase 2: Create Image

Scope:

- standard Create
- Create with refs
- Character Mode Create
- model picker credit chips
- prompt-reference and adjacent Create-side credit indicators
- button display
- submit metadata
- debit path

Key quantity drivers:

- input image count
- output count where applicable
- resolution / quality
- aspect

Done means:

- Create image button pricing comes from the new quantity-aware authority path
- Create image debit uses the same path
- display and debit match

### Phase 3: Edit Image

Scope:

- standard Edit launch paths
- single-ref and multi-ref Edit where supported
- GPT edit-like runs under the new quantity rule
- expert edit size or variant cost helpers that currently estimate price outside the main button path

Deferred from this phase unless explicitly reintroduced:

- inpaint
- markup
- mask-driven edit pricing

Key quantity drivers:

- input image count
- aspect
- resolution / quality
- input fidelity

Done means:

- Edit button pricing and debit both use the quantity-aware authority path
- unsupported deferred features remain clearly out of scope and fail safely

### Phase 4: Video

Scope:

- all launch video workflows and child lanes

Key quantity drivers:

- duration seconds
- input video count
- resolution
- audio on/off

Done means:

- Video button and debit no longer rely on standalone runtime math as final authority
- they use the shared quantity-aware authority contract

### Phase 5: Sound

Scope:

- music
- sound effects
- voiceover
- voice changer
- any sound child workflow in launch scope
- local component-level credit indicators in sound property panels

Key quantity drivers:

- duration seconds
- source duration seconds
- text characters
- generation count if applicable

Done means:

- Sound button and debit use the same shared quantity-aware authority path

## Panel-By-Panel Current Risk

### Create

- partially migrated today
- image lanes have some strict billed-row logic already
- current image strict-row system is not the right long-term shape for quantity-based pricing

### Edit

- partially migrated today
- standard launch image edit has strict-row work
- not yet on a true quantity-aware authority contract

### Video

- still mostly runtime-math driven through `resolveClientPricingBreakdown(...)` and shared debit logic

### Sound

- still mostly runtime-math driven through `resolveClientPricingBreakdown(...)` and shared debit logic

## Non-Negotiables

- Do not rewrite Scott's pricing page.
- Do not fork Scott's workbook math into a second calculator.
- Do not let button display use one quantity rule while debit uses another.
- Do not let child workflow price badges or secondary action surfaces keep using legacy client math after their parent lane migrates.
- Do not add hidden fallbacks that guess prices when authority data is missing.
- Do not continue lane-by-lane patching without first defining the new authority contract.

## Proof Required Per Phase

For each migrated lane:

1. repo audit proving button display and debit use the same shared quantity-aware resolver
2. targeted tests covering:
   - canonical row selection
   - quantity counting
   - final billed-credit derivation
   - fail-closed behavior
   - child workflow display parity where that lane has local component-level pricing
   - regenerate parity where the lane supports regenerate
   - batch-submit parity where one user action can create multiple requests
3. production smoke checks for at least one real path per unique priced behavior
4. proof that observability metadata records the same billed amount shown to the user and charged on submit

## Immediate Next Slice

The next implementation step should be:

1. define the new authoritative unit-pricing payload shape
2. decide which current pricing-page outputs can be reused as-is
3. decide which new structured fields must be added so runtime can derive quantity-based totals without guessing
4. decide how `/api/pricing/model-policy` distributes the new authority contract without preserving the old image-row materialization assumption
5. decide how observability fields such as `pricing_display_source` and `displayed_billed_credits` should identify the new authority path
6. decide per-request versus per-click semantics for batch workflows before migrating Sound or any multi-submit lane
7. implement the shared resolver against that contract for Create image first

## Phase 0 Checklist

Before Phase 1 implementation begins, complete this checklist:

1. choose the direct-final-vs-runtime-derived rule for each pricing family
2. define the machine-readable unit basis enum and quantity-driver enum
3. define where that data lives:
   - control-plane pricing policy document
   - admin pricing state route
   - or both
4. define whether existing `pricingPreviewVariants` remain preview-only or become partially superseded by the new authority payload
5. define one canonical return shape for:
   - button display
   - guardrail
   - submit metadata
   - debit
6. define fail-closed behavior when:
   - canonical base row is missing
   - quantity driver is unavailable
   - direct final billed value is required but absent

## Recommendation

Do not start broad panel rewiring yet.

Start with the authority-contract design and the shared resolver design, then migrate:

1. Create image
2. Edit image
3. Video
4. Sound

That is the smallest path that preserves Scott's pricing page ownership while making ShortPulse responsible for the real payload-based quantity calculation.
