# Expert Edit Stage Transform Chrome Rebuild Plan (2026-06-08)

Status: approved-for-implementation
Owner/Lane: Engineering / AI Studio Expert Edit master-stage transform chrome lane

## Objective

Permanently fix the Expert Edit stage interaction class where selected image pixels, move/resize
handles, zoom/pan camera state, and crop boundaries drift or fight each other.

The implementation must make the selected image layer movable and resizable in the actual stage
space while keeping transform handles fully visible and draggable even when the image pixels remain
cropped by the artboard/stage viewport.

This plan supersedes `docs/planning/expert-edit-master-stage-move-resize-buildout-plan-2026-06-08.md`
because the earlier plan fixed shared image/overlay geometry and direct manipulation, but the later
production regression showed that transform chrome still lives under clipping ancestors.

## Source Of Truth

Use these sources in this order:

1. Current repo code under `frontend/features/ai-studio/components/edit/` and
   `frontend/styles/ai-studio-edit-expert.css`.
2. This plan.
3. `docs/planning/ai-studio-master-stage-rebuild-spec-2026-04-12.md`.
4. `docs/adr/0054-ai-studio-canonical-master-stage-and-stage-system-sunset.md`.
5. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`.
6. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`.
7. The superseded move/resize plan as historical context only.

If this plan and current code disagree during implementation, tighten this plan before continuing.
Do not rely on chat memory as the source of truth.

## Current Repo-Backed Problem Statement

The older geometry regression and the newer handle-clipping regression are related but distinct:

1. Image pixels and transform overlay now share `resolveLayerVisualGeometry`, so the selected image
   and handle box have a shared geometry source.
2. The overlay is still rendered under clipping ancestors:
   - inline: `.edit-expert-primary-stage-shell` and `.edit-expert-markup-viewport`;
   - modal: `.edit-expert-markup-modal-stage`;
   - image crop: `.edit-expert-primary-composition-surface`.
3. CSS `overflow: visible` on `.edit-expert-primary-layer-selection-overlay` cannot escape an
   ancestor with `overflow: hidden`.
4. Inline and modal surfaces still use different DOM placement for the overlay, so fixing one can
   leave the other broken.
5. Current tests prove move/resize math and selected-layer alignment, but they do not prove the
   visual contract that transform handles remain visible outside the cropped image area.

This is why the visible symptom feels like an invisible window: the window is a real overflow clip
boundary applied above transform chrome.

## Approved Scope

In scope:

1. Expert Edit stage DOM structure for inline and expanded modal surfaces.
2. Expert Edit transform overlay/chrome placement and pointer routing.
3. CSS overflow/stacking contracts for render clips, camera layers, artboard layout, and transform
   chrome.
4. Focused tests that prevent the image/overlay geometry, move/resize, and handle-visibility
   regressions from returning.
5. Documentation updates needed to make this plan discoverable and to retire the narrower prior
   plan.

Out of scope:

1. Generic Canvas/right-rail Canvas redesign or revival.
2. Provider, billing, storage, Reference Grid, Quick Slot Inventory, pricing, or project
   persistence changes.
3. New editor tools, multi-select, snapping, grouping, guides, alignment tooling, or visual
   redesign beyond restoring expected transform affordance behavior.
4. Changing the rendering substrate away from the existing DOM/CSS stage. If DOM/CSS proves unable
   to satisfy this plan, stop and re-plan rather than installing Konva/Fabric or a second stage
   implementation.
5. Branch, commit, push, deploy, or production-release state changes unless explicitly approved in
   the active thread.
6. Workarounds such as shrinking handles, adding large padding, hiding overflow symptoms with
   z-index only, duplicating interaction controllers, or adding fallback stage paths.

## Canonical Design Decision

Separate the stage into named layers with one job each:

1. **Stage shell**: owns sizing, keyboard focus, high-level pointer routing, and background.
   It must not clip transform chrome.
2. **Render clip**: the only layer allowed to crop camera/image pixels.
3. **Camera layer**: applies zoom/pan transform to render content.
4. **Artboard/frame layer**: owns aspect-ratio frame layout and layer geometry basis.
5. **Transform chrome layer**: renders selected outline, handles, and direct manipulation hit
   targets. It uses the same camera transform and artboard frame dimensions as render content, but
   it is not a descendant of any render clip.

The image can be clipped. The handles cannot be clipped by the image/artboard crop. This is the
core contract to preserve.

## Implementation Batches

### Batch 1: Lock The Regression Contracts First

Add focused failing coverage before structural rewiring:

1. Add a transform chrome contract test that renders the inline and modal stage surfaces and asserts
   the transform overlay is not a descendant of:
   - `.edit-expert-primary-composition-surface`;
   - `.edit-expert-markup-viewport` when it is acting as a render clip;
   - `.edit-expert-primary-stage-shell` if that shell still clips;
   - `.edit-expert-markup-modal-stage` if that modal stage still clips.
2. Add a CSS contract test that reads `frontend/styles/ai-studio-edit-expert.css` and asserts:
   - clipping is isolated to explicitly named render/crop classes;
   - transform chrome host classes use `overflow: visible`;
   - stage shell and modal stage do not combine transform chrome ancestry with `overflow: hidden`,
     `overflow: clip`, `contain: paint`, `clip-path`, or mask clipping.
3. Keep or extend existing geometry tests proving image pixels and overlay use the same
   `resolveLayerVisualGeometry` result.
4. Keep existing controller tests proving overlay-origin pointer events resolve back to the
   authoritative stage/artboard rect.

Proof:

```bash
npm -C frontend run test -- \
  features/ai-studio/components/edit/__tests__/useExpertEditTransformController.test.tsx \
  features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx
```

The new contract tests should fail before the structural fix or be written against the intended
contract in the same batch that introduces the new primitives.

### Batch 2: Introduce Named Stage Render And Chrome Primitives

In `frontend/features/ai-studio/components/edit/ExpertEditStagePrimitives.tsx`, introduce explicit
layout primitives rather than reusing one container for clipping and chrome:

1. `PrimaryStageRenderClip` or equivalent: absolute/inset render-only clip root.
2. `PrimaryStageCameraLayer` or equivalent: applies `viewportStyle` for zoom/pan.
3. `PrimaryStageArtboardFrame` or equivalent: uses the existing frame sizing contract.
4. `ExpertEditTransformChromeLayer` or equivalent: sibling to the render clip, applies the same
   camera/artboard layout as render content, and permits overflow.

In `frontend/styles/ai-studio-edit-expert.css`, encode the class contract plainly:

1. render/crop roots are named and intentionally `overflow: hidden`;
2. chrome roots are named and intentionally `overflow: visible`;
3. stage shell/modal stage containers are not the crop authority when they also host chrome;
4. pointer events default to `none` on non-interactive chrome wrappers and `auto` only on transform
   box/handles.

Proof:

```bash
npm -C frontend run test -- \
  features/ai-studio/components/edit/__tests__/ExpertEditStagePrimitives.test.tsx
```

### Batch 3: Rewire Inline Stage Around The New Contract

Update `frontend/features/ai-studio/components/edit/ExpertEditStageSurface.tsx` so inline stage
rendering follows this structure:

1. `PrimaryStageShell`
2. render clip child containing the camera layer and real scene content;
3. transform chrome child outside the render clip, with the same camera transform and artboard frame
   dimensions;
4. selected transform overlay rendered only in the chrome layer;
5. image pixels, inpaint canvases, markup strokes, and other render content remain inside the render
   clip.

Preserve:

1. existing `frameStyle` sizing;
2. existing `viewportStyle` zoom/pan transform;
3. existing stage pan/background behavior;
4. existing move/resize pointer handlers and history behavior;
5. export/flatten semantics.

Do not duplicate the image scene or create a second interaction controller.

Proof:

```bash
npm -C frontend run test -- \
  features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx \
  features/ai-studio/components/edit/__tests__/useExpertEditTransformController.test.tsx
```

### Batch 4: Rewire Modal Stage To The Same Stage Core

Update `ExpertEditMarkupModalShell` / `ExpertEditModalStageSurface` so the expanded modal is a
presentation shell around the same render/chrome contract:

1. modal stage must not clip transform chrome;
2. modal render pixels must still be clipped by an internal render clip;
3. modal transform chrome must use the same camera/artboard layout as modal render content;
4. pointer events that start from modal chrome must still resolve to the modal stage/artboard rect.

This batch exists because modal and inline have historically regressed independently. Do not leave
modal as a "later parity" task if the inline fix changes shared primitives.

Proof:

```bash
npm -C frontend run test -- \
  features/ai-studio/components/edit/__tests__/useExpertEditTransformController.test.tsx \
  features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx
```

### Batch 5: Add Browser-Level Handle Visibility Proof

Extend the existing Expert Edit browser audit path instead of creating a separate ad hoc harness:

1. update `frontend/tests/e2e/expert-edit-coordinate-parity.audit.js` or add a narrowly named
   sibling audit if the existing script would become too broad;
2. place a selected image near each artboard edge/corner;
3. run at default zoom and at a zoom/pan state where the image crop is visible;
4. assert each transform handle has a non-zero visible bounding box and is not clipped by render
   crop boundaries;
5. assert the image pixels remain cropped by the artboard/render clip where expected;
6. cover inline and modal surfaces if auth/test setup allows both.

If the browser audit cannot authenticate or mount the production-like AI Studio state, stop with a
clear validation blocker. Do not claim the visual regression is fully prevented from JSDOM tests
alone.

Proof:

```bash
npm -C frontend run test:expert-edit:coordinate-parity:browser-audit
```

### Batch 6: Final Local Gate And Scope Audit

Run focused checks first, then broader feasible checks:

```bash
npm -C frontend run test:expert-edit:coordinate-parity:core
npm -C frontend run test:expert-edit:coordinate-parity:browser-audit
npm -C frontend run lint
npm -C frontend run type-check
npm -C frontend run docs:check
```

Run `npm -C frontend run build` if the touched diff changes shared stage imports, Next page
composition, or CSS import structure. Document unrelated pre-existing failures instead of expanding
scope.

## Required Proof Before Closing Implementation

Implementation is not complete until there is proof for all of these:

1. Selected image body drag moves the actual image pixels and the overlay together.
2. Direct corner-handle drag resizes the actual image pixels and the overlay together.
3. Handles remain fully visible when the selected image is cropped by the stage/artboard viewport.
4. Inline and modal stages use the same render/chrome contract or a documented shared primitive
   that enforces equivalent behavior.
5. Image pixels, inpaint canvases, and markup/render content remain cropped to the intended render
   area.
6. No new fallback stage, duplicate controller, or generic Canvas/right-rail editor path is added.
7. Focused unit/integration tests and browser visual audit pass, or the remaining blocker is
   explicitly outside the local implementation lane.

Production manual proof is not part of this implementation lane unless explicitly approved. During
the pre-launch phase, any manual browser validation that claims deployed behavior must target
`https://www.shortpulse.ai` after the relevant deployment exists.

## Stop Conditions

Stop successfully when:

1. the named render/chrome contract is implemented for inline and modal Expert Edit stages;
2. move/resize image pixels and handles stay aligned;
3. transform handles are not clipped by image/artboard crop boundaries;
4. required local proof passes or a clear validation blocker is documented;
5. no higher-ROI in-scope step remains.

Stop early and tighten the plan if:

1. a fix requires replacing the DOM/CSS substrate, installing a new canvas/editor library, or
   reviving generic Canvas as the editor substrate;
2. the next step would change provider/export/billing/storage/project persistence behavior;
3. the next step is a broad visual redesign rather than the transform chrome/stage contract;
4. validation depends on commit, push, deploy, or production account/credit mutation outside the
   active lane;
5. the implementation would preserve duplicate inline/modal interaction runtimes instead of
   converging them.

## Implementation Closeout Template

When completing the buildout, report:

1. plan source: this file path;
2. batches completed;
3. files changed by category: primitives, stage surfaces, controller/geometry, CSS, tests, docs;
4. proof commands and outcomes;
5. unproven boundaries, especially production/browser/deploy proof if not approved;
6. exact deferred boundary if any stop condition was hit.
