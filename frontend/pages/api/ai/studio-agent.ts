/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../../../features/agent-core/promptText";
import { pickSelectedReferencesForThinker } from "../../../features/ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../../features/ai-agent/logic/studioAgentOrchestration";
import {
  readStudioAgentCanonicalPrompt,
  writeStudioAgentCanonicalPrompt,
} from "../../../features/agent-runtime/studioAgentCanonicalPersistence";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../../../features/agent-runtime/studioAgentOpenAiGateway";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../../../features/agent-runtime/studioAgentRouteEnvelope";
import {
  extractStudioAgentCompletionText,
  parseStudioAgentJsonWithStatus,
} from "../../../features/agent-runtime/studioAgentResponseNormalization";
import { resolveStudioAgentTurnResponse } from "../../../features/agent-runtime/studioAgentTurnResponse";
import { executeStudioAgentV2Turn } from "../../../features/agent-runtime/studioAgentV2Turn";
import {
  applyStudioAgentVisionSummariesToContext,
  buildStudioAgentImageSummaryMap,
  describeStudioAgentVisionSummaryError,
} from "../../../features/agent-runtime/studioAgentVisionSummaries";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { clampCanonicalPrompt } from "../../../lib/server/api/agentConversationState";

type OpenAIChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
    };

const buildOpenAiMessages = (
  messages: AgentMessage[],
  context: AgentContext,
  systemPrompt: string,
  orchestration?: Record<string, unknown>
): OpenAIChatMessage[] => {
  const chat: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `CONTEXT:\n${JSON.stringify(context)}` },
  ];
  if (orchestration) {
    chat.push({ role: "system", content: `ORCHESTRATION:\n${JSON.stringify(orchestration)}` });
  }

  if (context.lastAssistantMessage) {
    chat.push({ role: "assistant", content: context.lastAssistantMessage });
  }

  if (context.media && context.media.length) {
    chat.push({
      role: "user",
      content: [
        { type: "text", text: "Here are media previews (downscaled):" },
        ...context.media.map((item) => ({
          type: "image_url" as const,
          image_url: {
            url: item.url as string,
            detail: "low" as const,
          },
        })),
      ],
    });
  }

  messages.forEach((message) => {
    const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
    chat.push({
      role,
      content: message.content,
    });
  });
  return chat;
};

const emitTurnTelemetry = ({
  flow,
  path,
  status,
  model,
  retryUsed,
  totalLatencyMs,
  stageLatencyMs,
}: {
  flow: string;
  path: string;
  status: "success" | "refuse" | "error";
  model: string;
  retryUsed: boolean;
  totalLatencyMs: number;
  stageLatencyMs: Record<string, number>;
}) => {
  console.info(
    "[studio-agent][telemetry]",
    JSON.stringify({
      flow,
      path,
      status,
      model,
      retry_used: retryUsed,
      latency_ms_total: totalLatencyMs,
      latency_ms_stage: stageLatencyMs,
    })
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestStartedAt = Date.now();
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

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
    return res.status(500).json({ error: "OPENAI_API_KEY is not set", traceId });
  }

  const systemPrompt = loadAgentPrompt("STUDIO_AGENT_SYSTEM", process.env.STUDIO_AGENT_SYSTEM);
  const thinkerPrompt = loadAgentPrompt("STUDIO_AGENT_THINKER", process.env.STUDIO_AGENT_THINKER);
  const formatterPrompt = loadAgentPrompt(
    "STUDIO_AGENT_FORMATTER",
    process.env.STUDIO_AGENT_FORMATTER
  );
  const imageDescribePrompt = loadAgentPrompt(
    "OPENAI_PROMPT_IMAGE_DESCRIBE",
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE
  );
  if (!systemPrompt) {
    return res.status(500).json({ error: "STUDIO_AGENT_SYSTEM prompt missing", traceId });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  const messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;

  const canonicalDbEnabled = process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED !== "false";
  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const textFastPathEnabled = process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED !== "false";
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const { openAiUrl, openAiModel, openAiVisionModel, openAiThinkerModel, openAiFormatterModel } =
    openAiConfig;
  const requestTimeoutMs = openAiConfig.requestTimeoutMs;

  const storedCanonical = await readStudioAgentCanonicalPrompt({
    req,
    userId: user.id,
    conversationId: normalizedConversationId,
    canonicalDbEnabled,
    markStage,
    formatErrorMessage: formatStudioAgentErrorMessage,
  });

  const canonicalPrompt =
    sanitizeGenerationPromptText(storedCanonical) ??
    incomingCanonical ??
    sanitizeGenerationPromptText(context.lastAssistantMessage) ??
    null;
  const effectiveCanonical = clampCanonicalPrompt(canonicalPrompt);

  const selectedReferencesBeforeVision = pickSelectedReferencesForThinker(context);
  const orchestrationBeforeVision = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforeVision,
    effectiveCanonical,
  });

  let visionSummaryMap = new Map<string, string>();
  if (
    serverVisionEnabled &&
    imageDescribePrompt &&
    orchestrationBeforeVision.shouldRunVisionDescription &&
    (context.media?.length ?? 0) > 0
  ) {
    const visionStartedAt = Date.now();
    try {
      visionSummaryMap = await buildStudioAgentImageSummaryMap({
        openAiUrl,
        context,
        imageDescribePrompt,
        apiKey,
        visionModel: openAiVisionModel,
        timeoutMs: requestTimeoutMs,
      });
      context = applyStudioAgentVisionSummariesToContext(context, visionSummaryMap);
    } catch (error) {
      console.warn(
        "[studio-agent] server vision summary failed",
        describeStudioAgentVisionSummaryError(error)
      );
      await logApiRouteException({
        req,
        error,
        routeLabel: "ai/studio-agent",
        metadata: {
          user_id: user.id,
          conversation_id: normalizedConversationId,
          stage: "vision_summary",
        },
      });
    } finally {
      markStage("vision_summary", visionStartedAt);
    }
  }

  const selectedReferences = pickSelectedReferencesForThinker(context);
  const orchestration = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences,
    effectiveCanonical,
  });

  const openAiMessages = buildOpenAiMessages(messages, context, systemPrompt, orchestration);
  const hasV2Prompts = Boolean(thinkerPrompt && formatterPrompt);
  const useV2Path = hasV2Prompts && !(orchestration.flow === "TEXT_ONLY" && textFastPathEnabled);
  const path = useV2Path
    ? "v2_orchestration"
    : orchestration.flow === "TEXT_ONLY"
      ? "text_fast_path"
      : "fallback_fast_path";

  try {
    if (useV2Path && thinkerPrompt && formatterPrompt) {
      const v2Turn = await executeStudioAgentV2Turn({
        apiKey,
        openAiUrl,
        thinkerModel: openAiThinkerModel,
        formatterModel: openAiFormatterModel,
        thinkerPrompt,
        formatterPrompt,
        timeoutMs: requestTimeoutMs,
        orchestration,
        context,
        messages,
        selectedReferences,
        visionSummaryMap,
        effectiveCanonical,
        markStage,
      });

      if (!v2Turn.ok) {
        emitTurnTelemetry({
          flow: orchestration.flow,
          path,
          status: "error",
          model: openAiThinkerModel,
          retryUsed: false,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
        });
        return res.status(v2Turn.status).json({
          error: `Upstream error (${v2Turn.stage})`,
          detail: v2Turn.detail,
          traceId,
        });
      }

      let parsed = v2Turn.result.parsed;
      const nextCanonical = v2Turn.result.nextCanonical;
      const usage = v2Turn.result.usage;
      const semanticStatus = v2Turn.result.semanticStatus;
      const retryUsed = v2Turn.result.retryUsed;

      const resolvedTurn = resolveStudioAgentTurnResponse({
        parsed,
        semanticStatus,
        nextCanonical,
        effectiveCanonical,
        context,
        messages,
      });
      parsed = resolvedTurn.parsed;
      const refusal = resolvedTurn.refusal;
      const resolvedCanonical = resolvedTurn.resolvedCanonical;

      if (!refusal) {
        await writeStudioAgentCanonicalPrompt({
          req,
          userId: user.id,
          conversationId: normalizedConversationId,
          canonicalPrompt: resolvedCanonical,
          canonicalDbEnabled,
          markStage,
          writeFailureStage: "canonical_write_v2",
          formatErrorMessage: formatStudioAgentErrorMessage,
        });
      }

      emitTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: refusal ? "refuse" : "success",
        model: openAiThinkerModel,
        retryUsed,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });

      return res.status(200).json({
        ...parsed,
        usage,
        canonicalPrompt: resolvedCanonical,
        traceId,
      });
    }

    const fastPathStartedAt = Date.now();
    const response = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl,
      model: openAiModel,
      messages: openAiMessages,
      timeoutMs: requestTimeoutMs,
    });
    markStage("fast_path_turn", fastPathStartedAt);

    if (!response.ok) {
      const detail = await response.text();
      emitTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "error",
        model: openAiModel,
        retryUsed: false,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });
      return res.status(response.status).json({ error: "Upstream error", detail, traceId });
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

    if (!refusal) {
      await writeStudioAgentCanonicalPrompt({
        req,
        userId: user.id,
        conversationId: normalizedConversationId,
        canonicalPrompt: resolvedCanonical,
        canonicalDbEnabled,
        markStage,
        writeFailureStage: "canonical_write_fast_path",
        formatErrorMessage: formatStudioAgentErrorMessage,
      });
    }

    emitTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: refusal ? "refuse" : "success",
      model: openAiModel,
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });

    return res.status(200).json({
      ...parsed,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
      canonicalPrompt: resolvedCanonical,
      traceId,
    });
  } catch (error) {
    emitTurnTelemetry({
      flow: "unknown",
      path,
      status: "error",
      model: openAiModel,
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: user.id,
        conversation_id: normalizedConversationId,
      },
    });
    return res.status(500).json({
      error: "Agent call failed",
      detail: formatStudioAgentErrorMessage(error),
      traceId,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
