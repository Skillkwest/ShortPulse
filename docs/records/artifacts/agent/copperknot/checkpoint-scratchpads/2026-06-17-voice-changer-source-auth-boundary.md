# Voice Changer Source Auth Boundary

Date: 2026-06-17
Agent: Copperknot

Touched:
- `frontend/pages/api/media/prepare-voice-changer-source-upload.ts`
- `frontend/pages/api/media/stage-voice-changer-source.ts`
- `frontend/pages/api/media/extract-audio.ts`
- `frontend/tests/api/media-prepare-voice-changer-source-upload-route.test.ts`
- `frontend/tests/api/media-stage-voice-changer-source-route.test.ts`
- `frontend/tests/api/media-extract-audio-route.test.ts`

Did:
- Added route-owned auth verifier exception logging for Voice Changer source upload preparation, source finalization, and video-to-audio extraction.
- Added tests proving auth verifier failures stop before rate limiting, storage target creation, source finalization, media reads, temp files, extraction, Supabase storage, or signing work.

Validation:
- `npm -C frontend run test -- --run tests/api/media-prepare-voice-changer-source-upload-route.test.ts tests/api/media-stage-voice-changer-source-route.test.ts tests/api/media-extract-audio-route.test.ts`: 18 passed.
- `npm -C frontend run test -- --run tests/api/media-prepare-voice-changer-source-upload-route.test.ts tests/api/media-stage-voice-changer-source-route.test.ts tests/api/media-extract-audio-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts`: 39 passed.
- `npm -C frontend run type-check:touched`: passed.
- `npm -C frontend run docs:check`: passed.
- `git diff --check -- <touched Voice Changer source route/test files>`: passed.

Proof boundary:
- Local source/test proof only. No authenticated production Voice Changer staging/extraction proof, credit-consuming generation proof, commit, push, or deploy.
- Production route parity still fails on exposed retired routes `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
