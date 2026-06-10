type JsonObject = Record<string, unknown>;

export type AudioCompanionArtSourceMode = "voiceover" | "voice-changer" | "sound-effects" | "music";

export type CompileAudioCompanionArtPromptInput = {
  promptText: string;
  sourceMode: AudioCompanionArtSourceMode;
  metadata?: JsonObject | null;
  styleLine?: string | null;
};

export type AudioCompanionArtGenerationSpec = {
  prompt: string;
};

const DEFAULT_BRAND_STYLE_LINE =
  "Branded audio cover art style: cinematic editorial illustration, bold silhouette, layered atmosphere, premium gradients, restrained color palette, tactile texture, crisp focal subject, no text, no logos, no typography, no UI, no watermark, no border.";

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const clampText = (value: string, limit = 420): string =>
  value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;

const buildCreativeDirection = ({
  sourceMode,
  metadata,
}: {
  sourceMode: AudioCompanionArtSourceMode;
  metadata: JsonObject;
}): string[] => {
  if (sourceMode === "voiceover") {
    const voiceName = asTrimmedString(metadata.voice_name);
    return [
      "Translate the spoken scene or message into one clear visual moment.",
      voiceName ? `Subtle performance character reference: ${voiceName}.` : "",
    ].filter(Boolean);
  }

  if (sourceMode === "voice-changer") {
    const voiceName = asTrimmedString(metadata.voice_name);
    return [
      "Show transformation, identity shift, or altered presence rather than a literal waveform.",
      voiceName ? `Persona cue: ${voiceName}.` : "",
    ].filter(Boolean);
  }

  if (sourceMode === "sound-effects") {
    const loopEnabled = metadata.loop_enabled === true;
    const durationSeconds = asFiniteNumber(metadata.duration_seconds);
    return [
      "Depict the sound source, impact, or environment as a single iconic visual.",
      loopEnabled ? "Composition should feel seamless and cyclical." : "",
      durationSeconds ? `Suggested pacing cue: ${durationSeconds} second effect.` : "",
    ].filter(Boolean);
  }

  const tempoBpm = asFiniteNumber(metadata.tempo_bpm);
  const energyPercent = asFiniteNumber(metadata.energy_percent);
  const structure = asTrimmedString(metadata.structure);
  const mode = asTrimmedString(metadata.music_mode);
  return [
    "Treat this like premium album-cover art inspired by the track mood.",
    tempoBpm ? `Tempo cue: ${tempoBpm} BPM.` : "",
    energyPercent != null ? `Energy cue: ${energyPercent} percent.` : "",
    structure ? `Arrangement cue: ${structure}.` : "",
    mode ? `Performance cue: ${mode}.` : "",
  ].filter(Boolean);
};

export const compileAudioCompanionArtPrompt = ({
  promptText,
  sourceMode,
  metadata = null,
  styleLine = null,
}: CompileAudioCompanionArtPromptInput): AudioCompanionArtGenerationSpec => {
  const normalizedPrompt = clampText(asTrimmedString(promptText) ?? "Audio reference cover art");
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const normalizedStyleLine = asTrimmedString(styleLine) ?? DEFAULT_BRAND_STYLE_LINE;
  const creativeDirection = buildCreativeDirection({
    sourceMode,
    metadata: safeMetadata,
  });

  const prompt = [
    `Audio concept: ${normalizedPrompt}`,
    `Source mode: ${sourceMode}.`,
    ...creativeDirection,
    normalizedStyleLine,
  ].join("\n");

  return {
    prompt,
  };
};
