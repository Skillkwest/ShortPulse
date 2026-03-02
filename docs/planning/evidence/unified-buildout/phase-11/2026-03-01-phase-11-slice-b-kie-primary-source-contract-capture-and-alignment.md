# Phase 11 Slice B Evidence: Kie Primary-Source Contract Capture and Alignment

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Capture current Kie Veo/Kling primary-source contract details and align dark-path submit/status/media adapters to documented field shapes without enabling cutover.

## Primary-Source Inputs Captured
1. Veo 3.1 generate endpoint:
   - `POST https://api.kie.ai/api/v1/veo/generate`
   - model values: `veo3`, `veo3_fast`
   - generation type values: `TEXT_2_VIDEO`, `FIRST_AND_LAST_FRAMES_2_VIDEO`, `REFERENCE_2_VIDEO`
   - image list and callback field conventions (`imageUrls`, `callBackUrl`)
2. Kling 3.0 create-task endpoint:
   - `POST https://api.kie.ai/api/v1/jobs/createTask`
   - root `model` + nested `input` request shape
   - callback payload conventions (`state=success/fail`, `resultJson.resultUrls`)

## Implementation
1. Submit contract alignment updates:
   - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
   - Added Veo alias normalization (`imageUrls`, callback aliases, generation type aliases) and model-aware validation (`seeds` range, generation-type image count, `REFERENCE_2_VIDEO` aspect constraint).
   - Added Kling request normalization to canonical create-task shape (`model` + `input`), with validated mode/sound/multi-shot/image requirements.
2. Status/media callback alignment updates:
   - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
   - `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
   - Added callback `state=fail` terminal handling and `resultJson` media URL extraction support.
3. Contract docs updates:
   - `docs/api/api-kie-veo-3-1-fast-image-to-video.md`
   - `docs/api/api-kie-kling-3-0.md`

## Why This Is Safe
1. Kie runtime remains dark/off by default.
2. No `/api/fal/*` route behavior changes.
3. Changes are limited to provider-integration Kie boundaries and contract docs.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
