import type { NextApiRequest } from "next";
import type { AgentContext, AgentMessage } from "../../prefabs/agent";
import type { StudioAgentOrchestration } from "../ai-agent/logic/studioAgentOrchestration";
import type { ThinkerSelectedReference } from "../ai-agent/logic/studioAgentReferenceSelection";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { writeStudioAgentCanonicalPrompt } from "./studioAgentCanonicalPersistence";
import { formatStudioAgentErrorMessage } from "./studioAgentOpenAiGateway";
import { executeStudioAgentFastPathTurn } from "./studioAgentFastPathTurn";
import {
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
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
        emitStudioAgentTurnTelemetry({
          flow: orchestration.flow,
          path,
          status: "error",
          model: openAiThinkerModel,
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
          userId,
          conversationId: normalizedConversationId,
          canonicalPrompt: resolvedCanonical,
          canonicalDbEnabled,
          markStage,
          writeFailureStage: "canonical_write_v2",
          formatErrorMessage: formatStudioAgentErrorMessage,
        });
      }

      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: refusal ? "refuse" : "success",
        model: openAiThinkerModel,
        retryUsed,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });

      return {
        status: 200,
        payload: {
          ...parsed,
          usage,
          canonicalPrompt: resolvedCanonical,
          traceId,
        },
      };
    }

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
      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "error",
        model: openAiModel,
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

    const parsed = fastPathTurn.result.parsed;
    const refusal = fastPathTurn.result.refusal;
    const resolvedCanonical = fastPathTurn.result.resolvedCanonical;
    const usage = fastPathTurn.result.usage;

    if (!refusal) {
      await writeStudioAgentCanonicalPrompt({
        req,
        userId,
        conversationId: normalizedConversationId,
        canonicalPrompt: resolvedCanonical,
        canonicalDbEnabled,
        markStage,
        writeFailureStage: "canonical_write_fast_path",
        formatErrorMessage: formatStudioAgentErrorMessage,
      });
    }

    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: refusal ? "refuse" : "success",
      model: openAiModel,
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });

    return {
      status: 200,
      payload: {
        ...parsed,
        usage,
        canonicalPrompt: resolvedCanonical,
        traceId,
      },
    };
  } catch (error) {
    emitStudioAgentTurnTelemetry({
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
