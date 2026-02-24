import type { NextApiRequest } from "next";
import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import type { StudioAgentOrchestration } from "../ai-agent/logic/studioAgentOrchestration";
import type { ThinkerSelectedReference } from "../ai-agent/logic/studioAgentReferenceSelection";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { writeStudioAgentCanonicalPrompt } from "./studioAgentCanonicalPersistence";
import { formatStudioAgentErrorMessage } from "./studioAgentOpenAiGateway";
import { executeStudioAgentFastPathTurn } from "./studioAgentFastPathTurn";
import {
  classifyStudioAgentFailure,
  computeStudioAgentRetryDelayMs,
  resolveStudioAgentFailureResolution,
  shouldRetryStudioAgentFailure,
  type StudioAgentFailureClass,
  waitForStudioAgentRetry,
} from "./studioAgentFailurePolicy";
import {
  postProcessStudioAgentSafetyText,
  type StudioAgentSafetyPostProcessOutcome,
} from "./studioAgentSafetyPostProcess";
import {
  buildStudioAgentInfraFallbackPayload,
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
  STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
} from "./studioAgentRouteOutcomes";
import { resolveStudioAgentTurnResponse } from "./studioAgentTurnResponse";
import { executeStudioAgentV2Turn } from "./studioAgentV2Turn";

type OpenAIChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
    };

type StudioAgentFastPathSuccessTurn = Extract<
  Awaited<ReturnType<typeof executeStudioAgentFastPathTurn>>,
  { ok: true }
>;

export const buildStudioAgentOpenAiMessages = ({
  messages,
  context,
  systemPrompt,
  orchestration,
}: {
  messages: AgentMessage[];
  context: AgentContext;
  systemPrompt: string;
  orchestration: StudioAgentOrchestration;
}): OpenAIChatMessage[] => {
  const chat: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `CONTEXT:\n${JSON.stringify(context)}` },
    { role: "system", content: `ORCHESTRATION:\n${JSON.stringify(orchestration)}` },
  ];

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

export const executeStudioAgentCoordinator = async ({
  req,
  traceId,
  requestStartedAt,
  stageLatencyMs,
  markStage,
  apiKey,
  openAiUrl,
  systemPrompt,
  openAiModel,
  openAiThinkerModel,
  openAiFormatterModel,
  thinkerPrompt,
  formatterPrompt,
  turnTimeoutMs,
  upstreamRetryMaxAttempts,
  upstreamRetryBaseDelayMs,
  upstreamRetryMaxDelayMs,
  singleStageEnabled,
  legacyV2FallbackEnabled,
  textFastPathEnabled,
  orchestration,
  context,
  messages,
  selectedReferences,
  visionSummaryMap,
  effectiveCanonical,
  normalizedConversationId,
  userId,
  canonicalDbEnabled,
  safetyPostProcessEnabled,
  safetyDebugEnabled,
}: {
  req: NextApiRequest;
  traceId: string;
  requestStartedAt: number;
  stageLatencyMs: Record<string, number>;
  markStage: (stage: string, startedAt: number) => void;
  apiKey: string;
  openAiUrl: string;
  systemPrompt: string;
  openAiModel: string;
  openAiThinkerModel: string;
  openAiFormatterModel: string;
  thinkerPrompt: string | null;
  formatterPrompt: string | null;
  turnTimeoutMs: number;
  upstreamRetryMaxAttempts: number;
  upstreamRetryBaseDelayMs: number;
  upstreamRetryMaxDelayMs: number;
  singleStageEnabled: boolean;
  legacyV2FallbackEnabled: boolean;
  textFastPathEnabled: boolean;
  orchestration: StudioAgentOrchestration;
  context: AgentContext;
  messages: AgentMessage[];
  selectedReferences: ThinkerSelectedReference[];
  visionSummaryMap: Map<string, string>;
  effectiveCanonical: string | null;
  normalizedConversationId: string;
  userId: string;
  canonicalDbEnabled: boolean;
  safetyPostProcessEnabled: boolean;
  safetyDebugEnabled: boolean;
}): Promise<{ status: number; payload: Record<string, unknown> }> => {
  const openAiMessages = buildStudioAgentOpenAiMessages({
    messages,
    context,
    systemPrompt,
    orchestration,
  });

  const canUseV2Path = Boolean(thinkerPrompt && formatterPrompt);
  const legacyUseV2Path =
    canUseV2Path && !(orchestration.flow === "TEXT_ONLY" && textFastPathEnabled);
  let runtimePath = singleStageEnabled
    ? "single_stage"
    : legacyUseV2Path
      ? "v2_orchestration"
      : orchestration.flow === "TEXT_ONLY"
        ? "text_fast_path"
        : "fallback_fast_path";

  const mergeSafetyOutcome = (
    current: StudioAgentSafetyPostProcessOutcome,
    next: StudioAgentSafetyPostProcessOutcome
  ): StudioAgentSafetyPostProcessOutcome => {
    if (current === "refusal" || next === "refusal") return "refusal";
    if (current === "rewritten" || next === "rewritten") return "rewritten";
    return "pass";
  };

  const resolveFailureClass = ({
    status,
    detail,
    safetyRefusal,
  }: {
    status: number;
    detail: string;
    safetyRefusal: boolean;
  }): StudioAgentFailureClass =>
    classifyStudioAgentFailure({
      status,
      detail,
      safetyRefusal,
    });

  const buildInfraFallbackResponse = ({
    path,
    model,
    retryUsed,
    retryCount,
    fallbackReason,
  }: {
    path: string;
    model: string;
    retryUsed: boolean;
    retryCount: number;
    fallbackReason: string;
  }): { status: number; payload: Record<string, unknown> } => {
    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: "success",
      model,
      outcomeClass: "fallback_infra",
      retryUsed,
      retryCount,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      fallbackReason,
    });
    return {
      status: 200,
      payload: buildStudioAgentInfraFallbackPayload({
        traceId,
        canonicalPrompt: effectiveCanonical,
      }),
    };
  };

  const resolveFailureResponse = ({
    status,
    detail,
    stage,
    path,
    model,
    retryUsed,
    retryCount,
    safetyRefusal,
  }: {
    status: number;
    detail: string;
    stage?: string;
    path: string;
    model: string;
    retryUsed: boolean;
    retryCount: number;
    safetyRefusal: boolean;
  }): {
    status: number;
    payload: Record<string, unknown>;
    failureClass: StudioAgentFailureClass;
  } => {
    const failureClass = resolveFailureClass({
      status,
      detail,
      safetyRefusal,
    });
    const failureResolution = resolveStudioAgentFailureResolution({ failureClass });
    if (failureResolution === "canonical_refusal") {
      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "refuse",
        model,
        outcomeClass: "refusal_safety",
        retryUsed,
        retryCount,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });
      return {
        status: 200,
        payload: buildStudioAgentSafetyRefusalPayload({
          traceId,
          canonicalPrompt: effectiveCanonical,
        }),
        failureClass,
      };
    }
    if (failureResolution === "assistant_fallback") {
      return {
        ...buildInfraFallbackResponse({
          path,
          model,
          retryUsed,
          retryCount,
          fallbackReason: stage ?? (detail.slice(0, 120) || "runtime_failure"),
        }),
        failureClass,
      };
    }
    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: "error",
      model,
      outcomeClass: "upstream_error",
      retryUsed,
      retryCount,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });
    return {
      status,
      payload: buildStudioAgentUpstreamErrorPayload({
        stage,
        detail,
        traceId,
      }),
      failureClass,
    };
  };

  const maybeRetryTurnFailure = async ({
    status,
    detail,
    safetyRefusal,
    attempt,
  }: {
    status: number;
    detail: string;
    safetyRefusal: boolean;
    attempt: number;
  }): Promise<StudioAgentFailureClass | null> => {
    const failureClass = resolveFailureClass({
      status,
      detail,
      safetyRefusal,
    });
    if (
      !shouldRetryStudioAgentFailure({
        failureClass,
        attempt,
        maxAttempts: upstreamRetryMaxAttempts,
      })
    ) {
      return null;
    }
    const retryDelayMs = computeStudioAgentRetryDelayMs({
      attempt,
      baseDelayMs: upstreamRetryBaseDelayMs,
      maxDelayMs: upstreamRetryMaxDelayMs,
    });
    await waitForStudioAgentRetry(retryDelayMs);
    return failureClass;
  };

  const finalizeSuccessfulTurn = async ({
    parsed,
    refusal,
    resolvedCanonical,
    usage,
    model,
    retryUsed,
    retryCount,
    path,
    writeFailureStage,
  }: {
    parsed: Record<string, unknown>;
    refusal: boolean;
    resolvedCanonical: string | null;
    usage: Record<string, unknown> | undefined;
    model: string;
    retryUsed: boolean;
    retryCount: number;
    path: string;
    writeFailureStage:
      | "canonical_write_v2"
      | "canonical_write_fast_path"
      | "canonical_write_single_stage";
  }): Promise<{ status: number; payload: Record<string, unknown> }> => {
    let finalParsed = parsed as AgentResponse;
    let finalRefusal = refusal;
    let finalResolvedCanonical = resolvedCanonical;
    let safetyOutcome: StudioAgentSafetyPostProcessOutcome = "pass";
    let safetyFallback = false;
    let safetyForcedRefusal = false;
    let safetyDebugReason: string | undefined;

    const registerSafetyResult = (result: {
      outcome: StudioAgentSafetyPostProcessOutcome;
      fallbackUsed: boolean;
      debugReason?: string;
    }) => {
      safetyOutcome = mergeSafetyOutcome(safetyOutcome, result.outcome);
      safetyFallback = safetyFallback || result.fallbackUsed;
      if (safetyDebugEnabled && result.debugReason) {
        safetyDebugReason = result.debugReason;
      }
    };

    if (!finalRefusal && safetyPostProcessEnabled) {
      const applyPromptValue =
        typeof finalParsed.actions?.applyPrompt === "string" ? finalParsed.actions.applyPrompt : "";
      if (applyPromptValue) {
        const applyPromptSafety = await postProcessStudioAgentSafetyText({
          text: applyPromptValue,
          route: "studio-agent",
          flow: orchestration.flow,
          source: "model_output",
          enabled: safetyPostProcessEnabled,
          debug: safetyDebugEnabled,
          traceId,
        });
        registerSafetyResult(applyPromptSafety);
        if (applyPromptSafety.outcome === "refusal") {
          finalRefusal = true;
          safetyForcedRefusal = true;
        } else if (applyPromptSafety.outcome === "rewritten") {
          finalParsed = {
            ...finalParsed,
            actions: {
              ...(finalParsed.actions ?? {}),
              applyPrompt: applyPromptSafety.text,
            },
            message: applyPromptSafety.text,
          };
          finalResolvedCanonical = applyPromptSafety.text;
        }
      }

      if (!finalRefusal) {
        const messageSafety = await postProcessStudioAgentSafetyText({
          text: finalParsed.message,
          route: "studio-agent",
          flow: orchestration.flow,
          source: "model_output",
          enabled: safetyPostProcessEnabled,
          debug: safetyDebugEnabled,
          traceId,
        });
        registerSafetyResult(messageSafety);
        if (messageSafety.outcome === "refusal") {
          finalRefusal = true;
          safetyForcedRefusal = true;
        } else if (messageSafety.outcome === "rewritten") {
          finalParsed = {
            ...finalParsed,
            message: messageSafety.text,
          };
        }
      }

      const finalApplyPrompt = finalParsed.actions?.applyPrompt;
      if (!finalRefusal && finalApplyPrompt) {
        finalParsed = {
          ...finalParsed,
          message: finalApplyPrompt,
        };
        finalResolvedCanonical = finalApplyPrompt;
      }
    }

    if (finalRefusal && safetyForcedRefusal) {
      finalParsed = {
        message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
        actions: undefined,
      };
      finalResolvedCanonical = effectiveCanonical;
    }

    if (!finalRefusal) {
      await writeStudioAgentCanonicalPrompt({
        req,
        userId,
        conversationId: normalizedConversationId,
        canonicalPrompt: finalResolvedCanonical,
        canonicalDbEnabled,
        markStage,
        writeFailureStage,
        formatErrorMessage: formatStudioAgentErrorMessage,
      });
    }

    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: finalRefusal ? "refuse" : "success",
      model,
      outcomeClass: finalRefusal
        ? safetyForcedRefusal
          ? "refusal_safety"
          : "refusal_model"
        : "success_prompt",
      retryUsed,
      retryCount,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyOutcome: safetyOutcome === "pass" ? undefined : safetyOutcome,
      safetySource: safetyOutcome === "pass" ? undefined : "model_output",
      safetyFallback: safetyOutcome === "pass" ? undefined : safetyFallback,
      safetyDebugReason,
      safetyDebugEnabled,
    });

    return {
      status: 200,
      payload: {
        ...finalParsed,
        ...(usage ? { usage } : {}),
        canonicalPrompt: finalResolvedCanonical,
        traceId,
      },
    };
  };

  const executeV2Path = async (
    path: string
  ): Promise<{ status: number; payload: Record<string, unknown> } | null> => {
    if (!thinkerPrompt || !formatterPrompt) return null;

    let attempt = 1;
    let retryCount = 0;
    let v2Turn = await executeStudioAgentV2Turn({
      apiKey,
      openAiUrl,
      thinkerModel: openAiThinkerModel,
      formatterModel: openAiFormatterModel,
      thinkerPrompt,
      formatterPrompt,
      timeoutMs: turnTimeoutMs,
      orchestration,
      context,
      messages,
      selectedReferences,
      visionSummaryMap,
      effectiveCanonical,
      markStage,
    });

    while (!v2Turn.ok) {
      const safetyRefusal = isStudioAgentSafetyRefusalUpstreamError({
        status: v2Turn.status,
        detail: v2Turn.detail,
      });
      const retryClass = await maybeRetryTurnFailure({
        status: v2Turn.status,
        detail: v2Turn.detail,
        safetyRefusal,
        attempt,
      });
      if (!retryClass) {
        return resolveFailureResponse({
          status: v2Turn.status,
          detail: v2Turn.detail,
          stage: v2Turn.stage,
          path,
          model: openAiThinkerModel,
          retryUsed: retryCount > 0,
          retryCount,
          safetyRefusal,
        });
      }
      retryCount += 1;
      attempt += 1;
      v2Turn = await executeStudioAgentV2Turn({
        apiKey,
        openAiUrl,
        thinkerModel: openAiThinkerModel,
        formatterModel: openAiFormatterModel,
        thinkerPrompt,
        formatterPrompt,
        timeoutMs: turnTimeoutMs,
        orchestration,
        context,
        messages,
        selectedReferences,
        visionSummaryMap,
        effectiveCanonical,
        markStage,
      });
    }

    let parsed = v2Turn.result.parsed;
    const nextCanonical = v2Turn.result.nextCanonical;
    const semanticStatus = v2Turn.result.semanticStatus;
    const resolvedTurn = resolveStudioAgentTurnResponse({
      parsed,
      semanticStatus,
      nextCanonical,
      effectiveCanonical,
      context,
      messages,
    });
    parsed = resolvedTurn.parsed;

    return await finalizeSuccessfulTurn({
      parsed: parsed as Record<string, unknown>,
      refusal: resolvedTurn.refusal,
      resolvedCanonical: resolvedTurn.resolvedCanonical,
      usage: (v2Turn.result.usage ?? undefined) as Record<string, unknown> | undefined,
      model: openAiThinkerModel,
      retryUsed: v2Turn.result.retryUsed || retryCount > 0,
      retryCount: retryCount + (v2Turn.result.retryUsed ? 1 : 0),
      path,
      writeFailureStage: "canonical_write_v2",
    });
  };

  const executeFastPathWithRetry = async ({
    path,
  }: {
    path: string;
  }): Promise<
    | {
        ok: true;
        turn: StudioAgentFastPathSuccessTurn;
        retryCount: number;
      }
    | {
        ok: false;
        response: { status: number; payload: Record<string, unknown> };
        failureClass: StudioAgentFailureClass;
      }
  > => {
    let attempt = 1;
    let retryCount = 0;
    let turn = await executeStudioAgentFastPathTurn({
      apiKey,
      openAiUrl,
      model: openAiModel,
      openAiMessages,
      timeoutMs: turnTimeoutMs,
      effectiveCanonical,
      context,
      messages,
      markStage,
    });

    while (!turn.ok) {
      const safetyRefusal = isStudioAgentSafetyRefusalUpstreamError({
        status: turn.status,
        detail: turn.detail,
      });
      const retryClass = await maybeRetryTurnFailure({
        status: turn.status,
        detail: turn.detail,
        safetyRefusal,
        attempt,
      });
      if (!retryClass) {
        const resolved = resolveFailureResponse({
          status: turn.status,
          detail: turn.detail,
          path,
          model: openAiModel,
          retryUsed: retryCount > 0,
          retryCount,
          safetyRefusal,
        });
        return {
          ok: false,
          response: resolved,
          failureClass: resolved.failureClass,
        };
      }
      retryCount += 1;
      attempt += 1;
      turn = await executeStudioAgentFastPathTurn({
        apiKey,
        openAiUrl,
        model: openAiModel,
        openAiMessages,
        timeoutMs: turnTimeoutMs,
        effectiveCanonical,
        context,
        messages,
        markStage,
      });
    }

    return {
      ok: true,
      turn: turn as StudioAgentFastPathSuccessTurn,
      retryCount,
    };
  };

  try {
    if (singleStageEnabled) {
      runtimePath = "single_stage";
      const singleStageResult = await executeFastPathWithRetry({
        path: runtimePath,
      });

      if (!singleStageResult.ok) {
        if (
          legacyV2FallbackEnabled &&
          canUseV2Path &&
          (singleStageResult.failureClass === "infra_transient" ||
            singleStageResult.failureClass === "infra_runtime")
        ) {
          runtimePath = "legacy_v2_fallback";
          const fallbackResult = await executeV2Path(runtimePath);
          if (fallbackResult) return fallbackResult;
        }
        return singleStageResult.response;
      }

      return await finalizeSuccessfulTurn({
        parsed: singleStageResult.turn.result.parsed as Record<string, unknown>,
        refusal: singleStageResult.turn.result.refusal,
        resolvedCanonical: singleStageResult.turn.result.resolvedCanonical,
        usage: singleStageResult.turn.result.usage as Record<string, unknown>,
        model: openAiModel,
        retryUsed: singleStageResult.retryCount > 0,
        retryCount: singleStageResult.retryCount,
        path: runtimePath,
        writeFailureStage: "canonical_write_single_stage",
      });
    }

    if (legacyUseV2Path) {
      runtimePath = "v2_orchestration";
      const v2Result = await executeV2Path(runtimePath);
      if (v2Result) return v2Result;
    }

    runtimePath = orchestration.flow === "TEXT_ONLY" ? "text_fast_path" : "fallback_fast_path";
    const fastPathResult = await executeFastPathWithRetry({
      path: runtimePath,
    });

    if (!fastPathResult.ok) {
      return fastPathResult.response;
    }

    return await finalizeSuccessfulTurn({
      parsed: fastPathResult.turn.result.parsed as Record<string, unknown>,
      refusal: fastPathResult.turn.result.refusal,
      resolvedCanonical: fastPathResult.turn.result.resolvedCanonical,
      usage: fastPathResult.turn.result.usage as Record<string, unknown>,
      model: openAiModel,
      retryUsed: fastPathResult.retryCount > 0,
      retryCount: fastPathResult.retryCount,
      path: runtimePath,
      writeFailureStage: "canonical_write_fast_path",
    });
  } catch (error) {
    const failureDetail = formatStudioAgentErrorMessage(error);
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: userId,
        conversation_id: normalizedConversationId,
      },
    });
    const failureClass = classifyStudioAgentFailure({
      detail: failureDetail,
    });
    const failureResolution = resolveStudioAgentFailureResolution({ failureClass });
    if (failureResolution === "assistant_fallback") {
      return buildInfraFallbackResponse({
        path: runtimePath,
        model: openAiModel,
        retryUsed: false,
        retryCount: 0,
        fallbackReason: "route_exception",
      });
    }
    emitStudioAgentTurnTelemetry({
      flow: "unknown",
      path: runtimePath,
      status: "error",
      model: openAiModel,
      outcomeClass: "route_error",
      retryUsed: false,
      retryCount: 0,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });
    return {
      status: 500,
      payload: buildStudioAgentRouteFailurePayload({
        detail: failureDetail,
        traceId,
      }),
    };
  }
};
