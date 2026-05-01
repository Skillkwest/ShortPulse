# ElevenLabs Audio Models

Purpose: document the canonical ElevenLabs model ids and ShortPulse route contracts used by AI Studio audio generation, voice change, music, sound effects, and voice-design preview flows.

## Shared provider reference

- Provider docs: `https://elevenlabs.io/docs`
- Runtime catalog source:
  - `frontend/lib/model-runtime/modelCatalog.ts`
  - `frontend/lib/model-runtime/elevenLabsModels.ts`

## Canonical model ids

- `eleven_multilingual_v2`
  - ShortPulse label: ElevenLabs Voiceover
  - Route: `POST /api/elevenlabs/text-to-speech`
  - Billing basis: billed character count
- `eleven_multilingual_sts_v2`
  - ShortPulse label: ElevenLabs Voice Changer
  - Route: `POST /api/elevenlabs/speech-to-speech`
  - Billing basis: processed source duration
- `eleven_text_to_sound_v2`
  - ShortPulse label: ElevenLabs Sound Effects
  - Route: `POST /api/elevenlabs/sound-effects`
  - Billing basis: generation or explicit duration
- `music_v1`
  - ShortPulse label: ElevenLabs Music
  - Route: `POST /api/elevenlabs/music`
  - Billing basis: requested duration
- `eleven_multilingual_ttv_v2`
  - ShortPulse label: ElevenLabs Voice Design
  - Routes:
    - `POST /api/elevenlabs/text-to-voice/design`
    - `POST /api/elevenlabs/text-to-voice/create`
  - Billing basis: metadata-only provider preview workflow, not part of shared user-billable runtime pricing

## Route-level auth

All ShortPulse ElevenLabs routes use handler-level bearer auth via `requireApiUser`.

## ShortPulse routing contract

- Voiceover generation:
  - route: `POST /api/elevenlabs/text-to-speech`
  - input family: text prompt plus selected saved/provider voice
  - output: persisted audio payload for Reference Grid insertion
- Voice changer generation:
  - route: `POST /api/elevenlabs/speech-to-speech`
  - input family: staged source audio or trusted source URL plus selected target voice
  - output: persisted converted audio, and for staged-video flows an additional remuxed video payload
- Music generation:
  - route: `POST /api/elevenlabs/music`
  - input family: prompt-first music controls (`text`, `durationSeconds`, `bpm`, `mode`, `structure`, `energyPercent`, `outputFormat`)
  - output: persisted generated audio payload
- Sound effects generation:
  - route: `POST /api/elevenlabs/sound-effects`
  - input family: prompt-driven SFX controls (`text`, `durationSeconds`, `loop`, `promptInfluence`, `outputFormat`)
  - output: persisted generated audio payload
- Voice design preview/create:
  - routes:
    - `POST /api/elevenlabs/text-to-voice/design`
    - `POST /api/elevenlabs/text-to-voice/create`
  - input family: voice description plus selected generated preview
  - output: reusable provider voice persisted in the user-scoped saved-voice cache
  - Billing basis: metadata-only provider voice creation workflow, not part of shared user-billable runtime pricing
- Voice clone create:
  - routes:
    - `POST /api/media/stage-voice-clone-source`
    - `POST /api/elevenlabs/voices/clone`
  - input family: staged local audio sample of at least 1 minute plus voice name and optional description
  - output: reusable provider voice persisted in the user-scoped saved-voice cache
  - Billing basis: metadata-only provider voice creation workflow, not part of shared user-billable runtime pricing

## Runtime pricing notes

- Shared runtime pricing treats these ids as canonical pricing subjects:
  - `eleven_multilingual_v2`
  - `eleven_multilingual_sts_v2`
  - `eleven_text_to_sound_v2`
  - `music_v1`
- `eleven_multilingual_ttv_v2` remains `metadata_only` in `frontend/lib/model-runtime/modelCatalog.ts` and exists to keep provider preview/create metadata under canonical model-id governance.

## Related docs

- `docs/api/api-internal-routes.md`
- `docs/product/ai-studio-pricing.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_ai_studio_style_creator.md`
