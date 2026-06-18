# Voice Changer Video Normalization Implementation Plan

Purpose: anchor the implementation checkpoints for the Voice Changer large-video intake fix so the build does not depend on conversational memory.

Status: locally implemented and validated on 2026-06-18. Commit, push, deploy, and production smoke are outside this plan unless separately assigned.

## Objective

Make local Voice Changer source videos that exceed the current extraction/remux processing ceiling but fit the broader app video ingest ceiling usable by normalizing them server-side before audio extraction and final remux.

## Owner And Lane

Owner: Gutan, ShortPulse Media Ingestion Normalization Steward.

Lane: media ingestion normalization for product processing. This is not Holomony display optimization, Nuclo storage architecture, Dave security posture, or a broader AI Studio UX lane.

## Source Of Truth

- Client source staging flow: `frontend/features/ai-studio/utils/voiceChangerSourceAsset.ts`
- Voice Changer source controller: `frontend/features/ai-studio/hooks/useVoiceChangerSourceController.ts`
- Voice Changer staging service: `frontend/lib/server/mediaUploadService.ts`
- Existing Motion Control video normalization precedent: `frontend/lib/server/motionReferenceVideoNormalization.ts`
- Audio extraction service: `frontend/lib/server/mediaAudioExtraction.ts`
- Audio extraction route: `frontend/pages/api/media/extract-audio.ts`
- Final speech-to-speech/remux route: `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- Voice Changer docs: `README.md` and `docs/sops/sop_ai_studio_index.md`

## Approved Scope

- Add a Voice Changer-specific server video normalization helper.
- Route local Voice Changer staged video finalization through that helper.
- Preserve existing client contract, panel behavior, extraction flow, and final generation/remux behavior.
- Keep the broader video ingest ceiling as the maximum staged input boundary.
- Keep downstream extraction/remux byte limits as defensive processing limits after normalization.
- Update focused tests and docs for the changed behavior.

## Non-Goals

- No UI, UX, copy, layout, control, drag/drop, or loading-state changes unless unavoidable for an existing error.
- No Supabase image transformations or Supabase transformation-adjacent shortcuts.
- No Reference Grid display/performance/adaptive preview work.
- No storage schema, bucket policy, RLS, hosted environment, deployment, commit, or push work.
- No Motion Control behavior changes.
- No general video transcoding framework unless a tiny helper extraction is strictly needed.
- No support for videos above the existing app video ingest ceiling.

## Proof Requirements

- Unit coverage for the Voice Changer normalization helper.
- API/service coverage proving a staged local Voice Changer video above the old processing ceiling but within the ingest ceiling is normalized and finalized for processing.
- Existing extraction/remux defensive limit behavior remains covered.
- Existing client upload/stage/extract contract remains covered.
- Documentation reflects that Voice Changer attempts server-side normalization before rejecting staged videos above the processing ceiling.
- Targeted lint/type/test checks on touched files plus `git diff --check`.

## Stop Condition

Stop when the canonical local Voice Changer video path stages videos under the broader app video ingest ceiling, normalizes video sources that exceed the processing ceiling into a processing-safe durable source, extracts audio from that normalized source, and remuxes against that normalized source without changing the visible workflow. Also stop if implementation proves it requires UI/UX changes, storage/security/schema owner decisions, production/deploy/commit/push work, or another owner lane.

## Closeout

Closed locally on 2026-06-18.

Implemented surfaces:

- `frontend/lib/server/voiceChangerSourceVideoNormalization.ts`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/__tests__/voiceChangerSourceVideoNormalization.test.ts`
- `frontend/lib/server/__tests__/mediaUploadService.voiceChangerSource.test.ts`
- `README.md`
- `docs/sops/sop_ai_studio_index.md`

Behavior now intended:

- Local Voice Changer videos are still uploaded through the existing browser-direct preparation and staging route.
- Video staging reads local staged video bytes under the existing broader video ingest ceiling.
- If the local staged video exceeds the Voice Changer processing ceiling, ShortPulse normalizes it into a processing-safe MP4 and returns that normalized source path to the existing extraction/remux flow.
- Under-ceiling staged videos keep the existing path and are not unnecessarily normalized.
- Extraction and final remux retain the defensive processing ceiling for trusted sources that remain oversized.

Validation completed:

- `npm run test -- --run lib/server/__tests__/voiceChangerSourceVideoNormalization.test.ts lib/server/__tests__/mediaUploadService.voiceChangerSource.test.ts tests/api/media-prepare-voice-changer-source-upload-route.test.ts tests/api/media-stage-voice-changer-source-route.test.ts tests/api/media-extract-audio-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts features/ai-studio/utils/__tests__/voiceChangerSourceAsset.test.ts`
- `npm run test -- --run lib/server/__tests__/voiceChangerSourceVideoNormalization.test.ts lib/server/__tests__/mediaUploadService.voiceChangerSource.test.ts`
- `npm run type-check:touched`
- targeted `npx eslint` on touched source and test files
- `npm -C frontend run docs:check`
- `git diff --check`
- touched-file scan for Supabase image transformation usage returned no matches

Outside local closeout:

- Production deployment and production smoke are not part of this local implementation closeout.
- Real uploaded large-video behavior should still be manually smoked after deploy with representative files.
- Commit and push are intentionally outside this closeout unless separately assigned.
