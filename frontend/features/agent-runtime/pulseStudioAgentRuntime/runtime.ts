/**
 * Pulse Create agent runtime for AI Studio.
 * Owns Pulse-route orchestration, built-in workflow prompt loading, persistence,
 * and telemetry.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { pickSelectedReferencesForThinker } from "../../ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../ai-agent/logic/studioAgentOrchestration";
import { resolveStudioAgentOpenAiConfig } from "../studioAgentOpenAiGateway";
import { executeStudioAgentCoordinator } from "./coordinator";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../studioAgentSafetyInputPrecheck";
import { resolveSafetyModality } from "../safetyPolicy/decisionEngine";
import { MISSING_PROVIDER_API_KEY_MESSAGE } from "../safetyPolicy/providerErrorPolicy";
import {
  buildSafeCompletionTelemetryDisposition,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentSafetyRefusalPayload,
  emitStudioAgentInputPrecheckTelemetry,
  emitStudioAgentUntrustedImageTextTelemetry,
} from "../studioAgentRouteOutcomes";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../studioAgentRouteEnvelope";
import {
  hasInboundStudioAgentCanonicalPrompt,
  hasStudioAgentPulseContext,
  isRetiredCreatePulsePresetId,
  isPulseCreateAgentSessionNamespace,
  readStudioAgentClientSessionNamespace,
  readPulsePresetIdFromSessionNamespace,
  readPulsePresetIdFromContext,
} from "../studioAgentRouteModeBoundary";
import {
  applyStudioAgentVisionSummariesToContext,
  buildStudioAgentImageSummaryMap,
  describeStudioAgentVisionSummaryError,
  isStudioAgentVisionSummaryAbortError,
} from "../studioAgentVisionSummaries";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "../promptCompilerCacheScopeKey";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  isAuthoritativeCreatePulseBuiltInCatalogResolution,
  resolveRuntimeCreatePulseBuiltInCatalog,
} from "../../../lib/server/api/createPulseBuiltInControlPlane";
import {
  SAFE_COMPLETION_CONTRACT_VERSION,
  resolveSafeCompletionRecoveryEligibility,
  resolveSafeCompletionSystemInstruction,
} from "../studioAgentSafeCompletion";
import { resolveStudioAgentSafetyRuntimeConfig } from "../studioAgentSafetyRuntimeConfig";

const PULSE_ROUTE_LABEL = "ai/studio-agent-pulse";
const PULSE_PROMPT_CACHE_ROUTE = "studio-agent-pulse";
const PULSE_RUNTIME_SCOPE_FALLBACK = "studio-agent-pulse";

const hasPulseWorkflowPresetMismatch = (body: unknown): boolean => {
  const pulse = (body as { context?: { pulse?: unknown } })?.context?.pulse as
    | { presetId?: unknown; workflowSession?: { presetId?: unknown } | null }
    | null
    | undefined;
  if (!pulse?.workflowSession) return false;
  const presetId = typeof pulse.presetId === "string" ? pulse.presetId.trim() : "";
  const workflowPresetId =
    typeof pulse.workflowSession.presetId === "string" ? pulse.workflowSession.presetId.trim() : "";
  return Boolean(workflowPresetId && presetId && workflowPresetId !== presetId);
};

const hasPulseSessionNamespacePresetMismatch = (body: unknown): boolean => {
  const clientSessionNamespace = readStudioAgentClientSessionNamespace(
    body as { clientSessionNamespace?: unknown } | null | undefined
  );
  const namespacePresetId = readPulsePresetIdFromSessionNamespace(clientSessionNamespace);
  const pulse = (body as { context?: { pulse?: unknown } })?.context?.pulse as
    | { presetId?: unknown }
    | null
    | undefined;
  const presetId = typeof pulse?.presetId === "string" ? pulse.presetId.trim() : "";
  return Boolean(namespacePresetId && presetId && namespacePresetId !== presetId);
};

export const runPulseStudioAgentRuntime = async (req: NextApiRequest, res: NextApiResponse) => {
  const requestStartedAt = Date.now();
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

  if (req.method === "POST") {
    const clientSessionNamespace = readStudioAgentClientSessionNamespace(req.body);
    const contextPresetId = readPulsePresetIdFromContext(req.body?.context);
    const namespacePresetId = readPulsePresetIdFromSessionNamespace(clientSessionNamespace);
    if (
      req.body?.runtimeMode === "standard" ||
      !hasStudioAgentPulseContext(req.body?.context) ||
      !isPulseCreateAgentSessionNamespace(clientSessionNamespace) ||
      hasInboundStudioAgentCanonicalPrompt(req.body) ||
      isRetiredCreatePulsePresetId(contextPresetId) ||
      isRetiredCreatePulsePresetId(namespacePresetId) ||
      hasPulseSessionNamespacePresetMismatch(req.body) ||
      hasPulseWorkflowPresetMismatch(req.body)
    ) {
      return sendStudioAgentError(res, 400, {
        code: "INVALID_REQUEST",
        message: "Pulse agent runtime requires an active Pulse runtime context.",
        traceId,
      });
    }
    req.body = {
      ...req.body,
      runtimeMode: "pulse",
      canonicalPrompt: null,
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
        detail: MISSING_PROVIDER_API_KEY_MESSAGE,
        reasonCode: "CONFIG_MISSING",
      }),
      error: MISSING_PROVIDER_API_KEY_MESSAGE,
    });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const originalLatestUserText =
    [...messages]
      .reverse()
      .find((message) => message.role === "user" && message.content.trim().length > 0)
      ?.content.trim() ?? "";
  if (!context.pulse) {
    return sendStudioAgentError(res, 400, {
      code: "INVALID_REQUEST",
      message: "Pulse agent runtime requires Pulse context.",
      traceId,
    });
  }
  const runtimePulseBuiltIns = await resolveRuntimeCreatePulseBuiltInCatalog({
    bypassCache: context.pulse.source === "builtin",
  });
  if (
    context.pulse.source === "builtin" &&
    !isAuthoritativeCreatePulseBuiltInCatalogResolution(runtimePulseBuiltIns)
  ) {
    return sendStudioAgentError(res, 503, {
      code: "PULSE_PRESET_CATALOG_UNAVAILABLE",
      message: "Built-in Pulse catalog is unavailable. Reload the Pulse catalog and try again.",
      traceId,
    });
  }
  const runtimeBuiltInPreset = runtimePulseBuiltIns.builtInDefinitions.find(
    (definition) => definition.presetId === context.pulse?.presetId
  );
  if (runtimeBuiltInPreset && context.pulse.source !== "builtin") {
    return sendStudioAgentError(res, 409, {
      code: "PULSE_PRESET_SOURCE_MISMATCH",
      message: "Pulse preset source mismatch. Reload the Pulse catalog and try again.",
      traceId,
    });
  }
  if (context.pulse.source === "builtin" && !runtimeBuiltInPreset) {
    return sendStudioAgentError(res, 409, {
      code: "PULSE_PRESET_UNAVAILABLE",
      message: "Built-in Pulse preset is unavailable. Reload the Pulse catalog and try again.",
      traceId,
    });
  }
  if (runtimeBuiltInPreset && context.pulse) {
    context = {
      ...context,
      pulse: {
        ...context.pulse,
        presetId: runtimeBuiltInPreset.presetId,
        label: runtimeBuiltInPreset.label,
        description: runtimeBuiltInPreset.description,
        instructions: runtimeBuiltInPreset.systemInstructions,
        pulseKind: runtimeBuiltInPreset.pulseKind,
        runtimeMode: runtimeBuiltInPreset.runtimeMode,
        activationMode: runtimeBuiltInPreset.activationMode,
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: runtimeBuiltInPreset.outputMode,
        artifactTarget: runtimeBuiltInPreset.artifactTarget,
        memoryPolicy: runtimeBuiltInPreset.memoryPolicy,
        source: "builtin",
        workflowSession: context.pulse.workflowSession ?? null,
        schemaVersion: runtimeBuiltInPreset.schemaVersion,
      },
    };
  }
  context = { ...context, lastAssistantMessage: undefined };
  const safetyRuntimeConfig = await resolveStudioAgentSafetyRuntimeConfig(process.env);
  const {
    inputPrecheckEnabled: safetyInputPrecheckEnabled,
    debugEnabled: safetyDebugEnabled,
    profile: safetyProfile,
    profileId: safetyProfileId,
    policyDocument: safetyPolicyDocument,
    policySchemaVersion: safetyPolicySchemaVersion,
    environment: safetyEnvironment,
    devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
    postProcessMode: safetyPostProcessMode,
    providerErrorMode: safetyProviderErrorMode,
    autoRollbackEnabled: safetyAutoRollbackEnabled,
  } = safetyRuntimeConfig;
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const { openAiUrl, turnTimeoutMs } = openAiConfig;
  const pulseRouteActive = Boolean(context.pulse);

  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const workflowSystemPrompt = loadAgentPrompt(
    "STUDIO_AGENT_WORKFLOW_SYSTEM",
    process.env.STUDIO_AGENT_WORKFLOW_SYSTEM
  );
  const thinkerPrompt = loadAgentPrompt("STUDIO_AGENT_THINKER", process.env.STUDIO_AGENT_THINKER);
  const formatterPrompt = loadAgentPrompt(
    "STUDIO_AGENT_FORMATTER",
    process.env.STUDIO_AGENT_FORMATTER
  );
  const imageDescribePrompt = loadAgentPrompt(
    "OPENAI_PROMPT_IMAGE_DESCRIBE",
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE
  );
  if (!workflowSystemPrompt) {
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: "STUDIO_AGENT_WORKFLOW_SYSTEM prompt missing",
        reasonCode: "CONFIG_MISSING",
      }),
      error: "STUDIO_AGENT_WORKFLOW_SYSTEM prompt missing",
    });
  }
  const systemPrompt = workflowSystemPrompt;
  const promptTemplateVersion = resolvePromptTemplateVersion({
    route: PULSE_PROMPT_CACHE_ROUTE,
    prompts: [
      systemPrompt,
      thinkerPrompt ?? "",
      formatterPrompt ?? "",
      imageDescribePrompt ?? "",
      SAFE_COMPLETION_CONTRACT_VERSION,
      resolveSafeCompletionSystemInstruction(process.env) ?? "disabled",
    ],
  });
  const runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: PULSE_PROMPT_CACHE_ROUTE,
    promptTemplateVersion,
    policySchemaVersion: safetyPolicySchemaVersion,
    controlPlanePolicyVersion: safetyProfile.policyVersion,
  });
  const {
    openAiModel,
    openAiVisionModel,
    openAiPulseModel,
    visionTimeoutMs,
    pulseTurnTimeoutMs,
    upstreamRetryMaxAttempts,
    upstreamRetryBaseDelayMs,
    upstreamRetryMaxDelayMs,
  } = openAiConfig;
  const coordinatorOpenAiModel = pulseRouteActive ? openAiPulseModel : openAiModel;
  const coordinatorTurnTimeoutMs = pulseRouteActive ? pulseTurnTimeoutMs : turnTimeoutMs;

  let effectiveCanonical: string | null = null;

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
      route: PULSE_PROMPT_CACHE_ROUTE,
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
      safeCompletionTelemetry:
        precheckResult.outcome === "refusal"
          ? buildSafeCompletionTelemetryDisposition({
              enabled: safetyRuntimeConfig.safeCompletionEnabled,
              recoverySkipReason: precheckResult.decision?.hardFloorViolation
                ? "hard_floor"
                : "policy_refusal",
            })
          : undefined,
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
  const safeCompletionRecoveryEligibility = resolveSafeCompletionRecoveryEligibility({
    enabled: safetyRuntimeConfig.safeCompletionEnabled,
    inputPrecheckEnabled: safetyRuntimeConfig.inputPrecheckEnabled,
    decision: precheckResult.decision,
    latestUserText: originalLatestUserText,
    refusalSource: "semantic_model",
    hasUnclassifiedMedia: orchestrationBeforePrecheck.flow !== "TEXT_ONLY",
  });

  const selectedReferencesBeforeVision = pickSelectedReferencesForThinker(context);
  const orchestrationBeforeVision = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforeVision,
    effectiveCanonical,
  });

  let visionSummaryMap = new Map<string, string>();
  let providerCallCount = 0;
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
        onProviderCall: () => {
          providerCallCount += 1;
        },
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
      if (!isStudioAgentVisionSummaryAbortError(error)) {
        await logApiRouteException({
          req,
          error,
          routeLabel: PULSE_ROUTE_LABEL,
          metadata: {
            user_id: user.id,
            conversation_id: normalizedConversationId,
            stage: "vision_summary",
          },
        });
      }
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
    openAiModel: coordinatorOpenAiModel,
    turnTimeoutMs: coordinatorTurnTimeoutMs,
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
    userId: user.id,
    userEmail: user.email ?? null,
    canonicalDbEnabled: false,
    safetyPostProcessMode,
    safetyDebugEnabled,
    safetyProfileId,
    safetyPolicyDocument,
    safetyPolicyVersion: safetyProfile.policyVersion,
    safetyPolicySchemaVersion,
    safetyPromptTemplateVersion: promptTemplateVersion,
    runtimeScopeKey: runtimeScopeKey || PULSE_RUNTIME_SCOPE_FALLBACK,
    safetyEnvironment,
    safetyDevAbsoluteZeroEnabled,
    safetyProviderErrorMode,
    safetyAutoRollbackEnabled,
    safeCompletionEnabled: safetyRuntimeConfig.safeCompletionEnabled,
    safeCompletionRecoveryEligible: safeCompletionRecoveryEligibility.eligible,
    safeCompletionRecoverySkipReason: safeCompletionRecoveryEligibility.eligible
      ? null
      : safeCompletionRecoveryEligibility.skipReason,
    initialProviderCallCount: providerCallCount,
    routeLabel: PULSE_ROUTE_LABEL,
    safetyRoute: PULSE_PROMPT_CACHE_ROUTE,
  });

  return res.status(coordinatorResult.status).json(coordinatorResult.payload);
};
