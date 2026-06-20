import { resolveRequiredAiStudioTextPromptModelId } from "../model-runtime/modelCatalog";
import { fetchOpenAiCompatibleChatCompletion } from "./api/openAiCompat";

export const GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS = 34;
export const GENERATED_SONG_TITLE_MAX_CHARACTERS = GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS;
const GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS = 3;

const TITLE_GENERATION_TIMEOUT_MS = 2_000;
const UNTITLED_TRACK_TITLE = "Untitled Track";
const UNTITLED_SOUND_EFFECT_TITLE = "Untitled Effect";
const UNTITLED_VOICEOVER_TITLE = "Voiceover";
const UNTITLED_VOICE_CHANGER_TITLE = "Voice Take";
const AUDIO_REFERENCE_TITLE_VARIANTS = [
  "Amber",
  "Bright",
  "Clear",
  "Coastal",
  "Cosmic",
  "Crimson",
  "Deep",
  "Electric",
  "Ember",
  "Fresh",
  "Golden",
  "Hidden",
  "Lunar",
  "Midnight",
  "Modern",
  "Neon",
  "Northern",
  "Open",
  "Quiet",
  "Radiant",
  "Rapid",
  "River",
  "Silver",
  "Soft",
  "Solar",
  "Steady",
  "Urban",
  "Velvet",
  "Warm",
  "Wild",
] as const;
export const GENERATED_AUDIO_REFERENCE_TITLE_VARIANT_COUNT = AUDIO_REFERENCE_TITLE_VARIANTS.length;
const AUDIO_REFERENCE_TITLE_VARIANT_SET = new Set<string>(AUDIO_REFERENCE_TITLE_VARIANTS);

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

const clampWords = (value: string, maxWords: number): string =>
  value.split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
};

const hashReferenceTitleSeed = (seed: string): number => {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(index);
  }
  return hash >>> 0;
};

export const clampGeneratedSongTitle = (
  value: unknown,
  options: { maxWords?: number } = {}
): string | null => {
  const normalized = normalizeString(value)
    ?.replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[<>]/g, "")
    .trim();
  if (!normalized) return null;
  const wordClamped = clampWords(
    normalized,
    options.maxWords ?? GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS
  );
  return wordClamped.length > GENERATED_SONG_TITLE_MAX_CHARACTERS
    ? wordClamped.slice(0, GENERATED_SONG_TITLE_MAX_CHARACTERS).trim()
    : wordClamped;
};

export const clampGeneratedAudioReferenceTitle = clampGeneratedSongTitle;

export const buildAudioReferenceTitleVariant = (
  seed: string | null | undefined,
  variantOffset = 0
): string | null => {
  const normalized = normalizeString(seed);
  if (!normalized) return null;
  const variantIndex =
    (hashReferenceTitleSeed(normalized) + Math.max(0, variantOffset)) %
    GENERATED_AUDIO_REFERENCE_TITLE_VARIANT_COUNT;
  return AUDIO_REFERENCE_TITLE_VARIANTS[variantIndex];
};

export const applyAudioReferenceTitleVariant = ({
  baseTitle,
  uniqueSeed,
  variantOffset,
}: {
  baseTitle: string;
  uniqueSeed?: string | null;
  variantOffset?: number;
}): string => {
  const variant = buildAudioReferenceTitleVariant(uniqueSeed, variantOffset);
  if (!variant) {
    return clampGeneratedAudioReferenceTitle(baseTitle) ?? UNTITLED_TRACK_TITLE;
  }
  const base = clampGeneratedAudioReferenceTitle(baseTitle, {
    maxWords: GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS,
  });
  const words = base?.split(/\s+/).filter(Boolean) ?? [];
  const titleWords =
    words.length > 1 && AUDIO_REFERENCE_TITLE_VARIANT_SET.has(words[0]) ? words.slice(1) : words;
  const clampedBase = titleWords.slice(0, GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS - 1).join(" ");
  return (
    clampGeneratedAudioReferenceTitle(`${variant} ${clampedBase || UNTITLED_TRACK_TITLE}`) ??
    variant
  );
};

export const finalizeAudioReferenceTitle = ({
  baseTitle,
  uniqueSeed,
}: {
  baseTitle: string;
  uniqueSeed?: string | null;
}): string => {
  return applyAudioReferenceTitleVariant({ baseTitle, uniqueSeed });
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
  const modelTitleMaxWords = input.uniqueSeed
    ? GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS - 1
    : GENERATED_AUDIO_REFERENCE_TITLE_MAX_WORDS;

  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model: resolveRequiredAiStudioTextPromptModelId(),
      timeoutMs: TITLE_GENERATION_TIMEOUT_MS,
      messages: [
        {
          role: "system",
          content: `Create one concise original ${describeTitleKind(input.sourceMode)} title for an audio reference. Return JSON only. The title must be ${modelTitleMaxWords} words or fewer, ${GENERATED_AUDIO_REFERENCE_TITLE_MAX_CHARACTERS} characters or fewer, readable in a small media card, and contain no quotes, emoji, provider names, filenames, codes, ids, labels, or explanations.`,
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
