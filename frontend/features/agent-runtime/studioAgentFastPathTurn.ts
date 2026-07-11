import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import type {
  OpenAiChatMessage,
  OpenAiChatResponseFormat,
} from "../../lib/server/api/openAiCompat";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
} from "./studioAgentOpenAiGateway";
import {
  buildStudioAgentSemanticResponse,
  extractStudioAgentProviderCompletion,
  isStudioAgentRefusalResponse,
  parseStudioAgentSemanticOutput,
  parseStudioAgentJsonWithStatus,
} from "./studioAgentResponseNormalization";
import {
  resolveLatestStudioAgentUserInput,
  resolveStudioAgentPulseKind,
} from "./studioAgentPulseRuntime";
import { resolveStudioAgentTurnResponse } from "./studioAgentTurnResponse";
import {
  withSafeCompletionRecoveryInstruction,
  type SafeCompletionRecoveryOutcome,
  type SafeCompletionRefusalSource,
} from "./studioAgentSafeCompletion";

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
    refusalSource: SafeCompletionRefusalSource | null;
    safeCompletionRecoveryAttempted: boolean;
    safeCompletionRecoveryOutcome: SafeCompletionRecoveryOutcome;
    safeCompletionRecoveryLatencyMs: number | null;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

export type StudioAgentFastPathTurnResult = StudioAgentFastPathFailure | StudioAgentFastPathSuccess;

const STUDIO_AGENT_PULSE_RESPONSE_FORMAT: OpenAiChatResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "studio_agent_pulse_response",
    description: "Pulse turn response.",
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

const extractFirstChoiceMessage = (
  data: Record<string, unknown>
): { content?: unknown; refusal?: unknown } => {
  const choices = data.choices;
  if (!Array.isArray(choices)) return {};
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return {};
  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return {};
  const record = message as Record<string, unknown>;
  return { content: record.content, refusal: record.refusal };
};

const parseFastPathCompletion = ({
  data,
  pulseActive,
}: {
  data: Record<string, unknown>;
  pulseActive: boolean;
}): {
  contentText: string;
  typedRefusal: string | null;
  parsedWithStatus: { response: AgentResponse; status: string | null } | null;
} => {
  const message = extractFirstChoiceMessage(data);
  const completion = extractStudioAgentProviderCompletion({
    content: message.content,
    refusal: message.refusal,
  });
  if (completion.typedRefusal) {
    return {
      contentText: completion.text,
      typedRefusal: completion.typedRefusal,
      parsedWithStatus: {
        response: { message: completion.typedRefusal, actions: undefined },
        status: "refuse",
      },
    };
  }
  const semanticParsed = pulseActive ? null : parseStudioAgentSemanticOutput(completion.text);
  const parsedWithStatus = semanticParsed
    ? (() => {
        const semanticResponse = buildStudioAgentSemanticResponse({ semantic: semanticParsed });
        return { response: semanticResponse.parsed, status: semanticResponse.status };
      })()
    : parseStudioAgentJsonWithStatus(completion.text, { allowUnstructured: !pulseActive });
  return {
    contentText: completion.text,
    typedRefusal: null,
    parsedWithStatus,
  };
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

const normalizePulseRepeatComparisonValue = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "") : "";

const isGuidedWorkflowRepeatAfterUserInput = ({
  context,
  messages,
  parsed,
  semanticStatus,
}: {
  context: AgentContext;
  messages: AgentMessage[];
  parsed: AgentResponse | null | undefined;
  semanticStatus: string | null | undefined;
}): boolean => {
  if (resolveStudioAgentPulseKind(context.pulse) !== "guided_workflow") return false;
  const latestUserInput = resolveLatestStudioAgentUserInput(messages);
  if (!latestUserInput) return false;
  const status = typeof semanticStatus === "string" ? semanticStatus.trim().toLowerCase() : "";
  if (status && status !== "needs_input" && status !== "awaiting_input" && status !== "running") {
    return false;
  }
  const responseMessage = normalizePulseRepeatComparisonValue(parsed?.message);
  if (!responseMessage) return false;
  const workflowSession = context.pulse?.workflowSession ?? null;
  const repeatedCandidates = [
    workflowSession?.currentStepPrompt,
    workflowSession?.currentStepLabel,
  ].map(normalizePulseRepeatComparisonValue);
  return repeatedCandidates.some(
    (candidate) => candidate.length > 0 && candidate === responseMessage
  );
};

const buildFastPathRepairMessagesWithContext = ({
  contentText,
  latestUserInput,
  canonicalPrompt,
  activePrompt,
  pulseKind,
  workflowSession,
  repairReason = "malformed_output",
}: {
  contentText: string;
  latestUserInput: string | null;
  canonicalPrompt: string | null;
  activePrompt: string | null;
  pulseKind: "guided_workflow" | "custom_gpt" | null;
  workflowSession?: unknown;
  repairReason?: "malformed_output" | "repeated_workflow_step";
}) => {
  const guidedWorkflowPulseRepair = pulseKind === "guided_workflow";
  const customPulseRepair = pulseKind === "custom_gpt";
  const pulseRepair = guidedWorkflowPulseRepair || customPulseRepair;
  const repairSystemPrompt = guidedWorkflowPulseRepair
    ? [
        "You repair malformed assistant output into strict JSON for a Pulse runtime.",
        "Return only valid JSON with keys: status (needs_input|ready|refuse), message (string), and actions (null or object with applyPrompt).",
        "Do not include markdown or explanation text.",
        "If SOURCE_OUTPUT is a follow-up question, checklist continuation, or clarification request, set status to needs_input and actions to null.",
        "If repair_reason is repeated_workflow_step, do not preserve the repeated question. Use latest_user_input and workflow_session_state to continue to the next useful question or final artifact.",
        "If SOURCE_OUTPUT is a final generation-ready artifact, set status to ready and put the exact final artifact text in actions.applyPrompt.",
        "If content is unsafe/refusal, set status to refuse and omit applyPrompt.",
      ].join(" ")
    : customPulseRepair
      ? [
          "You repair malformed assistant output into strict JSON for a custom Pulse runtime.",
          "Return only valid JSON with keys: status (needs_input|ready|refuse), message (string), and actions (null or object with applyPrompt).",
          "Do not include markdown or explanation text.",
          "If SOURCE_OUTPUT is a follow-up question, checklist continuation, or clarification request, set status to needs_input and actions to null.",
          "If SOURCE_OUTPUT is an ordinary direct answer or chat reply, set status to ready and actions to null.",
          "Use actions.applyPrompt only when SOURCE_OUTPUT is clearly a reusable final prompt or artifact the UI should treat as the authoritative final output.",
          "If content is unsafe/refusal, set status to refuse and omit applyPrompt.",
        ].join(" ")
      : [
          "You repair malformed assistant output into strict JSON for a prompt compiler.",
          "Return only valid JSON with keys: message (string) and optional actions.applyPrompt (string).",
          "Do not include markdown or explanation text.",
          "If SOURCE_OUTPUT is recap/meta text, reconstruct the intended prompt using latest_user_input/canonical_prompt/active_prompt while preserving intent.",
        ].join(" ");
  const repairUserPrompt = pulseRepair
    ? JSON.stringify({
        instruction: customPulseRepair
          ? "Repair SOURCE_OUTPUT into custom-Pulse JSON. Preserve question-vs-direct-answer-vs-final-artifact intent. Questions or missing-input requests must return status needs_input with actions null. Ordinary direct answers must return status ready with actions null. Use actions.applyPrompt only for a clearly reusable final prompt or artifact."
          : repairReason === "repeated_workflow_step"
            ? "Repair SOURCE_OUTPUT into Pulse JSON by continuing the active guided workflow. The assistant repeated the previous workflow question after the user answered it. Accept latest_user_input as progress and ask the next useful question, or produce the final artifact if enough information is present. Do not repeat SOURCE_OUTPUT verbatim."
            : "Repair SOURCE_OUTPUT into Pulse JSON. Preserve question-vs-final-artifact intent. Questions or missing-input requests must return status needs_input with actions null. Final generation-ready artifacts must return status ready with actions.applyPrompt equal to the exact artifact text.",
        repair_reason: repairReason,
        pulse_kind: pulseKind,
        source_output: contentText,
        latest_user_input: latestUserInput,
        canonical_prompt: canonicalPrompt,
        active_prompt: activePrompt,
        workflow_session_state: workflowSession ?? null,
      })
    : JSON.stringify({
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
  safeCompletionRecoveryEligible = false,
  onProviderCall,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  openAiMessages: OpenAiChatMessage[];
  timeoutMs: number;
  effectiveCanonical: string | null;
  context: AgentContext;
  messages: AgentMessage[];
  markStage: StageMarker;
  safeCompletionRecoveryEligible?: boolean;
  onProviderCall?: (
    stage: "coordinator" | "repair" | "safe_completion_recovery"
  ) => void | Promise<void>;
}): Promise<StudioAgentFastPathTurnResult> => {
  const fastPathStartedAt = Date.now();
  const pulseKind = resolveStudioAgentPulseKind(context.pulse);
  const pulseActive = pulseKind !== null;
  let response: Response;
  await onProviderCall?.("coordinator");
  try {
    response = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl,
      model,
      messages: openAiMessages,
      timeoutMs,
      responseFormat: pulseActive ? STUDIO_AGENT_PULSE_RESPONSE_FORMAT : undefined,
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
  const initialCompletion = parseFastPathCompletion({ data, pulseActive });
  const contentText = initialCompletion.contentText;
  let parsedWithStatus = initialCompletion.parsedWithStatus;
  let refusalSource: SafeCompletionRefusalSource | null = initialCompletion.typedRefusal
    ? "typed_model"
    : null;
  let repairUsed = false;
  const shouldRepairRepeatedGuidedStep = isGuidedWorkflowRepeatAfterUserInput({
    context,
    messages,
    parsed: parsedWithStatus?.response ?? null,
    semanticStatus: parsedWithStatus?.status ?? null,
  });
  if (
    !hasUsableFastPathPayload(parsedWithStatus?.response ?? null) ||
    shouldRepairRepeatedGuidedStep
  ) {
    const latestUserInput = pulseActive
      ? resolveLatestStudioAgentUserInput(messages)
      : resolveLatestUserInput(messages);
    const repairStartedAt = Date.now();
    let repairResponse: Response;
    await onProviderCall?.("repair");
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
          pulseKind,
          workflowSession: context.pulse?.workflowSession ?? null,
          repairReason: shouldRepairRepeatedGuidedStep
            ? "repeated_workflow_step"
            : "malformed_output",
        }),
        timeoutMs,
        responseFormat: pulseActive ? STUDIO_AGENT_PULSE_RESPONSE_FORMAT : undefined,
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
    const repairedCompletion = parseFastPathCompletion({ data: repairData, pulseActive });
    parsedWithStatus = repairedCompletion.parsedWithStatus;
    if (repairedCompletion.typedRefusal) refusalSource = "typed_model";
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

  const initialResponseRefusal = isStudioAgentRefusalResponse({
    status: parsedWithStatus.status,
    response: parsedWithStatus.response,
  });
  if (initialResponseRefusal && !refusalSource) {
    refusalSource = parsedWithStatus.status === "refuse" ? "semantic_model" : "lexical_model";
  }
  let safeCompletionRecoveryAttempted = false;
  let safeCompletionRecoveryOutcome: SafeCompletionRecoveryOutcome = "not_attempted";
  let safeCompletionRecoveryLatencyMs: number | null = null;
  if (initialResponseRefusal && safeCompletionRecoveryEligible) {
    safeCompletionRecoveryAttempted = true;
    const recoveryStartedAt = Date.now();
    await onProviderCall?.("safe_completion_recovery");
    try {
      const recoveryResponse = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model,
        messages: withSafeCompletionRecoveryInstruction(openAiMessages),
        timeoutMs,
        responseFormat: pulseActive ? STUDIO_AGENT_PULSE_RESPONSE_FORMAT : undefined,
      });
      if (recoveryResponse.ok) {
        const recoveryData = (await recoveryResponse.json()) as Record<string, unknown>;
        const recoveryCompletion = parseFastPathCompletion({ data: recoveryData, pulseActive });
        const recovered = recoveryCompletion.parsedWithStatus;
        if (
          recovered &&
          hasUsableFastPathPayload(recovered.response) &&
          !isStudioAgentRefusalResponse({ status: recovered.status, response: recovered.response })
        ) {
          parsedWithStatus = recovered;
          safeCompletionRecoveryOutcome = "recovered";
        } else if (
          recovered &&
          isStudioAgentRefusalResponse({ status: recovered.status, response: recovered.response })
        ) {
          safeCompletionRecoveryOutcome = "refused";
        } else {
          safeCompletionRecoveryOutcome = "error";
        }
      } else {
        safeCompletionRecoveryOutcome = "error";
      }
    } catch {
      safeCompletionRecoveryOutcome = "error";
    } finally {
      safeCompletionRecoveryLatencyMs = Date.now() - recoveryStartedAt;
      markStage("safe_completion_recovery", recoveryStartedAt);
    }
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
      refusalSource,
      safeCompletionRecoveryAttempted,
      safeCompletionRecoveryOutcome,
      safeCompletionRecoveryLatencyMs,
      usage: extractUsageTokens(data),
    },
  };
};
