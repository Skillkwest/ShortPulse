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
        const detail = await response.text();
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
  const thinkerData = await thinkerResp.json();
  const thinkerRaw = extractCompletionText(thinkerData?.choices?.[0]?.message?.content);
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
          usage: {
            inputTokens: thinkerData?.usage?.prompt_tokens,
            outputTokens: thinkerData?.usage?.completion_tokens,
          },
        },
      };
    }
    return formatterStage;
  }

  const formatterResp = formatterStage.response;
  const formatterData = await formatterResp.json();
  const formatterRaw = extractCompletionText(formatterData?.choices?.[0]?.message?.content);
  const parsed = parseAgentJson(formatterRaw) ?? {
    message: formatterRaw || "No response",
    actions: undefined,
  };
  const nextCanonical = parsed?.actions?.applyPrompt ?? parsed?.message ?? null;

  return {
    ok: true,
    result: {
      parsed,
      nextCanonical,
      semanticStatus,
      usage: {
        inputTokens: formatterData?.usage?.prompt_tokens,
        outputTokens: formatterData?.usage?.completion_tokens,
      },
    },
  };
};
