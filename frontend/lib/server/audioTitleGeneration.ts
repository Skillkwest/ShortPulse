import { resolveRequiredAiStudioTextPromptModelId } from "../model-runtime/modelCatalog";
import { fetchOpenAiCompatibleChatCompletion } from "./api/openAiCompat";

export const GENERATED_SONG_TITLE_MAX_CHARACTERS = 40;

const TITLE_GENERATION_TIMEOUT_MS = 8_000;
const UNTITLED_TRACK_TITLE = "Untitled Track";

export type GenerateSongTitleInput = {
  promptText: string;
  lyricsText?: string | null;
  structure?: string | null;
  mode?: string | null;
  bpm?: number | null;
  energyPercent?: number | null;
  providerPrompt?: string | null;
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

const buildTitlePrompt = (input: GenerateSongTitleInput): string =>
  [
    `User prompt: ${normalizeString(input.promptText) ?? ""}`,
    input.lyricsText ? `Lyrics: ${input.lyricsText}` : null,
    input.providerPrompt ? `Provider prompt: ${input.providerPrompt}` : null,
    input.structure ? `Arrangement: ${input.structure}` : null,
    input.mode ? `Mode: ${input.mode}` : null,
    typeof input.bpm === "number" ? `BPM: ${input.bpm}` : null,
    typeof input.energyPercent === "number" ? `Energy: ${input.energyPercent}%` : null,
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

export const generateMusicSongTitleBestEffort = async (
  input: GenerateSongTitleInput
): Promise<string> => {
  const fallbackTitle = buildFallbackSongTitle(input);
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
          content: `Create one concise original song title. Return JSON only. The title must be ${GENERATED_SONG_TITLE_MAX_CHARACTERS} characters or fewer, readable in a small media card, and contain no quotes, emoji, provider names, or explanations.`,
        },
        {
          role: "user",
          content: buildTitlePrompt(input),
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "shortpulse_song_title",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                maxLength: GENERATED_SONG_TITLE_MAX_CHARACTERS,
              },
            },
            required: ["title"],
          },
        },
      },
    });
    if (!response.ok) return fallbackTitle;
    return readGeneratedTitle(await response.json().catch(() => null)) ?? fallbackTitle;
  } catch {
    return fallbackTitle;
  }
};
