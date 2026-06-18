# ElevenLabs Paid Sound Auth Boundary

Date: 2026-06-17
Agent: Copperknot

Touched:
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/tests/api/elevenlabs-text-to-speech-route.test.ts`
- `frontend/tests/api/elevenlabs-music-route.test.ts`
- `frontend/tests/api/elevenlabs-sound-effects-route.test.ts`
- `frontend/tests/api/elevenlabs-speech-to-speech-route.test.ts`

Did:
- Added route-owned auth verifier exception logging for four paid ElevenLabs Sound generation routes.
- Added tests proving auth verifier failures stop before voice lookup, billing, provider submission, duration/title work, persistence, and multipart parsing where relevant.
- Did not touch dirty shared helper `frontend/lib/server/elevenlabs.ts`.

Validation:
- `npm -C frontend run test -- --run tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts`: 33 passed.
- `npm -C frontend run test -- --run tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/api/generation-billing.reservations.test.ts`: 53 passed; expected billing fail-closed stderr fixture lines appeared.
- `npm -C frontend run type-check:touched`: passed.
- `npm -C frontend run docs:check`: passed.
- `git diff --check -- <touched Sound route/test files>`: passed.

Proof boundary:
- Local source/test proof only. No provider calls, credit-consuming production tests, commit, push, deploy, or production URL proof.
