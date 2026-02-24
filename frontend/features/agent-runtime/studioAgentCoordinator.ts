import type { NextApiRequest } from "next";
import type { AgentContext, AgentMessage } from "../../prefabs/agent";
import type { StudioAgentOrchestration } from "../ai-agent/logic/studioAgentOrchestration";
import type { ThinkerSelectedReference } from "../ai-agent/logic/studioAgentReferenceSelection";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { writeStudioAgentCanonicalPrompt } from "./studioAgentCanonicalPersistence";
import { formatStudioAgentErrorMessage } from "./studioAgentOpenAiGateway";
import { executeStudioAgentFastPathTurn } from "./studioAgentFastPathTurn";
import {
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
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
  requestTimeoutMs,
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
  requestTimeoutMs: number;
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

  const finalizeSuccessfulTurn = async ({
    parsed,
    refusal,
    resolvedCanonical,
    usage,
    model,
    retryUsed,
    path,
    writeFailureStage,
  }: {
    parsed: Record<string, unknown>;
    refusal: boolean;
    resolvedCanonical: string | null;
    usage: Record<string, unknown> | undefined;
    model: string;
    retryUsed: boolean;
    path: string;
    writeFailureStage:
      | "canonical_write_v2"
      | "canonical_write_fast_path"
      | "canonical_write_single_stage";
  }): Promise<{ status: number; payload: Record<string, unknown> }> => {
    if (!refusal) {
      await writeStudioAgentCanonicalPrompt({
        req,
        userId,
        conversationId: normalizedConversationId,
        canonicalPrompt: resolvedCanonical,
        canonicalDbEnabled,
        markStage,
        writeFailureStage,
        formatErrorMessage: formatStudioAgentErrorMessage,
      });
    }

    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: refusal ? "refuse" : "success",
      model,
      outcomeClass: refusal ? "refusal_model" : "success_prompt",
      retryUsed,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });

    return {
      status: 200,
      payload: {
        ...parsed,
        ...(usage ? { usage } : {}),
        canonicalPrompt: resolvedCanonical,
        traceId,
      },
    };
  };

  const executeV2Path = async (
    path: string
  ): Promise<{ status: number; payload: Record<string, unknown> } | null> => {
    if (!thinkerPrompt || !formatterPrompt) return null;

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
      const safetyRefusal = isStudioAgentSafetyRefusalUpstreamError({
        status: v2Turn.status,
        detail: v2Turn.detail,
      });
      if (safetyRefusal) {
        emitStudioAgentTurnTelemetry({
          flow: orchestration.flow,
          path,
          status: "refuse",
          model: openAiThinkerModel,
          outcomeClass: "refusal_safety",
          retryUsed: false,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
        });
        return {
          status: 200,
          payload: buildStudioAgentSafetyRefusalPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
          }),
        };
      }
      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "error",
        model: openAiThinkerModel,
        outcomeClass: "upstream_error",
        retryUsed: false,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });
      return {
        status: v2Turn.status,
        payload: buildStudioAgentUpstreamErrorPayload({
          stage: v2Turn.stage,
          detail: v2Turn.detail,
          traceId,
        }),
      };
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
      retryUsed: v2Turn.result.retryUsed,
      path,
      writeFailureStage: "canonical_write_v2",
    });
  };

  try {
    if (singleStageEnabled) {
      runtimePath = "single_stage";
      const singleStageTurn = await executeStudioAgentFastPathTurn({
        apiKey,
        openAiUrl,
        model: openAiModel,
        openAiMessages,
        timeoutMs: requestTimeoutMs,
        effectiveCanonical,
        context,
        messages,
        markStage,
      });

      if (!singleStageTurn.ok) {
        const safetyRefusal = isStudioAgentSafetyRefusalUpstreamError({
          status: singleStageTurn.status,
          detail: singleStageTurn.detail,
        });
        if (safetyRefusal) {
          emitStudioAgentTurnTelemetry({
            flow: orchestration.flow,
            path: runtimePath,
            status: "refuse",
            model: openAiModel,
            outcomeClass: "refusal_safety",
            retryUsed: false,
            totalLatencyMs: Date.now() - requestStartedAt,
            stageLatencyMs,
          });
          return {
            status: 200,
            payload: buildStudioAgentSafetyRefusalPayload({
              traceId,
              canonicalPrompt: effectiveCanonical,
            }),
          };
        }
        if (legacyV2FallbackEnabled && canUseV2Path) {
          runtimePath = "legacy_v2_fallback";
          const fallbackResult = await executeV2Path(runtimePath);
          if (fallbackResult) return fallbackResult;
        }
        emitStudioAgentTurnTelemetry({
          flow: orchestration.flow,
          path: runtimePath,
          status: "error",
          model: openAiModel,
          outcomeClass: "upstream_error",
          retryUsed: false,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
        });
        return {
          status: singleStageTurn.status,
          payload: buildStudioAgentUpstreamErrorPayload({
            detail: singleStageTurn.detail,
            traceId,
          }),
        };
      }

      return await finalizeSuccessfulTurn({
        parsed: singleStageTurn.result.parsed as Record<string, unknown>,
        refusal: singleStageTurn.result.refusal,
        resolvedCanonical: singleStageTurn.result.resolvedCanonical,
        usage: singleStageTurn.result.usage as Record<string, unknown>,
        model: openAiModel,
        retryUsed: false,
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
    const fastPathTurn = await executeStudioAgentFastPathTurn({
      apiKey,
      openAiUrl,
      model: openAiModel,
      openAiMessages,
      timeoutMs: requestTimeoutMs,
      effectiveCanonical,
      context,
      messages,
      markStage,
    });

    if (!fastPathTurn.ok) {
      const safetyRefusal = isStudioAgentSafetyRefusalUpstreamError({
        status: fastPathTurn.status,
        detail: fastPathTurn.detail,
      });
      if (safetyRefusal) {
        emitStudioAgentTurnTelemetry({
          flow: orchestration.flow,
          path: runtimePath,
          status: "refuse",
          model: openAiModel,
          outcomeClass: "refusal_safety",
          retryUsed: false,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
        });
        return {
          status: 200,
          payload: buildStudioAgentSafetyRefusalPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
          }),
        };
      }
      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path: runtimePath,
        status: "error",
        model: openAiModel,
        outcomeClass: "upstream_error",
        retryUsed: false,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });
      return {
        status: fastPathTurn.status,
        payload: buildStudioAgentUpstreamErrorPayload({
          detail: fastPathTurn.detail,
          traceId,
        }),
      };
    }

    return await finalizeSuccessfulTurn({
      parsed: fastPathTurn.result.parsed as Record<string, unknown>,
      refusal: fastPathTurn.result.refusal,
      resolvedCanonical: fastPathTurn.result.resolvedCanonical,
      usage: fastPathTurn.result.usage as Record<string, unknown>,
      model: openAiModel,
      retryUsed: false,
      path: runtimePath,
      writeFailureStage: "canonical_write_fast_path",
    });
  } catch (error) {
    emitStudioAgentTurnTelemetry({
      flow: "unknown",
      path: runtimePath,
      status: "error",
      model: openAiModel,
      outcomeClass: "route_error",
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: userId,
        conversation_id: normalizedConversationId,
      },
    });
    return {
      status: 500,
      payload: buildStudioAgentRouteFailurePayload({
        detail: formatStudioAgentErrorMessage(error),
        traceId,
      }),
    };
  }
};
