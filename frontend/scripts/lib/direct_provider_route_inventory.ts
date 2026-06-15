import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  ELEVENLABS_VOICE_DESIGN_MODEL_ID,
} from "../../lib/model-runtime/elevenLabsModels";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../lib/model-runtime/openAiImage2";

export type DirectProviderRouteKind = "create" | "edit" | "audio-generate" | "metadata-preview";

export type DirectProviderRouteAuthority =
  | "server-constant"
  | "catalog-default-role-allowlist"
  | "catalog-default-role-server-default";

export type DirectProviderRouteInventoryEntry = {
  modelId: string;
  routePath: string;
  directRouteKind: DirectProviderRouteKind;
  authority: DirectProviderRouteAuthority;
  requiredSymbols: string[];
};

export const DIRECT_PROVIDER_ROUTE_INVENTORY: DirectProviderRouteInventoryEntry[] = [
  {
    modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
    routePath: "frontend/pages/api/openai/image-generate.ts",
    directRouteKind: "create",
    authority: "server-constant",
    requiredSymbols: ["OPENAI_GPT_IMAGE_2_MODEL_ID", "chargeGenerationRequest"],
  },
  {
    modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
    routePath: "frontend/pages/api/openai/image-edit.ts",
    directRouteKind: "edit",
    authority: "server-constant",
    requiredSymbols: ["OPENAI_GPT_IMAGE_2_MODEL_ID", "chargeGenerationRequest"],
  },
  {
    modelId: ELEVENLABS_MUSIC_MODEL_ID,
    routePath: "frontend/pages/api/elevenlabs/music.ts",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-server-default",
    requiredSymbols: ["resolveRequiredAudioMusicModelId", "chargeGenerationRequest"],
  },
  {
    modelId: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
    routePath: "frontend/pages/api/elevenlabs/sound-effects.ts",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-server-default",
    requiredSymbols: ["resolveRequiredAudioSfxModelId", "chargeGenerationRequest"],
  },
  {
    modelId: ELEVENLABS_VOICEOVER_MODEL_ID,
    routePath: "frontend/pages/api/elevenlabs/text-to-speech.ts",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-allowlist",
    requiredSymbols: ["resolveRequiredAudioVoiceoverModelId", "ALLOWED_MODEL_IDS"],
  },
  {
    modelId: ELEVENLABS_VOICE_CHANGER_MODEL_ID,
    routePath: "frontend/pages/api/elevenlabs/speech-to-speech.ts",
    directRouteKind: "audio-generate",
    authority: "catalog-default-role-server-default",
    requiredSymbols: ["resolveRequiredAudioVoiceChangerModelId", "chargeGenerationRequest"],
  },
  {
    modelId: ELEVENLABS_VOICE_DESIGN_MODEL_ID,
    routePath: "frontend/pages/api/elevenlabs/text-to-voice/design.ts",
    directRouteKind: "metadata-preview",
    authority: "catalog-default-role-server-default",
    requiredSymbols: ["resolveRequiredAudioVoiceDesignModelId", "generateDesignedVoicePreview"],
  },
];

export const listDirectProviderRouteModelIds = (): string[] =>
  [...new Set(DIRECT_PROVIDER_ROUTE_INVENTORY.map((entry) => entry.modelId))].sort((a, b) =>
    a.localeCompare(b)
  );
