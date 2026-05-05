/**
 * Standard Create agent runtime for AI Studio.
 * Owns Standard request execution and forwards raw conversation turns to OpenAI.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { buildAgentMachineOutcome } from "../agentMachineOutcome";
import {
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
import { extractStudioAgentCompletionText } from "../studioAgentResponseNormalization";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import type { OpenAiChatMessage } from "../../../lib/server/api/openAiCompat";
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";

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
}: {
  messages: AgentMessage[];
  context: AgentContext;
}): OpenAiChatMessage[] => {
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

  return messages.map((message, index): OpenAiChatMessage => {
    const role = message.role === "assistant" ? "assistant" : "user";
    if (index !== latestUserIndex || !imageParts.length || role !== "user") {
      return {
        role,
        content: message.content,
      };
    }
    const textContent = message.content.trim();
    return {
      role,
      content: textContent.length
        ? [{ type: "text", text: textContent }, ...imageParts]
        : imageParts,
    };
  });
};

const extractStandardOpenAiResponse = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const raw = choices?.[0]?.message?.content;
  const directMessage = extractStudioAgentCompletionText(raw);
  return typeof directMessage === "string" && directMessage.trim().length > 0
    ? directMessage.trim()
    : null;
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

  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const standardModel = openAiConfig.openAiModel;
  const openAiRoundTripStartedAt = Date.now();
  try {
    const directResponse = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl: openAiConfig.openAiUrl,
      model: standardModel,
      messages: buildStandardOpenAiMessages({ messages, context }),
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
    const directResult = extractStandardOpenAiResponse(directPayload);
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

    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "success",
      model: standardModel,
      outcomeClass: "success_message",
      retryUsed: false,
      reasonCode: "SUCCESS_MESSAGE",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(200).json({
      message: directResult,
      ...buildAgentMachineOutcome({
        outcomeClass: "success_message",
        reasonCode: "SUCCESS_MESSAGE",
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
