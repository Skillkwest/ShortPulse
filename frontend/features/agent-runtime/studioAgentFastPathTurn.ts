import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import type { OpenAiChatResponseFormat } from "../../lib/server/api/openAiCompat";
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
import { isStudioAgentWorkflowPulse } from "./studioAgentPulseRuntime";
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
    semanticStatus: string | null;
    repairUsed: boolean;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

export type StudioAgentFastPathTurnResult = StudioAgentFastPathFailure | StudioAgentFastPathSuccess;

const STUDIO_AGENT_WORKFLOW_RESPONSE_FORMAT: OpenAiChatResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "studio_agent_workflow_response",
    description: "Workflow Pulse turn response.",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["needs_input", "ready", "refuse"],
        },
        message: {
          type: "string",
        },
        actions: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                applyPrompt: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
              },
              required: ["applyPrompt"],
            },
            { type: "null" },
          ],
        },
      },
      required: ["status", "message", "actions"],
    },
  },
};

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

const resolveLatestUserInput = (messages: AgentMessage[]): string | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const trimmed = message.content?.trim();
    if (trimmed?.length) return trimmed;
  }
  return null;
};

const buildFastPathRepairMessagesWithContext = ({
  contentText,
  latestUserInput,
  canonicalPrompt,
  activePrompt,
}: {
  contentText: string;
  latestUserInput: string | null;
  canonicalPrompt: string | null;
  activePrompt: string | null;
}) => {
  const repairSystemPrompt = [
    "You repair malformed assistant output into strict JSON for a prompt compiler.",
    "Return only valid JSON with keys: message (string) and optional actions.applyPrompt (string).",
    "Do not include markdown or explanation text.",
    "If SOURCE_OUTPUT is recap/meta text, reconstruct the intended prompt using latest_user_input/canonical_prompt/active_prompt while preserving intent.",
  ].join(" ");
  const repairUserPrompt = JSON.stringify({
    instruction:
      "Repair SOURCE_OUTPUT into valid JSON while preserving original prompt meaning. If SOURCE_OUTPUT is recap-like, produce a direct generation-ready prompt from available context. If content is unsafe/refusal, keep refusal intent in message and omit applyPrompt.",
    source_output: contentText,
    latest_user_input: latestUserInput,
    canonical_prompt: canonicalPrompt,
    active_prompt: activePrompt,
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
  const workflowPulseActive = isStudioAgentWorkflowPulse(context.pulse);
  let response: Response;
  try {
    response = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl,
      model,
      messages: openAiMessages,
      timeoutMs,
      responseFormat: workflowPulseActive ? STUDIO_AGENT_WORKFLOW_RESPONSE_FORMAT : undefined,
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
  const semanticParsed = workflowPulseActive ? null : parseStudioAgentSemanticOutput(contentText);
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
    : parseStudioAgentJsonWithStatus(contentText, {
        allowUnstructured: !workflowPulseActive,
      });
  let repairUsed = false;
  if (!hasUsableFastPathPayload(parsedWithStatus?.response ?? null)) {
    const latestUserInput = resolveLatestUserInput(messages);
    const repairStartedAt = Date.now();
    let repairResponse: Response;
    try {
      repairResponse = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model,
        messages: buildFastPathRepairMessagesWithContext({
          contentText,
          latestUserInput,
          canonicalPrompt: effectiveCanonical,
          activePrompt:
            typeof context.activePrompt === "string" && context.activePrompt.trim().length
              ? context.activePrompt.trim()
              : null,
        }),
        timeoutMs,
        responseFormat: workflowPulseActive ? STUDIO_AGENT_WORKFLOW_RESPONSE_FORMAT : undefined,
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
    const repairedSemantic = workflowPulseActive
      ? null
      : parseStudioAgentSemanticOutput(repairedText);
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
      : parseStudioAgentJsonWithStatus(repairedText, {
          allowUnstructured: !workflowPulseActive,
        });
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

  if (!parsedWithStatus) {
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
      semanticStatus: parsedWithStatus?.status ?? null,
      repairUsed,
      usage: extractUsageTokens(data),
    },
  };
};
