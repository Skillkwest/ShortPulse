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
    repairUsed: boolean;
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

const hasUsableFastPathPayload = (response: AgentResponse | null): response is AgentResponse => {
  if (!response) return false;
  const applyPrompt = response.actions?.applyPrompt?.trim() ?? "";
  const message = response.message?.trim() ?? "";
  return applyPrompt.length > 0 || message.length > 0;
};

const buildFastPathRepairMessages = ({ contentText }: { contentText: string }) => {
  const repairSystemPrompt = [
    "You repair malformed assistant output into strict JSON for a prompt compiler.",
    "Return only valid JSON with keys: message (string) and optional actions.applyPrompt (string).",
    "Do not include markdown or explanation text.",
  ].join(" ");
  const repairUserPrompt = JSON.stringify({
    instruction:
      "Repair SOURCE_OUTPUT into valid JSON while preserving original prompt meaning. If content is unsafe/refusal, keep refusal intent in message and omit applyPrompt.",
    source_output: contentText,
  });
  return [
    { role: "system", content: repairSystemPrompt },
    { role: "user", content: repairUserPrompt },
  ];
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
  let parsedWithStatus = semanticParsed
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
  let repairUsed = false;
  if (!hasUsableFastPathPayload(parsedWithStatus?.response ?? null)) {
    const repairStartedAt = Date.now();
    let repairResponse: Response;
    try {
      repairResponse = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model,
        messages: buildFastPathRepairMessages({ contentText }),
        timeoutMs,
      });
    } catch (error) {
      markStage("fast_path_repair_turn", repairStartedAt);
      return {
        ok: false,
        status: resolveFastPathFailureStatus(error),
        detail: formatStudioAgentErrorMessage(error),
      };
    }
    markStage("fast_path_repair_turn", repairStartedAt);
    if (!repairResponse.ok) {
      return {
        ok: false,
        status: repairResponse.status,
        detail: await safeReadFastPathErrorDetail(repairResponse),
      };
    }
    let repairData: Record<string, unknown>;
    try {
      repairData = (await repairResponse.json()) as Record<string, unknown>;
    } catch (error) {
      return {
        ok: false,
        status: 502,
        detail: formatStudioAgentErrorMessage(error),
      };
    }
    const repairedText = extractStudioAgentCompletionText(
      extractFirstChoiceMessageContent(repairData)
    );
    const repairedSemantic = parseStudioAgentSemanticOutput(repairedText);
    parsedWithStatus = repairedSemantic
      ? (() => {
          const semanticResponse = buildStudioAgentSemanticResponse({
            semantic: repairedSemantic,
          });
          return {
            response: semanticResponse.parsed,
            status: semanticResponse.status,
          };
        })()
      : parseStudioAgentJsonWithStatus(repairedText);
    repairUsed = hasUsableFastPathPayload(parsedWithStatus?.response ?? null);
    if (!repairUsed) {
      return {
        ok: false,
        status: 502,
        detail: "Fast-path output parse/repair failed",
      };
    }
  }

  if (!hasUsableFastPathPayload(parsedWithStatus?.response ?? null)) {
    return {
      ok: false,
      status: 502,
      detail: "Fast-path output parse/repair failed",
    };
  }

  let parsed = parsedWithStatus.response;

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
      repairUsed,
      usage: extractUsageTokens(data),
    },
  };
};
