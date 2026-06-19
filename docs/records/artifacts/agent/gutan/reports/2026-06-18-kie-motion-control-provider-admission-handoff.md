# Kie Motion Control Provider-Admission Handoff

Date: 2026-06-18

Owner/lane: Gutan, media-ingestion normalization.

Status: implementation-ready handoff. No app code was changed during the audit that produced this packet.

## Goal Prompt For Next Agent

Pursue the goal of completing the Kie Kling 3.0 Motion Control provider-admission buildout end-to-end.

Use this handoff as the plan source of truth:

`docs/records/artifacts/agent/gutan/reports/2026-06-18-kie-motion-control-provider-admission-handoff.md`

Objective: make Motion Control reliably accept local uploads and Reference Grid inputs by adding a canonical server-side provider-admission layer for Kie Motion Control media. The fix must preserve current UI/UX and product behavior, must not use Supabase image transformations, must not alter Reference Grid display compression or full-quality export behavior, and must not create workaround/fallback authorities.

Owner/lane: Gutan owns media-ingestion normalization for product processing and generation. Stay out of Holomony's display-performance lane, Nuclo's storage architecture lane, and Dave's security lane except where their boundaries require review or proof.

Approved scope:

- Add or update server-side media admission code needed to produce Kie Motion Control-compatible character images and motion videos before provider submit.
- Route Motion Control local uploads, Reference Grid/internal refs, and signed storage sources through the same canonical provider-admission path.
- Preserve existing Motion Control UI/UX and visible behavior except for replacing provider `500`/`File type not supported` failures with deterministic pre-submit errors when media cannot be admitted.
- Add focused tests for the Motion Control provider-admission path.
- Update only directly relevant docs if code behavior changes.

Non-goals:

- Do not change Reference Grid display compression, card rendering, detail modal behavior, export/save original authority, virtualization, or performance tuning.
- Do not change Supabase buckets, RLS, migrations, storage policy, or environment topology unless explicitly approved after Nuclo/Dave review.
- Do not use Supabase image transformations, signed transform params, or `/storage/v1/render/image/` URLs.
- Do not broaden this into a generic media rewrite, a mobile UX pass, or a pricing/credits lane.
- Do not change Motion Control layout, copy, mode selection, drop-zone behavior, or generation semantics unless the user explicitly approves.

Proof requirements:

- Focused unit/integration tests prove local image upload, Reference Grid/internal image reuse, and storage-path image reuse produce Kie-compatible `jpg/jpeg/png` assets under Kie's Motion Control image cap.
- Tests prove product-valid but Kie-invalid image formats such as AVIF/WebP do not reach Kie Motion Control unchanged.
- Tests prove oversized character images are admitted to Kie-compatible media without replacing the user's original/full-quality source.
- Tests prove motion videos remain provider-facing MP4/QuickTime, 3-30 seconds, under Kie's video cap, with dimensions/aspect checked where feasible.
- Tests prove impossible media fails before provider submit with deterministic client-fixable error detail.
- Existing focused Motion Control submit, Kie model-contract, Kie media-guard, and motion-reference upload tests still pass.
- No Supabase image transformation usage is introduced.

Implementation stop condition:

Stop when Motion Control submit has one canonical provider-admission path for both character image and motion video inputs, local tests prove the accepted/rejected cases above, and remaining proof depends on production logs/manual smoke/deploy work outside the local implementation lane.

## Problem Statement

Production Motion Control currently fails consistently at `/api/fal/kie-kling-submit` with a browser `500` and a Reference Grid failure card saying `File type not supported`.

Observed user context:

- Character image is PNG or comes from Reference Grid.
- Motion video is MP4 or comes from Reference Grid.
- Direct computer upload and Reference Grid drag/drop both fail with the same error.

Audit conclusion: the most likely shared root cause is not the basic MP4 upload path. It is a provider-admission gap between ShortPulse product-valid media and Kie Motion Control-valid media, especially for the character image.

Kie Motion Control's current constraints are stricter than ShortPulse's product image ingestion constraints:

- Character image: JPEG, PNG, or JPG only; max 10 MB; size greater than 340 px; aspect ratio 2:5 to 5:2; clear head/shoulders/torso.
- Motion video: MP4 or QuickTime; 3-30 seconds; max 100 MB; size greater than 340 px; aspect ratio 2:5 to 5:2; clear head/shoulders/torso.
- Maximum one image and one video per request.

ShortPulse's current product image admission is app-wide and allows images up to 25 MB for product use. Oversized images can be normalized to AVIF/WebP/JPEG, which is correct for product ingestion but not always valid for Kie Motion Control character images.

## Evidence Summary

Primary docs and code evidence:

- `docs/troubleshooting.md` already names this exact symptom under `Kling Motion Control returns File type not supported`.
- `docs/sops/sop_video_generation.md` documents Motion Control as `model=kling-3.0/motion-control` with one character image, one provider-facing MP4/MOV motion video, and `mode=720p|1080p`.
- `docs/api/api-kie-kling-3-0.md` documents the internal Kie Kling 3.0 contract and current Motion Control shape.
- Kie current docs confirm Motion Control uses `input_urls`, `video_urls`, `mode`, `character_orientation`, and `background_source`, and confirm stricter file requirements.
- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts` prepares Motion Control image and video before submit, uploads both to Kie temporary storage, then submits `input_urls` and `video_urls`.
- `frontend/features/ai-studio/utils/videoUpload.ts` correctly treats only `videos/motion-control/*` as proof that a motion video was normalized for provider use.
- `frontend/lib/server/motionReferenceVideoNormalization.ts` transcodes motion videos to MP4 and enforces 3-30 seconds.
- `frontend/lib/server/imageAdmission.ts` and `frontend/lib/server/imageUploadNormalization.ts` enforce the product image admission lane, not Kie Motion Control-specific 10 MB/type/aspect requirements.
- `frontend/features/ai-studio/components/useReferencePropertiesInteractions.ts` can preserve internal Reference Grid image refs instead of re-staging them, which means original product media can be uploaded to Kie temp storage unchanged.
- `frontend/pages/api/kie/upload-url.ts` can upload from a user storage path to Kie temp storage using the stored object's MIME/filename; it does not apply Motion Control-specific character-image admission.
- `frontend/lib/server/providerIntegration/kieSubmitMediaGuards.ts` checks URL shape, extension, TTL, and content-type, but does not prove image byte size/dimensions/aspect or MP4 container/codec details.

Focused validation already run during audit:

```bash
cd frontend
npm test -- --run features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts tests/api/motion-reference-video-upload-route.test.ts lib/server/providerIntegration/__tests__/kieSubmitMediaGuards.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts
```

Result: 4 files passed, 81 tests passed.

Interpretation: current tests prove the intended payload shape and some guardrails. They do not prove Kie Motion Control provider-admission constraints for actual image/video bytes.

## Root-Cause Ranking

1. Most likely: character image reaches Kie as product-valid but Kie-invalid media.

Examples:

- PNG over 10 MB but under ShortPulse's 25 MB cap.
- Product-normalized AVIF/WebP admitted by ShortPulse but unsupported by Kie Motion Control image requirements.
- Reference Grid/internal image ref bypasses provider-specific re-staging and uploads original storage object to Kie temp storage.
- Image dimensions/aspect outside Kie's Motion Control bounds.

2. Possible: motion video is format-normalized to MP4 but not fully provider-admitted.

Examples:

- Output exceeds Kie's 100 MB cap after transcode.
- Video dimensions/aspect fall outside Kie's Motion Control bounds.
- MP4 container is present but the actual temp-upload or provider fetch behavior still causes Kie to reject it.

3. Less likely: payload field names are stale.

Kie current docs still match the repo shape: root `model="kling-3.0/motion-control"`, body `input.input_urls`, `input.video_urls`, `mode`, `character_orientation`, `background_source`.

4. Less likely but still possible: production deploy/log state differs from local repo truth.

Production `app_error_logs` and the exact failing asset metadata were not available during this audit. Keep that as the remaining runtime proof gap.

## Recommended Architecture

Create a dedicated Kie Motion Control provider-admission service. It should sit between ShortPulse product media and Kie temporary upload/provider submit.

Suggested module shape:

- `frontend/lib/server/kieMotionControlMediaAdmission.ts`
- Optional shared policy constants under `frontend/lib/server/` or `frontend/lib/model-runtime/` only if needed by both route and tests.

Suggested responsibilities:

- Admit character images for Kie Motion Control:
  - accept source buffer, filename, MIME, and optional source storage context;
  - decode dimensions;
  - reject unreadable images;
  - enforce minimum dimensions and aspect ratio bounds;
  - output only `image/jpeg` or `image/png`;
  - target under Kie's 10 MB image cap;
  - preserve original storage authority and create only a provider-use derivative;
  - return buffer, filename, MIME, size, dimensions, and admission metadata.
- Admit motion videos for Kie Motion Control:
  - reuse existing MP4 normalization as the canonical base;
  - explicitly enforce 3-30 seconds;
  - explicitly enforce output under Kie's 100 MB cap;
  - add dimension/aspect probe where feasible;
  - output provider-facing MP4 unless QuickTime preservation is deliberately chosen and tested.
- Provide deterministic errors:
  - invalid type;
  - unsupported dimensions/aspect;
  - still over provider cap after admission;
  - unreadable image/video;
  - unsupported animated/alpha case if the path cannot safely convert.

Important boundary: this is provider-admission for Motion Control, not display optimization and not Supabase storage architecture.

## Integration Plan

1. Read startup and lane authority.

- Root `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- Gutan docs:
  - `docs/agents/gutan/AGENTS.md`
  - `docs/agents/gutan/standard-operating-procedure.md`
  - `docs/agents/gutan/ownership-manifest.md`
  - `docs/agents/gutan/memory.md`
- Motion/Kie docs:
  - `docs/troubleshooting.md`
  - `docs/sops/sop_video_generation.md`
  - `docs/api/api-kie-kling-3-0.md`

2. Add provider-admission policy and service.

- Define Kie Motion Control image constraints:
  - allowed output MIME: `image/jpeg`, `image/png`
  - max bytes: 10 MB
  - min dimension: greater than or equal to the repo-chosen interpretation of Kie's "greater than 340px"; prefer conservative `min(width, height) >= 341` if no existing convention exists
  - aspect ratio: 2:5 to 5:2
- Define Kie Motion Control video constraints:
  - allowed output MIME: `video/mp4` and possibly `video/quicktime`
  - max bytes: 100 MB
  - duration: 3-30 seconds
  - min dimension/aspect bounds matching provider docs where probeable
- Use `sharp` for image admission.
- Use existing ffmpeg helpers for video duration/transcode; extend or add a narrow metadata probe if dimensions are needed.

3. Wire character-image admission into Motion Control submit preparation.

Best candidate seam:

- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- `prepareKieInputUrl`
- `uploadStoragePathToKieTemporaryFile`
- `/api/kie/upload-url`

Preferred implementation pattern:

- Do not put heavy provider-specific media transformations in the browser submit handler.
- Add a server route or extend `/api/kie/upload-url` with an explicit `providerUse`/`admissionProfile` value such as `kie_motion_control_character_image`.
- When `storagePath` is provided for a Motion Control character image, the server downloads the user-owned source, admits it to Kie-compatible bytes, then streams that admitted derivative to Kie file upload.
- When a local/blob image has already been staged through product reference upload, still run the Kie Motion Control character-image provider admission before Kie temp upload.
- Ensure this explicit admission path is only used for Motion Control character images, not every Kie image model.

4. Wire motion-video proof into Motion Control video preparation.

- Keep `prepareMotionReferenceVideoUrl` and `stage-motion-reference-video` as the canonical video normalization path.
- Extend server-side video normalization/admission to enforce any missing Kie Motion Control constraints:
  - output byte cap;
  - dimensions/aspect if metadata probe is added;
  - deterministic error if impossible.
- Ensure Reference Grid video sources outside `videos/motion-control/*` still get copied through the canonical normalization route before provider submit.

5. Preserve originals.

- Do not overwrite Reference Grid originals.
- Do not change detail/save/export authority.
- Store or stream provider-admitted derivatives as transient/provider-use artifacts only.
- If a durable derivative is needed, keep it app-owned and explicit; do not use Supabase transformations.

6. Improve deterministic failures without UI redesign.

- If provider admission fails before submit, return a clear existing-style generation failure.
- Keep the visible Motion Control UI stable.
- Prefer existing `notifyGenerationFailure` path and server `KIE_MEDIA_INPUT_INVALID`-style codes.

7. Add tests.

Minimum focused tests:

- Local Motion Control PNG under 10 MB remains Kie-compatible.
- Local Motion Control PNG over 10 MB but under 25 MB is admitted below 10 MB as JPEG/PNG.
- Product-valid WebP/AVIF image is converted before Motion Control Kie upload or rejected deterministically if conversion cannot preserve requirements.
- Reference Grid/internal image ref does not upload original Kie-invalid bytes unchanged.
- Reference Grid/internal image ref produces Kie-compatible temp upload input.
- Motion video WebM/MP4 source still stages to provider-facing MP4.
- Motion video output over 100 MB fails before provider submit.
- Motion video invalid duration still fails before provider submit.
- Invalid dimensions/aspect for image/video fail before provider submit if that check is implemented.
- Kie submit payload remains `model=kling-3.0/motion-control`, one `input_urls`, one `video_urls`, `mode=720p|1080p`, no standard-video `aspect_ratio` or `duration`.
- Existing tests listed in the proof command still pass.

Suggested test files to update or add:

- `frontend/features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts`
- `frontend/tests/api/motion-reference-video-upload-route.test.ts`
- `frontend/tests/api/fal-submit-proxy.test.ts`
- `frontend/lib/server/providerIntegration/__tests__/kieSubmitMediaGuards.test.ts`
- New server test for the provider-admission module.

## Approaches Considered

### Approach A: Client-side resize/compress only

Benefits:

- Quick to build.
- Reduces upload bandwidth.

Risks:

- Browser-only authority is bypassable.
- Reference Grid/internal refs still fail.
- Duplicates existing admission logic.
- Hard to prove provider compliance.

Decision: reject as canonical fix. It can be a future UX optimization only.

### Approach B: Expand global product image admission to Kie constraints

Benefits:

- Reuses Gutan's existing image admission architecture.
- Simple rule: all product images become provider-safe.

Risks:

- Incorrectly lowers app-wide image behavior from 25 MB to Kie Motion Control's 10 MB.
- Could degrade Reference Grid, save/export, and non-Kie image workflows.
- Violates the user's requirement that large originals remain valid product assets.

Decision: reject.

### Approach C: Provider-admit only inside `/api/kie/upload-url`

Benefits:

- Close to the final provider boundary.
- Covers storage path, signed URL, and binary upload sources if designed carefully.
- Keeps UI unchanged.

Risks:

- Route can become too generic if admission profile is implicit.
- Must not accidentally change non-Motion Kie image workflows.
- Needs explicit tests proving Motion Control-only behavior.

Decision: use as a likely integration seam, but only with explicit `providerUse`/`admissionProfile`.

### Approach D: Dedicated Motion Control provider-admission route/service called before Kie upload

Benefits:

- Clean ownership and explicit constraints.
- Easier to test than hidden generic upload behavior.
- Can preserve original media and emit provider-use derivative metadata.

Risks:

- More route surface if implemented as a new API.
- Must avoid creating duplicate authorities beside `/api/kie/upload-url`.

Decision: acceptable if implemented as one canonical service and one explicit route/transport seam.

### Recommended blend

Use one canonical server service for Kie Motion Control provider admission. Integrate it at the Kie upload/provider boundary with explicit Motion Control context. Keep product ingestion and display behavior unchanged.

## Files To Audit Before Editing

- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- `frontend/features/ai-studio/utils/videoUpload.ts`
- `frontend/features/ai-studio/utils/imageUpload.ts`
- `frontend/features/ai-studio/components/useReferencePropertiesInteractions.ts`
- `frontend/features/ai-studio/logic/motionReferenceVideoDropSource.ts`
- `frontend/pages/api/kie/upload-url.ts`
- `frontend/pages/api/media/stage-reference-image.ts`
- `frontend/pages/api/media/stage-motion-reference-video.ts`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/imageAdmission.ts`
- `frontend/lib/server/imageUploadNormalization.ts`
- `frontend/lib/server/motionReferenceVideoNormalization.ts`
- `frontend/lib/server/providerIntegration/kieSubmitMediaGuards.ts`
- `frontend/lib/server/providerIntegration/kieModelContracts.ts`
- `frontend/lib/model-runtime/modelCatalog.ts`

## Validation Commands

Start focused:

```bash
cd frontend
npm test -- --run features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts tests/api/motion-reference-video-upload-route.test.ts lib/server/providerIntegration/__tests__/kieSubmitMediaGuards.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts
```

Then run any new provider-admission tests directly.

If touched TypeScript spans multiple server/client imports, run the repo's touched type-check if available or the nearest relevant type-check/lint command from `frontend/package.json`.

Do not claim production success from local tests. Production proof requires deploy plus manual smoke and/or `app_error_logs` evidence.

## Owner Boundaries And Handoffs

Holomony:

- Owns Reference Grid display compression and performance.
- Do not change display previews, adaptive rendering, card hydration, virtualization, or export/detail behavior.

Nuclo:

- Owns Supabase storage architecture, bucket policies, RLS, migrations, and production storage/runtime proof.
- If implementation requires new tables, bucket policy changes, or storage namespace changes, stop for Nuclo review.

Dave:

- Owns security and attack-surface review.
- If adding a new API route or broadening `/api/kie/upload-url` request authority, verify auth, ownership checks, rate limits, SSRF posture, path constraints, and no secret exposure.

Gutan:

- Owns the provider-admission normalization rules and canonical media-processing seam.

## Open Runtime Proof Gap

The audit did not have:

- exact failing production request payload;
- exact Kie response body from `/api/fal/kie-kling-submit`;
- production `app_error_logs` entry;
- source metadata for the failing PNG and MP4.

These are not blockers to implementation, because the repo and Kie docs show a clear canonical gap. They are required only before claiming production root-cause certainty or production fix success.

## Closeout Requirements For Implementing Agent

Closeout must state:

- what canonical provider-admission path was added;
- which Motion Control surfaces now use it;
- what tests passed;
- whether exact production smoke is still outside local proof;
- whether Nuclo/Dave review was required or not;
- confirmation that no Supabase transformations were introduced;
- confirmation that original/full-quality Reference Grid media remains preserved for save/export.
