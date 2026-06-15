import {
  fetchOpenAiCompatibleChatCompletion,
  type OpenAiChatResponseFormat,
} from "../../lib/server/api/openAiCompat";
import {
  resolveRequiredStudioAgentDefaultModelId,
  resolveRequiredStudioAgentDefaultVisionModelId,
} from "../../lib/model-runtime/modelCatalog";
import {
  resolveStandardWebSearchMode,
  type StudioAgentStandardWebSearchMode,
} from "./standardWebSearch";

const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = resolveRequiredStudioAgentDefaultModelId();
const DEFAULT_VISION_MODEL = resolveRequiredStudioAgentDefaultVisionModelId();
const DEFAULT_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;
const DEFAULT_UPSTREAM_MAX_ATTEMPTS = 2;
const MIN_UPSTREAM_MAX_ATTEMPTS = 1;
const MAX_UPSTREAM_MAX_ATTEMPTS = 5;
const DEFAULT_UPSTREAM_RETRY_BASE_DELAY_MS = 150;
const MIN_UPSTREAM_RETRY_BASE_DELAY_MS = 0;
const MAX_UPSTREAM_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_UPSTREAM_RETRY_MAX_DELAY_MS = 1200;
const MIN_UPSTREAM_RETRY_MAX_DELAY_MS = 0;
const MAX_UPSTREAM_RETRY_MAX_DELAY_MS = 10000;

const parseStudioAgentTimeoutMs = (
  value: string | undefined,
  fallback = DEFAULT_TIMEOUT_MS
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < MIN_TIMEOUT_MS) return MIN_TIMEOUT_MS;
  if (rounded > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
  return rounded;
};

const parseBoundedInt = ({
  value,
  fallback,
  min,
  max,
}: {
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
}): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

const resolveModelEnv = (candidate: string | undefined, fallback: string): string => {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length ? trimmed : fallback;
};

const parseBooleanEnv = (value: string | undefined): boolean =>
  String(value ?? "").toLowerCase() === "true";

export const resolveStudioAgentOpenAiConfig = (
  env: NodeJS.ProcessEnv = process.env
): {
  openAiUrl: string;
  openAiModel: string;
  openAiVisionModel: string;
  openAiThinkerModel: string;
  openAiFormatterModel: string;
  openAiPulseModel: string;
  standardResponsesEnabled: boolean;
  standardChatFallbackEnabled: boolean;
  standardWebSearchEnabled: boolean;
  standardWebSearchMode: StudioAgentStandardWebSearchMode;
  requestTimeoutMs: number;
  visionTimeoutMs: number;
  turnTimeoutMs: number;
  pulseTurnTimeoutMs: number;
  upstreamRetryMaxAttempts: number;
  upstreamRetryBaseDelayMs: number;
  upstreamRetryMaxDelayMs: number;
} => {
  const openAiUrl = (env.OPENAI_API_BASE || "https://api.openai.com/v1") + "/chat/completions";
  const openAiModel = resolveModelEnv(env.OPENAI_MODEL, DEFAULT_MODEL);
  const openAiVisionModel = resolveModelEnv(env.OPENAI_VISION_MODEL, DEFAULT_VISION_MODEL);
  const openAiThinkerModel = resolveModelEnv(env.STUDIO_AGENT_THINKER_MODEL, openAiModel);
  const openAiFormatterModel = resolveModelEnv(
    env.STUDIO_AGENT_FORMATTER_MODEL,
    openAiThinkerModel
  );
  const openAiPulseModel = resolveModelEnv(env.STUDIO_AGENT_PULSE_MODEL, openAiModel);
  const standardResponsesEnabled = parseBooleanEnv(env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED);
  const standardChatFallbackEnabled =
    String(env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";
  const standardWebSearchEnabled = parseBooleanEnv(env.STUDIO_AGENT_STANDARD_WEB_SEARCH_ENABLED);
  const standardWebSearchMode = resolveStandardWebSearchMode({
    value: env.STUDIO_AGENT_STANDARD_WEB_SEARCH_MODE,
    enabled: standardWebSearchEnabled,
  });
  const requestTimeoutMs = parseStudioAgentTimeoutMs(env.STUDIO_AGENT_TIMEOUT_MS);
  const visionTimeoutMs = parseStudioAgentTimeoutMs(
    env.STUDIO_AGENT_VISION_TIMEOUT_MS,
    requestTimeoutMs
  );
  const turnTimeoutMs = parseStudioAgentTimeoutMs(
    env.STUDIO_AGENT_TURN_TIMEOUT_MS,
    requestTimeoutMs
  );
  const pulseTurnTimeoutMs = parseStudioAgentTimeoutMs(
    env.STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS,
    turnTimeoutMs
  );
  const upstreamRetryMaxAttempts = parseBoundedInt({
    value: env.STUDIO_AGENT_UPSTREAM_MAX_ATTEMPTS,
    fallback: DEFAULT_UPSTREAM_MAX_ATTEMPTS,
    min: MIN_UPSTREAM_MAX_ATTEMPTS,
    max: MAX_UPSTREAM_MAX_ATTEMPTS,
  });
  const upstreamRetryBaseDelayMs = parseBoundedInt({
    value: env.STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS,
    fallback: DEFAULT_UPSTREAM_RETRY_BASE_DELAY_MS,
    min: MIN_UPSTREAM_RETRY_BASE_DELAY_MS,
    max: MAX_UPSTREAM_RETRY_BASE_DELAY_MS,
  });
  const upstreamRetryMaxDelayMs = parseBoundedInt({
    value: env.STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS,
    fallback: DEFAULT_UPSTREAM_RETRY_MAX_DELAY_MS,
    min: MIN_UPSTREAM_RETRY_MAX_DELAY_MS,
    max: MAX_UPSTREAM_RETRY_MAX_DELAY_MS,
  });

  return {
    openAiUrl,
    openAiModel,
    openAiVisionModel,
    openAiThinkerModel,
    openAiFormatterModel,
    openAiPulseModel,
    standardResponsesEnabled,
    standardChatFallbackEnabled,
    standardWebSearchEnabled,
    standardWebSearchMode,
    requestTimeoutMs,
    visionTimeoutMs,
    turnTimeoutMs,
    pulseTurnTimeoutMs,
    upstreamRetryMaxAttempts,
    upstreamRetryBaseDelayMs,
    upstreamRetryMaxDelayMs,
  };
};

export const fetchStudioAgentChatCompletion = async ({
  apiKey,
  openAiUrl,
  model,
  messages,
  timeoutMs,
  responseFormat,
  env,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  messages: unknown[];
  timeoutMs: number;
  responseFormat?: OpenAiChatResponseFormat;
  env?: NodeJS.ProcessEnv;
}) => {
  return await fetchOpenAiCompatibleChatCompletion({
    apiKey,
    openAiUrl: openAiUrl || DEFAULT_OPENAI_URL,
    model,
    messages: messages as Parameters<typeof fetchOpenAiCompatibleChatCompletion>[0]["messages"],
    timeoutMs,
    responseFormat,
    env,
  });
};

export const formatStudioAgentErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "OpenAI request timed out";
  }
  return error instanceof Error ? error.message : String(error);
};
