/**
 * Canonical ElevenLabs model identities used across admin inventory, AI Studio, and API routes.
 */
import type { PricingStrategyId } from "./pricingTypes";

export const ELEVENLABS_MUSIC_MODEL_ID = "music_v1";
export const ELEVENLABS_SOUND_EFFECTS_MODEL_ID = "eleven_text_to_sound_v2";
export const ELEVENLABS_VOICEOVER_MODEL_ID = "eleven_multilingual_v2";
export const ELEVENLABS_VOICE_CHANGER_MODEL_ID = "eleven_multilingual_sts_v2";
export const ELEVENLABS_VOICE_DESIGN_MODEL_ID = "eleven_multilingual_ttv_v2";

export type ElevenLabsModelPricingAuthority = "shared_policy" | "local_pricing" | "metadata_only";

export type ElevenLabsRuntimeModelDefinition = {
  id: string;
  label: string;
  pricingAuthority: ElevenLabsModelPricingAuthority;
  pricingStrategy?: PricingStrategyId;
  defaultDurationSeconds?: number;
  defaultGenerationCount?: number;
  defaultSourceDurationSeconds?: number;
  defaultTextCharacters?: number;
  maxDurationSeconds?: number;
  minDurationSeconds?: number;
};

export const ELEVENLABS_RUNTIME_MODEL_DEFINITIONS: ElevenLabsRuntimeModelDefinition[] = [
  {
    id: ELEVENLABS_MUSIC_MODEL_ID,
    label: "ElevenLabs Music",
    pricingAuthority: "shared_policy",
    pricingStrategy: "elevenlabs-music-per-minute",
    defaultDurationSeconds: 30,
    minDurationSeconds: 8,
    maxDurationSeconds: 180,
  },
  {
    id: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
    label: "ElevenLabs Sound Effects",
    pricingAuthority: "shared_policy",
    pricingStrategy: "elevenlabs-sound-effect",
    defaultGenerationCount: 1,
    minDurationSeconds: 0.5,
    maxDurationSeconds: 30,
  },
  {
    id: ELEVENLABS_VOICEOVER_MODEL_ID,
    label: "ElevenLabs Voiceover",
    pricingAuthority: "shared_policy",
    pricingStrategy: "elevenlabs-text-to-speech-per-kchar",
    defaultTextCharacters: 1000,
  },
  {
    id: ELEVENLABS_VOICE_CHANGER_MODEL_ID,
    label: "ElevenLabs Voice Changer",
    pricingAuthority: "shared_policy",
    pricingStrategy: "elevenlabs-voice-changer-per-minute",
    defaultSourceDurationSeconds: 60,
  },
  {
    id: ELEVENLABS_VOICE_DESIGN_MODEL_ID,
    label: "ElevenLabs Voice Design",
    pricingAuthority: "metadata_only",
  },
];
