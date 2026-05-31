# Create Admin-Priced Billed Credit Implementation Plan

Date: 2026-05-30  
Owner surface: Money Stuff  
Status: active execution plan

## Purpose

Define the smallest executable plan for migrating the Create lane onto admin-priced canonical `Billed credits` variant rows without creating a temporary display/debit split.

This plan exists because Create already has live authority drift and because some Create submits are not pure text-to-image runs even when the panel looks like Create.

## Done Means

The Create lane is done only when all billed Create actions use one canonical billed-credit lookup result for:

1. the visible Create `Generate` button
2. model picker credit chips shown in Create context
3. Create agent-output generate shortcuts
4. required-credit guardrails and optimistic debit
5. submit metadata and observability payloads
6. actual server debit

Create is not done if any of those still read shared-policy/runtime math or if any missing canonical row can fall back to an estimate.

## In Scope

- Standard Create button pricing
- Create model-modal credit chips
- Create agent-output generate pricing
- Create submit metadata and generation-trace parity
- Create server debit authority
- fail-closed handling when a billed Create configuration has no canonical row

## Out Of Scope

- Edit migration
- Video migration
- Sound migration
- Scott's admin pricing page implementation or layout
- plan/package/subscription billing
- provider contract pricing math cleanup outside the Create lane

## Source Of Truth

- Canonical authority decision: `docs/adr/0088-admin-priced-billed-credit-authority.md`
- Compact migration plan: `docs/records/artifacts/agent/Money Stuff/reports/2026-05-30-admin-priced-billed-credit-migration-plan.md`
- Create display/runtime consumers under `frontend/features/ai-studio/`
- Create debit path under `frontend/lib/server/api/generationBilling.ts`
- Canonical stored variant data managed through `/admin/pricing`

## Actual Source Problem

Create pricing is not one lane today. It is a cluster of billed sub-lanes that can share the same visible panel while producing different priced operations.

Examples already proven in repo and production:

- Standard Create can be true `text_to_image`.
- OpenAI Create can silently become `image_edit` pricing when references, masks, or internal media refs are present.
- Character Mode can remap a text-to-image model into its paired edit model before submit.
- Create-side agent output generation still bills through the Create generation controller and observability path.

Because of that, `model + aspect + resolution` is not a safe billed-credit key for Create.

## Canonical Create Variant Lookup Key

The Create lookup key must describe the actual billed Create operation, not only the visible selector state.

Minimum required fields for Create:

- `surface`: `create`
- `workflow`: `standard_create`
- `operation`:
  - `text_to_image`
  - `image_edit`
- `model_id`
- `aspect`
- `resolution`
- `input_image_count`
- `input_fidelity`
- `mask_present`

Guidance:

- `input_image_count`, `input_fidelity`, and `mask_present` are required whenever the Create submit path resolves to an edit-priced operation.
- For pure text-to-image Create runs, those edit-only fields should be absent rather than guessed.
- Do not include dimensions in the Create key unless the server debit path can actually distinguish them for Create billing.

## Create Variant Families Scott Must Be Able To Price

Create must support at least these canonical priced families:

1. Standard Create text-to-image

- visible settings:
  - model
  - aspect
  - resolution or quality tier

2. Create edit-like runs triggered from Create context

- examples:
  - GPT Image 2 reference-driven Create
  - mask-backed Create submits
  - internal-media-ref edit submits routed through Create
- required pricing dimensions:
  - model
  - aspect when applicable
  - resolution or quality tier
  - input image count
  - input fidelity
  - mask present

3. Character Mode Create

- priced against the effective submit model, not the pre-toggle text model
- may resolve to paired edit models and therefore must use the edit-like branch of the key when applicable

## Create Consumers That Must Switch Together

### Display

- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePanelProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShellRuntime.ts`

### Create-side action bridges

- `frontend/features/ai-studio/hooks/useAiStudioAgentOutputGenerationBridge.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`

### Guardrail and optimistic debit

- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`

### Submit metadata and observability

- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`

### Actual debit authority

- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationBilling/pricingParams.ts`

## Required Implementation Order

1. Create one canonical Create billed-credit lookup helper that resolves a variant row from the actual Create billed configuration.
2. Switch Create display consumers onto that lookup result.
3. Switch Create guardrail and optimistic-debit consumers onto that same lookup result.
4. Switch Create submit metadata onto that same lookup result.
5. Switch server debit onto that same lookup result.
6. Remove Create access to shared-policy billed-credit fallback authority.

Do not ship any intermediate state where the button and debit read different authorities.

## Fail-Closed Rule For Create

If a billed Create configuration has no canonical priced row:

- disable the Create billed action
- show a clear operator-style message
- do not estimate
- do not fallback to shared-policy math
- do not submit

This rule applies to:

- main Create `Generate`
- Create agent-output generate actions
- any other billed Create child action that would otherwise launch a run

## Explicit Non-Goals

These are not part of the Create migration stop condition:

- rewriting Scott's admin pricing page UX
- cleaning all shared-policy code out of unrelated lanes
- solving FLUX Create availability in the same change unless Create lookup work proves it is directly blocking authority cutover
- migrating Edit, Video, or Sound early

## Create State Boundary

The canonical Create billed-credit authority in this lane is image-based only.

Persisted or restored Create `video` state should not receive new canonical Create pricing rows. The implementation should normalize that stale state out of the Create billed path or reject it fail-closed, because the active Standard Create primary submit path already forces image generation rather than a true Create-video workflow.

## Proof Required Before Create Closeout

Repo proof:

- targeted tests showing Create lookup parity for:
  - standard text-to-image
  - edit-like Create variants
  - Character Mode effective submit variants
- tests proving missing Create rows fail closed
- tests proving display and debit use the same canonical row

Production proof:

- one real Standard Create run where:
  - pricing grid billed credits
  - visible button credits
  - actual debit
  - final balance delta
    all match
- one real edit-like Create run from Create context with the same four-way parity
- `/admin/generation-trace` spot-check showing no display-vs-debit mismatch for those Create paths

## Recommended Immediate Next Task

Implement the Create lookup contract itself:

1. define the stored canonical row matcher for the Create key above
2. replace Create display authority with that matcher
3. switch Create debit to that same matcher
4. add fail-closed behavior for unmatched Create rows
