# Holomony Reference Grid Diagnostic SOP

Purpose: provide the repeatable Reference Grid workflow Holomony uses before changing grid behavior, so fixes target the owning path instead of becoming patches on patches.

## When To Use

Use this SOP for Reference Grid or Quick Slot issues involving:

- slow loading or app lag attributed to the right rail;
- broken, missing, unavailable, or stale media in cards;
- inconsistent spinner/placeholder/loading visuals;
- wrong media, duplicate media, or deleted references still appearing;
- double-click/detail modal source failures from grid surfaces;
- adaptive preview quality or column-density questions;
- restore/refresh/session reliability involving references.

## Done Definition

A Reference Grid task is done when:

- the exact behavioral contract is named;
- the owning layer is identified;
- the fix or handoff addresses that owner path;
- Supabase render-image transforms remain prohibited;
- detail/full-quality behavior is not regressed by card-preview tuning;
- targeted tests or diagnostics cover the changed layer;
- any production-only proof gap is stated clearly.

## Scope Freeze Template

Before edits, write the lane in this shape:

```text
Surface:
Visible symptom:
Likely owner layer:
In scope:
Out of scope:
Source of truth:
Proof before stopping:
Stop state:
```

If any line cannot be answered from current repo evidence, keep auditing instead of editing.

## Diagnostic Order

### 1. Confirm Product Surface

Determine whether the symptom is in:

- Quick Slot Inventory;
- Reference Grid All Refs;
- Canvas/rail interaction;
- Media Library modal opened from the grid;
- Detail modal opened from a grid/right-rail card;
- restore/session state before the grid receives outputs.

Do not assume every right-rail symptom is Reference Grid-owned.

### 2. Classify The Failure Layer

Use the classification in `reference-grid-ownership-map.md`:

- projection/state;
- URL authority;
- hydration/loading;
- render performance;
- detail handoff;
- ingestion/drag;
- upstream failure.

Only edit after one owner layer is strongest. If two layers remain equally plausible, gather more evidence.

### 3. Trace Output Identity

Inspect whether the affected card has:

- stable `id`;
- `mode`;
- `taskState`;
- `mediaSource`;
- `generationId` or `taskId`;
- `savedMediaIds`;
- `previewStoragePath` and `fullStoragePath`;
- `previewUrl`, `previewPosterUrl`, `resultUrls`;
- `hiddenInReferenceGrid`;
- `durationMs` and companion artwork for audio/video cases.

Expected result:

- reusable media has storage or saved-media authority;
- tracked generated media has generation/task identity;
- preview-only media can render temporarily but should not be treated as durable/full-quality authority.

### 4. Trace Projection

Check:

- `selectVisibleAllRefsProjection`;
- `selectQuickSlotProjection`;
- `pruneReferenceProjectionState`;
- `useReferenceGridOutputCollections`;
- `useReferenceGridOutputViewModels`;
- output selector-store usage versus direct parent props.

Questions:

- Is the item absent because projection filtered it?
- Is the item duplicated between Quick Slot and All Refs?
- Is a deleted/stale ID still referenced?
- Is the grid recomputing from a broad `outputs` prop when selector-store isolation should own it?

### 5. Trace URL Authority

Check:

- `resolveReferenceCardUrls`;
- `resolveReferenceOutputAuthorityTier`;
- `useReferenceGridResolvedMediaController`;
- `referenceGridMediaHelpers`;
- `mediaPreviewTrustPolicy`;
- `adaptive-media` resolver and policy.

Rules:

- Supabase `/storage/v1/render/image/` URLs are always regressions.
- Card previews may use compact transform-free URLs.
- Detail modals must promote to original/full signed authority when available.
- `/_next/image` can be a temporary preview bridge but must not become final full-quality authority.

### 6. Trace Hydration And Loading UI

Check:

- `useReferenceGridPreviewRuntime`;
- `useReferenceGridImageHydrationController`;
- `useReferenceGridHydrationQueueController`;
- `classifyReferenceGridCardVisualState`;
- `ReferenceGridCard` load/error handling.

Questions:

- Does valid media exist but `imageSrc` stay undefined because hydration has not reached it?
- Is the card pending generation versus pending decode?
- Did an error fire before loading completed?
- Is the UI showing browser broken-image state instead of app loading state?
- Is a fallback timeout hiding a real persistent failure?

### 7. Trace Render Performance

Check:

- `useReferenceGridViewportProjectionController`;
- `useReferenceGridVirtualMetricsController`;
- `useReferenceGridCardItemsController`;
- `useReferenceGridCardRenderController`;
- `referenceGridPropsEquality`;
- `useReferenceGridRuntimeScaffold`;
- Reference Grid feature flags in `perfProfileFlags`.

Questions:

- Is work proportional to visible/near-visible cards?
- Are Quick Slot and All Refs rendering the same media twice?
- Is parent state invalidating the grid despite unchanged media?
- Are visible-card arrays, render nodes, or resolved-media caches rebuilt too broadly?
- Is adaptive pressure reducing useful UX more than it reduces work?

### 8. Trace Detail Modal Handoff

Check:

- selected output ID from card double-click;
- `onOpenDetails` path;
- `DetailModal` preview candidates;
- canonical signed/full URL resolution;
- modal image error recovery;
- download target authority.

Rules:

- detail modal should not inherit compressed card-only policy as final source;
- fallback preview bridges are acceptable only to avoid blank/broken modal states while full authority resolves;
- if no full authority exists, show the best safe preview and make persistence limits explicit in code/tests.

### 9. Decide Fix Or Handoff

Fix in Reference Grid only when the owning path is one of:

- projection/state;
- URL authority inside grid/card/detail handoff;
- hydration/loading UI;
- render performance;
- ingestion/drag payload handling.

Handoff when the owner is:

- provider generation;
- Supabase storage or auth;
- media-library list/folder API;
- project/session restore persistence outside reference projection;
- deployment/chunk/caching;
- billing/credits.

## Proof Matrix

Use the narrowest proof that covers the owner layer:

- Projection: `reference-projections` tests and output collection/view-model tests.
- URL authority: `referenceGridMedia`, `mediaPreviewTrustPolicy`, resolved-media controller, and DetailModal tests.
- Hydration/loading: preview runtime, hydration controller, card visual state, and card render tests.
- Render performance: viewport/virtual metrics/card-items tests plus runtime telemetry if performance claim is made.
- Detail handoff: DetailModal tests and one production/modal observation when deployed behavior is the user-reported source.
- Adaptive changes: `npm run test:adaptive-media-runtime` when touching protected adaptive/grid delivery paths.

Local tests prove implementation behavior. Production browser/network evidence proves deployed user behavior.

## Anti-Patterns To Stop

- Do not add a new subsystem before naming the old subsystem's precise failure.
- Do not make card preview compression solve detail-modal full-resolution authority.
- Do not use loading placeholders to hide stale/deleted references.
- Do not treat `Media unavailable` as a diagnosis; trace why no candidate survived.
- Do not tune columns and media quality in the same pass unless the source problem requires both.
- Do not continue from "while here" cleanup after the stated proof condition is met.

## Closeout Shape

Every meaningful Reference Grid closeout should say:

- what contract was repaired or audited;
- which owner layer was involved;
- what changed or why no edit was made;
- what proof ran;
- what remains unknown, especially production-only unknowns;
- recommended next stop state: `done`, `done enough for now`, `continue`, or `handoff`.
