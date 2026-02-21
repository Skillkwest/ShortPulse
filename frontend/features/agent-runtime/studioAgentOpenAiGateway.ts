const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;

const parseStudioAgentTimeoutMs = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  const rounded = Math.trunc(parsed);
  if (rounded < MIN_TIMEOUT_MS) return MIN_TIMEOUT_MS;
  if (rounded > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
  return rounded;
};

const resolveModelEnv = (candidate: string | undefined, fallback: string): string => {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length ? trimmed : fallback;
};

export const resolveStudioAgentOpenAiConfig = (
  env: NodeJS.ProcessEnv = process.env
): {
  openAiUrl: string;
  openAiModel: string;
  openAiVisionModel: string;
  openAiThinkerModel: string;
  openAiFormatterModel: string;
  requestTimeoutMs: number;
} => {
  const openAiUrl = (env.OPENAI_API_BASE || "https://api.openai.com/v1") + "/chat/completions";
  const openAiModel = resolveModelEnv(env.OPENAI_MODEL, DEFAULT_MODEL);
  const openAiVisionModel = resolveModelEnv(env.OPENAI_VISION_MODEL, DEFAULT_VISION_MODEL);
  const openAiThinkerModel = resolveModelEnv(env.STUDIO_AGENT_THINKER_MODEL, openAiModel);
  const openAiFormatterModel = resolveModelEnv(
    env.STUDIO_AGENT_FORMATTER_MODEL,
    openAiThinkerModel
  );
  const requestTimeoutMs = parseStudioAgentTimeoutMs(env.STUDIO_AGENT_TIMEOUT_MS);

  return {
    openAiUrl,
    openAiModel,
    openAiVisionModel,
    openAiThinkerModel,
    openAiFormatterModel,
    requestTimeoutMs,
  };
};

export const fetchStudioAgentChatCompletion = async ({
  apiKey,
  openAiUrl,
  model,
  messages,
  timeoutMs,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  messages: unknown[];
  timeoutMs: number;
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(openAiUrl || DEFAULT_OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const formatStudioAgentErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "OpenAI request timed out";
  }
  return error instanceof Error ? error.message : String(error);
};
