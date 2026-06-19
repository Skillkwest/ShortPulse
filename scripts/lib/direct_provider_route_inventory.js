const DIRECT_PROVIDER_ROUTE_INVENTORY = [
  {
    routePath: "frontend/pages/api/openai/image-generate.ts",
    modelId: "gpt-image-2",
    provider: "openai",
    directRouteKind: "create",
    authority: "server-constant",
    requiredSymbols: [
      "OPENAI_GPT_IMAGE_2_MODEL_ID",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/openai/image-edit.ts",
    modelId: "gpt-image-2",
    provider: "openai",
    directRouteKind: "edit",
    authority: "server-constant",
    requiredSymbols: [
      "OPENAI_GPT_IMAGE_2_MODEL_ID",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/elevenlabs/music.ts",
    modelId: "music_v1",
    provider: "elevenlabs",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-allowlist",
    requiredSymbols: [
      "resolveRequiredAudioMusicModelId",
      "ALLOWED_MODEL_IDS",
      "ALLOWED_MODEL_IDS.has(modelId)",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/elevenlabs/sound-effects.ts",
    modelId: "eleven_text_to_sound_v2",
    provider: "elevenlabs",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-allowlist",
    requiredSymbols: [
      "resolveRequiredAudioSoundEffectsModelId",
      "ALLOWED_MODEL_IDS",
      "ALLOWED_MODEL_IDS.has(modelId)",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/elevenlabs/text-to-speech.ts",
    modelId: "eleven_v3",
    provider: "elevenlabs",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-allowlist",
    requiredSymbols: [
      "resolveRequiredAudioVoiceoverModelId",
      "ALLOWED_MODEL_IDS",
      "ALLOWED_MODEL_IDS.has(modelId)",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/elevenlabs/speech-to-speech.ts",
    modelId: "eleven_multilingual_sts_v2",
    provider: "elevenlabs",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-allowlist",
    requiredSymbols: [
      "resolveRequiredAudioVoiceChangerModelId",
      "ALLOWED_MODEL_IDS",
      "ALLOWED_MODEL_IDS.has(modelId)",
      "requireApiUser",
      "chargeGenerationRequest",
    ],
  },
  {
    routePath: "frontend/pages/api/elevenlabs/text-to-voice/design.ts",
    modelId: "eleven_multilingual_ttv_v2",
    provider: "elevenlabs",
    directRouteKind: "metadata-preview",
    authority: "catalog-default-role-server-default",
    requiredSymbols: [
      "resolveRequiredAudioVoiceDesignModelId",
      "DEFAULT_VOICE_DESIGN_MODEL_ID",
      "requireApiUser",
    ],
  },
];

const listDirectProviderRouteModelIds = () =>
  Array.from(
    new Set(DIRECT_PROVIDER_ROUTE_INVENTORY.map((entry) => entry.modelId)),
  ).sort((a, b) => a.localeCompare(b));

module.exports = {
  DIRECT_PROVIDER_ROUTE_INVENTORY,
  listDirectProviderRouteModelIds,
};
