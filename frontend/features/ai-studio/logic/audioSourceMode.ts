import {
  resolveRequiredAudioMusicModelId,
  resolveRequiredAudioSoundEffectsModelId,
  resolveRequiredAudioVoiceChangerModelId,
  resolveRequiredAudioVoiceoverModelId,
} from "../../../lib/model-runtime/modelCatalog";
import type { StudioAudioSourceMode } from "../types";

const AUDIO_SOURCE_MODE_VALUES = new Set<StudioAudioSourceMode>([
  "voiceover",
  "voice-changer",
  "sound-effects",
  "music",
]);

const AUDIO_SOURCE_MODE_BY_MODEL_ID = new Map<string, StudioAudioSourceMode>([
  [resolveRequiredAudioVoiceoverModelId(), "voiceover"],
  [resolveRequiredAudioVoiceChangerModelId(), "voice-changer"],
  [resolveRequiredAudioSoundEffectsModelId(), "sound-effects"],
  [resolveRequiredAudioMusicModelId(), "music"],
]);

const normalizeTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeAudioSourceMode = (value: unknown): StudioAudioSourceMode | null => {
  const normalized = normalizeTrimmedString(value)?.toLowerCase();
  if (!normalized) return null;
  return AUDIO_SOURCE_MODE_VALUES.has(normalized as StudioAudioSourceMode)
    ? (normalized as StudioAudioSourceMode)
    : null;
};

export const resolveAudioSourceModeFromModelId = (
  modelId: string | null | undefined
): StudioAudioSourceMode | null => {
  const normalizedModelId = normalizeTrimmedString(modelId);
  if (!normalizedModelId) return null;
  return AUDIO_SOURCE_MODE_BY_MODEL_ID.get(normalizedModelId) ?? null;
};

export const resolveOutputAudioSourceMode = ({
  audioSourceMode,
  modelId,
}: {
  audioSourceMode?: StudioAudioSourceMode | null;
  modelId?: string | null;
}): StudioAudioSourceMode | null =>
  normalizeAudioSourceMode(audioSourceMode) ?? resolveAudioSourceModeFromModelId(modelId);
