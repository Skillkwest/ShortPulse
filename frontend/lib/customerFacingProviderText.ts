const AUDIO_SERVICE_LABEL = "the audio service";

const providerTextReplacements: Array<[RegExp, string]> = [
  [
    /ELEVENLABS_API_KEY\s+is\s+not\s+configured\.?/gi,
    "Audio generation is temporarily unavailable.",
  ],
  [/Eleven\s*Labs\s+Sound\s+Effects/gi, "Sound Effects"],
  [/Eleven\s*Labs\s+Voice\s+Changer/gi, "Voice Changer"],
  [/Eleven\s*Labs\s+Voice\s+Design/gi, "Voice Design"],
  [/Eleven\s*Labs\s+Voiceover/gi, "Voiceover"],
  [/Eleven\s*Labs\s+Music/gi, "Music"],
  [/Eleven\s*Labs\s+account/gi, "ShortPulse voice library"],
  [/elevenlabs[/:][a-z0-9_-]+/gi, "the selected audio model"],
  [/Eleven\s*Labs/gi, AUDIO_SERVICE_LABEL],
  [/elevenlabs/gi, AUDIO_SERVICE_LABEL],
  [/11\s*labs/gi, AUDIO_SERVICE_LABEL],
  [/fal(\.ai)?/gi, "the provider"],
  [/api\.elevenlabs\.io/gi, AUDIO_SERVICE_LABEL],
  [
    /eleven_(?:multilingual(?:_sts|_ttv)?|text_to_sound)[a-z0-9_]*|music_v1/gi,
    "the selected audio model",
  ],
  [/xi-api-key/gi, "audio service credentials"],
];

export const sanitizeCustomerFacingProviderText = (
  value: string | null | undefined,
  fallback = "Audio generation failed."
): string => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const sanitized = providerTextReplacements.reduce(
    (nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement),
    trimmed
  );

  return sanitized.trim() || fallback;
};

export const resolveCustomerFacingModelLabel = ({
  model,
  modelId,
  resolveModelLabel,
  fallback = "Generation",
}: {
  model?: string | null;
  modelId?: string | null;
  resolveModelLabel?: (modelId: string) => string | null | undefined;
  fallback?: string;
}): string => {
  const normalizedModelId = modelId?.trim() ?? "";
  const labelFromId = normalizedModelId ? resolveModelLabel?.(normalizedModelId)?.trim() : "";
  return sanitizeCustomerFacingProviderText(labelFromId || model || normalizedModelId, fallback);
};
