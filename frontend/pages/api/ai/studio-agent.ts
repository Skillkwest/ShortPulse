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
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../../../features/agent-runtime/studioAgentOpenAiGateway";
import { executeStudioAgentCoordinator } from "../../../features/agent-runtime/studioAgentCoordinator";
import { runStudioAgentSafetyInputPrecheck } from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import {
  resolveSafetyEnvironment,
  resolveSafetyModality,
} from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";
import { resolveProviderErrorNormalizationMode } from "../../../features/agent-runtime/safetyPolicy/providerErrorPolicy";
import {
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentSafetyRefusalPayload,
  emitStudioAgentInputPrecheckTelemetry,
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
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { clampCanonicalPrompt } from "../../../lib/server/api/agentConversationState";
import { resolveRuntimeSafetyProfile } from "../../../lib/server/api/agentSafetyPolicyControlPlane";

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

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;

  const canonicalDbEnabled = process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED !== "false";
  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const singleStageEnabled = process.env.STUDIO_AGENT_SINGLE_STAGE_ENABLED !== "false";
  const legacyV2FallbackEnabled = process.env.STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED === "true";
  const textFastPathEnabled = process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED !== "false";
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
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const safetyProviderErrorMode = resolveProviderErrorNormalizationMode(
    process.env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
  );
  const safetyAutoRollbackEnabled = process.env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true";
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const {
    openAiUrl,
    openAiModel,
    openAiVisionModel,
    openAiThinkerModel,
    openAiFormatterModel,
    visionTimeoutMs,
    turnTimeoutMs,
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
      profileId: safetyTelemetryProfileId,
      modality: precheckResult.decision?.modality ?? "text",
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? null,
      decisionSource: precheckResult.decision?.source ?? null,
      hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
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
