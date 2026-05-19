# SOP: AI Studio Internal Drag/Drop Intake

Purpose: preserve the working intake pattern for AI Studio internal drag/drop flows so future fixes do not rely on rediscovering browser quirks. This SOP covers drag/drop intake for app-owned references such as Reference Grid, Quick Slot Inventory, Styles, Media Library, and Create composer image attachments.

## Scope

- In scope: internal app drags that originate inside AI Studio and may carry structured drag payloads, session tokens, fallback text fields, preview URLs, or synthetic browser `File` objects.
- In scope: consumers that need to accept the drag asynchronously after the browser event has already ended.
- Out of scope: external website drags, clipboard-only workflows, and provider-specific image preprocessing rules after a source has already been resolved.

## Core rule

For AI Studio internal drags, never trust `DataTransfer.files` first.

Browser/runtime degradation can produce a mixed payload where:

- the drag is app-owned,
- `DataTransfer.files` contains a synthetic image file,
- some structured fields are partially missing,
- enough reference hints remain to resolve the real source safely.

If the consumer chooses the raw file lane first, the drag is misclassified as a local desktop upload and the wrong error path or preview path wins.

## Canonical intake pattern

1. Capture the drag payload synchronously.
2. Rebuild a stable transfer-like snapshot for downstream parsing.
3. Resolve structured internal/composer/media-library payloads first.
4. Treat app-owned reference hints as authoritative enough to suppress the raw local-file lane.
5. Only use `files` first when there are no internal/reference/media hints at all.
6. Resolve preview source and model source separately from the same normalized source.
7. Lock degraded browser cases in characterization tests.

## Required implementation shape

### 1. Snapshot first

Consumers should capture the browser payload synchronously on drop, before any async work begins.

Minimum snapshot fields:

- `types`
- `files`
- internal reference drag session token
- composer image-drop session token
- serialized composer image-drop payload
- `text/reference-*` fields
- `image/url`
- `text/plain`
- `text/uri-list`

Recommended functions:

- `capture*DropSnapshot(...)`
- `build*SnapshotTransfer(...)`

The Style creator flow is the cleanest existing example:

- `frontend/features/ai-studio/components/style-creator/styleSourceCapture.ts`

### 2. Rebuild a transfer-like adapter

Do not keep re-reading the live browser `DataTransfer` inside async code. Rehydrate a transfer-like object from the captured snapshot and feed that to existing parsers.

This protects against:

- browser data disappearing after the event returns,
- inconsistent transfer reads across branches,
- drift between consumer branches.

### 3. Use structured-first precedence

Recommended precedence for AI Studio internal image drags:

1. internal reference payload / internal session token
2. dedicated composer image-drop payload
3. media-library payload
4. degraded app-owned reference hints
5. raw local desktop image file

Important: this is intentionally different from the Style creator’s historical `snapshot.files`-first order. The composer regression showed that `files`-first is unsafe for internal app drags.

### 4. Detect degraded internal drags

Even when structured payload extraction fails, the drag may still be app-owned.

Treat these as internal/reference hints:

- internal/composer session-token transfer types
- composer payload transfer types
- `text/reference-origin`
- `text/reference-id`
- `text/reference-output-id`
- `text/reference-media-id`
- `text/reference-source-surface`
- `text/reference-url`
- `text/reference-render-url`
- `image/url`
- URL-like `text/plain`
- URL-like `text/uri-list`

If any of those hints are present, do not let the raw `files` lane win automatically.

### 5. Separate preview from model source

Consumers should derive:

- a preview-safe image source for the UI chip/card
- a model-safe source for GPT vision or downstream processing

These may be different:

- preview can be a render-safe drag artifact or resized local data URL,
- model source can be a signed/public HTTPS image URL or reduced model data URL.

Do not force both concerns through one field.

## Test matrix

Every internal drag/drop consumer that stages images should have characterization coverage for:

1. plain desktop image file drop
2. structured internal/composer payload plus synthetic browser image file
3. degraded hint-only internal drag plus synthetic browser image file
4. media-library image payload plus synthetic browser image file
5. video rejection
6. audio rejection
7. prompt-only drop bypass where applicable

The goal is to lock behavior, not implementation details.

## Current reference implementation

The current Create composer image-attachment lane applies this pattern in:

- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`

Current regression coverage lives in:

- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`

The related cleaner snapshot/resolver model already exists in the Style creator:

- `frontend/features/ai-studio/components/style-creator/styleSourceCapture.ts`
- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`

## Maintenance rules

- When fixing an internal drag/drop bug, first classify whether the failure is:
  - structured payload missing,
  - degraded hint-only drag,
  - raw file misclassification,
  - preview-source failure,
  - model-source failure.
- Do not patch by adding another file-first branch.
- Prefer strengthening the snapshot/resolver boundary and then adding a characterization test.
- When a new AI Studio surface needs internal image drag/drop, copy the intake architecture, not just the branch logic.

## Recommended next refactor

The long-term cleanup target is a shared internal intake seam shaped like:

- `captureAiStudioDropSnapshot(...)`
- `buildAiStudioDropSnapshotTransfer(...)`
- `resolveAiStudioInternalImageSource(...)`

Consumers can then adapt the resolved source to their surface-specific needs:

- Style creator: data URL for extraction
- Create composer: ephemeral preview + vision-safe model source
- other surfaces: media insertion or reference selection
