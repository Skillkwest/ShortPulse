# Generation Pipeline Rebuild Generated Reuse And Drag/Drop Authority Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document defines the next explicit follow-on job after the current admin trace/health checkpoint.

It is a new job with a different objective:
1. move generated reuse and drag/drop authority onto canonical generation/output/storage evidence
2. reduce remaining dependence on transient `previewUrl` and `resultUrls` in user-facing generated reference reuse
3. keep scope on generated reference authority, not broad Reference Grid layout or unrelated Media Library refactors

## Why This Job Exists
The current branch now has:
1. canonical output authority for preview/detail and download resolution
2. canonical attempt/output evidence in admin/operator diagnostics
3. explicit pause boundaries that kept Lane 3 from widening into a broad grid rewrite

But one real user-facing seam remains:
1. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` still falls back through transient `previewUrl` / `resultUrls`
2. `frontend/features/ai-studio/utils/dragDrop.ts` still exposes direct reference URLs based on storage heuristics rather than canonical output-aware reuse rules
3. generated drag/drop and internal reference reuse are the last meaningful user-facing authority seam before broader Lane 3 would become speculative

## Scoped Objective
Define and implement one explicit generated-reference reuse and drag/drop authority boundary.

The job should answer:
1. when a generated output is reusable vs tracked vs preview-only
2. when drag/drop may expose direct URLs versus only internal reference identity
3. how Reference Grid resolved media should prefer canonical output/storage authority without breaking downstream payload contracts

## In Scope
1. generated reference resolved-media authority in Reference Grid
2. generated drag/drop payload authority and URL exposure policy
3. generated internal reference reuse posture
4. targeted regression coverage for drag/drop and generated reference resolution

## Explicitly Out Of Scope
1. broad Reference Grid card/layout redesign
2. character/style/media library downstream contract redesign
3. non-generated media drag/drop policy changes
4. historical normalization/backfill
5. unrelated admin or control-plane work

## Primary Surfaces
1. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
2. `frontend/features/ai-studio/utils/dragDrop.ts`
3. `frontend/features/ai-studio/logic/referenceOutputAuthority.ts`
4. `frontend/features/ai-studio/logic/referenceDownload.ts`
5. generated-reference tests under `frontend/features/ai-studio/reference-grid/controllers/__tests__`
6. drag/drop tests under `frontend/features/ai-studio/utils/__tests__` and adjacent hook coverage

## Exit Gate
This job is done when:
1. generated resolved-media and drag/drop behavior use canonical output/storage authority first
2. preview-only generated outputs are clearly bounded from durable reuse behavior
3. downstream payload contracts remain stable and explicitly regression-tested
4. the next remaining work would widen into broader Lane 3 cross-surface cutover

## Done State
1. generated Reference Grid media resolution prefers canonical output/storage authority before transient provider URLs
2. generated drag/drop exposure rules are explicit and canonical-output-aware
3. preview-only generated outputs remain viewable but do not masquerade as durable reusable assets
4. regression coverage exists for generated drag/drop and generated reference resolution

## Proposed Execution Slices
### `GPR-GR-S1`
Status:
1. Done

Goal:
1. write the generated reuse and drag/drop authority contract from current repo behavior

Exit gate:
1. one planning artifact defines canonical-vs-compatibility posture for generated resolved-media and drag/drop before code changes

Artifact:
1. `docs/planning/generation-pipeline-rebuild-generated-reuse-dragdrop-authority-contract-2026-03-27.md`

### `GPR-GR-S2`
Status:
1. Done

Goal:
1. align Reference Grid generated resolved-media derivation with canonical output/storage authority

Exit gate:
1. generated resolved-media no longer depends primarily on transient `previewUrl` / `resultUrls` when canonical output/storage evidence exists

Current note:
1. preview-only generated outputs must remain viewable without being upgraded into reusable authority

### `GPR-GR-S3`
Status:
1. Done

Goal:
1. align generated drag/drop URL exposure with canonical reuse authority

Exit gate:
1. drag/drop uses stable generated-reference authority rules without changing downstream payload shapes

## Validation Bundle
1. targeted resolved-media controller tests
2. targeted drag/drop tests
3. docs parity checks
4. self-audit confirming we reduced user-facing authority ambiguity without widening into broad UI redesign

## Stop Rules
Stop this job when:
1. the next step would widen into downstream consumer redesign
2. the next step would widen into broad Reference Grid cutover
3. remaining work is mostly optional UI polish rather than authority reduction

## Checkpoint Note
This job is done at the current bounded checkpoint:
1. generated resolved-media now trusts canonical resolved authority before raw fallback ladders
2. generated drag/drop direct URL exposure now requires output-level storage paths instead of `savedMediaIds` alone
3. remaining work would widen into broader cross-surface drag/drop or Reference Grid redesign
