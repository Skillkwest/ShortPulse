/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { sanitizeGenerationPromptText } from "../../../features/agent-core/promptText";
import { pickSelectedReferencesForThinker } from "../../../features/ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../../features/ai-agent/logic/studioAgentOrchestration";
import { readStudioAgentCanonicalPrompt } from "../../../features/agent-runtime/studioAgentCanonicalPersistence";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../../../features/agent-runtime/studioAgentOpenAiGateway";
import { executeStudioAgentCoordinator } from "../../../features/agent-runtime/studioAgentCoordinator";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import {
  resolveSafetyEnvironment,
  resolveSafetyModality,
} from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";
import { resolveProviderErrorNormalizationMode } from "../../../features/agent-runtime/safetyPolicy/providerErrorPolicy";
import {
  buildStudioAgentInfraFallbackPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentSafetyRefusalPayload,
  emitStudioAgentInputPrecheckTelemetry,
  emitStudioAgentUntrustedImageTextTelemetry,
} from "../../../features/agent-runtime/studioAgentRouteOutcomes";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../../../features/agent-runtime/studioAgentRouteEnvelope";
import {
  applyStudioAgentVisionSummariesToContext,
  buildStudioAgentImageSummaryMap,
  describeStudioAgentVisionSummaryError,
} from "../../../features/agent-runtime/studioAgentVisionSummaries";
import {
  shouldCommitStudioAgentCanonicalPrompt,
  writeStudioAgentCanonicalPrompt,
} from "../../../features/agent-runtime/studioAgentCanonicalPersistence";
import {
  buildAgentMachineOutcome,
  resolveInfraFallbackReasonCode,
} from "../../../features/agent-runtime/agentMachineOutcome";
import { resolveStudioAgentFallbackReasonLabel } from "../../../features/agent-runtime/studioAgentFallbackReason";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "../../../features/agent-runtime/promptCompilerCacheScopeKey";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { clampCanonicalPrompt } from "../../../lib/server/api/agentConversationState";
import { resolveRuntimeSafetyProfile } from "../../../lib/server/api/agentSafetyPolicyControlPlane";
import { emitStudioAgentTurnTelemetry } from "../../../features/agent-runtime/studioAgentRouteOutcomes";

const DEFAULT_DIRECT_OPENAI_MODEL = "gpt-5.4";

const resolveDirectOpenAiBypassEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";

const resolveDirectOpenAiModel = (env: NodeJS.ProcessEnv): string =>
  env.STUDIO_AGENT_DIRECT_OPENAI_MODEL?.trim() || DEFAULT_DIRECT_OPENAI_MODEL;

const extractDirectOpenAiMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const raw = choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim().length) return null;
  return sanitizeGenerationPromptText(raw) ?? raw.trim();
};

const resolveDirectOpenAiBypassFlow = (
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
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;
  const directOpenAiBypassRequested = requestEnvelope.value.directOpenAiBypass;

  const directOpenAiBypassEnabled = resolveDirectOpenAiBypassEnabled(process.env);
  const safetyInputPrecheckEnabled =
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false";
  const safetyDebugEnabled = process.env.STUDIO_AGENT_SAFETY_DEBUG === "true";
  const safetyProfile = await resolveRuntimeSafetyProfile({
    envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
  });
  const safetyProfileId = safetyProfile.profileId;
  const safetyPolicyDocument = resolveSafetyPolicyDocument({
    activePolicy: safetyProfile.activePolicy,
    profileId: safetyProfileId,
  });
  const safetyPolicySchemaVersion = safetyPolicyDocument.schemaVersion;
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const { openAiUrl, turnTimeoutMs } = openAiConfig;
  const directOpenAiModel = resolveDirectOpenAiModel(process.env);

  if (directOpenAiBypassEnabled && directOpenAiBypassRequested) {
    const directBypassFlow = resolveDirectOpenAiBypassFlow(context);
    const directSafetyModality = resolveSafetyModality({
      route: "studio-agent",
      flow: directBypassFlow,
    });
    const directCanonicalPrompt =
      incomingCanonical ?? sanitizeGenerationPromptText(context.lastAssistantMessage) ?? null;
    let effectiveCanonical = clampCanonicalPrompt(directCanonicalPrompt);
    const precheckResult = runStudioAgentSafetyInputPrecheck({
      enabled: safetyInputPrecheckEnabled,
      messages,
      context,
      canonicalPrompt: effectiveCanonical,
      modality: directSafetyModality,
      profileId: safetyProfileId,
      environment: safetyEnvironment,
      devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
      policyDocument: safetyPolicyDocument,
      rewriteRecheckMode: "allow_or_rewrite",
      fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
        sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
        scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
      }),
    });
    const safetyTelemetryProfileId =
      safetyProfileId === "prod_safe_v1" ||
      safetyProfileId === "staging_lenient" ||
      safetyProfileId === "dev_absolute_zero"
        ? safetyProfileId
        : null;
    if (precheckResult.outcome !== "pass") {
      emitStudioAgentInputPrecheckTelemetry({
        flow: directBypassFlow,
        outcome: precheckResult.outcome,
        rewrittenFieldCount: precheckResult.rewrittenFieldCount,
        providerCallSkipped: precheckResult.providerCallSkipped,
        policyVersion: safetyProfile.policyVersion,
        policySchemaVersion: safetyPolicyDocument.schemaVersion,
        promptTemplateVersion: null,
        runtimeScopeKey: null,
        profileId: safetyTelemetryProfileId,
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decisionAction: precheckResult.decision?.action ?? null,
        decisionSource: precheckResult.decision?.source ?? null,
        hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
        refusalField: precheckResult.scopeTelemetry.refusalField,
        rewrittenFields: precheckResult.scopeTelemetry.rewrittenFields,
        nonBlockingSignalCount: precheckResult.scopeTelemetry.nonBlockingSignalCount,
      });
    }
    if (precheckResult.outcome === "refusal") {
      return res.status(200).json(
        buildStudioAgentSafetyRefusalPayload({
          traceId,
          canonicalPrompt: precheckResult.canonicalPrompt,
          reasonCode: "SAFETY_INPUT_REFUSAL",
        })
      );
    }
    messages = precheckResult.messages;
    context = precheckResult.context;
    effectiveCanonical = precheckResult.canonicalPrompt;

    const directOpenAiStartedAt = Date.now();
    try {
      const directMessages = messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));
      const directResponse = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model: directOpenAiModel,
        messages: directMessages,
        timeoutMs: turnTimeoutMs,
      });
      markStage("direct_openai_bypass", directOpenAiStartedAt);

      if (!directResponse.ok) {
        const detail = await directResponse.text();
        const reasonCode = resolveInfraFallbackReasonCode({
          status: directResponse.status,
          detail,
        });
        const fallbackReason = resolveStudioAgentFallbackReasonLabel({
          status: directResponse.status,
          detail,
        });
        emitStudioAgentTurnTelemetry({
          flow: directBypassFlow,
          path: "direct_openai_bypass",
          status: "success",
          model: directOpenAiModel,
          outcomeClass: "fallback_infra",
          retryUsed: false,
          reasonCode,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
          fallbackReason,
          safetyTelemetry: {
            policyVersion: safetyProfile.policyVersion,
            policySchemaVersion: safetyPolicyDocument.schemaVersion,
            promptTemplateVersion: null,
            runtimeScopeKey: null,
            profileId: safetyTelemetryProfileId,
            modality: directSafetyModality,
          },
        });
        return res.status(200).json(
          buildStudioAgentInfraFallbackPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
            reasonCode,
            fallbackReason,
          })
        );
      }

      const directPayload = await directResponse.json();
      const directMessage = extractDirectOpenAiMessage(directPayload);
      if (!directMessage) {
        emitStudioAgentTurnTelemetry({
          flow: directBypassFlow,
          path: "direct_openai_bypass",
          status: "success",
          model: directOpenAiModel,
          outcomeClass: "fallback_infra",
          retryUsed: false,
          reasonCode: "INFRA_FALLBACK_OUTPUT_CONTRACT",
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
          fallbackReason: "stage_prompt_missing",
          safetyTelemetry: {
            policyVersion: safetyProfile.policyVersion,
            policySchemaVersion: safetyPolicyDocument.schemaVersion,
            promptTemplateVersion: null,
            runtimeScopeKey: null,
            profileId: safetyTelemetryProfileId,
            modality: directSafetyModality,
          },
        });
        return res.status(200).json(
          buildStudioAgentInfraFallbackPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
            reasonCode: "INFRA_FALLBACK_OUTPUT_CONTRACT",
            fallbackReason: "stage_prompt_missing",
          })
        );
      }

      const nextCanonical = clampCanonicalPrompt(directMessage);
      emitStudioAgentTurnTelemetry({
        flow: directBypassFlow,
        path: "direct_openai_bypass",
        status: "success",
        model: directOpenAiModel,
        outcomeClass: "success_prompt",
        retryUsed: false,
        reasonCode: "SUCCESS_PROMPT",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          policyVersion: safetyProfile.policyVersion,
          policySchemaVersion: safetyPolicyDocument.schemaVersion,
          promptTemplateVersion: null,
          runtimeScopeKey: null,
          profileId: safetyTelemetryProfileId,
          modality: directSafetyModality,
        },
      });
      return res.status(200).json({
        message: directMessage,
        actions: {
          applyPrompt: directMessage,
          referenceCard: {
            title: "Direct prompt",
            prompt: directMessage,
          },
        },
        ...buildAgentMachineOutcome({
          outcomeClass: "success_prompt",
          reasonCode: "SUCCESS_PROMPT",
        }),
        canonicalPrompt: nextCanonical,
        traceId,
      });
    } catch (error) {
      markStage("direct_openai_bypass", directOpenAiStartedAt);
      await logApiRouteException({
        req,
        error,
        routeLabel: "ai/studio-agent",
        metadata: {
          user_id: user.id,
          conversation_id: normalizedConversationId,
          stage: "direct_openai_bypass",
        },
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        detail: formatStudioAgentErrorMessage(error),
      });
      const reasonCode = resolveInfraFallbackReasonCode({
        detail: formatStudioAgentErrorMessage(error),
      });
      emitStudioAgentTurnTelemetry({
        flow: directBypassFlow,
        path: "direct_openai_bypass",
        status: "success",
        model: directOpenAiModel,
        outcomeClass: "fallback_infra",
        retryUsed: false,
        reasonCode,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        fallbackReason,
        safetyTelemetry: {
          policyVersion: safetyProfile.policyVersion,
          policySchemaVersion: safetyPolicyDocument.schemaVersion,
          promptTemplateVersion: null,
          runtimeScopeKey: null,
          profileId: safetyTelemetryProfileId,
          modality: directSafetyModality,
        },
      });
      return res.status(200).json(
        buildStudioAgentInfraFallbackPayload({
          traceId,
          canonicalPrompt: effectiveCanonical,
          reasonCode,
          fallbackReason,
        })
      );
    }
  }

  const canonicalDbEnabled = process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED !== "false";
  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const singleStageEnabled = process.env.STUDIO_AGENT_SINGLE_STAGE_ENABLED !== "false";
  const legacyV2FallbackEnabled = process.env.STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED === "true";
  const textFastPathEnabled = process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED !== "false";
  const envPostprocessMode = String(process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_MODE ?? "")
    .trim()
    .toLowerCase();
  const safetyPostProcessMode =
    envPostprocessMode === "enforce" ||
    envPostprocessMode === "shadow" ||
    envPostprocessMode === "off"
      ? envPostprocessMode
      : process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED === "false"
        ? "off"
        : safetyPolicyDocument.postprocess.mode;
  const safetyProviderErrorMode = resolveProviderErrorNormalizationMode(
    process.env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
  );
  const safetyAutoRollbackEnabled = process.env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true";
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
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: "STUDIO_AGENT_SYSTEM prompt missing",
        reasonCode: "CONFIG_MISSING",
      }),
      error: "STUDIO_AGENT_SYSTEM prompt missing",
    });
  }
  const promptTemplateVersion = resolvePromptTemplateVersion({
    route: "studio-agent",
    prompts: [systemPrompt, thinkerPrompt ?? "", formatterPrompt ?? "", imageDescribePrompt ?? ""],
  });
  const runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "studio-agent",
    promptTemplateVersion,
    policySchemaVersion: safetyPolicySchemaVersion,
    controlPlanePolicyVersion: safetyProfile.policyVersion,
  });
  const {
    openAiModel,
    openAiVisionModel,
    openAiThinkerModel,
    openAiFormatterModel,
    visionTimeoutMs,
    upstreamRetryMaxAttempts,
    upstreamRetryBaseDelayMs,
    upstreamRetryMaxDelayMs,
  } = openAiConfig;

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
  let effectiveCanonical = clampCanonicalPrompt(canonicalPrompt);

  const selectedReferencesBeforePrecheck = pickSelectedReferencesForThinker(context);
  const orchestrationBeforePrecheck = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforePrecheck,
    effectiveCanonical,
  });
  const precheckResult = runStudioAgentSafetyInputPrecheck({
    enabled: safetyInputPrecheckEnabled,
    messages,
    context,
    canonicalPrompt: effectiveCanonical,
    modality: resolveSafetyModality({
      route: "studio-agent",
      flow: orchestrationBeforePrecheck.flow,
    }),
    profileId: safetyProfileId,
    environment: safetyEnvironment,
    devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
    policyDocument: safetyPolicyDocument,
    rewriteRecheckMode: "allow_or_rewrite",
    fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
      scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
    }),
  });
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;
  if (precheckResult.outcome !== "pass") {
    emitStudioAgentInputPrecheckTelemetry({
      flow: orchestrationBeforePrecheck.flow,
      outcome: precheckResult.outcome,
      rewrittenFieldCount: precheckResult.rewrittenFieldCount,
      providerCallSkipped: precheckResult.providerCallSkipped,
      policyVersion: safetyProfile.policyVersion,
      policySchemaVersion: safetyPolicySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: precheckResult.decision?.modality ?? "text",
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? null,
      decisionSource: precheckResult.decision?.source ?? null,
      hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
      refusalField: precheckResult.scopeTelemetry.refusalField,
      rewrittenFields: precheckResult.scopeTelemetry.rewrittenFields,
      nonBlockingSignalCount: precheckResult.scopeTelemetry.nonBlockingSignalCount,
    });
  }
  if (precheckResult.outcome === "refusal") {
    return res.status(200).json(
      buildStudioAgentSafetyRefusalPayload({
        traceId,
        canonicalPrompt: precheckResult.canonicalPrompt,
        reasonCode: "SAFETY_INPUT_REFUSAL",
      })
    );
  }
  messages = precheckResult.messages;
  context = precheckResult.context;
  effectiveCanonical = precheckResult.canonicalPrompt;

  const selectedReferencesBeforeVision = pickSelectedReferencesForThinker(context);
  const orchestrationBeforeVision = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforeVision,
    effectiveCanonical,
  });

  let visionSummaryMap = new Map<string, string>();
  let untrustedImageTextSignalCount = 0;
  let untrustedImageTextAffectedImageCount = 0;
  let untrustedImageTextRemovedLineCount = 0;
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
        timeoutMs: visionTimeoutMs,
        onUntrustedImageTextSignal: (signal) => {
          untrustedImageTextSignalCount += 1;
          untrustedImageTextAffectedImageCount += 1;
          untrustedImageTextRemovedLineCount += signal.removedInstructionLikeLineCount;
        },
      });
      context = applyStudioAgentVisionSummariesToContext(context, visionSummaryMap);
      emitStudioAgentUntrustedImageTextTelemetry({
        flow: orchestrationBeforeVision.flow,
        signalCount: untrustedImageTextSignalCount,
        affectedImageCount: untrustedImageTextAffectedImageCount,
        removedInstructionLikeLineCount: untrustedImageTextRemovedLineCount,
        policyVersion: safetyProfile.policyVersion,
        policySchemaVersion: safetyPolicySchemaVersion,
        promptTemplateVersion,
        runtimeScopeKey,
        profileId: safetyTelemetryProfileId,
      });
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
  const coordinatorResult = await executeStudioAgentCoordinator({
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
    userId: user.id,
    userEmail: user.email ?? null,
    canonicalDbEnabled,
    safetyPostProcessMode,
    safetyDebugEnabled,
    safetyProfileId,
    safetyPolicyDocument,
    safetyPolicyVersion: safetyProfile.policyVersion,
    safetyPolicySchemaVersion,
    safetyPromptTemplateVersion: promptTemplateVersion,
    runtimeScopeKey,
    safetyEnvironment,
    safetyDevAbsoluteZeroEnabled,
    safetyProviderErrorMode,
    safetyAutoRollbackEnabled,
  });

  return res.status(coordinatorResult.status).json(coordinatorResult.payload);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
