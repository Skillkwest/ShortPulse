# Phase 6 Ephemeral Provider-Submit Admission Plan

Purpose: implementation-ready plan for the deferred Gutan lane that makes local/blob/data image references safe for provider/product submission without changing composer, Style Creator, Expert Edit, Standard, Pulse, or right-rail UX.

Status: planned for later. No Phase 6 runtime implementation has started from this artifact.

Owner: Gutan, ShortPulse Media Ingestion Normalization Steward.

## Done Means

Phase 6 is done when every local/blob/data still-image path that can reach provider/product processing either:

- passes through canonical product image admission before submit;
- resolves to an already covered durable/signed media path;
- or intentionally rejects if it cannot be admitted under the 25 MB product-use limit.

The implementation must not create new UI, controls, copy, loading states, or workflow behavior unless the user explicitly approves it in a future implementation thread.

## Source Of Truth

- `docs/records/artifacts/agent/gutan/image-admission-policy.md`
- `docs/records/artifacts/agent/gutan/image-admission-implementation-plan.md`
- `docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md`
- `frontend/lib/imageAdmissionPolicy.ts`
- `frontend/lib/server/imageAdmission.ts`
- `frontend/features/ai-studio/utils/imageUpload.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/preflightPreparation.ts`
- `frontend/features/ai-studio/logic/editImageIngress.ts`
- `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`
- `frontend/features/ai-studio/components/style-creator/styleImageDerivation.ts`

## Current Repo Baseline

The main provider-submit preflight already does useful canonical work:

- `prepareSubmissionReferenceInputs` calls `prepareImageUrlForSubmission` for standard references and inpaint override media.
- `prepareImageUrlForSubmission` uploads `blob:` and `data:image/...` URLs through `/api/upload-image`.
- `/api/upload-image` is now a canonical adapter over server image admission from earlier Gutan phases.
- Supabase signed URLs are refreshed rather than transformed.

Expert Edit currently has additional ephemeral image handling:

- file/drop ingress uses `prepareLocalImageFileForEditIngress` and `prepareLocalImageBlobForEditIngress`;
- these helpers use adaptive-media browser preprocessing for preview/bandwidth;
- inline generate exports flattened primary/mask/markup blobs and converts them to object URLs before calling the shared task submission path;
- the task submission preflight should then upload those object URLs through `/api/upload-image`.

Style Creator currently has a separate extraction-focused path:

- file/drop source resolution reads files and fetched blobs into data URLs;
- preview and extraction artifacts are canvas-derived data URLs;
- server-copy fallback for internal/generated sources goes through `/api/media/copy-from-url`, which is now covered by canonical admission;
- style extraction is not always a provider-generation submit, so Phase 6 must distinguish extraction-only normalization from provider-product admission.

## In Scope

- Local/blob/data image references that enter provider submit through AI Studio task submission.
- Expert Edit flattened primary, inpaint mask, markup reference, and secondary reference inputs when they are submitted to image generation/edit providers.
- Agent composer image attachments only when they become provider/product image inputs.
- Style Creator images only if they are passed to provider/product processing, not when they are merely UI previews or local extraction artifacts.
- Tests and guardrails proving no over-25 MB still image reaches provider submit from local/blob/data sources.

## Out Of Scope

- Reference Grid display compression, hydration, virtualization, and preview performance. Holomony owns that lane.
- Supabase storage architecture, hosted environment operations, bucket policies, RLS, and storage accounting. Nuclo/Dave own those lanes.
- Supabase image transformations. They remain prohibited, not delegated.
- Full-quality generated original save/download/export authority. Phase 5 already protects this lane.
- Animated image recompression. Over-25 MB animated images stay rejected in v1.
- New UI/UX behavior, banners, warnings, controls, gestures, or layout changes.

## Product Rules

- Under-25 MB still images should preserve existing behavior.
- Over-25 MB local/blob/data still images should be admitted quietly before provider/product submit when possible.
- Over-25 MB animated images should reject intentionally.
- Browser-side preprocessing can help bandwidth and latency, but server-side `/api/upload-image` admission remains the final authority for submit-bound durable URLs.
- If a provider requires an HTTPS URL, local/blob/data inputs should upload through the canonical route rather than attempting direct provider submission.
- If an input is extraction-only and never leaves the browser/provider boundary, avoid durable storage unless a later submit path requires it.

## Proposed Architecture

Do not create a second compression system.

Use a thin shared client helper to make submit intent explicit:

```ts
prepareEphemeralImageForProductUse(input, options);
```

Recommended behavior:

- delegate to `prepareImageUrlForSubmission` for URL-like inputs;
- delegate to `uploadImageBlobToStorage` for in-memory blobs that do not need fragile object URLs;
- return the same externally usable URL contract existing submit handlers already expect;
- preserve existing preflight telemetry stages where possible;
- optionally include admission metadata later only if returned by existing upload routes and needed for debugging.

The helper should live close to current upload preflight code, likely:

- `frontend/features/ai-studio/utils/imageUpload.ts`, or
- `frontend/features/ai-studio/logic/ephemeralProductImageAdmission.ts` if separating policy improves readability.

Do not add a new server route unless a concrete Phase 6 surface cannot use `/api/upload-image` or existing canonical upload/admission routes.

## Phase 6A - Audit And Classification

Objective: prove which ephemeral paths are already covered and which are not.

Tasks:

- Trace every `blob:` and `data:image/` path that can reach provider submit.
- Confirm standard reference submit and inpaint override submit use `prepareSubmissionReferenceInputs`.
- Confirm Expert Edit flattened outputs reach `prepareImageUrlForSubmission` before provider submit.
- Confirm composer attachments either resolve to durable media identity or are uploaded through `/api/upload-image` before provider submit.
- Confirm Style Creator images are extraction-only unless a provider/product submit path uses them.

Likely files:

- `frontend/features/ai-studio/hooks/taskSubmission/preflightPreparation.ts`
- `frontend/features/ai-studio/utils/imageUpload.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/defaultHandlers.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/logic/composerImageAttachment.ts`
- `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- `frontend/features/ai-studio/components/edit/expertEditStageExport.ts`
- `frontend/features/ai-studio/components/edit/expertEditSubmissionDispatch.ts`
- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`
- `frontend/features/ai-studio/components/style-creator/styleImageDerivation.ts`

Acceptance gate:

- produce a surface matrix: `covered`, `covered-by-existing-preflight`, `needs-helper-wiring`, or `not-provider-submit`;
- no code changes until the matrix shows a concrete gap.

## Phase 6B - Shared Helper, Only If Needed

Objective: add one explicit helper only if Phase 6A finds duplicated or unclear local/blob/data submit prep.

Tasks:

- Implement `prepareEphemeralImageForProductUse` as a wrapper over existing canonical helpers.
- Keep `/api/upload-image` as the server-authoritative final admission path.
- Preserve current error messages unless they are misleading for admission failure.
- Do not create durable storage for extraction-only flows.
- Do not change successful under-cap behavior.

Likely files:

- `frontend/features/ai-studio/utils/imageUpload.ts`
- or `frontend/features/ai-studio/logic/ephemeralProductImageAdmission.ts`
- tests under the same feature area.

Acceptance gate:

- helper routes blob/data still images through `/api/upload-image`;
- helper refreshes signed URLs without transforms;
- helper does not upload remote public HTTPS URLs that providers can already fetch unless current behavior requires upload for auth/private access;
- tests prove over-cap still images rely on the server route, not only browser compression.

## Phase 6C - Expert Edit Submit Hardening

Objective: ensure flattened/canvas-generated Expert Edit artifacts cannot bypass admission before provider submit.

Tasks:

- Verify flattened primary object URLs, inpaint masks, and markup reference object URLs go through `prepareSubmissionReferenceInputs`.
- Prefer passing blobs directly to an upload helper if object URL fragility causes known failures.
- Preserve layer ingress preprocessing as preview/bandwidth-only, not final authority.
- Preserve hidden advanced mode flags and existing standard/inpaint/markup behavior.

Likely files:

- `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- `frontend/features/ai-studio/components/edit/expertEditSubmissionDispatch.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/preflightPreparation.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `frontend/features/ai-studio/components/edit/__tests__/useExpertEditInlineGenerate.test.tsx`
- `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionDispatch.test.ts`

Acceptance gate:

- flattened primary blob over 25 MB is uploaded/admitted before submit;
- inpaint mask over 25 MB rejects or admits according to still-image policy;
- no object URL is sent directly to a provider route;
- no Expert Edit UI/UX changes.

## Phase 6D - Composer Attachment Submit Hardening

Objective: ensure agent/composer image attachments only become provider inputs after canonical prep.

Tasks:

- Trace `AgentAttachment.submissionImageUrl`, `imageUrl`, `imageFallbackUrls`, `referenceUrl`, and durable media identity.
- Confirm local upload blobs/data URLs are prepared through `prepareImageUrlForSubmission` when included in generation reference inputs.
- Preserve composer preview behavior and delivery status semantics.
- Avoid changing agent/Pulse semantics outside admitted-media selection.

Likely files:

- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/logic/composerImageAttachment.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/preflightPreparation.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`

Acceptance gate:

- local/blob/data composer images cannot reach provider payloads directly;
- durable/generated composer references preserve internal media refs where available;
- no composer UI/UX or delivery-state changes.

## Phase 6E - Style Creator Classification

Objective: avoid overbuilding storage/admission into Style Creator if the path is extraction-only.

Tasks:

- Confirm style file/drop intake only creates preview/extraction artifacts unless a provider submit path uses them.
- If style extraction sends images to a server/provider endpoint, ensure the extraction image is admitted or bounded before submit.
- Keep server-copy fallback for internal generated sources on `/api/media/copy-from-url`.
- Preserve current style preview data URLs and extraction dimensions.

Likely files:

- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`
- `frontend/features/ai-studio/components/style-creator/styleImageDerivation.ts`
- `frontend/features/ai-studio/components/style-creator/extraction.ts`
- `frontend/features/ai-studio/components/style-creator/intake.ts`
- `frontend/features/ai-studio/components/style-creator/__tests__/intake.test.ts`
- `frontend/features/ai-studio/components/style-creator/__tests__/extraction.test.ts`

Acceptance gate:

- extraction-only paths remain local and do not create unnecessary storage rows;
- any provider-bound style image is admitted under product-use limits;
- server-copy fallback remains canonical and transform-free;
- no Style Creator UI/UX changes.

## Phase 6F - Tests And Guards

Required tests:

- `prepareImageUrlForSubmission` uploads `blob:` and `data:image/...` inputs through `/api/upload-image`.
- over-cap still local/blob/data image path receives an admitted URL or rejects from canonical admission.
- over-cap animated local/blob/data image rejects.
- signed Supabase URLs refresh without transform options.
- Expert Edit flattened primary and inpaint mask object URLs are preflighted before provider submit.
- composer local/blob/data attachment submit does not pass raw local URL to provider.
- Style Creator classification tests prove extraction-only paths are not unnecessarily uploaded.
- Supabase transform guard remains green.

Suggested validation commands:

```bash
npm -C frontend test -- --run features/ai-studio/utils/__tests__/imageUpload.test.ts
npm -C frontend test -- --run features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts
npm -C frontend test -- --run features/ai-studio/components/edit/__tests__/useExpertEditInlineGenerate.test.tsx
npm -C frontend test -- --run features/ai-studio/components/style-creator/__tests__/intake.test.ts features/ai-studio/components/style-creator/__tests__/extraction.test.ts
npm -C frontend test -- --run lib/__tests__/supabaseTransformGuard.test.ts
npx eslint <touched files>
npm -C frontend run docs:check
git diff --check
```

Run full `npm -C frontend run type-check` when unrelated known fixture failures are cleared or when the touched-file typecheck helper is available and appropriate.

## Security And Owner Gates

Ask Dave before implementation if Phase 6 needs:

- a new route that accepts raw client storage paths, signed URLs, or arbitrary metadata;
- browser-direct writes to new durable derivative locations;
- provider submit of untrusted external URLs not already allowed by current route policy;
- persistence of signed URLs into durable state.

Ask Nuclo before implementation if Phase 6 needs:

- new storage namespace;
- new table/column/index/RLS/policy;
- storage accounting changes;
- hosted Supabase migration.

Ask Holomony before implementation if Phase 6 requires:

- Reference Grid display/preview/hydration changes;
- media performance or adaptive display changes;
- right-rail state changes.

## Stop Conditions

Stop before implementation if:

- Phase 6A cannot prove a concrete uncovered path;
- implementation would require visible UI/UX behavior changes;
- implementation would require Supabase image transformations;
- implementation would alter full-quality original authority;
- implementation would create durable storage for extraction-only paths without a provider/product-use need.

Stop during implementation if:

- provider payloads still contain raw `blob:` or `data:image/...` URLs after preflight;
- admitted still-image output can exceed 25 MB;
- animated over-cap images silently convert instead of rejecting;
- any path bypasses `/api/upload-image`, `/api/media/admit-image-asset`, `/api/media/copy-from-url`, durable upload admission, or Phase 5 admitted variant resolution without a documented reason;
- tests require changing composer, Style Creator, Expert Edit, Standard, Pulse, or right-rail UX to pass.

## Suggested Future Prompt

```text
Gutan, begin Phase 6A only. Audit ephemeral provider-submit image paths against docs/records/artifacts/agent/gutan/phase-6-ephemeral-provider-submit-admission-plan.md. Do not build yet. Produce the covered/gap matrix and recommend whether Phase 6B implementation is actually needed.
```
