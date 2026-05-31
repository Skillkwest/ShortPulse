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
import {
  classifyStudioAgentFailure,
  computeStudioAgentRetryDelayMs,
  shouldRetryStudioAgentFailure,
  waitForStudioAgentRetry,
} from "../studioAgentFailurePolicy";
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
const STANDARD_EXTENDED_TEXT_TIMEOUT_CHAR_THRESHOLD = 2500;
const STANDARD_MAX_PROMPT_REFERENCE_SNIPPETS = 8;
const STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS = 320;
const STANDARD_RESPONSE_STYLE_GUIDANCE = [
  "Standard response formatting rules:",
  "- For ordinary replies, prefer short paragraphs, bullets or numbered lists when helpful, and brief section labels only when they genuinely improve scanning.",
  "- Do not flatten helpful structure into a dense text wall.",
].join("\n");

type StandardOpenAiImageDetail = "high" | "auto";

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
  imageDetail = "high",
}: {
  messages: AgentMessage[];
  context: AgentContext;
  systemPrompt?: string | null;
  imageDetail?: StandardOpenAiImageDetail;
}): OpenAiChatMessage[] => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceSnippets = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  });
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
          detail: imageDetail,
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
  const effectiveSystemPrompt = normalizedSystemPrompt.length
    ? `${normalizedSystemPrompt}\n\n${STANDARD_RESPONSE_STYLE_GUIDANCE}`
    : STANDARD_RESPONSE_STYLE_GUIDANCE;
  return [{ role: "system", content: effectiveSystemPrompt }, ...conversationMessages];
};

const clipStandardPromptReferenceSnippet = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS
    ? `${trimmed.slice(0, STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS - 1)}...`
    : trimmed;
};

const resolveLatestStandardUserText = (messages: AgentMessage[]): string => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0);
  return latestUserMessage?.content.trim() ?? "";
};

const resolveStandardPromptReferenceSnippets = ({
  context,
  latestUserText,
}: {
  context: AgentContext;
  latestUserText: string;
}): string[] => {
  const normalizedLatestUserText = latestUserText.trim();
  return Array.from(
    new Set(
      context.references
        ?.filter((item) => item.kind === "prompt")
        .map((item) => clipStandardPromptReferenceSnippet(item.promptSnippet))
        .filter((item): item is string => Boolean(item) && item !== normalizedLatestUserText) ?? []
    )
  ).slice(0, STANDARD_MAX_PROMPT_REFERENCE_SNIPPETS);
};

const measureStandardTextPayloadChars = ({
  messages,
  context,
}: {
  messages: AgentMessage[];
  context: AgentContext;
}): number => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceChars = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  }).reduce((total, snippet) => total + snippet.length, 0);
  const messageChars = messages.reduce(
    (total, message) => total + message.content.trim().length,
    0
  );
  return messageChars + promptReferenceChars;
};

const summarizeStandardTextPayload = ({
  messages,
  context,
}: {
  messages: AgentMessage[];
  context: AgentContext;
}) => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceSnippets = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  });
  const promptReferenceChars = promptReferenceSnippets.reduce(
    (total, snippet) => total + snippet.length,
    0
  );
  const textPayloadChars =
    messages.reduce((total, message) => total + message.content.trim().length, 0) +
    promptReferenceChars;
  return {
    latestUserChars: latestUserText.length,
    promptReferenceChars,
    promptReferenceSnippetCount: promptReferenceSnippets.length,
    textPayloadChars,
  };
};

const executeStandardOpenAiWithRetry = async ({
  apiKey,
  openAiUrl,
  model,
  messages,
  timeoutMs,
  maxAttempts,
  retryBaseDelayMs,
  retryMaxDelayMs,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  messages: OpenAiChatMessage[];
  timeoutMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
}): Promise<
  | { ok: true; response: Response; retryCount: number }
  | {
      ok: false;
      detail: string;
      retryCount: number;
      status?: number;
      error?: unknown;
    }
> => {
  let attempt = 1;
  let retryCount = 0;

  while (true) {
    try {
      const response = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model,
        messages,
        timeoutMs,
      });
      if (response.ok) {
        return { ok: true, response, retryCount };
      }

      const detail = await response.text();
      const failureClass = classifyStudioAgentFailure({
        status: response.status,
        detail,
      });
      if (
        !shouldRetryStudioAgentFailure({
          failureClass,
          attempt,
          maxAttempts,
        })
      ) {
        return {
          ok: false,
          status: response.status,
          detail,
          retryCount,
        };
      }
    } catch (error) {
      const detail = formatStudioAgentErrorMessage(error);
      const failureClass = classifyStudioAgentFailure({ detail });
      if (
        !shouldRetryStudioAgentFailure({
          failureClass,
          attempt,
          maxAttempts,
        })
      ) {
        return {
          ok: false,
          detail,
          retryCount,
          error,
        };
      }
    }

    retryCount += 1;
    const retryDelayMs = computeStudioAgentRetryDelayMs({
      attempt,
      baseDelayMs: retryBaseDelayMs,
      maxDelayMs: retryMaxDelayMs,
    });
    await waitForStudioAgentRetry(retryDelayMs);
    attempt += 1;
  }
};

export const resolveStandardOpenAiExecutionProfile = ({
  flow,
  openAiModel,
  openAiVisionModel,
  turnTimeoutMs,
  visionTimeoutMs,
  pulseTurnTimeoutMs,
  textPayloadChars = 0,
}: {
  flow: "TEXT_ONLY" | "MIXED";
  openAiModel: string;
  openAiVisionModel: string;
  turnTimeoutMs: number;
  visionTimeoutMs: number;
  pulseTurnTimeoutMs: number;
  textPayloadChars?: number;
}): {
  model: string;
  timeoutMs: number;
  imageDetail: StandardOpenAiImageDetail;
} => {
  if (flow === "MIXED") {
    return {
      model: openAiVisionModel,
      timeoutMs: Math.max(turnTimeoutMs, visionTimeoutMs, pulseTurnTimeoutMs),
      imageDetail: "auto",
    };
  }

  return {
    model: openAiModel,
    timeoutMs:
      textPayloadChars >= STANDARD_EXTENDED_TEXT_TIMEOUT_CHAR_THRESHOLD
        ? Math.max(turnTimeoutMs, pulseTurnTimeoutMs)
        : turnTimeoutMs,
    imageDetail: "high",
  };
};

const summarizeStandardContextForExceptionLog = (context: AgentContext) => {
  const references = Array.isArray(context.references) ? context.references : [];
  const media = Array.isArray(context.media) ? context.media : [];
  return {
    reference_count: references.length,
    image_reference_count: references.filter(
      (reference) => reference.kind === "image" || reference.kind === "video"
    ).length,
    prompt_reference_count: references.filter((reference) => reference.kind === "prompt").length,
    media_count: media.length,
    image_media_count: media.filter((item) => item.kind === "image").length,
    mode_hint: context.modeHint ?? null,
    focused_source: context.focusedSource ?? null,
  };
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

  const authVerificationStartedAt = Date.now();
  const user = await requireApiUser(req, res);
  markStage("auth_verification", authVerificationStartedAt);
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

  const requestEnvelopeStartedAt = Date.now();
  const requestEnvelope = parseStudioAgentRequestEnvelope({
    req,
    userId: user.id,
    traceId,
  });
  markStage("request_envelope", requestEnvelopeStartedAt);
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
  const runtimePromptResolutionStartedAt = Date.now();
  try {
    resolvedSystemPrompt = await resolveRequiredRuntimeAgentPrompt({
      promptId: "STUDIO_AGENT_SYSTEM",
    });
    markStage("runtime_prompt_resolution", runtimePromptResolutionStartedAt);
  } catch (error) {
    markStage("runtime_prompt_resolution", runtimePromptResolutionStartedAt);
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
      traceId,
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
  const textPayloadChars = measureStandardTextPayloadChars({ messages, context });
  const textPayloadSummary = summarizeStandardTextPayload({ messages, context });
  const executionProfile = resolveStandardOpenAiExecutionProfile({
    flow,
    openAiModel: openAiConfig.openAiModel,
    openAiVisionModel: openAiConfig.openAiVisionModel,
    turnTimeoutMs: openAiConfig.turnTimeoutMs,
    visionTimeoutMs: openAiConfig.visionTimeoutMs,
    pulseTurnTimeoutMs: openAiConfig.pulseTurnTimeoutMs,
    textPayloadChars,
  });
  const standardModel = executionProfile.model;
  const openAiRoundTripStartedAt = Date.now();
  const standardOpenAiMessages = buildStandardOpenAiMessages({
    messages,
    context,
    systemPrompt: resolvedSystemPrompt.promptBody,
    imageDetail: executionProfile.imageDetail,
  });
  try {
    const directResponseResult = await executeStandardOpenAiWithRetry({
      apiKey,
      openAiUrl: openAiConfig.openAiUrl,
      model: standardModel,
      messages: standardOpenAiMessages,
      timeoutMs: executionProfile.timeoutMs,
      maxAttempts: openAiConfig.upstreamRetryMaxAttempts,
      retryBaseDelayMs: openAiConfig.upstreamRetryBaseDelayMs,
      retryMaxDelayMs: openAiConfig.upstreamRetryMaxDelayMs,
    });
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);

    if (!directResponseResult.ok) {
      if (directResponseResult.error) {
        throw Object.assign(
          directResponseResult.error instanceof Error
            ? directResponseResult.error
            : new Error(directResponseResult.detail),
          { retryCount: directResponseResult.retryCount }
        );
      }

      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        traceId,
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
        reasonCode: "UPSTREAM_ERROR",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res.status(directResponseResult.status ?? 502).json(
        buildStudioAgentUpstreamErrorPayload({
          traceId,
          detail: directResponseResult.detail,
        })
      );
    }

    const directPayload = await directResponseResult.response.json();
    const directResult = extractStandardOpenAiResponse({
      payload: directPayload,
      fallbackPrompt: messages[messages.length - 1]?.content?.trim() || "",
    });
    if (!directResult) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        traceId,
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
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
        traceId,
        model: standardModel,
        outcomeClass: "refusal_safety",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
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
      traceId,
      model: standardModel,
      outcomeClass: "success_prompt",
      retryUsed: directResponseResult.retryCount > 0,
      retryCount: directResponseResult.retryCount,
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
        trace_id: traceId,
        user_id: user.id,
        conversation_id: normalizedConversationId,
        stage: "standard_openai",
        flow,
        execution_model: standardModel,
        execution_image_detail: executionProfile.imageDetail,
        effective_timeout_ms: executionProfile.timeoutMs,
        configured_turn_timeout_ms: openAiConfig.turnTimeoutMs,
        configured_vision_timeout_ms: openAiConfig.visionTimeoutMs,
        configured_pulse_turn_timeout_ms: openAiConfig.pulseTurnTimeoutMs,
        message_count: messages.length,
        retry_count:
          typeof (error as { retryCount?: unknown })?.retryCount === "number"
            ? ((error as { retryCount: number }).retryCount ?? 0)
            : 0,
        text_payload_chars: textPayloadSummary.textPayloadChars,
        latest_user_chars: textPayloadSummary.latestUserChars,
        prompt_reference_chars: textPayloadSummary.promptReferenceChars,
        prompt_reference_snippet_count: textPayloadSummary.promptReferenceSnippetCount,
        stage_latency_ms: stageLatencyMs,
        ...summarizeStandardContextForExceptionLog(context),
      },
    });
    const detail = formatStudioAgentErrorMessage(error);
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "error",
      traceId,
      model: standardModel,
      outcomeClass: "upstream_error",
      retryUsed:
        typeof (error as { retryCount?: unknown })?.retryCount === "number" &&
        ((error as { retryCount: number }).retryCount ?? 0) > 0,
      retryCount:
        typeof (error as { retryCount?: unknown })?.retryCount === "number"
          ? ((error as { retryCount: number }).retryCount ?? 0)
          : 0,
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
