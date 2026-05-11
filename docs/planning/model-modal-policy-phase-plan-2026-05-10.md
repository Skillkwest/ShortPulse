# ModelModal Policy Phase Plan (2026-05-10)

## Purpose

Define the next model-platform phase after the durability pass. This phase is scoped to the remaining picker-policy shell in `frontend/features/ai-studio/components/ModelModal.tsx`.

The goal is not to generically "clean up the modal." The goal is to reduce operator churn for picker-visible model onboarding and removal **without** changing UI, UX, or runtime behavior.

## Current Assessment

The repo is in a materially better state than when the model-platform cleanup began:

- model inventory is now operator-only and server-allowlisted
- core runtime policy is much more catalog-backed
- queued Fal/Kie route wrappers now have a shared inventory plus sync/check tooling
- direct OpenAI/ElevenLabs routes now have explicit route-authority inventory
- onboarding and retirement tooling now exist through `model:doctor`, `model:scaffold`, and `model:retire`

The largest remaining concentrated manual surface is `ModelModal.tsx`, which still owns:

- `modelMeta`
- `modelFamilyMeta`
- `familyPriorityByContext`
- `providerPriorityByContext`
- `modelPriorityByContext`
- `resolveModelFamilyKey(...)`

This is no longer pure accidental duplication. Part of it is real product policy.

## Problem Statement

Adding or removing a picker-visible model is still not close to "catalog entry + validation" because picker presentation remains split across:

- catalog/runtime authority in `frontend/lib/model-runtime/modelCatalog.ts`
- modal presentation/order authority in `frontend/features/ai-studio/components/ModelModal.tsx`

That split is acceptable only if we are explicit about which parts are:

1. shared metadata that can safely centralize
2. true product-policy ranking/exposure that should remain manual

Right now that boundary is implicit.

## Non-Negotiable Constraints

- no UI changes
- no UX changes
- no behavior changes
- no ranking changes
- no label/copy changes
- no picker exposure changes
- no model-family reshuffling unless the existing rendered result stays identical

## Phase Goal

Separate **centralizable modal metadata** from **explicit product policy** so that:

- same-family model onboarding/removal touches fewer places
- `ModelModal` stays readable and intentional
- product ranking remains explicit where that is the actual source of truth

## Safe-To-Centralize Scope

These are good candidates for centralization or derivation because they are shared facts more than product-policy judgments:

### 1. Canonical model ids

Continue replacing raw literals with shared constants/selectors where missing.

### 2. Startup-default-driven ordering anchors

Keep deriving the startup slots from catalog selectors rather than duplicating Seedream startup ids in modal-local tables.

### 3. Paired create/edit ordering

Where create/edit ordering is structurally mirrored, prefer deriving the edit order from the create-side family plus `pairedModelId`.

### 4. Family identity for known runtime families

Family-key resolution can likely move to a small shared selector keyed by canonical model ids and provider/runtime facts, as long as rendered grouping stays identical.

### 5. Reusable family logos and provider-logo fallbacks

Shared visual metadata can move out of the component if that reduces duplication without introducing a second presentation database.

## Keep-Explicit Scope

These should remain explicit unless a later, broader presentation-manifest decision is made:

### 1. `familyPriorityByContext`

This is product ranking policy, not runtime fact.

### 2. `providerPriorityByContext`

This is exposure/order policy, not runtime fact.

### 3. `modelPriorityByContext`

This is the strongest manual product-policy surface and should remain explicit unless we intentionally design a higher-level presentation policy plane.

### 4. Marketing/tooltip copy in `modelMeta`

Descriptions and curated tag sets are presentation content, not model runtime governance.

## Recommended Execution Order

### Phase A: Classification Pass

Do not change behavior yet.

1. annotate or document each `ModelModal` table as:
   - shared metadata
   - product policy
   - mixed
2. freeze the current rendered grouping/order contract through tests before refactoring any implementation

### Phase B: Shared Metadata Extraction

Only move the clearly safe subset:

1. family resolution
2. shared logos/fallbacks
3. any remaining startup/pair-derived ordering helpers

Keep all rendered output identical.

### Phase C: Guardrail Expansion

Strengthen tests so the modal can remain partly explicit without drifting:

1. context-by-context family ordering assertions
2. startup anchor presence assertions
3. family grouping assertions for image/video contexts
4. a `model:doctor` check only for the explicit invariants we truly want to lock

## What Not To Do

- do not force all modal state into `modelCatalog.ts`
- do not invent a large presentation schema just to eliminate a few local tables
- do not convert explicit ranking policy into implicit sorting logic
- do not treat marketing copy as runtime metadata
- do not refactor `ModelModal` broadly without adding or strengthening parity tests first

## Acceptance Criteria

This phase is successful when:

- `ModelModal` has a clearer boundary between shared metadata and explicit product policy
- same-family picker-visible model changes require fewer duplicate edits
- all existing modal order/grouping tests still pass
- no UI/UX/behavior changes are introduced
- `model:doctor` and focused modal tests make drift harder in the remaining explicit policy surfaces

## Stop Rule

Stop this phase once:

- the shared-metadata seams are extracted
- the remaining manual tables are intentionally product-policy only
- further cleanup would require inventing a new presentation system rather than reducing real operator cost

At that point, any additional picker-policy work should be treated as a different architectural decision, not more of this phase.
