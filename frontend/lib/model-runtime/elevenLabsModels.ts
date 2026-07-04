/**
 * Canonical ElevenLabs model identities and pricing authority labels shared across
 * admin inventory, AI Studio, and API routes.
 */

export const ELEVENLABS_MUSIC_MODEL_ID = "music_v1";
export const ELEVENLABS_SOUND_EFFECTS_MODEL_ID = "eleven_text_to_sound_v2";
export const ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID = "auto-duration";
export const ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID = "explicit-duration";
export const ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL = "Explicit duration";
export const ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL = "Auto duration";
export const ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS = 5;
export const ELEVENLABS_VOICEOVER_MODEL_ID = "eleven_v3";
export const ELEVENLABS_VOICE_CHANGER_MODEL_ID = "eleven_multilingual_sts_v2";
export const ELEVENLABS_VOICE_DESIGN_MODEL_ID = "eleven_multilingual_ttv_v2";

export type ElevenLabsModelPricingAuthority = "shared_policy" | "local_pricing" | "metadata_only";
