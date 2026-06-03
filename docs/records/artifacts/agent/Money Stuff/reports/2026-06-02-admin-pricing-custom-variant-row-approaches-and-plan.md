# Admin Pricing Custom Variant Row Approaches And Plan

Date: 2026-06-02  
Owner surface: Money Stuff  
Status: planning recommendation

## Purpose

Choose the best way to let `/admin/pricing` add a new row under a model without changing:

- any existing visible rows
- any current numbers
- any current calculator math
- or any current priced authority for existing configurations

The requested feature is specifically: add a new row that behaves like the existing pricing-grid rows and uses the same calculator path.

## Locked Constraints

1. Existing grid rows must remain unchanged in shape, ordering behavior, and values unless the operator explicitly edits them.
2. Existing pricing formulas, markup math, rounding behavior, and provider-cost calculations must stay canonical and reused.
3. A new row must behave like a real workbook row, not a fake note row.
4. The feature must not create hidden collisions in:
   - workbook drafts
   - plan-margin simulator rows
   - usage-mix analysis rows
   - saved admin workspace state
5. The implementation should respect the current authority direction in `docs/adr/0088-admin-priced-billed-credit-authority.md`.

## Non-Negotiables

- Existing built-in rows stay present and numerically unchanged unless the operator edits their pricing inputs directly.
- Existing calculator math stays canonical. Custom rows may not introduce a second math path.
- Display identity and pricing identity must remain separate:
  - `displayRowId` for UI/runtime bookkeeping inside `/admin/pricing`
  - `variantId` for canonical pricing resolution
- The feature may author row presence and row spec only. It may not rely on fake pricing overrides just to preserve a row.
- Phase 1 must not silently expand runtime billing authority beyond what is explicitly chosen in the rollout plan.

## Implementation Update

The implemented admin pricing custom-row feature intentionally relaxes one planning assumption:

- custom rows may now target the same canonical `variantId` as an existing built-in row or another custom row

That change was necessary to ship a usable `Add custom variant` button with the current catalog, because the built-in grid already expands the currently supported canonical variants for shared-policy models.

The guardrail that replaces the old duplicate block is:

- built-in rows remain untouched
- custom rows get their own `displayRowId`
- custom rows carry their own row-local pricing overrides inside the custom-row manifest
- all numeric calculations still run through the existing workbook helpers

So the implementation keeps one calculator path, but it now allows multiple display rows to reuse the same canonical pricing identity while preserving independent custom-row edits.

## Current Repo Reality

The pricing page does not currently have a first-class concept of operator-authored extra rows.

Today the visible row set is derived from:

- model metadata in the pricing catalog
- expansion rules in `frontend/lib/model-runtime/pricingGridVariantRules.ts`
- computed preview variants in `frontend/features/admin/pricingCostDocs.ts`

The current workspace also assumes row identity is effectively:

- `modelId + variantId`

That assumption is reused across:

- workbook display rows
- pricing analysis rows
- usage mix selectors
- support-strip simulator rows
- local workspace persistence
- model-scoped aspect/resolution/audio draft state

Because of that, a naive "duplicate the row in the table" approach would create collisions.

Additional audit findings from the current source:

- `useAdminPricingPageState` currently computes `displayedModels` and `modelEconomicsRows` from model-scoped drafts, not row-scoped drafts, so custom rows cannot reuse that state shape directly.
- `PricingUsageMixSection` currently selects rows by `${modelId}:${variantId}`, which means duplicate canonical variants would become ambiguous.
- `PricingCalculatorSupportStrip` currently keys expanded variant rows by `${compositeKey}:${row.variantId}`, so duplicate canonical variants would collide there too.
- `pricingWorkspacePersistence` currently stores only model-scoped spec drafts and usage-mix rows keyed by `modelId` / `variantId`, so the draft snapshot contract needs an explicit revision.
- `useAdminPricingPageState` currently treats unsaved state as `modelPolicyDirty` and uses that same flag to drive save/reset affordances in the pricing status bar, so custom-row changes must integrate into the existing dirty-state contract rather than creating a hidden second unsaved state.
- `resetModelPolicyDraft()` currently resets workbook, simulator, and usage-mix draft state together, so custom-row draft state must participate in the same reset semantics.
- usage-mix defaults are currently seeded from `modelEconomicsRows[0]`, so built-in row ordering must remain stable or the default seed behavior will change unintentionally.

## New Feasibility Finding From Implementation Start

A repo-backed feasibility pass against the current pricing catalog and current `buildDraftPricingPreviewVariants(...)` behavior found no currently addable canonical variants.

What that means:

- The current shared-policy row builder already expands today’s supported catalog models into their full set of canonical preview variants.
- Under the current non-negotiables, there is no honest `Add Variant` button to show right now because there is no remaining distinct canonical row for the operator to add.
- A visible add-button workflow only becomes real if one of these changes:
  - the catalog begins withholding supported canonical variants from the built-in grid
  - the custom-row feature is explicitly allowed to author a new kind of row identity beyond current canonical variant resolution
  - or the non-negotiables are relaxed to permit duplicate canonical variants, which this plan does not recommend

Immediate implication:

- The foundation work remains useful for durable custom-row manifests and merged display support.
- The visible add-row UI should stay blocked until the product decides which of the three changes above is actually desired.

## Current Pricing Page Behavior To Preserve

The plan must preserve these current pricing-page behaviors exactly unless a later explicit feature asks to change them:

1. **Calculator path**

- Built-in workbook rows derive preview variants through `buildDraftPricingPreviewVariants(...)`.
- Workbook numbers then flow through the existing helpers:
  - `getEffectiveProviderCostUsd(...)`
  - `getCreditsAtProviderCost(...)`
  - `getWorkbookBillableCredits(...)`
  - `getWorkbookBillableUsd(...)`
- Custom rows must call those same helpers with resolved spec inputs. Do not replace or fork them.

2. **Model-level search and sort**

- The page searches and sorts at the model level first.
- Expanding a model reveals that model’s variant rows.
- Custom rows must not change model-level search/sort semantics.

3. **Built-in row ordering**

- Existing computed rows remain the baseline row set.
- Their current ordering behavior under the selected sort option must remain unchanged.
- Custom rows may appear in addition to them, but may not reshuffle the built-in rows.

4. **Support-strip / analysis parity**

- The support strip and usage-mix analysis consume the same model-economics row family as the workbook.
- Custom rows must enter through the same merged row builder so there is no workbook-vs-analysis drift.

5. **Save / reset / rollback contract**

- The existing pricing status bar owns the route’s unsaved-state behavior.
- Custom-row changes must show up through that same save/reset affordance.
- Reset must return the workbook to the live pricing snapshot plus live custom-row manifest.
- Rollback must restore the previous live pricing snapshot plus previous live custom-row manifest if custom rows are versioned with policy.

6. **Catalog sections stay untouched**

- Plans, credit packages, storage add-ons, and their existing draft flows are out of scope for this feature.
- The custom-row work belongs to the pricing-grid and its analysis companions only.

## Approaches Considered

### Approach A: Workspace-Local Display Overlay Only

Add custom rows only in browser-local admin workspace state. Do not persist them in the control plane.

How it works:

- Add a new `customRows` array to admin workspace local storage.
- Each custom row stores a `displayRowId`, `modelId`, row-specific spec config, and resolved `variantId`.
- Merge those rows into workbook rendering and analysis modules locally.
- Existing policy save/apply remains unchanged.

Pros:

- Smallest implementation surface
- Low backend risk
- No SQL or RPC changes
- Safest first prototype

Cons:

- Rows disappear outside the current browser/workspace unless separately re-authored
- Not durable enough for operator truth
- Weak fit for a pricing command center where authored pricing state should survive refresh/device changes

Verdict:

- Good prototype path
- Not the best final approach

### Approach B: Persist Extra Rows Indirectly Through Policy Variant Overrides Only

Try to make extra rows durable by inferring them from `policy.perModel[modelId].variants[variantId]`.

How it works:

- Add a row in the UI
- Resolve a canonical `variantId`
- Persist only pricing overrides under that variant key
- Rebuild the custom row later by scanning policy variant keys

Pros:

- Reuses the existing policy document
- No parallel persistence object required
- Good alignment with current runtime pricing keys

Cons:

- Cannot persist a new row with zero pricing changes, because empty variant overrides are compacted away
- Display intent becomes coupled to price overrides
- Forces fake/no-op overrides if the operator wants a row only for calculator visibility
- Harder to distinguish built-in rows from operator-added rows

Verdict:

- Too brittle
- Violates the constraint that we should not invent fake data just to keep a row alive

### Approach C: Versioned Custom Row Manifest Stored Alongside The Pricing Policy

Add a separate custom-row manifest as versioned admin-pricing metadata while keeping all math and policy overrides canonical.

How it works:

- Introduce a versioned `display manifest` for admin pricing custom rows
- Each custom row stores:
  - `displayRowId`
  - `modelId`
  - row-scoped spec configuration
  - resolved canonical `variantId`
  - ordering metadata
  - optional operator label/note if desired later
- The page merges:
  - built-in computed rows
  - custom manifest rows
- All cost math still resolves through the existing calculator and policy helpers
- Policy overrides remain keyed by canonical `variantId`
- The custom row manifest exists purely to preserve operator-authored row presence and row-level spec intent

Pros:

- Preserves existing rows untouched
- Preserves existing calculator math untouched
- Gives durable operator-authored row presence without fake overrides
- Separates display identity from pricing identity cleanly
- Supports future runtime-authority migration without redesigning row identity again

Cons:

- Larger implementation than a local-only overlay
- Requires backend/control-plane contract expansion
- Needs careful merge logic in workbook/analysis/simulator paths

Verdict:

- Best final approach

### Approach D: Expand The Default Catalog/Rule System So The New Row Becomes A Built-In Row

Add more allowed resolutions/aspects/audio/video-input combinations so the row appears automatically in the default computed set.

Pros:

- Simple mental model
- No separate custom-row concept

Cons:

- Changes the default row inventory for everyone
- Breaks the constraint that current rows and current page behavior stay untouched
- Pushes operator authoring into catalog/rules code instead of the admin pricing workspace

Verdict:

- Reject

## Chosen Approach

Choose **Approach C: Versioned Custom Row Manifest Stored Alongside The Pricing Policy**.

This is the best fit because it gives us:

- no math rewrite
- no mutation of current rows
- no fake pricing overrides
- durable authored state
- a clean future path if these rows later need stronger runtime significance

## Persistence Decision Record

The plan needs one explicit persistence choice before implementation starts.

### Option 1: Companion versioned control-plane document

Store `customRows` beside the pricing policy inside the same versioned admin-pricing mutation flow.

Pros:

- smallest durable extension of the current apply/rollback model
- custom-row state can move with the pricing version that authored it
- easier to preserve admin pricing workspace snapshots as one coherent operator artifact

Cons:

- expands the current control-plane payload shape
- requires careful backward compatibility for older versions with no custom-row manifest

### Option 2: Dedicated table-backed manifest

Store custom rows in their own table with explicit version linkage.

Pros:

- strongest queryability and explicit schema
- easier future analytics if row authoring history becomes important

Cons:

- larger SQL/RPC surface
- more migration overhead than the current feature appears to need

### Current recommendation

Prefer **Option 1: companion versioned control-plane document** unless implementation uncovers a hard requirement for row-level querying outside `/admin/pricing`.

Reason:

- this feature is primarily an operator-authoring concern
- the repo already treats admin pricing as a versioned control-plane mutation surface
- we want the smallest durable extension that still keeps apply/rollback coherent

## Recommended Architecture

Separate row identity into two layers:

1. **Display identity**

- `displayRowId`
- unique only for the admin pricing workspace
- used by React keys, ordering, local draft state, and UI actions

2. **Pricing identity**

- `variantId`
- canonical key resolved from the real billed configuration
- used for calculator math and policy overrides

This split is the key architectural move that prevents collisions.

## Suggested Data Model

Add a versioned custom-row manifest entry shaped roughly like:

```ts
type AdminPricingCustomRow = {
  displayRowId: string;
  modelId: string;
  baseVariantId: "default" | "create" | "edit";
  aspect: string | null;
  resolution: string | null;
  audio: boolean | null;
  videoInput: boolean | null;
  inputImageCount: number | null;
  inputFidelity: string | null;
  maskPresent: boolean | null;
  variantId: string;
  sortAfterVariantId: string | null;
  label: string | null;
  createdAt: string;
};
```

Notes:

- `variantId` should be server-verified from the spec config, not accepted blindly from the client.
- The manifest should not store pricing numbers.
- The manifest should not replace policy overrides.
- Existing built-in rows do not need `displayRowId` migration if we derive synthetic built-in ids at render time.

Suggested supporting draft state:

```ts
type AdminPricingCustomRowDraft = {
  displayRowId: string;
  modelId: string;
  baseVariantId: "default" | "create" | "edit";
  aspect: string | null;
  resolution: string | null;
  audio: boolean | null;
  videoInput: boolean | null;
  inputImageCount: number | null;
  inputFidelity: string | null;
  maskPresent: boolean | null;
};
```

Important:

- custom-row draft state must be row-scoped
- existing model-scoped draft maps may continue to power built-in rows only
- do not retrofit custom rows onto the current `aspectDrafts[modelId]` / `resolutionDrafts[modelId]` / `audioDrafts[modelId]` maps

## Ordering Rules

- Built-in rows remain first within a model.
- Custom rows appear only inside that model’s expanded variant section.
- Default phase-1 ordering should be append-only after the built-in rows for that model.
- Reordering, if added later, is in-model only and never across models.
- `sortAfterVariantId` should be treated as best-effort placement metadata within one model, not as a global row ordering system.
- Built-in row sort order under the active model sort option stays authoritative for built-in rows.
- Custom rows must not change the first built-in row used today as the default seed input for usage-mix defaults.

## Best Rollout Shape

### Phase 1: Introduce The Custom Row Manifest Without Changing Pricing Math

Goal:

- create a durable place for operator-authored extra rows

Tasks:

- extend admin pricing state to return `customRows`
- extend admin pricing apply flow to save both:
  - `policy`
  - `customRows`
- load/save local workspace drafts with `customRowsDraft`
- extend apply verification semantics so the server confirms both the saved policy and saved custom-row manifest, not only the policy document
- define one explicit backward-compatible payload shape for versions that have no custom-row manifest

Stop boundary:

- no UI button yet
- no visible behavior change
- old policy versions with no manifest still load cleanly
- manifest read failure degrades to built-in rows only and does not break `/admin/pricing`
- existing save/reset/rollback behavior for pure built-in edits remains unchanged

### Phase 2: Add Row Authoring UI Under Each Expandable Model

Goal:

- let the operator click `Add Variant`

Tasks:

- add `Add Variant` button in the expanded model section
- open a constrained row editor using only supported dimensions for that model
- resolve canonical `variantId` from that editor state
- block save when the resolved `variantId` already exists in:
  - built-in rows
  - existing custom rows for that model

Stop boundary:

- row can be created and persists
- existing rows remain untouched
- duplicate canonical variants are rejected before save
- row editor exposes only dimensions supported by the selected model
- row creation alone does not modify any built-in row pricing values

### Phase 3: Merge Custom Rows Into Workbook Rendering

Goal:

- make custom rows behave like existing workbook rows

Tasks:

- create one row-builder helper that merges:
  - built-in computed rows
  - custom manifest rows
- assign synthetic `displayRowId`s to built-in rows and real `displayRowId`s to custom rows
- keep all math flowing through the current calculator helpers
- preserve built-in row derivation and built-in row ordering exactly as they work today

Stop boundary:

- custom rows show provider cost, credits at cost, billed credits, billed USD, and margin through the same math path
- built-in row counts and built-in row numbers remain unchanged when no custom rows exist
- merged workbook rows use `displayRowId` for React/UI identity
- built-in row counts and numbers remain unchanged even when custom rows exist

### Phase 4: Extend Analysis And Simulator Consumers

Goal:

- make custom rows participate everywhere the workbook rows matter

Tasks:

- update `pricingAnalysis.ts`
- update `PricingCalculatorSupportStrip.tsx`
- update `PricingUsageMixSection.tsx`
- update workspace persistence sanitizers and selected-row lookup logic
- preserve the current usage-mix default seed behavior by keeping built-in-first ordering stable
- replace any row-key or select-value assumptions that rely only on `${modelId}:${variantId}`

Stop boundary:

- custom rows behave like first-class selectable rows in support-strip and usage-mix analysis
- usage mix can select custom rows without ambiguous `${modelId}:${variantId}` collisions
- simulator/support-strip expanded row keys no longer collide on shared `variantId`
- support-strip totals and usage-mix totals remain unchanged when no custom rows exist

### Phase 5: Guardrails And Polishing

Goal:

- prevent collisions and operator confusion

Tasks:

- duplicate prevention by resolved `variantId`
- model-scoped validation so only supported dimensions can be chosen
- clear row labels such as `Custom Variant 1`
- optional delete/remove custom row action
- clear visual distinction between built-in rows and custom rows if needed, but without changing the current built-in row presentation

Stop boundary:

- feature is safe for operator use
- delete/remove custom row does not mutate built-in rows or unrelated policy overrides
- rollback to a version without custom rows removes only the authored custom rows from that version

## Failure And Rollback Rules

- If the custom-row manifest fails to load, `/admin/pricing` must still render built-in rows and surface a clear operator warning instead of failing the whole pricing workspace.
- If a custom row references a model that is no longer present in the pricing catalog, the row should be ignored in live rendering and surfaced in admin diagnostics as stale manifest data.
- If a custom row’s stored spec can no longer resolve to a valid canonical `variantId`, the row should fail closed and remain non-interactive until repaired or removed.
- Rolling back to an earlier pricing version must restore that version’s custom-row manifest exactly; it must not merge manifests across versions.
- Deleting a custom row must remove only that row’s manifest entry. It must not automatically remove a surviving policy override unless no visible row still depends on that override and the operator explicitly confirms cleanup.
- If a save fails after local custom-row edits, the page must preserve local draft state exactly as it already does for existing pricing edits; it must not silently drop custom-row drafts.

## Dirty-State And Confirmation Contract

- Extend the current route-level unsaved-state concept rather than creating a second hidden draft status.
- The pricing status bar should reflect pending custom-row changes through the same visible unsaved cue already used for policy edits.
- Save confirmation should gain a custom-row summary line when custom rows were added, removed, or reordered.
- Reset should restore:
  - live policy document
  - live custom-row manifest
  - built-in model-scoped drafts
  - custom-row row-scoped drafts
- Rollback confirmation should explain whether it restores only policy or policy plus custom-row manifest depending on the final persistence design.

## Touched Areas

Expected primary touch set:

- `frontend/features/admin/PricingModelWorkbookTable.tsx`
- `frontend/features/admin/PricingModelWorkbook.tsx`
- `frontend/features/admin/logic/useAdminPricingPageState.ts`
- `frontend/features/admin/logic/pricingWorkspacePersistence.ts`
- `frontend/features/admin/pricingAnalysis.ts`
- `frontend/features/admin/PricingCalculatorSupportStrip.tsx`
- `frontend/features/admin/PricingUsageMixSection.tsx`
- `frontend/features/admin/types.ts`
- `frontend/lib/model-runtime/modelPricingVariants.ts`
- `frontend/pages/api/admin/pricing/state.ts`
- `frontend/pages/api/admin/pricing/model-policy/apply.ts`
- `frontend/lib/server/api/modelPricingControlPlane.ts`
- SQL/RPC layer for versioned manifest persistence

Likely new helper seams:

- `frontend/features/admin/pricingCustomRows.ts`
- `frontend/features/admin/pricingCustomRowValidation.ts`
- `frontend/features/admin/pricingCustomRowMerge.ts`

## Why This Beats A Simpler Table-Only Button

The table-only version looks cheap, but it would be misleadingly expensive later because:

- row identity collisions already exist in downstream consumers
- current spec drafts are model-scoped, not row-scoped
- the control plane has no durable concept of an extra row today
- a fake duplicate row would force either collisions or fake overrides

The chosen approach solves those root seams directly instead of layering a brittle UI trick on top.

## Risks To Plan Around

1. **Row-scoped vs model-scoped drafts**

- Existing aspect/resolution/audio drafts are keyed by `modelId`
- custom rows need row-scoped spec state
- built-in row state and custom-row state should remain separate rather than forcing one shared draft map

2. **Persistence contract growth**

- the apply/state control-plane surface will need to carry more than the policy document alone

3. **Analysis parity**

- custom rows must flow through the same merged row builder as the workbook
- otherwise support-strip and usage-mix will drift immediately

4. **Authority confusion**

- this feature must not imply that a custom row automatically changes runtime authority for unrelated built-in rows

5. **Version compatibility**

- older pricing versions and older workspace drafts without `customRows` must continue to deserialize safely

6. **Calculator behavior drift**

- a careless merge could accidentally alter built-in row ordering, the usage-mix default seed row, or save/reset semantics even if the math helpers stay unchanged

## Explicit Out Of Scope

- arbitrary/manual math entry that bypasses the current calculator helpers
- changing built-in catalog expansion rules just to make custom rows easier
- cross-model custom row ordering
- making custom rows runtime billing authority in phase 1 unless a later explicit plan chooses that cutover
- broad redesign of Scott's current pricing workbook presentation

## Validation Plan

Required test groups:

1. **Workbook rendering**

- built-in rows remain unchanged
- custom rows render beneath the correct model
- duplicate `variantId` creation is blocked

2. **Persistence**

- custom rows round-trip through workspace draft storage
- custom rows round-trip through admin pricing state/apply persistence
- older snapshots without custom rows still load safely

3. **Analysis parity**

- support-strip sees custom rows
- usage-mix selector sees custom rows
- selected custom rows compute the same numbers as workbook rows
- support-strip expansion and usage-mix selection use collision-safe row identity

4. **No-math-regression**

- existing pricing-grid invariant tests remain green
- existing built-in row counts remain unchanged for models without custom rows
- existing built-in workbook row values remain unchanged for models without custom rows
- existing built-in workbook row values remain unchanged when custom rows are present
- existing support-strip and usage-mix totals remain unchanged when custom rows are absent

5. **Rollback / failure handling**

- manifest-missing versions render safely
- stale custom rows fail closed without crashing the pricing page
- rollback restores the earlier manifest exactly

6. **Pricing-page behavior preservation**

- existing model-level search/sort behavior remains unchanged
- existing save/reset/rollback affordances remain unchanged for built-in-only edits
- existing usage-mix default seed remains unchanged
- existing built-in row order remains unchanged under every current sort option

## Concrete Recommendation

Build this as:

- **durable custom-row manifest**
- **displayRowId / variantId split**
- **row-scoped spec editor**
- **merged row-builder reused by workbook + analysis**

Do **not** build it as:

- local-only state unless intentionally prototyping
- a fake duplicate of an existing row
- policy-only inferred row persistence
- catalog/rule expansion that changes the default grid

## Immediate Next Checklist

Before implementation begins, close these planning gates:

1. confirm companion-document persistence vs table-backed manifest
2. define the exact admin pricing state/apply payload additions
3. define the row-scoped draft snapshot contract version bump
4. define duplicate detection semantics for:
   - same model + same `variantId`
   - same model + same spec config before `variantId` resolution
5. define stale-row UI behavior when catalog support drifts

## Suggested Immediate Next Implementation Slice

The best first code slice is:

1. add the custom-row manifest data model
2. carry it through admin pricing state + apply persistence
3. add merge helpers and tests

That slice creates the durable architectural seam first, so the later `Add Variant` button is attaching to stable plumbing instead of inventing it ad hoc inside the table UI.
