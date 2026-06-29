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
  "Branded audio companion art style: cinematic editorial illustration, bold silhouette, layered atmosphere, premium gradients, restrained color palette, tactile texture, crisp focal subject, no border.";

const TEXT_FREE_VISUAL_CONTRACT = [
  "Hard visual contract: image-only artwork.",
  "Do not render any text from the audio concept or metadata.",
  "No readable text, fake text, pseudo-letters, numbers, captions, labels, stickers, badges, logos, brand marks, watermarks, signatures, typography, subtitles, UI, icons, symbols, glyphs, QR codes, barcodes, advisory labels, music-note icons, or waveform graphics.",
  "Avoid poster, flyer, product packaging, record-label, and literal music-packaging layouts that reserve space for words.",
  "Use only people, objects, places, lighting, color, texture, and abstract atmosphere to communicate the mood.",
].join(" ");

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const clampText = (value: string, limit = 420): string =>
  value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;

const normalizeStyleLine = (value: string | null | undefined): string => {
  const normalized = asTrimmedString(value) ?? DEFAULT_BRAND_STYLE_LINE;
  return normalized
    .replace(/\balbum[- ]cover\b/gi, "companion artwork")
    .replace(/\bcover art style\b/gi, "companion art style")
    .replace(/\bcover art\b/gi, "companion art");
};

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
    "Treat this as premium square companion artwork inspired by the track mood, not literal album packaging.",
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
  const normalizedPrompt = clampText(
    asTrimmedString(promptText) ?? "Audio reference companion art"
  );
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const normalizedStyleLine = normalizeStyleLine(styleLine);
  const creativeDirection = buildCreativeDirection({
    sourceMode,
    metadata: safeMetadata,
  });

  const prompt = [
    `Audio concept: ${normalizedPrompt}`,
    "Interpret the audio concept as mood, setting, subject, color, and texture only; never draw its words.",
    `Source mode: ${sourceMode}.`,
    ...creativeDirection,
    "Apply style language only as text-free visual treatment; ignore any request for typography, labels, logos, or symbolic marks.",
    normalizedStyleLine,
    TEXT_FREE_VISUAL_CONTRACT,
  ].join("\n");

  return {
    prompt,
  };
};
