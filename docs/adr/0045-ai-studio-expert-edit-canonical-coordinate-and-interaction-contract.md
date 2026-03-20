# ADR 0045: AI Studio Expert Edit Canonical Coordinate and Interaction Contract

- Status: Accepted (implementation pending)
- Date: 2026-03-20
- Owners: AI Studio / Expert Edit

## Context
Expert Edit currently shows a high-severity parity regression where markup and inpaint pointer placement diverge from the visible reticle under zoom/pan in inline stage workflows. Prior parity work established shared interaction routing, but coordinate authority remains split across multiple DOM surfaces and transform paths.

The drift class is cross-cutting:
1. Pointer sampling and pointer unprojection.
2. Camera transform ownership (DOM/CSS vs render content).
3. Scene-to-mask conversion.
4. Submit-time export/flatten camera mapping.

Without one canonical contract, behavior can remain correct in one surface (modal) and regress in another (inline).

## Decision
### 1) Canonical Coordinate Chain
Expert Edit uses one canonical mapping chain for all draw/export operations:
1. `screen` (`clientX`, `clientY` in viewport CSS pixels)
2. `stage` (CSS pixels relative to authoritative stage rect)
3. `scene` (stable logical image-space coordinates)
4. `mask` (inpaint mask pixels)
5. `export` (submit artifact pixels)

All coordinate transforms must flow through one shared forward/inverse transform service.

### 2) One-Time Inverse Rule
Pointer mapping applies inverse camera/fit transform exactly once.

Forbidden:
1. Applying a CSS/DOM transform to the interaction surface and also re-inverting the same zoom/pan in tool controllers.
2. Maintaining separate ad hoc inverse math in markup and inpaint controllers.

### 3) Viewport Truth
Authoritative stage rects are:
1. Inline: `primaryDropzoneRef` rect.
2. Modal: `markupModalStageRef` rect.

`inlineStageWrapperRef` is non-authoritative for draw/unproject/export camera mapping.

### 4) Transform Ownership
Interaction surfaces stay layout-only (no camera transform on the event target element).

Camera/viewport transform is applied to render content and overlays derived from shared transform state. Inline and modal must follow the same ownership rule.

### 5) Inpaint Brush Contract
Inpaint brush diameter source-of-truth is `mask pixels`.

Implications:
1. Painted footprint remains stable in mask/image space across zoom changes.
2. Reticle size on screen scales with camera zoom.
3. Reticle rendering and paint radius must be derived from the same canonical transform chain.

### 6) Inpaint Mask Resolution Contract
Mask buffer canonical resolution equals selected layer image pixel resolution for submit-targeted inpaint operations.

Any stage-space drawing interaction is projected into this image-space mask buffer through canonical transforms.

### 7) Lasso Fill Rule Contract
Lasso fill rule is explicitly `evenodd` for commit-time mask application.

Rationale:
1. Predictable behavior under self-intersection.
2. Direction-independent semantics for user freehand loops.

### 8) Export/Flatten Contract
Inpaint submit exports image-area-aligned mask output in image-space crop coordinates and applies the same canonical camera contract used for base-image flattening.

Export must not depend on wrapper/padding geometry.

### 9) Pointer Lifecycle Contract
All draw tools (markup and inpaint) must:
1. Capture pointer on draw start.
2. Handle `pointercancel` as first-class termination.
3. Use coalesced samples when available.
4. Preserve behavior under `touch-action: none` and UA cancellation paths.

## Consequences
Positive:
1. One coordinate contract across inline/modal/markup/inpaint/export eliminates class of double-transform regressions.
2. Reticle and painted output become testable against hard numeric thresholds.
3. Export parity becomes deterministic and independent of DOM wrapper styling.

Tradeoffs:
1. Requires refactor from local controller math to shared transform service.
2. Requires stricter DOM structure constraints for stage interaction surfaces.
3. Requires new parity test matrix for zoom/pan/aspect/DPR.

## Non-Goals
1. Replacing current render technology stack.
2. Expanding tool set beyond current move/inpaint/markup scope.
3. Multi-user collaboration semantics.

## Validation Contract
Minimum pass criteria:
1. Pointer-to-stroke center error: <= 0.75 CSS px.
2. Reticle diameter to painted diameter delta: <= 1.0 CSS px equivalent.
3. Export alignment delta: <= 1 mask px.
4. Lasso deterministic area parity under self-intersection test cases.

## Links
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
4. `docs/sops/sop_image_generation.md`
