import type { NextApiRequest } from "next";
import { loadAgentPrompt } from "../../lib/agentPromptLoader";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { resolveRuntimeSafetyProfile } from "../../lib/server/api/agentSafetyPolicyControlPlane";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import {
  extractImageDescriptionText,
  requestOpenAiImageDescribeWithRetry,
  resolveImageDescribeUpstreamFailureSource,
  shouldRetryWithFallbackVisionModel,
} from "../../lib/server/api/imageDescribeOpenAi";
import { probeImageUrlForDescribe } from "../../lib/server/api/imageDescribeUrlGuard";
import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "./studioAgentFailurePolicy";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "./promptCompilerCacheScopeKey";
import { emitAgentRouteOutcomeTelemetry } from "./agentRouteTelemetry";
import { resolveSafetyEnvironment } from "./safetyPolicy/decisionEngine";
import {
  resolveImagePreflightFailMode,
  runImageSafetyPreflight,
} from "./safetyPolicy/imagePreflightClassifier";
import { maybeTriggerSafetyIncidentAutoRollback } from "./safetyPolicy/incidentAutoRollback";
import { resolveSafetyPolicyDocument } from "./safetyPolicy/policyDocument";
import {
  resolveProviderErrorHandling,
  resolveProviderErrorNormalizationMode,
} from "./safetyPolicy/providerErrorPolicy";
import { postProcessStudioAgentSafetyText } from "./studioAgentSafetyPostProcess";
import {
  isStudioAgentSafetyRefusalUpstreamError,
  STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
} from "./studioAgentRouteOutcomes";
import type { SafetyCategoryId } from "./safetyPolicy/types";
import { buildAgentMachineOutcome, resolveInfraFallbackReasonCode } from "./agentMachineOutcome";
import { resolveStudioAgentFallbackReasonLabel } from "./studioAgentFallbackReason";
import type { AgentMachineOutcomeFields } from "../../prefabs/agent/outcomeContract";

const IMAGE_DESCRIBER_ID: AgentPromptId = "OPENAI_PROMPT_IMAGE_DESCRIBE";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_FALLBACK_VISION_MODEL = "gpt-5-nano";

const emitDescribeSafetyTelemetry = ({
  routeLabel,
  outcome,
  fallbackUsed,
  debugReason,
  debugEnabled,
  policyVersion,
  policySchemaVersion,
  promptTemplateVersion,
  runtimeScopeKey,
  profileId,
  category,
  decisionAction,
  decisionSource,
  providerBlocked,
  hardFloorViolation,
  rollbackTriggered,
}: {
  routeLabel: string;
  outcome: "pass" | "rewritten" | "refusal";
  fallbackUsed: boolean;
  debugReason?: string;
  debugEnabled: boolean;
  policyVersion: number | null;
  policySchemaVersion: number | null;
  promptTemplateVersion: string;
  runtimeScopeKey: string;
  profileId: "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero" | null;
  category: SafetyCategoryId | null;
  decisionAction: "allow" | "rewrite" | "refuse" | null;
  decisionSource: "profile" | "hard_floor" | "absolute_zero" | null;
  providerBlocked: boolean;
  hardFloorViolation: boolean;
  rollbackTriggered: boolean;
}) => {
  if (outcome === "pass" && !debugEnabled) return;
  console.info(
    "[describe-image][safety]",
    JSON.stringify({
      route: routeLabel,
      safety_outcome: outcome,
      safety_source: "describe_output",
      safety_fallback: fallbackUsed,
      policy_version: policyVersion,
      policy_schema_version: policySchemaVersion,
      prompt_template_version: promptTemplateVersion,
      runtime_scope_key: runtimeScopeKey,
      profile_id: profileId,
      modality: "image",
      category,
      decision_action: decisionAction,
      decision_source: decisionSource,
      provider_blocked: providerBlocked,
      hard_floor_violation: hardFloorViolation,
      rollback_triggered: rollbackTriggered,
      ...(debugEnabled && debugReason ? { safety_debug_reason: debugReason } : {}),
    })
  );
};

const emitDescribeFallbackTelemetry = ({
  routeLabel,
  failureClass,
  detail,
  fallbackReason,
  policyVersion,
  policySchemaVersion,
  promptTemplateVersion,
  runtimeScopeKey,
  profileId,
}: {
  routeLabel: string;
  failureClass: string;
  detail: string;
  fallbackReason: string;
  policyVersion: number | null;
  policySchemaVersion: number | null;
  promptTemplateVersion: string;
  runtimeScopeKey: string;
  profileId: "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero" | null;
}) => {
  console.info(
    "[describe-image][fallback]",
    JSON.stringify({
      route: routeLabel,
      failure_class: failureClass,
      detail,
      fallback_reason: fallbackReason,
      policy_version: policyVersion,
      policy_schema_version: policySchemaVersion,
      prompt_template_version: promptTemplateVersion,
      runtime_scope_key: runtimeScopeKey,
      profile_id: profileId,
    })
  );
};

type LegacyImageDescribeSuccess = {
  ok: true;
  payload: AgentMachineOutcomeFields & {
    description: string;
    fallback_reason?: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

type LegacyImageDescribeFailure = {
  ok: false;
  status: number;
  payload: AgentMachineOutcomeFields & {
    error: string;
    detail?: string;
    model?: string;
    fallback_reason?: string;
  };
};

export type LegacyImageDescribeResult = LegacyImageDescribeSuccess | LegacyImageDescribeFailure;

export const executeLegacyImageDescribe = async ({
  req,
  user,
  imageUrl,
  routeLabel = "ai/describe-image",
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  imageUrl: unknown;
  routeLabel?: string;
}): Promise<LegacyImageDescribeResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = loadAgentPrompt(IMAGE_DESCRIBER_ID, process.env[IMAGE_DESCRIBER_ID]);
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
  const safetyImagePreflightEnabled =
    process.env.STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED !== "false";
  const safetyImagePreflightFailMode = resolveImagePreflightFailMode(
    process.env.STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE
  );
  const safetyProviderErrorMode = resolveProviderErrorNormalizationMode(
    process.env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
  );
  const safetyAutoRollbackEnabled = process.env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true";
  const safetyPolicyVersion = safetyProfile.policyVersion;
  const safetyPolicySchemaVersion = safetyPolicyDocument.schemaVersion;
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;
  let promptTemplateVersion: string | null = null;
  let runtimeScopeKey: string | null = null;
  const emitDescribeRouteTelemetry = ({
    statusCode,
    machineOutcome,
    category,
    decisionAction,
    decisionSource,
    providerBlocked,
    hardFloorViolation,
    rollbackTriggered,
    fallbackReason,
  }: {
    statusCode: number;
    machineOutcome: AgentMachineOutcomeFields;
    category?: SafetyCategoryId | null;
    decisionAction?: "allow" | "rewrite" | "refuse" | null;
    decisionSource?: "profile" | "hard_floor" | "absolute_zero" | null;
    providerBlocked?: boolean | null;
    hardFloorViolation?: boolean | null;
    rollbackTriggered?: boolean | null;
    fallbackReason?: string | null;
  }) => {
    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "describe-image",
      routeLabel,
      statusCode,
      machineOutcome,
      policyVersion: safetyPolicyVersion,
      policySchemaVersion: safetyPolicySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: "image",
      category: category ?? null,
      decisionAction: decisionAction ?? null,
      decisionSource: decisionSource ?? null,
      providerBlocked: providerBlocked ?? null,
      hardFloorViolation: hardFloorViolation ?? null,
      rollbackTriggered: rollbackTriggered ?? null,
      fallbackReason,
    });
  };

  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.config_missing",
      message: "OPENAI_API_KEY is not set",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    emitDescribeRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "OPENAI_API_KEY is not set",
      },
    };
  }

  if (!systemPrompt) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.config_missing",
      message: `${IMAGE_DESCRIBER_ID} is not set`,
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    emitDescribeRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: `${IMAGE_DESCRIBER_ID} is not set`,
      },
    };
  }
  promptTemplateVersion = resolvePromptTemplateVersion({
    route: "describe-image",
    prompts: [systemPrompt],
  });
  runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "describe-image",
    promptTemplateVersion,
    policySchemaVersion: safetyPolicySchemaVersion,
    controlPlanePolicyVersion: safetyPolicyVersion,
  });

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.validation_failed",
      message: "imageUrl is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "REQUEST_INVALID",
    });
    emitDescribeRouteTelemetry({
      statusCode: 400,
      machineOutcome,
    });
    return {
      ok: false,
      status: 400,
      payload: {
        ...machineOutcome,
        error: "imageUrl is required",
      },
    };
  }

  try {
    const normalizedImageUrl = imageUrl.trim();
    const imageProbe = await probeImageUrlForDescribe(normalizedImageUrl);
    if (!imageProbe.ok) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.image_describe.validation_failed",
        message: imageProbe.message,
        statusCode: imageProbe.statusCode,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          detail: imageProbe.detail,
        },
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "route_error",
        reasonCode: "REQUEST_INVALID",
      });
      emitDescribeRouteTelemetry({
        statusCode: imageProbe.statusCode,
        machineOutcome,
      });
      return {
        ok: false,
        status: imageProbe.statusCode,
        payload: {
          ...machineOutcome,
          error: imageProbe.message,
          detail: imageProbe.detail,
        },
      };
    }
    const preflightResult = await runImageSafetyPreflight({
      enabled: safetyImagePreflightEnabled && safetyPolicyDocument.input.image_preflight.enabled,
      imageUrl: normalizedImageUrl,
      policyDocument: safetyPolicyDocument,
      environment: safetyEnvironment,
      failMode: safetyImagePreflightFailMode,
    });
    if (preflightResult.outcome === "refusal") {
      emitDescribeSafetyTelemetry({
        routeLabel,
        outcome: "refusal",
        fallbackUsed: false,
        debugReason: preflightResult.classifierUnavailable
          ? "image_preflight_classifier_unavailable"
          : `image_preflight_block_${preflightResult.matchedFamily ?? "unknown"}`,
        debugEnabled: safetyDebugEnabled,
        policyVersion: safetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion,
        promptTemplateVersion,
        runtimeScopeKey,
        profileId: safetyTelemetryProfileId,
        category:
          preflightResult.matchedFamily === "sexual"
            ? "sexual_explicit"
            : preflightResult.matchedFamily === "violence"
              ? "violence_explicit"
              : preflightResult.matchedFamily === "self_harm"
                ? "self_harm_explicit"
                : preflightResult.matchedFamily === "hate"
                  ? "hate_explicit"
                  : null,
        decisionAction: preflightResult.matchedAction,
        decisionSource: "profile",
        providerBlocked: true,
        hardFloorViolation: false,
        rollbackTriggered: false,
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "refusal_safety",
        reasonCode: "SAFETY_INPUT_REFUSAL",
      });
      emitDescribeRouteTelemetry({
        statusCode: 200,
        machineOutcome,
        category:
          preflightResult.matchedFamily === "sexual"
            ? "sexual_explicit"
            : preflightResult.matchedFamily === "violence"
              ? "violence_explicit"
              : preflightResult.matchedFamily === "self_harm"
                ? "self_harm_explicit"
                : preflightResult.matchedFamily === "hate"
                  ? "hate_explicit"
                  : null,
        decisionAction: preflightResult.matchedAction,
        decisionSource: "profile",
        providerBlocked: true,
        hardFloorViolation: false,
        rollbackTriggered: false,
      });
      return {
        ok: true,
        payload: {
          description: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
          usage: {},
          ...machineOutcome,
        },
      };
    }

    const primaryVisionModel = (process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL).trim();
    const fallbackVisionModel = (
      process.env.OPENAI_VISION_FALLBACK_MODEL || DEFAULT_FALLBACK_VISION_MODEL
    ).trim();

    const attemptedModels: string[] = [primaryVisionModel];
    let describeAttempt = await requestOpenAiImageDescribeWithRetry({
      apiKey,
      model: primaryVisionModel,
      systemPrompt,
      imageUrl: normalizedImageUrl,
    });

    if (
      !describeAttempt.ok &&
      shouldRetryWithFallbackVisionModel({
        status: describeAttempt.status,
        detail: describeAttempt.detail,
        primaryModel: primaryVisionModel,
        fallbackModel: fallbackVisionModel,
      })
    ) {
      attemptedModels.push(fallbackVisionModel);
      describeAttempt = await requestOpenAiImageDescribeWithRetry({
        apiKey,
        model: fallbackVisionModel,
        systemPrompt,
        imageUrl: normalizedImageUrl,
      });
    }

    if (!describeAttempt.ok) {
      const detail = describeAttempt.detail;
      const modelUsed = describeAttempt.model;
      const safetyRefusal =
        safetyPostProcessMode !== "off" &&
        isStudioAgentSafetyRefusalUpstreamError({
          status: describeAttempt.status,
          detail,
        });
      if (safetyRefusal) {
        emitDescribeSafetyTelemetry({
          routeLabel,
          outcome: "refusal",
          fallbackUsed: false,
          debugReason: "upstream_safety_refusal",
          debugEnabled: safetyDebugEnabled,
          policyVersion: safetyPolicyVersion,
          policySchemaVersion: safetyPolicySchemaVersion,
          promptTemplateVersion,
          runtimeScopeKey,
          profileId: safetyTelemetryProfileId,
          category: null,
          decisionAction: "refuse",
          decisionSource: null,
          providerBlocked: true,
          hardFloorViolation: false,
          rollbackTriggered: false,
        });
        const machineOutcome = buildAgentMachineOutcome({
          outcomeClass: "refusal_model",
          reasonCode: "PROVIDER_SAFETY_REFUSAL",
        });
        emitDescribeRouteTelemetry({
          statusCode: 200,
          machineOutcome,
          category: null,
          decisionAction: "refuse",
          decisionSource: null,
          providerBlocked: true,
          hardFloorViolation: false,
          rollbackTriggered: false,
        });
        return {
          ok: true,
          payload: {
            description: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
            usage: {},
            ...machineOutcome,
          },
        };
      }
      const providerError = resolveProviderErrorHandling({
        status: describeAttempt.status,
        detail,
        normalizationMode: safetyProviderErrorMode,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: resolveImageDescribeUpstreamFailureSource(describeAttempt.status),
        message: "Upstream error",
        statusCode: describeAttempt.status,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          detail,
          model: modelUsed,
          attempted_models: attemptedModels,
          failure_class: providerError.failureClass,
          user_lane_fallback: providerError.failureResolution === "assistant_fallback",
        },
      });
      if (providerError.failureResolution === "assistant_fallback") {
        const fallbackReason = resolveStudioAgentFallbackReasonLabel({
          status: describeAttempt.status,
          detail,
        });
        emitDescribeFallbackTelemetry({
          routeLabel,
          failureClass: providerError.failureClass,
          detail,
          fallbackReason,
          policyVersion: safetyPolicyVersion,
          policySchemaVersion: safetyPolicySchemaVersion,
          promptTemplateVersion,
          runtimeScopeKey,
          profileId: safetyTelemetryProfileId,
        });
        const machineOutcome = buildAgentMachineOutcome({
          outcomeClass: "fallback_infra",
          reasonCode: resolveInfraFallbackReasonCode({
            status: describeAttempt.status,
            detail,
          }),
        });
        emitDescribeRouteTelemetry({
          statusCode: 200,
          machineOutcome,
          fallbackReason,
        });
        return {
          ok: true,
          payload: {
            description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
            fallback_reason: fallbackReason,
            usage: {},
            ...machineOutcome,
          },
        };
      }
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: "UPSTREAM_ERROR",
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        status: describeAttempt.status,
        detail,
      });
      emitDescribeRouteTelemetry({
        statusCode: describeAttempt.status,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: false,
        status: describeAttempt.status,
        payload: {
          ...machineOutcome,
          error: "Upstream error",
          ...(providerError.detailForClient ? { detail: providerError.detailForClient } : {}),
          fallback_reason: fallbackReason,
          ...(describeAttempt.status < 500 && modelUsed ? { model: modelUsed } : {}),
        },
      };
    }

    const data = describeAttempt.data;
    const description = extractImageDescriptionText(data);
    const usage =
      data.usage && typeof data.usage === "object" && !Array.isArray(data.usage)
        ? (data.usage as Record<string, unknown>)
        : {};
    const promptTokens = usage.prompt_tokens;
    const completionTokens = usage.completion_tokens;

    if (!description) {
      const providerError = resolveProviderErrorHandling({
        status: 502,
        detail: "No description returned",
        normalizationMode: safetyProviderErrorMode,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.image_describe.empty_response",
        message: "No description returned",
        statusCode: 502,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          failure_class: providerError.failureClass,
          user_lane_fallback: true,
        },
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        status: 502,
        detail: "No description returned",
      });
      emitDescribeFallbackTelemetry({
        routeLabel,
        failureClass: providerError.failureClass,
        detail: "No description returned",
        fallbackReason,
        policyVersion: safetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion,
        promptTemplateVersion,
        runtimeScopeKey,
        profileId: safetyTelemetryProfileId,
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "fallback_infra",
        reasonCode: resolveInfraFallbackReasonCode({
          status: 502,
          detail: "No description returned",
        }),
      });
      emitDescribeRouteTelemetry({
        statusCode: 200,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: true,
        payload: {
          description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
          fallback_reason: fallbackReason,
          usage: {},
          ...machineOutcome,
        },
      };
    }

    const safetyPostProcessResult = await postProcessStudioAgentSafetyText({
      text: description,
      route: "describe-image",
      flow: "describe_image",
      source: "describe_output",
      mode: safetyPostProcessMode,
      debug: safetyDebugEnabled,
      profileId: safetyProfileId,
      environment: safetyEnvironment,
      devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
      modality: "image",
      policyDocument: safetyPolicyDocument,
    });
    let rollbackTriggered = false;
    if (safetyPostProcessResult.decision?.hardFloorViolation) {
      try {
        const rollbackResult = await maybeTriggerSafetyIncidentAutoRollback({
          environment: safetyEnvironment,
          autoRollbackEnabled: safetyAutoRollbackEnabled,
          hardFloorViolation: true,
          actorUserId: user.id,
          actorEmail: user.email ?? null,
          source: "describe_image_runtime_hard_floor",
          reason: "Describe-image runtime hard-floor incident.",
        });
        rollbackTriggered = rollbackResult.rollbackTriggered;
      } catch (error) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.image_describe.safety_auto_rollback_failed",
          message: "Safety auto rollback execution failed",
          statusCode: 500,
          userId: user.id,
          userEmail: user.email ?? null,
          metadata: {
            detail: String(error),
          },
        });
      }
    }
    emitDescribeSafetyTelemetry({
      routeLabel,
      outcome: safetyPostProcessResult.outcome,
      fallbackUsed: safetyPostProcessResult.fallbackUsed,
      debugReason: safetyPostProcessResult.debugReason,
      debugEnabled: safetyDebugEnabled,
      policyVersion: safetyPolicyVersion,
      policySchemaVersion: safetyPolicySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      category: safetyPostProcessResult.decision?.category ?? null,
      decisionAction: safetyPostProcessResult.decision?.action ?? null,
      decisionSource: safetyPostProcessResult.decision?.source ?? null,
      providerBlocked: false,
      hardFloorViolation: safetyPostProcessResult.decision?.hardFloorViolation ?? false,
      rollbackTriggered,
    });

    const safeDescription =
      safetyPostProcessResult.outcome === "pass"
        ? description
        : safetyPostProcessResult.outcome === "rewritten"
          ? safetyPostProcessResult.text
          : STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE;
    const outputMachineOutcome =
      safetyPostProcessResult.outcome === "refusal"
        ? buildAgentMachineOutcome({
            outcomeClass: "refusal_safety",
            reasonCode: "SAFETY_OUTPUT_REFUSAL",
          })
        : buildAgentMachineOutcome({
            outcomeClass: "success_prompt",
            reasonCode: "SUCCESS_PROMPT",
          });
    emitDescribeRouteTelemetry({
      statusCode: 200,
      machineOutcome: outputMachineOutcome,
      category: safetyPostProcessResult.decision?.category ?? null,
      decisionAction: safetyPostProcessResult.decision?.action ?? null,
      decisionSource: safetyPostProcessResult.decision?.source ?? null,
      providerBlocked: false,
      hardFloorViolation: safetyPostProcessResult.decision?.hardFloorViolation ?? false,
      rollbackTriggered,
    });

    return {
      ok: true,
      payload: {
        description: safeDescription,
        usage: {
          inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
          outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        },
        ...outputMachineOutcome,
      },
    };
  } catch (error) {
    const detail = String(error);
    const providerError = resolveProviderErrorHandling({
      detail,
      normalizationMode: safetyProviderErrorMode,
    });
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.transport_error",
      message: "Image description failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        detail,
        failure_class: providerError.failureClass,
        user_lane_fallback: providerError.failureResolution === "assistant_fallback",
      },
    });
    if (providerError.failureResolution === "assistant_fallback") {
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        detail,
      });
      emitDescribeFallbackTelemetry({
        routeLabel,
        failureClass: providerError.failureClass,
        detail,
        fallbackReason,
        policyVersion: safetyPolicyVersion,
        policySchemaVersion: safetyPolicySchemaVersion,
        promptTemplateVersion,
        runtimeScopeKey,
        profileId: safetyTelemetryProfileId,
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "fallback_infra",
        reasonCode: resolveInfraFallbackReasonCode({ detail }),
      });
      emitDescribeRouteTelemetry({
        statusCode: 200,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: true,
        payload: {
          description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
          fallback_reason: fallbackReason,
          usage: {},
          ...machineOutcome,
        },
      };
    }
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "upstream_error",
      reasonCode: "UPSTREAM_ERROR",
    });
    const fallbackReason = resolveStudioAgentFallbackReasonLabel({
      detail,
    });
    emitDescribeRouteTelemetry({
      statusCode: 500,
      machineOutcome,
      fallbackReason,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "Image description failed",
        fallback_reason: fallbackReason,
      },
    };
  }
};
