/**
 * Server-side Voiceover Enhance helper for ElevenLabs v3 audio-tag prompting.
 */
import { resolveRequiredAiStudioTextPromptModelId } from "../model-runtime/modelCatalog";
import { fetchOpenAiCompatibleChatCompletion } from "./api/openAiCompat";
import {
  extractOpenAiInternalCapacityUsage,
  type OpenAiInternalCapacityUsage,
} from "./api/openAiInternalCapacityAdmission";

export const VOICEOVER_ENHANCE_MAX_CHARACTERS = 5000;

const VOICEOVER_ENHANCE_TIMEOUT_MS = 30_000;
const GENERATED_VOICEOVER_ENHANCE_MAX_CHARACTERS = 5000;

type EnhanceVoiceoverScriptResult =
  | { ok: true; enhancedScript: string; usage: OpenAiInternalCapacityUsage }
  | { ok: false; status: number; error: string; details?: string };

const normalizeScript = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readChatCompletionContent = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || Array.isArray(firstChoice)) return null;
  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  return normalizeScript((message as { content?: unknown }).content);
};

const readEnhancedScript = (payload: unknown): string | null => {
  const content = readChatCompletionContent(payload);
  if (!content) return null;
  const parsed = JSON.parse(content) as { enhancedScript?: unknown };
  return normalizeScript(parsed.enhancedScript);
};

const buildVoiceoverEnhancePrompt = (script: string): string =>
  [
    "Enhance this voiceover script for ElevenLabs v3 text to speech.",
    "Add concise square-bracket audio/performance tags where they improve delivery.",
    "Preserve the original words, order, meaning, names, punctuation intent, and language.",
    "Use only audible delivery tags such as [thoughtful], [excited], [warmly], [whispers], [chuckles], [pause], or similar natural performance cues.",
    "Do not add visual/camera/stage directions, markdown, explanations, title text, speaker names, or notes.",
    "Return JSON with one property: enhancedScript.",
    "",
    "Script:",
    script,
  ].join("\n");

/**
 * Enhances one voiceover script into an ElevenLabs v3 audio-tagged script.
 * Returns a structured failure instead of falling back to unmodified text.
 */
export const enhanceVoiceoverScript = async ({
  script,
  apiKey = process.env.OPENAI_API_KEY?.trim() ?? "",
}: {
  script: unknown;
  apiKey?: string;
}): Promise<EnhanceVoiceoverScriptResult> => {
  const normalizedScript = normalizeScript(script);
  if (!normalizedScript) {
    return {
      ok: false,
      status: 400,
      error: "Invalid request",
      details: "script is required.",
    };
  }
  if (normalizedScript.length > VOICEOVER_ENHANCE_MAX_CHARACTERS) {
    return {
      ok: false,
      status: 400,
      error: "Invalid request",
      details: `script must be ${VOICEOVER_ENHANCE_MAX_CHARACTERS.toLocaleString()} characters or fewer.`,
    };
  }
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "Voiceover Enhance is unavailable",
      details: "Voiceover Enhance is not configured right now.",
    };
  }

  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model: resolveRequiredAiStudioTextPromptModelId(),
      timeoutMs: VOICEOVER_ENHANCE_TIMEOUT_MS,
      messages: [
        {
          role: "system",
          content:
            "You are a ShortPulse voiceover enhancement assistant. You prepare single-speaker scripts for ElevenLabs v3 by adding sparse, useful square-bracket audio tags while preserving the script text.",
        },
        {
          role: "user",
          content: buildVoiceoverEnhancePrompt(normalizedScript),
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "shortpulse_voiceover_enhance",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              enhancedScript: {
                type: "string",
                minLength: 1,
                maxLength: GENERATED_VOICEOVER_ENHANCE_MAX_CHARACTERS,
              },
            },
            required: ["enhancedScript"],
          },
        },
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status >= 400 && response.status < 500 ? 502 : 503,
        error: "Voiceover Enhance failed",
        details: "The enhancement model did not return a usable response.",
      };
    }

    const payload = await response.json().catch(() => null);
    const enhancedScript = readEnhancedScript(payload);
    if (!enhancedScript || enhancedScript.length > GENERATED_VOICEOVER_ENHANCE_MAX_CHARACTERS) {
      return {
        ok: false,
        status: 502,
        error: "Voiceover Enhance failed",
        details: "The enhancement model returned an invalid script.",
      };
    }

    return {
      ok: true,
      enhancedScript,
      usage: extractOpenAiInternalCapacityUsage(payload),
    };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Voiceover Enhance failed",
      details: "Voiceover Enhance could not complete right now.",
    };
  }
};
