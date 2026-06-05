# Canvas Boundary Tear-Out Build Plan

Date: `2026-06-05`

Owner: `Enate Ende`

Status: `plan-ready, not implemented`

## Objective

Build a no-Shift boundary tear-out interaction that lets a user drag supported references from the right-rail Canvas into the active Create composer without regressing normal Canvas movement.

The finished behavior should feel like this:

1. Plain drag on a Canvas item still moves the item inside Canvas.
2. If the pointer clearly leaves the Canvas boundary during that drag, the ghost can become an export candidate.
3. Releasing over the Create composer copies the item into composer.
4. Releasing elsewhere cancels export and leaves the Canvas source item unchanged.
5. Releasing inside Canvas commits the normal Canvas move.

## Source Of Truth

Use these current repo surfaces as implementation authority:

- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
- `frontend/features/ai-studio/components/canvas/canvasViewportPointerTypes.ts`
- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/canvas/canvasTypes.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/components/promptStep/agentComposerDrop.ts`
- `frontend/features/ai-studio/createRuntime/contracts.ts`
- `frontend/lib/internalReferenceDragPayload.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`
- `docs/agents/enate-ende/canvas-tear-out-drag-design-2026-06-03.md`

Do not rely on chat memory as implementation authority. If code has drifted, current source wins over this plan.

## Scope

In scope:

- Right-rail Canvas item tear-out into the active Create composer.
- Standard Create and Pulse Create composer support through the shared Create runtime seam.
- Text Canvas items inserting text into the composer at the target insertion point or current composer end.
- Image Canvas items adding composer image attachments through the existing internal/composer image drop authority.
- Copy semantics only. Canvas source items remain saved and unchanged after export.
- Existing Shift/native export lane preserved as fallback and regression guard.
- Tests for Canvas pointer behavior, payload normalization, composer acceptance, and Standard/Pulse target wiring.

Out of scope:

- Removing Canvas items after composer drop.
- Multi-item export.
- Cross-window or OS-level drag/drop.
- Reference Grid or Quick Slot Inventory behavior changes.
- New composer support for video/audio attachments.
- New Canvas object types.
- General AI Studio large-project responsiveness work.

## Constraints

- Normal Canvas drag must remain fast and predictable.
- Boundary exit alone is not enough to export; use a hysteresis threshold or valid target entry.
- Export and Canvas move must be mutually exclusive at commit time.
- Pointer capture should be preserved so Canvas can keep receiving pointer movement while the pointer is outside the Canvas.
- Do not enable native browser `draggable` for no-Shift item drags; it can steal the pointer lane from Canvas movement.
- Do not synthesize fragile browser `DragEvent` or `DataTransfer` objects as the primary implementation.
- Do not add a parallel composer attachment system. Extract and reuse the existing composer intake path.

## Approaches Considered

### Approach A: Remove Shift And Use Native Browser Drag

Summary:

- Make Canvas items always `draggable`.
- Use the existing native `dragstart` payload path.

Rejected because:

- The current repo deliberately gates native drag behind Shift so plain item drag stays in the Canvas pointer-move lane.
- Native drag would fight Canvas ghost movement, text selection/editing, pointer capture, and edge panning behavior.
- It would be hard to support "move inside Canvas until boundary tear-out" because native drag starts immediately.

### Approach B: Keep Shift Export Only

Summary:

- Preserve the existing Shift export lane and polish it.

Rejected as the primary UX because:

- It is safe but not the creative boundary tear-out interaction the user wants.
- It remains low discoverability and does not feel like a Figma/Lucid-style canvas.

Keep as:

- A fallback lane.
- A regression test anchor.
- A proof that current shared drag payloads still work.

### Approach C: Pointer Tear-Out With DOM Hit Testing

Summary:

- Keep normal pointer drag inside Canvas.
- Use `document.elementsFromPoint()` to detect whether the pointer is over `.agent-composer-input-shell` or `.create-composer-right-panel-inner`.

Usable but not preferred because:

- It couples Canvas behavior to composer CSS class names.
- It is harder to test cleanly.
- It can silently break if composer DOM structure changes.

Keep as:

- A possible temporary diagnostic helper only if target registration proves too heavy.

### Approach D: Pointer Tear-Out With Registered Composer Targets

Summary:

- Extend the Canvas pointer session state machine.
- Register active composer drop targets with a small same-page target registry.
- Let Canvas query that registry during pointer move and pointer up.
- Let composer expose a normalized accept action instead of requiring a native `DataTransfer`.

Chosen because:

- It preserves Canvas pointer ownership.
- It keeps target ownership in the composer/Create runtime.
- It avoids class-name-only coupling.
- It is testable without browser-native drag synthesis.
- It creates one canonical path for future Canvas-to-workflow handoff.

## Chosen Architecture

Build Approach D in small validated batches.

### 1. Normalized Canvas Tear-Out Payload

Add a Canvas-owned adapter that converts a `CanvasSceneItem` into a normalized payload:

- `text`: trimmed text payload for composer insertion.
- `image`: internal reference/composer image payload using available durable authority.
- `unsupported`: explicit reason for video, audio, empty text, or weak media authority.

Payload rules:

- Prefer durable identifiers available on Canvas items: `mediaId` first, then `outputId`.
- Use live `StudioOutput` storage-path fields only when an `outputId` resolves through the current output store. Do not assume restored Canvas scene items already carry `previewStoragePath` or `fullStoragePath`.
- For mediaId-only restored images, build an internal image payload with `mediaId`, `mediaKind: "image"`, and the best display/render URL available on the Canvas item so the existing composer resolver can perform saved-media lookup.
- For images, support restored Canvas items that have `mediaId` even when `getOutputById(outputId)` returns null.
- For text, do not create media payloads; insert text only.
- For video/audio, fail closed with the existing composer unsupported-media messaging unless composer media support is explicitly expanded later.
- Keep `sourceSurface` compatible with the current `"all-refs" | "curated"` type. Do not introduce `"canvas"` unless that type is deliberately widened across parsing, tests, restore, and downstream consumers.

Likely file:

- `frontend/features/ai-studio/components/canvas/canvasTearOutPayload.ts`

### 2. Composer Intake Extraction

Extract the core of `handleAgentAttachmentDrop` into a reusable normalized intake path.

Required shape:

- Keep the native `DragEvent` handler working.
- Add a direct action that can accept a normalized composer drop request from Canvas.
- Reuse existing helper behavior for:
  - internal image resolution
  - preparing attachment placeholder
  - replacing placeholder after image resolution
  - video/audio rejection messages
  - duplicate attachment signatures
  - max image attachment trimming
  - Create workflow debug events

Do not duplicate the attachment creation logic in Canvas.

Likely public action:

- `acceptAgentComposerDropPayload(payload)`

Likely internal helper shape:

- `acceptComposerDropSnapshot(...)` or `acceptComposerStructuredDrop(...)`

The exact name can change during implementation, but the extracted function must remain the only source of composer attachment behavior.

### 3. Composer Target Registry

Add a small same-page target registry so the Canvas pointer lane can ask:

- Is there a valid composer target under this pointer?
- Should the target be highlighted?
- Can this target accept this payload?
- What action should run on pointer-up?

Target registration should happen from Standard and Pulse Create composer panels or their shared prompt/composer shell.

Target behavior:

- Text payload over composer: valid.
- Image payload over composer: valid.
- Unsupported payload: invalid for hover and drop acceptance.
- Video/audio payload: do not show a success affordance and do not mutate composer. If a stale or direct accept call still receives video/audio, use the existing composer rejection message rather than adding a new Canvas-specific error path.

Preferred shape:

- A page-local context or hook owned by AI Studio Create/Canvas integration.
- No global browser singleton unless a same-page context is impractical.

Likely files:

- `frontend/features/ai-studio/components/create/useCanvasTearOutComposerTargets.ts`
- or `frontend/features/ai-studio/hooks/useAiStudioCanvasTearOutTargets.ts`

### 4. Canvas Pointer State Extension

Extend `CanvasPointerSession` from only `item-ghost-drag` into explicit tear-out phases.

Possible state shape:

- `item-ghost-drag`
- `item-export-candidate`
- `item-export-active`

Implementation rules:

- Continue using pointer capture.
- During normal in-Canvas drag, keep scheduling the existing item drag preview.
- When pointer leaves Canvas beyond hysteresis or enters a registered target, switch to export candidate/active.
- While export-active, stop updating item move preview as a future scene commit.
- On pointer-up:
  - active target accepts payload: run target accept action, clear preview, do not move Canvas items.
  - no active target and pointer outside Canvas: cancel export, clear preview, do not move Canvas items.
  - still inside Canvas: commit the normal ghost move.
- On pointer-cancel: clear preview and export target highlight.

Hysteresis recommendation:

- Start with `24px` outside the Canvas rect.
- Treat direct entry into a registered composer target as intentional even before 24px if the pointer is outside the Canvas rect.
- Do not convert to export while the pointer is still inside the Canvas rect.

### 5. Visual Feedback

Keep visual feedback minimal for first implementation:

- Existing Canvas ghost continues while moving inside Canvas.
- Export candidate can use a lighter ghost opacity or a cursor/drop affordance.
- Composer target uses existing `is-drop-active` styling where possible.
- Do not redesign the composer or Canvas panel.

### 6. Preserve Shift Native Export

Keep the existing Shift/native export lane:

- It remains useful for browser-native targets and as a fallback.
- Its tests protect against accidental native drag takeover.
- Do not remove it unless a later plan explicitly deprecates it.

## Implementation Batches

### Batch 1: Payload Adapter And Unit Tests

Build:

- Canvas tear-out payload adapter.
- Tests for text, image with output, image with mediaId-only, video unsupported, audio unsupported, empty text unsupported.

Proof:

- Adapter tests pass.
- No Canvas runtime behavior changes yet.

Stop if:

- Current `CanvasSceneItem` data cannot produce durable image payloads without broad upstream media changes.

### Batch 2: Composer Intake Extraction

Build:

- Extract reusable composer intake from `handleAgentAttachmentDrop`.
- Native drag/drop still calls the extracted path.
- New direct accept action can receive normalized text/image payloads.

Proof:

- Existing `useAiStudioAgentComposer` tests still pass.
- New tests cover direct text/image intake.
- Video/audio rejection tests still pass.

Stop if:

- Extraction requires duplicating large blocks of composer logic instead of centralizing them.

### Batch 3: Target Registry

Build:

- Same-page composer target registration.
- Standard and Pulse Create register valid composer targets.
- Target hover state maps to existing drop-active affordance.

Proof:

- Standard and Pulse tests show a registered target can be detected by point/rect.
- Existing native panel drop tests still pass.

Stop if:

- Registration would require mode-local right-rail state or fork Standard/Pulse runtime authority.

### Batch 4: Canvas Pointer Tear-Out

Build:

- Extend Canvas pointer session for export candidate/active.
- Boundary/hysteresis detection.
- Pointer-up commit routing.
- Cancel and pointer-cancel cleanup.

Proof:

- Plain drag inside Canvas still moves image, video, audio, and text.
- Drag outside but not over composer cancels export and does not move the item.
- Drag outside over composer copies text/image into composer and does not move the Canvas item.
- Shift native export tests still pass.
- Pan, wheel zoom, marquee, text edit, and text resize tests still pass.

Stop if:

- Pointer capture or event routing prevents reliable target detection in the deployed browser surface.

### Batch 5: Integration And Runtime Verification

Build:

- Wire the page-level target registry and payload adapter into the right-rail Canvas props.
- Keep scope limited to Create composer targets.

Proof:

- Targeted tests pass.
- `npm -C frontend run type-check:touched` or the repo's current touched-file type-check path passes, or unrelated failures are documented.
- Production manual test after deploy verifies:
  - image Canvas item can be moved inside Canvas
  - text Canvas item can be moved inside Canvas
  - image Canvas item can tear out into composer
  - text Canvas item can tear out into composer
  - release outside composer cancels
  - Shift drag fallback still works or remains intentionally unchanged

Stop if:

- Production proof requires work outside Canvas/Create composer scope.

## Test Matrix

Canvas interaction tests:

- Plain image drag inside Canvas commits movement.
- Plain text drag inside Canvas commits movement.
- Plain drag near Canvas edge but still inside does not export.
- Drag past boundary threshold enters export candidate.
- Releasing export candidate outside a target cancels with no scene movement.
- Releasing export active over composer copies payload with no scene movement.
- Shift native drag still does not create item ghost movement.
- Pointer cancel clears export state and composer highlight.
- Space-drag and middle-drag pan still work.
- Wheel zoom still works.
- Marquee still works.
- Text edit and text resize still work.

Payload tests:

- Text item exports trimmed prompt text.
- Empty text item is unsupported.
- Image item with live output exports internal image payload.
- Image item with mediaId but missing live output exports resolvable internal image payload.
- Video item is unsupported for Create composer.
- Audio item is unsupported for Create composer.

Composer tests:

- Direct text payload inserts into Standard composer.
- Direct text payload inserts into Pulse composer.
- Direct image payload stages a composer image attachment.
- Direct image payload uses `resolveInternalImageDropSource`.
- Direct video/audio payload follows existing rejection messages.
- Existing native drop tests still pass.

Integration tests:

- Standard composer target registers/unregisters.
- Pulse composer target registers/unregisters.
- Canvas pointer release over registered target invokes accept once.
- Source Canvas item remains in scene after export.

## Autonomous Execution Checklist

Before implementing:

- Confirm branch is `production`.
- Confirm `shortpulse.allowedBranch` is `production`.
- Confirm current worktree changes are understood and unrelated changes are not reverted.
- Fresh-read this plan and the source-of-truth files.

During implementation:

- Work in the numbered batches.
- After each batch, run the narrowest relevant tests.
- Do not continue to the next batch if the current batch's stop condition is hit.
- Prefer extraction over duplication.
- Keep Shift/native export intact.
- Keep source item copy semantics intact.

Before closeout:

- Run the final test matrix subset that matches touched files.
- Self-audit that no adjacent right-rail, Reference Grid, Quick Slot, global responsiveness, or video composer feature work slipped in.
- Report what is implemented, what proof exists, and what still requires deployed/manual verification.

## Plan Self-Audit

Question: Can Enate Ende autonomously implement from this plan?

Answer: Yes, with one explicit boundary.

Why yes:

- The plan identifies the owner seams.
- The plan selects one architecture instead of leaving competing approaches unresolved.
- The plan forbids the risky no-Shift native drag shortcut.
- The plan preserves the existing Shift fallback.
- The plan defines payload, composer intake, target registration, pointer-state, and proof batches.
- The plan defines stop conditions for each batch.

Explicit boundary:

- Create composer video/audio attachment support is out of scope. If the user later wants video references to become first-class composer attachments, that should be a separate composer/media-lane plan.

## Stop Condition For This Planning Goal

This planning goal is complete when:

- This document exists in Enate Ende's docs folder.
- The chosen approach is clear.
- Implementation batches and proof requirements are defined.
- The plan has been self-audited for autonomous execution.
- Enate's local doc indexes point to the plan.

Once those are true, stop. Do not start implementation by momentum.
