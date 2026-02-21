import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import { fetchStudioAgentChatCompletion } from "./studioAgentOpenAiGateway";
import {
  extractStudioAgentCompletionText,
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
  const response = await fetchStudioAgentChatCompletion({
    apiKey,
    openAiUrl,
    model,
    messages: openAiMessages,
    timeoutMs,
  });
  markStage("fast_path_turn", fastPathStartedAt);

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false,
      status: response.status,
      detail,
    };
  }

  const data = await response.json();
  const contentText = extractStudioAgentCompletionText(data?.choices?.[0]?.message?.content);
  const parsedWithStatus = parseStudioAgentJsonWithStatus(contentText);
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
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
    },
  };
};
