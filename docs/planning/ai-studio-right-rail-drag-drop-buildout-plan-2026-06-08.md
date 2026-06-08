# AI Studio Right-Rail Drag/Drop Buildout Plan (2026-06-08)

Purpose: stabilize the implementation source of truth for the AI Studio
right-rail drag/drop buildout so every checkpoint can reference a repo-owned
plan instead of prior chat memory.

## Plan Source

This plan stabilizes the prior thread plan named `Autonomous Plan`, created on
2026-06-08 after the Reference Grid / Quick Slot / Media Library drag/drop
audit.

## Objective

Fix the canonical AI Studio drag/drop path for text, image, video, and
audio/sound references across:

- Media Library to Reference Grid
- Media Library to Quick Slot Inventory
- Reference Grid to Quick Slot Inventory
- Quick Slot Inventory reorder/add flows
- Reference Grid, Quick Slot Inventory, and Media Library drops into Canvas
- Text/prompt drops into text-reference paths

The buildout is complete only when these paths no longer lose app-owned drag
payloads, misclassify synthetic browser files as desktop uploads, silently
swallow degraded structured drops, or wait indefinitely before visible Quick
Slot insertion.

## Source Of Truth

- `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/agents/holomony/reference-grid-ownership-map.md`
- `docs/sops/sop_media_performance_operations.md`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceIngestionActions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`

## Owner / Lane

Owner lane: AI Studio Reference Grid / global right-rail ingestion. This follows
Holomony's Reference Grid ownership map for ingestion, loading/display
correctness, Quick Slot projection, and right-rail Canvas drop ownership.

This lane does not own upstream provider failures, Supabase outages, auth
failures, billing/credit behavior, deployment state, or product redesign.

## Approved Scope

In scope:

1. Add one shared AI Studio drop snapshot and transfer-adapter utility.
2. Route Reference Grid, Quick Slot Inventory, shell capture, and Canvas drop
   handling through snapshot-first structured resolution.
3. Ensure Media Library payloads, internal reference payloads, composer
   reference payloads, degraded app-owned hints, text prompts, pasted media
   URLs, and desktop files resolve in deterministic precedence.
4. Make Quick Slot Media Library insertion visible immediately by using the
   same optimistic output insertion pattern as Reference Grid, with background
   media preparation/signing.
5. Prevent media preparation/signing from blocking visible Quick Slot
   projection indefinitely.
6. Update shared image/video drag extractors so structured app-owned hints beat
   synthetic browser files.
7. Preserve text, image, video, and audio metadata, including video poster
   fields and audio companion art, duration, waveform, and source-mode fields.
8. Add targeted regression coverage for the touched drag/drop surfaces.

Out of scope:

- UI redesign, visual styling changes, new interaction models, or copy changes.
- New right-rail state authorities or workflow-local forks.
- New provider, billing, credit, auth, deploy, branch, commit, push, or release
  behavior.
- Broad refactors, compatibility-only duplicate paths, hidden fallbacks, backup
  implementations, or adjacent cleanup.
- Production validation that requires deploy/release authority.

## Implementation Batches

### Batch 1: Shared Snapshot Contract

Create a shared utility shaped around:

- `captureAiStudioDropSnapshot(...)`
- `buildAiStudioDropSnapshotTransfer(...)`
- focused helpers for structured-hint detection and snapshot-safe reads

The snapshot must include:

- transfer types
- files
- internal reference drag session token fields
- composer image-drop token and payload fields
- Media Library custom and fallback fields
- `text/reference-*` fields
- `image/url`
- `text/plain`
- `text/prompt`
- `text/uri-list`
- video poster fields
- audio companion art, duration, waveform, and source-mode fields
- storage path fields needed by downstream media authority

### Batch 2: Reference Grid And Quick Slot Intake

Convert All Refs and Quick Slot drop handlers to capture once and resolve from
the snapshot transfer. Structured payloads must win over raw files, and degraded
app-owned hints must suppress unsafe file-first routing without silently doing
nothing.

### Batch 3: Quick Slot Optimistic Insertion

Change Quick Slot Media Library drops so output insertion returns immediately
with an output id and patches prepared media authority in the background. Keep
project association non-blocking. Add a bounded preparation fallback so signing
or media-id lookup cannot create an infinite wait before projection.

### Batch 4: Shared Extractor Precedence

Update `extractDragDropPayload` and `extractVideoDragDropPayload` so internal
reference/media-library/composer/reference hints are evaluated before file
objects. Plain desktop files must still work when there are no app-owned hints.

### Batch 5: Shell And Canvas Ownership

Move shell right-column drop payload resolution and Canvas viewport drops onto
the same snapshot-first contract so Quick Slot, Canvas, and All Refs own drops
under the pointer without shell reroute or duplicated payload logic.

### Batch 6: Audio/Sound Completeness

Audit and correct direct audio file routing. If audio still routes through an
existing mixed media upload destination, the behavior must be covered by tests
and documented in code comments only where the naming would otherwise be
misleading. Preserve audio-specific payload fields through Media Library,
Reference Grid, Quick Slot, and Canvas paths.

## Proof Requirements

Targeted tests should cover:

- Media Library image, video, audio, and prompt drops into Quick Slot
- Media Library image, video, audio, and prompt drops into Reference Grid
- Reference Grid image, video, audio, and text/prompt drops into Quick Slot
- Quick Slot reorder with structured internal payloads
- degraded internal drops with synthetic browser files
- degraded Media Library fallback-marker drops
- plain desktop image, video, and audio files
- pasted media URL drops for image, video, and audio
- text-only prompt drops
- shell capture bypass for right-rail local owners
- Canvas drops for image, video, audio, and text
- stalled or rejected media preparation not blocking visible Quick Slot
  projection

Recommended validation commands:

```bash
npm -C frontend run test -- ReferenceGrid.curated.test.tsx mediaLibraryDragPayload.test.ts dragDrop.test.ts useAiStudioReferenceIngestionActions.test.ts useAiStudioPageMediaReferenceRuntime.test.ts canvas.drop.test.tsx
npm -C frontend run lint
npm -C frontend run build
```

Run lint/build only after the targeted tests pass or when the touched surface
warrants a broader check.

## Stop Condition

Stop when the canonical drag/drop buildout is complete and targeted validation
passes, or immediately when:

- the next change is outside this plan,
- the next change belongs to an upstream owner,
- validation blocks further safe progress,
- proof requires commit, push, deploy, release, or production account work,
- the remaining work would mostly create churn rather than reduce drag/drop
  failure risk.
