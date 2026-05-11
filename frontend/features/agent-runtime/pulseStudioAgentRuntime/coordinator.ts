import type { NextApiRequest } from "next";
import type { AgentContext, AgentMessage, AgentResponse } from "../../../prefabs/agent";
import type { StudioAgentOrchestration } from "../../ai-agent/logic/studioAgentOrchestration";
import type { ThinkerSelectedReference } from "../../ai-agent/logic/studioAgentReferenceSelection";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  shouldCommitStudioAgentCanonicalPrompt,
  writeStudioAgentCanonicalPrompt,
} from "../studioAgentCanonicalPersistence";
import { formatStudioAgentErrorMessage } from "../studioAgentOpenAiGateway";
import { executeStudioAgentFastPathTurn } from "../studioAgentFastPathTurn";
import {
  computeStudioAgentRetryDelayMs,
  shouldRetryStudioAgentFailure,
  type StudioAgentFailureClass,
  waitForStudioAgentRetry,
} from "../studioAgentFailurePolicy";
import {
  resolveProviderErrorHandling,
  type ProviderErrorNormalizationMode,
} from "../safetyPolicy/providerErrorPolicy";
import {
  postProcessStudioAgentSafetyText,
  type StudioAgentSafetyDecisionMeta,
  type StudioAgentSafetyPostProcessOutcome,
  type StudioAgentSafetyRoute,
} from "../studioAgentSafetyPostProcess";
import { maybeTriggerSafetyIncidentAutoRollback } from "../safetyPolicy/incidentAutoRollback";
import { resolveSafetyModality } from "../safetyPolicy/decisionEngine";
import type {
  SafetyEnvironment,
  SafetyPolicyDocumentV2,
  SafetyPostprocessMode,
} from "../safetyPolicy/types";
import {
  resolvePolicyVersionFromProfileId,
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
  STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
} from "../studioAgentRouteOutcomes";
import { buildAgentMachineOutcome } from "../agentMachineOutcome";
import { resolveStudioAgentTurnResponse } from "../studioAgentTurnResponse";
import {
  buildStudioAgentPulseTurnStateMessage,
  buildStudioAgentWorkflowSessionUpdate,
  buildStudioAgentPulseSystemMessage,
  isStudioAgentWorkflowPulse,
  resolveLatestStudioAgentUserInput,
} from "../studioAgentPulseRuntime";

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
  const pulseSystemMessage = buildStudioAgentPulseSystemMessage(context.pulse);
  const pulseTurnStateMessage = buildStudioAgentPulseTurnStateMessage({
    pulse: context.pulse,
    messages,
  });
  const chat: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(pulseSystemMessage ? [{ role: "system" as const, content: pulseSystemMessage }] : []),
    ...(pulseTurnStateMessage ? [{ role: "system" as const, content: pulseTurnStateMessage }] : []),
    { role: "system", content: `CONTEXT:\n${JSON.stringify(context)}` },
    { role: "system", content: `ORCHESTRATION:\n${JSON.stringify(orchestration)}` },
  ];

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
  turnTimeoutMs,
  upstreamRetryMaxAttempts,
  upstreamRetryBaseDelayMs,
  upstreamRetryMaxDelayMs,
  orchestration,
  context,
  messages,
  selectedReferences,
  visionSummaryMap,
  effectiveCanonical,
  normalizedConversationId,
  userId,
  userEmail,
  canonicalDbEnabled,
  safetyPostProcessMode,
  safetyDebugEnabled,
  safetyProfileId,
  safetyPolicyDocument,
  safetyPolicyVersion,
  safetyPolicySchemaVersion,
  safetyPromptTemplateVersion,
  runtimeScopeKey,
  safetyEnvironment,
  safetyDevAbsoluteZeroEnabled,
  safetyProviderErrorMode,
  safetyAutoRollbackEnabled,
  routeLabel = "ai/studio-agent",
  safetyRoute = "studio-agent",
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
  turnTimeoutMs: number;
  upstreamRetryMaxAttempts: number;
  upstreamRetryBaseDelayMs: number;
  upstreamRetryMaxDelayMs: number;
  orchestration: StudioAgentOrchestration;
  context: AgentContext;
  messages: AgentMessage[];
  selectedReferences: ThinkerSelectedReference[];
  visionSummaryMap: Map<string, string>;
  effectiveCanonical: string | null;
  normalizedConversationId: string;
  userId: string;
  userEmail: string | null;
  canonicalDbEnabled: boolean;
  safetyPostProcessMode: SafetyPostprocessMode;
  safetyDebugEnabled: boolean;
  safetyProfileId?: string | null;
  safetyPolicyDocument: SafetyPolicyDocumentV2;
  safetyPolicyVersion?: number | null;
  safetyPolicySchemaVersion?: number | null;
  safetyPromptTemplateVersion?: string | null;
  runtimeScopeKey?: string | null;
  safetyEnvironment: SafetyEnvironment;
  safetyDevAbsoluteZeroEnabled: boolean;
  safetyProviderErrorMode: ProviderErrorNormalizationMode;
  safetyAutoRollbackEnabled: boolean;
  routeLabel?: string;
  safetyRoute?: StudioAgentSafetyRoute;
}): Promise<{ status: number; payload: Record<string, unknown> }> => {
  const openAiMessages = buildStudioAgentOpenAiMessages({
    messages,
    context,
    systemPrompt,
    orchestration,
  });

  const workflowPulseActive = isStudioAgentWorkflowPulse(context.pulse);
  const runtimePath = "pulse_agent";
  const resolvedSafetyPolicyVersion =
    typeof safetyPolicyVersion === "number" && Number.isFinite(safetyPolicyVersion)
      ? safetyPolicyVersion
      : resolvePolicyVersionFromProfileId(safetyProfileId);
  const safetyModality = resolveSafetyModality({
    route: safetyRoute,
    flow: orchestration.flow,
  });
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;

  const mergeSafetyOutcome = (
    current: StudioAgentSafetyPostProcessOutcome,
    next: StudioAgentSafetyPostProcessOutcome
  ): StudioAgentSafetyPostProcessOutcome => {
    if (current === "refusal" || next === "refusal") return "refusal";
    if (current === "rewritten" || next === "rewritten") return "rewritten";
    return "pass";
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
    const handling = resolveProviderErrorHandling({
      status,
      detail,
      safetyRefusal,
      normalizationMode: safetyProviderErrorMode,
    });
    const failureClass = handling.failureClass;
    const failureResolution = handling.failureResolution;
    if (failureResolution === "canonical_refusal") {
      emitStudioAgentTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "refuse",
        model,
        outcomeClass: "refusal_safety",
        retryUsed,
        retryCount,
        reasonCode: "PROVIDER_SAFETY_REFUSAL",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          policyVersion: resolvedSafetyPolicyVersion,
          policySchemaVersion: safetyPolicySchemaVersion ?? null,
          promptTemplateVersion: safetyPromptTemplateVersion ?? null,
          runtimeScopeKey: runtimeScopeKey ?? null,
          profileId: safetyTelemetryProfileId,
          modality: safetyModality,
          decisionAction: "refuse",
          providerBlocked: safetyRefusal,
        },
      });
      return {
        status: 200,
        payload: buildStudioAgentSafetyRefusalPayload({
          traceId,
          canonicalPrompt: effectiveCanonical,
          reasonCode: "PROVIDER_SAFETY_REFUSAL",
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
      reasonCode: "UPSTREAM_ERROR",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        policyVersion: resolvedSafetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion ?? null,
        promptTemplateVersion: safetyPromptTemplateVersion ?? null,
        runtimeScopeKey: runtimeScopeKey ?? null,
        profileId: safetyTelemetryProfileId,
        modality: safetyModality,
        providerBlocked: safetyRefusal,
      },
    });
    return {
      status,
      payload: buildStudioAgentUpstreamErrorPayload({
        stage,
        detail: handling.detailForClient ?? detail,
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
    const handling = resolveProviderErrorHandling({
      status,
      detail,
      safetyRefusal,
      normalizationMode: safetyProviderErrorMode,
    });
    const failureClass = handling.failureClass;
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
    semanticStatus,
    usage,
    model,
    retryUsed,
    retryCount,
    repairUsed,
    repairCount,
    path,
    writeFailureStage,
  }: {
    parsed: Record<string, unknown>;
    refusal: boolean;
    resolvedCanonical: string | null;
    semanticStatus: string | null;
    usage: Record<string, unknown> | undefined;
    model: string;
    retryUsed: boolean;
    retryCount: number;
    repairUsed: boolean;
    repairCount: number;
    path: string;
    writeFailureStage: "canonical_write_pulse_agent";
  }): Promise<{ status: number; payload: Record<string, unknown> }> => {
    let finalParsed = parsed as AgentResponse;
    let finalRefusal = refusal;
    let finalResolvedCanonical = resolvedCanonical;
    let safetyOutcome: StudioAgentSafetyPostProcessOutcome = "pass";
    let safetyFallback = false;
    let safetyForcedRefusal = false;
    let safetyDebugReason: string | undefined;
    let safetyDecisionAction: StudioAgentSafetyDecisionMeta["action"] | null = null;
    let safetyDecisionCategory: StudioAgentSafetyDecisionMeta["category"] | null = null;
    let safetyDecisionSource: StudioAgentSafetyDecisionMeta["source"] | null = null;
    let safetyHardFloorViolation = false;
    let safetyRollbackTriggered = false;

    const registerSafetyResult = (result: {
      outcome: StudioAgentSafetyPostProcessOutcome;
      fallbackUsed: boolean;
      debugReason?: string;
      decision?: StudioAgentSafetyDecisionMeta;
    }) => {
      safetyOutcome = mergeSafetyOutcome(safetyOutcome, result.outcome);
      safetyFallback = safetyFallback || result.fallbackUsed;
      if (result.decision) {
        if (result.decision.action !== "allow" || !safetyDecisionAction) {
          safetyDecisionAction = result.decision.action;
        }
        if (result.decision.category !== "safe" || !safetyDecisionCategory) {
          safetyDecisionCategory = result.decision.category;
        }
        if (result.decision.source !== "profile" || !safetyDecisionSource) {
          safetyDecisionSource = result.decision.source;
        }
        safetyHardFloorViolation = safetyHardFloorViolation || result.decision.hardFloorViolation;
      }
      if (safetyDebugEnabled && result.debugReason) {
        safetyDebugReason = result.debugReason;
      }
    };

    if (!finalRefusal && safetyPostProcessMode !== "off") {
      const applyPromptValue =
        typeof finalParsed.actions?.applyPrompt === "string" ? finalParsed.actions.applyPrompt : "";
      if (applyPromptValue) {
        const applyPromptSafety = await postProcessStudioAgentSafetyText({
          text: applyPromptValue,
          route: safetyRoute,
          flow: orchestration.flow,
          source: "model_output",
          mode: safetyPostProcessMode,
          debug: safetyDebugEnabled,
          traceId,
          profileId: safetyProfileId,
          environment: safetyEnvironment,
          devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
          modality: safetyModality,
          policyDocument: safetyPolicyDocument,
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
          route: safetyRoute,
          flow: orchestration.flow,
          source: "model_output",
          mode: safetyPostProcessMode,
          debug: safetyDebugEnabled,
          traceId,
          profileId: safetyProfileId,
          environment: safetyEnvironment,
          devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
          modality: safetyModality,
          policyDocument: safetyPolicyDocument,
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
      if (!finalRefusal && finalApplyPrompt && !workflowPulseActive) {
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

    if (safetyHardFloorViolation) {
      try {
        const rollbackResult = await maybeTriggerSafetyIncidentAutoRollback({
          environment: safetyEnvironment,
          autoRollbackEnabled: safetyAutoRollbackEnabled,
          hardFloorViolation: safetyHardFloorViolation,
          actorUserId: userId,
          actorEmail: userEmail,
          source: "studio_agent_runtime_hard_floor",
          reason: "Studio agent runtime hard-floor incident.",
        });
        safetyRollbackTriggered = rollbackResult.rollbackTriggered;
      } catch (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel,
          metadata: {
            user_id: userId,
            conversation_id: normalizedConversationId,
            stage: "safety_auto_rollback",
          },
        });
      }
    }

    const finalOutcomeClass = finalRefusal
      ? safetyForcedRefusal
        ? "refusal_safety"
        : "refusal_model"
      : finalParsed.actions?.applyPrompt
        ? "success_prompt"
        : "success_message";
    const finalReasonCode = finalRefusal
      ? safetyForcedRefusal
        ? "SAFETY_OUTPUT_REFUSAL"
        : "PROVIDER_SAFETY_REFUSAL"
      : finalParsed.actions?.applyPrompt
        ? "SUCCESS_PROMPT"
        : "SUCCESS_MESSAGE";

    if (
      shouldCommitStudioAgentCanonicalPrompt({
        canonicalPrompt: finalResolvedCanonical,
        outcomeClass: finalOutcomeClass,
      })
    ) {
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

    const workflowSessionUpdate = buildStudioAgentWorkflowSessionUpdate({
      pulse: context.pulse,
      response: finalParsed,
      semanticStatus,
      latestUserInput: resolveLatestStudioAgentUserInput(messages),
    });
    const pulsePresetId =
      workflowPulseActive && typeof context.pulse?.presetId === "string"
        ? context.pulse.presetId.trim() || null
        : null;
    const pulseWorkflowStatusBefore = workflowPulseActive
      ? (context.pulse?.workflowSession?.status ?? null)
      : null;
    const isPulseActivationTurn =
      workflowPulseActive &&
      messages.some(
        (message) =>
          message.role === "user" &&
          message.content.includes('Pulse "') &&
          message.content.includes("was just activated.")
      );
    const pulseTurnPhase = workflowPulseActive
      ? isPulseActivationTurn
        ? "activation"
        : pulseWorkflowStatusBefore === "completed"
          ? "completed_followup"
          : "followup"
      : null;

    emitStudioAgentTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: finalRefusal ? "refuse" : "success",
      model,
      outcomeClass: finalOutcomeClass,
      retryUsed,
      retryCount,
      repairUsed,
      repairCount,
      reasonCode: finalReasonCode,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      pulsePresetId,
      pulseTurnPhase,
      pulseWorkflowStatusBefore,
      pulseWorkflowStatusAfter: workflowSessionUpdate?.status ?? null,
      safetyOutcome: safetyOutcome === "pass" ? undefined : safetyOutcome,
      safetySource: safetyOutcome === "pass" ? undefined : "model_output",
      safetyFallback: safetyOutcome === "pass" ? undefined : safetyFallback,
      safetyDebugReason,
      safetyDebugEnabled,
      safetyTelemetry: {
        policyVersion: resolvedSafetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion ?? null,
        promptTemplateVersion: safetyPromptTemplateVersion ?? null,
        runtimeScopeKey: runtimeScopeKey ?? null,
        profileId: safetyTelemetryProfileId,
        modality: safetyModality,
        category: safetyDecisionCategory,
        decisionAction: safetyDecisionAction,
        decisionSource: safetyDecisionSource,
        providerBlocked: false,
        hardFloorViolation: safetyHardFloorViolation,
        rollbackTriggered: safetyRollbackTriggered,
      },
    });
    return {
      status: 200,
      payload: {
        ...finalParsed,
        workflowSession: workflowSessionUpdate,
        ...(usage ? { usage } : {}),
        ...buildAgentMachineOutcome({
          outcomeClass: finalOutcomeClass,
          reasonCode: finalReasonCode,
        }),
        canonicalPrompt: finalResolvedCanonical,
        traceId,
      },
    };
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
        repairCount: number;
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
      repairCount: turn.result.repairUsed ? 1 : 0,
    };
  };

  try {
    const singleStageResult = await executeFastPathWithRetry({
      path: runtimePath,
    });

    if (!singleStageResult.ok) {
      return singleStageResult.response;
    }

    return await finalizeSuccessfulTurn({
      parsed: singleStageResult.turn.result.parsed as Record<string, unknown>,
      refusal: singleStageResult.turn.result.refusal,
      resolvedCanonical: singleStageResult.turn.result.resolvedCanonical,
      semanticStatus: singleStageResult.turn.result.semanticStatus,
      usage: singleStageResult.turn.result.usage as Record<string, unknown>,
      model: openAiModel,
      retryUsed: singleStageResult.retryCount > 0,
      retryCount: singleStageResult.retryCount,
      repairUsed: singleStageResult.repairCount > 0,
      repairCount: singleStageResult.repairCount,
      path: runtimePath,
      writeFailureStage: "canonical_write_pulse_agent",
    });
  } catch (error) {
    const failureDetail = formatStudioAgentErrorMessage(error);
    await logApiRouteException({
      req,
      error,
      routeLabel,
      metadata: {
        user_id: userId,
        conversation_id: normalizedConversationId,
      },
    });
    emitStudioAgentTurnTelemetry({
      flow: "unknown",
      path: runtimePath,
      status: "error",
      model: openAiModel,
      outcomeClass: "route_error",
      retryUsed: false,
      retryCount: 0,
      reasonCode: "ROUTE_ERROR",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        policyVersion: resolvedSafetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion ?? null,
        promptTemplateVersion: safetyPromptTemplateVersion ?? null,
        runtimeScopeKey: runtimeScopeKey ?? null,
        profileId: safetyTelemetryProfileId,
        modality: safetyModality,
      },
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
