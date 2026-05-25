/**
 * Standard Create agent runtime for AI Studio.
 * Owns Standard request execution and forwards raw conversation turns to OpenAI.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { buildAgentMachineOutcome } from "../agentMachineOutcome";
import {
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
} from "../studioAgentRouteOutcomes";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../studioAgentRouteEnvelope";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../studioAgentOpenAiGateway";
import {
  hasInboundStudioAgentCanonicalPrompt,
  hasStudioAgentPulseContext,
  isPulseCreateAgentSessionNamespace,
  readStudioAgentClientSessionNamespace,
} from "../studioAgentRouteModeBoundary";
import {
  ensureStudioAgentApplyPromptContract,
  extractStudioAgentCompletionText,
  isStudioAgentRefusalResponse,
  parseStudioAgentJsonWithStatus,
} from "../studioAgentResponseNormalization";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import type { OpenAiChatMessage } from "../../../lib/server/api/openAiCompat";
import {
  resolveRequiredRuntimeAgentPrompt,
  type RequiredRuntimeAgentPromptResolution,
  RequiredRuntimeAgentPromptMissingError,
  RequiredRuntimeAgentPromptUnavailableError,
} from "../../../lib/server/api/runtimeAgentPromptControlPlane";
import type { AgentContext, AgentMessage, AgentResponse } from "../../../prefabs/agent";

const STANDARD_ROUTE_LABEL = "ai/studio-agent-standard";
const STANDARD_TELEMETRY_PATH = "standard_agent";

const resolveStandardFlow = (
  context: {
    media?: Array<unknown> | null;
    references?: Array<{ kind?: string | null } | null> | null;
  } | null
): "TEXT_ONLY" | "MIXED" => {
  const hasMediaContext = (context?.media?.length ?? 0) > 0;
  const hasImageReferenceContext =
    context?.references?.some((reference) => {
      const kind = reference?.kind;
      return kind === "image" || kind === "video";
    }) ?? false;
  return hasMediaContext || hasImageReferenceContext ? "MIXED" : "TEXT_ONLY";
};

const buildStandardOpenAiMessages = ({
  messages,
  context,
  systemPrompt,
}: {
  messages: AgentMessage[];
  context: AgentContext;
  systemPrompt?: string | null;
}): OpenAiChatMessage[] => {
  const promptReferenceSnippets = Array.from(
    new Set(
      context.references
        ?.filter((item) => item.kind === "prompt")
        .map((item) => item.promptSnippet?.trim() || "")
        .filter((item) => item.length > 0) ?? []
    )
  ).slice(0, 8);
  const promptReferenceBlock = promptReferenceSnippets.length
    ? `Attached reference text:\n${promptReferenceSnippets.map((snippet) => `- ${snippet}`).join("\n")}`
    : "";
  const imageParts =
    context.media
      ?.filter((item) => item.kind === "image" && typeof item.url === "string" && item.url.length)
      .map((item) => ({
        type: "image_url" as const,
        image_url: {
          url: item.url as string,
          detail: "high" as const,
        },
      })) ?? [];
  const latestUserIndex = messages.reduce(
    (latestIndex, message, index) => (message.role === "user" ? index : latestIndex),
    -1
  );

  const conversationMessages = messages.map((message, index): OpenAiChatMessage => {
    const role = message.role === "assistant" ? "assistant" : "user";
    if (index !== latestUserIndex || role !== "user") {
      return {
        role,
        content: message.content,
      };
    }
    const textContent = message.content.trim();
    const combinedTextContent = [textContent, promptReferenceBlock].filter(Boolean).join("\n\n");
    if (!imageParts.length) {
      return {
        role,
        content: combinedTextContent,
      };
    }
    return {
      role,
      content: combinedTextContent.length
        ? [{ type: "text", text: combinedTextContent }, ...imageParts]
        : imageParts,
    };
  });
  const normalizedSystemPrompt = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
  return normalizedSystemPrompt.length > 0
    ? [{ role: "system", content: normalizedSystemPrompt }, ...conversationMessages]
    : conversationMessages;
};

const extractStandardOpenAiResponse = ({
  payload,
  fallbackPrompt,
}: {
  payload: unknown;
  fallbackPrompt: string;
}): {
  response: AgentResponse;
  refusal: boolean;
} | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const raw = choices?.[0]?.message?.content;
  const parsed = parseStudioAgentJsonWithStatus(raw, { allowUnstructured: true });
  if (!parsed) {
    const directMessage = extractStudioAgentCompletionText(raw);
    if (typeof directMessage !== "string" || directMessage.trim().length === 0) {
      return null;
    }
    return {
      response: ensureStudioAgentApplyPromptContract({
        parsed: {
          message: directMessage.trim(),
          actions: undefined,
        },
        fallbackPrompt: directMessage.trim(),
      }),
      refusal: false,
    };
  }

  if (
    isStudioAgentRefusalResponse({
      status: parsed.status,
      response: parsed.response,
    })
  ) {
    return {
      response: {
        message: parsed.response.message,
        actions: undefined,
      },
      refusal: true,
    };
  }

  return {
    response: ensureStudioAgentApplyPromptContract({
      parsed: parsed.response,
      fallbackPrompt: parsed.response.message || fallbackPrompt,
    }),
    refusal: false,
  };
};

/**
 * Runs one Standard Create agent request as a pass-through OpenAI chat turn.
 */
export const runStandardStudioAgentRuntime = async (req: NextApiRequest, res: NextApiResponse) => {
  const requestStartedAt = Date.now();
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

  if (req.method === "POST") {
    const clientSessionNamespace = readStudioAgentClientSessionNamespace(req.body);
    const hasCrossModeContinuity = isPulseCreateAgentSessionNamespace(clientSessionNamespace);
    if (
      req.body?.runtimeMode === "pulse" ||
      hasStudioAgentPulseContext(req.body?.context) ||
      hasCrossModeContinuity
    ) {
      return sendStudioAgentError(res, 400, {
        code: "INVALID_REQUEST",
        message: "Standard agent runtime does not accept Pulse runtime payloads.",
        traceId,
      });
    }
    if (hasInboundStudioAgentCanonicalPrompt(req.body)) {
      return sendStudioAgentError(res, 400, {
        code: "INVALID_REQUEST",
        message: "Standard agent runtime does not accept canonicalPrompt.",
        traceId,
      });
    }
    req.body = {
      ...req.body,
      runtimeMode: "standard",
    };
  }

  if (req.method !== "POST") {
    return sendStudioAgentError(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
      traceId,
    });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  if (
    !isStudioAgentFeatureEnabled({
      serverFlag: process.env.STUDIO_AGENT_ENABLED,
      publicFlag: process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT,
    })
  ) {
    return sendStudioAgentError(res, 503, {
      code: "AGENT_DISABLED",
      message: "Studio agent is disabled",
      traceId,
    });
  }

  const requestEnvelope = parseStudioAgentRequestEnvelope({
    req,
    userId: user.id,
    traceId,
  });
  if (!requestEnvelope.ok) {
    return sendStudioAgentError(res, requestEnvelope.status, requestEnvelope.payload);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: "OPENAI_API_KEY is not set",
        reasonCode: "CONFIG_MISSING",
      }),
      error: "OPENAI_API_KEY is not set",
    });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  const messages = requestEnvelope.value.messages;
  const context = requestEnvelope.value.context;
  const flow = resolveStandardFlow(context);
  let resolvedSystemPrompt: RequiredRuntimeAgentPromptResolution;
  try {
    resolvedSystemPrompt = await resolveRequiredRuntimeAgentPrompt({
      promptId: "STUDIO_AGENT_SYSTEM",
    });
  } catch (error) {
    const detail =
      error instanceof RequiredRuntimeAgentPromptMissingError ||
      error instanceof RequiredRuntimeAgentPromptUnavailableError ||
      (error instanceof Error &&
        (error.name === "RequiredRuntimeAgentPromptMissingError" ||
          error.name === "RequiredRuntimeAgentPromptUnavailableError"))
        ? error.message
        : "Standard runtime system prompt unavailable.";
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "error",
      model: process.env.OPENAI_MODEL ?? "unknown",
      outcomeClass: "route_error",
      retryUsed: false,
      reasonCode: "CONFIG_MISSING",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail,
        reasonCode: "CONFIG_MISSING",
      }),
      error: detail,
    });
  }

  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const standardModel = openAiConfig.openAiModel;
  const openAiRoundTripStartedAt = Date.now();
  try {
    const directResponse = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl: openAiConfig.openAiUrl,
      model: standardModel,
      messages: buildStandardOpenAiMessages({
        messages,
        context,
        systemPrompt: resolvedSystemPrompt.promptBody,
      }),
      timeoutMs: openAiConfig.turnTimeoutMs,
    });
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);

    if (!directResponse.ok) {
      const detail = await directResponse.text();
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: false,
        reasonCode: "UPSTREAM_ERROR",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res.status(directResponse.status).json(
        buildStudioAgentUpstreamErrorPayload({
          traceId,
          detail,
        })
      );
    }

    const directPayload = await directResponse.json();
    const directResult = extractStandardOpenAiResponse({
      payload: directPayload,
      fallbackPrompt: messages[messages.length - 1]?.content?.trim() || "",
    });
    if (!directResult) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: false,
        reasonCode: "UPSTREAM_ERROR",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res.status(502).json(
        buildStudioAgentUpstreamErrorPayload({
          traceId,
          detail: "Standard agent output contract violation.",
          stage: "standard_openai_response",
        })
      );
    }

    if (directResult.refusal) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "refuse",
        model: standardModel,
        outcomeClass: "refusal_safety",
        retryUsed: false,
        reasonCode: "SAFETY_OUTPUT_REFUSAL",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res
        .status(200)
        .json(buildStudioAgentSafetyRefusalPayload({ traceId, canonicalPrompt: null }));
    }

    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "success",
      model: standardModel,
      outcomeClass: "success_prompt",
      retryUsed: false,
      reasonCode: "SUCCESS_PROMPT",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(200).json({
      ...directResult.response,
      ...buildAgentMachineOutcome({
        outcomeClass: "success_prompt",
        reasonCode: "SUCCESS_PROMPT",
      }),
      canonicalPrompt: null,
      traceId,
    });
  } catch (error) {
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);
    await logApiRouteException({
      req,
      error,
      routeLabel: STANDARD_ROUTE_LABEL,
      metadata: {
        user_id: user.id,
        conversation_id: normalizedConversationId,
        stage: "standard_openai",
      },
    });
    const detail = formatStudioAgentErrorMessage(error);
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "error",
      model: standardModel,
      outcomeClass: "upstream_error",
      retryUsed: false,
      reasonCode: "UPSTREAM_ERROR",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(502).json(
      buildStudioAgentUpstreamErrorPayload({
        traceId,
        detail,
        stage: "standard_openai",
      })
    );
  }
};
