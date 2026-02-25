import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
} from "./studioAgentOpenAiGateway";
import {
  buildStudioAgentSemanticResponse,
  extractStudioAgentCompletionText,
  parseStudioAgentSemanticOutput,
  parseStudioAgentJsonWithStatus,
} from "./studioAgentResponseNormalization";
import { resolveStudioAgentTurnResponse } from "./studioAgentTurnResponse";

type StageMarker = (stage: string, startedAt: number) => void;

type StudioAgentFastPathFailure = {
  ok: false;
  status: number;
  detail: string;
};

type StudioAgentFastPathSuccess = {
  ok: true;
  result: {
    parsed: AgentResponse;
    refusal: boolean;
    resolvedCanonical: string | null;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

export type StudioAgentFastPathTurnResult = StudioAgentFastPathFailure | StudioAgentFastPathSuccess;

const resolveFastPathFailureStatus = (error: unknown): number => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return 504;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return 503;
};

const safeReadFastPathErrorDetail = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch (error) {
    return formatStudioAgentErrorMessage(error);
  }
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

export const executeStudioAgentFastPathTurn = async ({
  apiKey,
  openAiUrl,
  model,
  openAiMessages,
  timeoutMs,
  effectiveCanonical,
  context,
  messages,
  markStage,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  openAiMessages: unknown[];
  timeoutMs: number;
  effectiveCanonical: string | null;
  context: AgentContext;
  messages: AgentMessage[];
  markStage: StageMarker;
}): Promise<StudioAgentFastPathTurnResult> => {
  const fastPathStartedAt = Date.now();
  let response: Response;
  try {
    response = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl,
      model,
      messages: openAiMessages,
      timeoutMs,
    });
  } catch (error) {
    markStage("fast_path_turn", fastPathStartedAt);
    return {
      ok: false,
      status: resolveFastPathFailureStatus(error),
      detail: formatStudioAgentErrorMessage(error),
    };
  }
  markStage("fast_path_turn", fastPathStartedAt);

  if (!response.ok) {
    const detail = await safeReadFastPathErrorDetail(response);
    return {
      ok: false,
      status: response.status,
      detail,
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    return {
      ok: false,
      status: 502,
      detail: formatStudioAgentErrorMessage(error),
    };
  }
  const contentText = extractStudioAgentCompletionText(extractFirstChoiceMessageContent(data));
  const semanticParsed = parseStudioAgentSemanticOutput(contentText);
  const parsedWithStatus = semanticParsed
    ? (() => {
        const semanticResponse = buildStudioAgentSemanticResponse({
          semantic: semanticParsed,
        });
        return {
          response: semanticResponse.parsed,
          status: semanticResponse.status,
        };
      })()
    : parseStudioAgentJsonWithStatus(contentText);
  let parsed = parsedWithStatus?.response ?? {
    message: sanitizeGenerationPromptText(contentText || "No response") ?? "No response",
    actions: undefined,
  };

  const nextCanonical = sanitizeGenerationPromptText(
    parsed?.actions?.applyPrompt ?? parsed?.message ?? effectiveCanonical ?? null
  );

  const resolvedTurn = resolveStudioAgentTurnResponse({
    parsed,
    semanticStatus: parsedWithStatus?.status ?? null,
    nextCanonical,
    effectiveCanonical,
    context,
    messages,
  });
  parsed = resolvedTurn.parsed;
  const refusal = resolvedTurn.refusal;
  const resolvedCanonical = resolvedTurn.resolvedCanonical;

  return {
    ok: true,
    result: {
      parsed,
      refusal,
      resolvedCanonical,
      usage: extractUsageTokens(data),
    },
  };
};
