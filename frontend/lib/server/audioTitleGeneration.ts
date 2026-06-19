import { resolveRequiredAiStudioTextPromptModelId } from "../model-runtime/modelCatalog";
import { fetchOpenAiCompatibleChatCompletion } from "./api/openAiCompat";

export const GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS = 34;
export const GENERATED_SONG_TITLE_MAX_CHARACTERS = GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS;

const TITLE_GENERATION_TIMEOUT_MS = 2_000;
const UNTITLED_TRACK_TITLE = "Untitled Track";
const UNTITLED_SOUND_EFFECT_TITLE = "Untitled Effect";
const UNTITLED_VOICEOVER_TITLE = "Voiceover";
const UNTITLED_VOICE_CHANGER_TITLE = "Voice Take";

export type AudioReferenceTitleSourceMode =
  | "music"
  | "sound-effects"
  | "voiceover"
  | "voice-changer";

export type GenerateAudioReferenceTitleInput = {
  sourceMode: AudioReferenceTitleSourceMode;
  promptText: string;
  lyricsText?: string | null;
  transcriptText?: string | null;
  sourceName?: string | null;
  voiceName?: string | null;
  structure?: string | null;
  mode?: string | null;
  bpm?: number | null;
  energyPercent?: number | null;
  durationSeconds?: number | null;
  loop?: boolean | null;
  providerPrompt?: string | null;
  uniqueSeed?: string | null;
};

export type GenerateSongTitleInput = {
  promptText: string;
  lyricsText?: string | null;
  structure?: string | null;
  mode?: string | null;
  bpm?: number | null;
  energyPercent?: number | null;
  providerPrompt?: string | null;
  uniqueSeed?: string | null;
};

export type GenerateSoundEffectTitleInput = {
  promptText: string;
  durationSeconds?: number | null;
  loop?: boolean | null;
  providerPrompt?: string | null;
  uniqueSeed?: string | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
};

export const clampGeneratedSongTitle = (value: unknown): string | null => {
  const normalized = normalizeString(value)
    ?.replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[<>]/g, "")
    .trim();
  if (!normalized) return null;
  return normalized.length > GENERATED_SONG_TITLE_MAX_CHARACTERS
    ? normalized.slice(0, GENERATED_SONG_TITLE_MAX_CHARACTERS).trim()
    : normalized;
};

export const clampGeneratedAudioReferenceTitle = clampGeneratedSongTitle;

const buildReferenceTitleMark = (seed: string | null | undefined): string | null => {
  const normalized = normalizeString(seed);
  if (!normalized) return null;
  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(index);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
};

export const finalizeAudioReferenceTitle = ({
  baseTitle,
  uniqueSeed,
}: {
  baseTitle: string;
  uniqueSeed?: string | null;
}): string => {
  const normalizedBase = clampGeneratedAudioReferenceTitle(baseTitle) ?? UNTITLED_TRACK_TITLE;
  const mark = buildReferenceTitleMark(uniqueSeed);
  if (!mark) return normalizedBase;
  const suffix = ` ${mark}`;
  const baseMaxLength = Math.max(1, GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS - suffix.length);
  const clampedBase =
    normalizedBase.length > baseMaxLength
      ? normalizedBase.slice(0, baseMaxLength).trim()
      : normalizedBase;
  return `${clampedBase || UNTITLED_TRACK_TITLE}${suffix}`;
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const [first = "", ...rest] = word;
      return `${first.toUpperCase()}${rest.join("")}`;
    })
    .join(" ");

export const buildFallbackSongTitle = (input: GenerateSongTitleInput): string => {
  const source =
    normalizeString(input.promptText) ??
    normalizeString(input.lyricsText) ??
    normalizeString(input.providerPrompt) ??
    "";
  const withoutLabels = source
    .replace(/\b(lyrics|creative direction|arrangement|tempo target|energy)\b\s*:/gi, " ")
    .replace(/[^a-z0-9' -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutLabels) return UNTITLED_TRACK_TITLE;
  const words = withoutLabels.split(" ").filter(Boolean).slice(0, 6);
  return clampGeneratedSongTitle(toTitleCase(words.join(" "))) ?? UNTITLED_TRACK_TITLE;
};

export const buildFallbackSoundEffectTitle = (input: GenerateSoundEffectTitleInput): string => {
  const source = normalizeString(input.promptText) ?? normalizeString(input.providerPrompt) ?? "";
  const withoutLabels = source
    .replace(/\b(sound effects?|sfx|duration|loop|prompt influence)\b\s*:/gi, " ")
    .replace(/[^a-z0-9' -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutLabels) return UNTITLED_SOUND_EFFECT_TITLE;
  const words = withoutLabels.split(" ").filter(Boolean).slice(0, 6);
  return clampGeneratedSongTitle(toTitleCase(words.join(" "))) ?? UNTITLED_SOUND_EFFECT_TITLE;
};

export const buildFallbackVoiceoverTitle = (
  input: Pick<GenerateAudioReferenceTitleInput, "promptText" | "voiceName">
): string => {
  const source = normalizeString(input.promptText) ?? "";
  const withoutLabels = source
    .replace(/\b(script|voiceover|narration|dialogue|copy)\b\s*:/gi, " ")
    .replace(/[^a-z0-9' -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutLabels.split(" ").filter(Boolean).slice(0, 5);
  const phrase = words.length > 0 ? toTitleCase(words.join(" ")) : null;
  return (
    clampGeneratedSongTitle(phrase) ?? normalizeString(input.voiceName) ?? UNTITLED_VOICEOVER_TITLE
  );
};

export const buildFallbackVoiceChangerTitle = (
  input: Pick<
    GenerateAudioReferenceTitleInput,
    "promptText" | "transcriptText" | "sourceName" | "voiceName"
  >
): string => {
  const source =
    normalizeString(input.transcriptText) ??
    normalizeString(input.sourceName) ??
    normalizeString(input.promptText) ??
    normalizeString(input.voiceName) ??
    "";
  const withoutLabels = source
    .replace(/\b(source|voice|voice changer|transcript|audio|video)\b\s*:/gi, " ")
    .replace(/\s+->\s+/g, " ")
    .replace(/\.[a-z0-9]{2,5}\b/gi, " ")
    .replace(/[^a-z0-9' -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutLabels.split(" ").filter(Boolean).slice(0, 5);
  return clampGeneratedSongTitle(toTitleCase(words.join(" "))) ?? UNTITLED_VOICE_CHANGER_TITLE;
};

export const buildFallbackAudioReferenceTitle = (
  input: GenerateAudioReferenceTitleInput
): string => {
  switch (input.sourceMode) {
    case "music":
      return buildFallbackSongTitle(input);
    case "sound-effects":
      return buildFallbackSoundEffectTitle(input);
    case "voiceover":
      return buildFallbackVoiceoverTitle(input);
    case "voice-changer":
      return buildFallbackVoiceChangerTitle(input);
  }
};

const buildTitlePrompt = (input: GenerateAudioReferenceTitleInput): string =>
  [
    `Audio workflow: ${input.sourceMode}`,
    `User prompt: ${normalizeString(input.promptText) ?? ""}`,
    input.lyricsText ? `Lyrics: ${input.lyricsText}` : null,
    input.transcriptText ? `Transcript: ${input.transcriptText}` : null,
    input.providerPrompt ? `Provider prompt: ${input.providerPrompt}` : null,
    input.sourceName ? `Source name: ${input.sourceName}` : null,
    input.voiceName ? `Voice: ${input.voiceName}` : null,
    input.structure ? `Arrangement: ${input.structure}` : null,
    input.mode ? `Mode: ${input.mode}` : null,
    typeof input.bpm === "number" ? `BPM: ${input.bpm}` : null,
    typeof input.energyPercent === "number" ? `Energy: ${input.energyPercent}%` : null,
    typeof input.durationSeconds === "number" ? `Duration: ${input.durationSeconds}s` : null,
    typeof input.loop === "boolean" ? `Loop: ${input.loop ? "yes" : "no"}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

const readChatCompletionContent = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || Array.isArray(firstChoice)) return null;
  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  return normalizeString((message as { content?: unknown }).content);
};

const readGeneratedTitle = (payload: unknown): string | null => {
  const content = readChatCompletionContent(payload);
  if (!content) return null;
  const parsed = JSON.parse(content) as { title?: unknown };
  return clampGeneratedSongTitle(parsed.title);
};

const describeTitleKind = (sourceMode: AudioReferenceTitleSourceMode): string => {
  switch (sourceMode) {
    case "music":
      return "song";
    case "sound-effects":
      return "sound-effect";
    case "voiceover":
      return "voiceover";
    case "voice-changer":
      return "voice-changer";
  }
};

export const generateAudioReferenceTitleBestEffort = async (
  input: GenerateAudioReferenceTitleInput
): Promise<string> => {
  const fallbackTitle = finalizeAudioReferenceTitle({
    baseTitle: buildFallbackAudioReferenceTitle(input),
    uniqueSeed: input.uniqueSeed,
  });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackTitle;

  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model: resolveRequiredAiStudioTextPromptModelId(),
      timeoutMs: TITLE_GENERATION_TIMEOUT_MS,
      messages: [
        {
          role: "system",
          content: `Create one concise original ${describeTitleKind(input.sourceMode)} title for an audio reference. Return JSON only. The title must be ${GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS} characters or fewer before any app suffix, readable in a small media card, and contain no quotes, emoji, provider names, filenames, hash ids, or explanations.`,
        },
        {
          role: "user",
          content: buildTitlePrompt(input),
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "shortpulse_audio_reference_title",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                maxLength: GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS,
              },
            },
            required: ["title"],
          },
        },
      },
    });
    if (!response.ok) return fallbackTitle;
    const generatedTitle = readGeneratedTitle(await response.json().catch(() => null));
    return generatedTitle
      ? finalizeAudioReferenceTitle({ baseTitle: generatedTitle, uniqueSeed: input.uniqueSeed })
      : fallbackTitle;
  } catch {
    return fallbackTitle;
  }
};

export const generateMusicSongTitleBestEffort = async (
  input: GenerateSongTitleInput
): Promise<string> => {
  return generateAudioReferenceTitleBestEffort({ ...input, sourceMode: "music" });
};

export const generateSoundEffectTitleBestEffort = async (
  input: GenerateSoundEffectTitleInput
): Promise<string> => {
  return generateAudioReferenceTitleBestEffort({ ...input, sourceMode: "sound-effects" });
};
