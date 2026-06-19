# Copperknot Checkpoint - Sound Provider Env Contract

Date: `2026-06-18`

Touched:
- `scripts/lib/vercel_env_contract.mjs`
- `frontend/tests/scripts/vercel-env-contract.test.mjs`
- `frontend/tests/scripts/vercel-env-file-cli.test.mjs`

Did:
- Skipped higher-priority handed-off/gated lanes and active dirty Video/Motion Control files.
- Audited Sound's next gap: production-safe provider/env posture.
- Found that `ELEVENLABS_API_KEY` was declared in `.env.example` but not required by the production Vercel env contract.
- Added `ELEVENLABS_API_KEY` as a production-required Vercel key and as a sensitive presence-only key.
- Updated env-contract tests so Sound credentials stay covered by readiness checks.
- Ran production Vercel env contract: passed for production with existing undeclared-key warnings only.
- Ran production-safe unauthenticated Sound route probes: voices, TTS, music, sound effects, speech-to-speech, voice design, voice create, and voice clone all returned `401`.

Boundary:
- This hardens production env readiness gates only.
- It does not prove live ElevenLabs provider success, authenticated output insertion, or credit-consuming Sound generation.
