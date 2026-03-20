/**
 * Thinker/formatter OpenAI pipeline helpers for the AI Studio agent route.
 * Keeps two-stage model orchestration outside the API route handler.
 */
import type { AgentResponse } from "../../../prefabs/agent";
import { fetchOpenAiCompatibleChatCompletion } from "../../../lib/server/api/openAiCompat";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "../../agent-runtime/studioAgentRouteOutcomes";

export type ThinkerFormatterResult = {
  parsed: AgentResponse;
  nextCanonical: string | null;
  semanticStatus: string | null;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

type ThinkerFormatterError = {
  ok: false;
  stage: "thinker" | "formatter";
  status: number;
  detail: string;
};

type ThinkerFormatterSuccess = {
  ok: true;
  result: ThinkerFormatterResult;
};

export type ThinkerFormatterTurnResult = ThinkerFormatterSuccess | ThinkerFormatterError;

const DEFAULT_STAGE_MAX_ATTEMPTS = 2;
const MAX_FORMATTER_PROMPT_CHARS = 6000;
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const extractCompletionText = (rawContent: unknown): string => {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      const record = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n")
    .trim();
};

const clip = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

const normalizeStatus = (value: unknown): string => {
  if (typeof value !== "string") return "ready";
  const cleaned = value.trim().toLowerCase();
  return cleaned.length ? cleaned : "ready";
};

const normalizePromptText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const extractSemanticPromptForRepair = (semantic: unknown): string => {
  const record =
    semantic && typeof semantic === "object" ? (semantic as Record<string, unknown>) : {};
  return (
    normalizePromptText(record.prompt_text) ||
    normalizePromptText(record.promptText) ||
    normalizePromptText(record.prompt) ||
    normalizePromptText(record.message)
  );
};

const extractFirstChoiceMessageContent = (data: Record<string, unknown>): unknown => {
  const choices = data.choices;
  if (!Array.isArray(choices)) return null;
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return null;
  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  return (message as Record<string, unknown>).content;
};

const extractUsageTokens = (
  data: Record<string, unknown>
): { inputTokens?: number; outputTokens?: number } => {
  const usage = data.usage;
  if (!usage || typeof usage !== "object") {
    return {};
  }
  const usageRecord = usage as Record<string, unknown>;
  const inputTokens =
    typeof usageRecord.prompt_tokens === "number" ? usageRecord.prompt_tokens : undefined;
  const outputTokens =
    typeof usageRecord.completion_tokens === "number" ? usageRecord.completion_tokens : undefined;
  return {
    inputTokens,
    outputTokens,
  };
};

const buildFormatterSemanticPayload = ({
  semantic,
  thinkerRaw,
}: {
  semantic: unknown;
  thinkerRaw: string;
}): { status: string; prompt_text: string } => {
  const record =
    semantic && typeof semantic === "object" ? (semantic as Record<string, unknown>) : {};
  const status = normalizeStatus(record.status);
  const promptText =
    normalizePromptText(record.prompt_text) ||
    normalizePromptText(record.promptText) ||
    normalizePromptText(record.prompt) ||
    normalizePromptText(record.message) ||
    thinkerRaw;

  return {
    status,
    prompt_text: clip(promptText, MAX_FORMATTER_PROMPT_CHARS),
  };
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timed out|timeout|network|fetch failed|econnreset|eai_again/i.test(message);
};

const toErrorDetail = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "OpenAI request timed out";
  }
  return error instanceof Error ? error.message : String(error);
};

const safeReadStageFailureDetail = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch (error) {
    return toErrorDetail(error);
  }
};

const safeParseStageJson = async ({
  response,
  stage,
}: {
  response: Response;
  stage: "thinker" | "formatter";
}): Promise<{ ok: true; data: Record<string, unknown> } | ThinkerFormatterError> => {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      stage,
      status: 502,
      detail: toErrorDetail(error),
    };
  }
};

const buildFormatterFallback = ({
  semanticStatus,
  semanticPrompt,
}: {
  semanticStatus: string | null;
  semanticPrompt: string;
}): AgentResponse | null => {
  const normalizedStatus = normalizeStatus(semanticStatus);
  if (normalizedStatus === "refuse") {
    return {
      message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      actions: undefined,
    };
  }
  const prompt = semanticPrompt.trim();
  if (!prompt.length) return null;
  return {
    message: prompt,
    actions: {
      applyPrompt: prompt,
    },
  };
};

const hasUsablePromptPayload = (response: AgentResponse | null): response is AgentResponse => {
  if (!response) return false;
  const applyPrompt = response.actions?.applyPrompt?.trim() ?? "";
  const message = response.message?.trim() ?? "";
  return applyPrompt.length > 0 || message.length > 0;
};

/**
 * Runs thinker -> formatter calls and returns normalized parsed output.
 */
export const runThinkerFormatterTurn = async ({
  apiKey,
  openAiUrl,
  model,
  thinkerModel,
  formatterModel,
  thinkerMessages,
  buildFormatterMessages,
  parseAgentJson,
  timeoutMs = 20000,
  maxStageAttempts = DEFAULT_STAGE_MAX_ATTEMPTS,
}: {
  apiKey: string;
  openAiUrl: string;
  model?: string;
  thinkerModel?: string;
  formatterModel?: string;
  thinkerMessages: unknown[];
  buildFormatterMessages: (semantic: unknown) => unknown[];
  parseAgentJson: (raw: string) => AgentResponse | null;
  timeoutMs?: number;
  maxStageAttempts?: number;
}): Promise<ThinkerFormatterTurnResult> => {
  const resolvedThinkerModel = (thinkerModel ?? model ?? "").trim();
  const thinkerStageModel = resolvedThinkerModel.length ? resolvedThinkerModel : "gpt-5-nano";
  const resolvedFormatterModel = (formatterModel ?? thinkerStageModel).trim();
  const formatterStageModel = resolvedFormatterModel.length
    ? resolvedFormatterModel
    : thinkerStageModel;
  const attempts = Math.max(1, Math.min(3, Math.trunc(maxStageAttempts)));

  const fetchStage = async ({
    messages,
    stageModel,
  }: {
    messages: unknown[];
    stageModel: string;
  }) => {
    return await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      openAiUrl,
      model: stageModel,
      messages: messages as Parameters<typeof fetchOpenAiCompatibleChatCompletion>[0]["messages"],
      timeoutMs,
    });
  };

  const runStage = async ({
    stage,
    messages,
    stageModel,
  }: {
    stage: "thinker" | "formatter";
    messages: unknown[];
    stageModel: string;
  }): Promise<{ ok: true; response: Response } | ThinkerFormatterError> => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetchStage({ messages, stageModel });
        if (response.ok) return { ok: true, response };
        const detail = await safeReadStageFailureDetail(response);
        const canRetry = attempt < attempts && RETRYABLE_STATUSES.has(response.status);
        if (canRetry) {
          await sleep(attempt * 120);
          continue;
        }
        return {
          ok: false,
          stage,
          status: response.status,
          detail,
        };
      } catch (error) {
        const detail = toErrorDetail(error);
        const canRetry = attempt < attempts && isRetryableError(error);
        if (canRetry) {
          await sleep(attempt * 120);
          continue;
        }
        return {
          ok: false,
          stage,
          status: 504,
          detail,
        };
      }
    }

    return {
      ok: false,
      stage,
      status: 504,
      detail: "OpenAI request failed after retries",
    };
  };

  const thinkerStage = await runStage({
    stage: "thinker",
    messages: thinkerMessages,
    stageModel: thinkerStageModel,
  });
  if (!thinkerStage.ok) {
    return thinkerStage;
  }

  const thinkerResp = thinkerStage.response;
  const thinkerParsed = await safeParseStageJson({
    response: thinkerResp,
    stage: "thinker",
  });
  if (!thinkerParsed.ok) {
    return thinkerParsed;
  }
  const thinkerData = thinkerParsed.data;
  const thinkerRaw = extractCompletionText(extractFirstChoiceMessageContent(thinkerData));
  let semantic: unknown = null;
  let semanticStatus: string | null = null;
  try {
    semantic = JSON.parse(thinkerRaw);
    if (
      semantic &&
      typeof semantic === "object" &&
      typeof (semantic as Record<string, unknown>).status === "string"
    ) {
      semanticStatus = (semantic as Record<string, unknown>).status as string;
    }
  } catch {
    semantic = { status: "ready", prompt_text: thinkerRaw };
    semanticStatus = "ready";
  }

  const formatterSemantic = buildFormatterSemanticPayload({
    semantic,
    thinkerRaw,
  });

  const formatterStage = await runStage({
    stage: "formatter",
    messages: buildFormatterMessages(formatterSemantic),
    stageModel: formatterStageModel,
  });
  if (!formatterStage.ok) {
    const fallback = buildFormatterFallback({
      semanticStatus: semanticStatus ?? formatterSemantic.status,
      semanticPrompt: formatterSemantic.prompt_text,
    });
    if (fallback) {
      const nextCanonical =
        fallback.actions?.applyPrompt ??
        (fallback.message?.trim().length ? fallback.message : null);
      return {
        ok: true,
        result: {
          parsed: fallback,
          nextCanonical,
          semanticStatus: semanticStatus ?? formatterSemantic.status,
          usage: extractUsageTokens(thinkerData),
        },
      };
    }
    return formatterStage;
  }

  const formatterResp = formatterStage.response;
  const formatterParsed = await safeParseStageJson({
    response: formatterResp,
    stage: "formatter",
  });
  if (!formatterParsed.ok) {
    return formatterParsed;
  }
  const formatterData = formatterParsed.data;
  const formatterRaw = extractCompletionText(extractFirstChoiceMessageContent(formatterData));
  let parsed: AgentResponse | null = null;
  try {
    parsed = parseAgentJson(formatterRaw);
  } catch {
    parsed = null;
  }
  if (!hasUsablePromptPayload(parsed)) {
    const repaired = buildFormatterFallback({
      semanticStatus: semanticStatus ?? formatterSemantic.status,
      semanticPrompt: extractSemanticPromptForRepair(semantic),
    });
    if (repaired) {
      const nextCanonical = repaired.actions?.applyPrompt ?? repaired.message ?? null;
      return {
        ok: true,
        result: {
          parsed: repaired,
          nextCanonical,
          semanticStatus: semanticStatus ?? formatterSemantic.status,
          usage: extractUsageTokens(formatterData),
        },
      };
    }
    return {
      ok: false,
      stage: "formatter",
      status: 502,
      detail: "Formatter output parse/repair failed",
    };
  }
  const safeParsed = parsed;
  const nextCanonical = safeParsed.actions?.applyPrompt ?? safeParsed.message ?? null;

  return {
    ok: true,
    result: {
      parsed: safeParsed,
      nextCanonical,
      semanticStatus,
      usage: extractUsageTokens(formatterData),
    },
  };
};
