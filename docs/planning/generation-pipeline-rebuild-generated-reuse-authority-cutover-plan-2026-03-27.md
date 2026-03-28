# Generation Pipeline Rebuild Generated Reuse Authority Cutover Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document defines the next larger Lane 3 job after the bounded generated reuse/drag-drop checkpoint.

It is intentionally broader than the last lane:
1. carry canonical generated reuse authority across the downstream internal reuse surfaces
2. keep generated reference reuse consistent between drag payloads, drop resolvers, and reference ingestion
3. make one milestone-sized forward move instead of more seam-by-seam cleanup

## Why This Job Exists
The current branch already closed the bounded generated authority checkpoint:
1. generated resolved-media is canonical-first
2. generated drag/drop direct URL exposure is tightened
3. preview-only generated outputs remain bounded from durable reuse

But generated reuse is still spread across several downstream consumers:
1. `frontend/features/ai-studio/hooks/useAiStudioInternalDropResolvers.ts`
2. `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
3. `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts`
4. `frontend/features/ai-studio/reference-ingestion/prepareLibraryMediaIngestionPayload.ts`
5. `frontend/features/ai-studio/components/style-creator/intake/*`
6. canvas / character / style / media-library drop consumers that still infer reuse posture from mixed URL and media-id evidence

That means we have reduced authority ambiguity at the drag source, but not yet completed the end-to-end generated reuse cutover.

## Objective
Implement one explicit cross-surface generated reuse authority cutover.

This job should make these surfaces agree on:
1. when a generated output is reusable vs tracked vs preview-only
2. when downstream consumers may rely on direct reusable media URLs
3. when downstream consumers must resolve by internal identity and persistence instead
4. how media-library/style/canvas/character consumers recover canonical media without reintroducing provider-URL authority

## In Scope
1. internal reference drop resolution for generated outputs
2. style-library internal drop and style-creator intake
3. media-library internal drop and ingestion preparation
4. canvas and character drop resolution for generated outputs
5. targeted regression coverage across these generated reuse consumers

## Explicitly Out Of Scope
1. broad Reference Grid card/layout redesign
2. non-generated drag/drop policy changes
3. Media Library visual redesign
4. broad Character Manager or canvas UX redesign
5. historical normalization/backfill
6. unrelated control-plane or billing work

## Primary Surfaces
1. `frontend/features/ai-studio/hooks/useAiStudioInternalDropResolvers.ts`
2. `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
3. `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts`
4. `frontend/features/ai-studio/reference-ingestion/prepareLibraryMediaIngestionPayload.ts`
5. `frontend/features/ai-studio/components/style-creator/intake/*`
6. `frontend/features/ai-studio/components/canvas/canvasDropResolvers.ts`
7. `frontend/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
8. targeted tests in:
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioInternalDropResolvers.test.ts`
   - `frontend/features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx`
   - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`

## Done State
This job is done when:
1. generated internal drops resolve through one consistent reusable/tracked/preview-only policy
2. direct reusable media URLs are only consumed where canonical reusable authority exists
3. tracked generated outputs continue to work through internal identity/persist-and-resolve flows without leaking provider URL authority
4. preview-only generated outputs remain bounded from durable reuse surfaces
5. the next remaining work would widen into broad cross-surface UI redesign rather than authority cutover

## Larger Execution Slices
### `GPR-GX-S1`
Status:
1. Done

Goal:
1. lock the cross-surface generated reuse authority contract for downstream consumers

Exit gate:
1. one contract artifact defines reusable/tracked/preview-only rules for internal drop resolvers, style intake, media-library intake, canvas, and character consumers

Artifact:
1. `docs/planning/generation-pipeline-rebuild-generated-reuse-authority-cutover-contract-2026-03-27.md`

### `GPR-GX-S2`
Status:
1. Ready

Goal:
1. align internal reference drop resolution and media-library drop resolution with the canonical generated reuse policy

Exit gate:
1. internal generated drops no longer rely on mixed provider-URL authority when internal identity plus persistence resolution should be used

### `GPR-GX-S3`
Status:
1. Pending

Goal:
1. align style/canvas/character generated reuse consumers with the same policy

Exit gate:
1. generated downstream consumers behave consistently across style, canvas, character, and media-library intake without reopening broad UI redesign

## Validation Bundle
1. internal drop resolver tests
2. style-library generated drag/drop tests
3. Reference Grid curated generated reuse tests
4. any targeted canvas/character drop tests touched by the cutover
5. docs parity checks
6. self-audit confirming this lane reduced authority ambiguity across consumers instead of adding another wrapper layer

## Stop Rules
Stop this job when:
1. the next step requires broad downstream consumer redesign rather than authority cutover
2. the next step would materially widen into UI/layout work
3. remaining work is mostly polish instead of generated reuse authority reduction
