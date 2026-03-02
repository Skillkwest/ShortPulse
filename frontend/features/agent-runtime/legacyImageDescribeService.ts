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
import { resolveSafetyEnvironment } from "./safetyPolicy/decisionEngine";
import { maybeTriggerSafetyIncidentAutoRollback } from "./safetyPolicy/incidentAutoRollback";
import {
  resolveProviderErrorHandling,
  resolveProviderErrorNormalizationMode,
} from "./safetyPolicy/providerErrorPolicy";
import { postProcessStudioAgentSafetyText } from "./studioAgentSafetyPostProcess";
import {
  isStudioAgentSafetyRefusalUpstreamError,
  STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
} from "./studioAgentRouteOutcomes";

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
  profileId: "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero" | null;
  category: "safe" | "sexual_suggestive" | "sexual_explicit" | null;
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
}: {
  routeLabel: string;
  failureClass: string;
  detail: string;
}) => {
  console.info(
    "[describe-image][fallback]",
    JSON.stringify({
      route: routeLabel,
      failure_class: failureClass,
      detail,
    })
  );
};

type LegacyImageDescribeSuccess = {
  ok: true;
  payload: {
    description: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

type LegacyImageDescribeFailure = {
  ok: false;
  status: number;
  payload: {
    error: string;
    detail?: string;
    model?: string;
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
  const safetyPostProcessEnabled = process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED !== "false";
  const safetyDebugEnabled = process.env.STUDIO_AGENT_SAFETY_DEBUG === "true";
  const safetyProfile = await resolveRuntimeSafetyProfile({
    envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
  });
  const safetyProfileId = safetyProfile.profileId;
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const safetyProviderErrorMode = resolveProviderErrorNormalizationMode(
    process.env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
  );
  const safetyAutoRollbackEnabled = process.env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true";
  const safetyPolicyVersion = safetyProfile.policyVersion;
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;

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
    return { ok: false, status: 500, payload: { error: "OPENAI_API_KEY is not set" } };
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
    return { ok: false, status: 500, payload: { error: `${IMAGE_DESCRIBER_ID} is not set` } };
  }

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
    return { ok: false, status: 400, payload: { error: "imageUrl is required" } };
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
      return {
        ok: false,
        status: imageProbe.statusCode,
        payload: { error: imageProbe.message, detail: imageProbe.detail },
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
        safetyPostProcessEnabled &&
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
          profileId: safetyTelemetryProfileId,
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
        emitDescribeFallbackTelemetry({
          routeLabel,
          failureClass: providerError.failureClass,
          detail,
        });
        return {
          ok: true,
          payload: {
            description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
            usage: {},
          },
        };
      }
      return {
        ok: false,
        status: describeAttempt.status,
        payload: {
          error: "Upstream error",
          ...(providerError.detailForClient ? { detail: providerError.detailForClient } : {}),
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
      emitDescribeFallbackTelemetry({
        routeLabel,
        failureClass: providerError.failureClass,
        detail: "No description returned",
      });
      return {
        ok: true,
        payload: {
          description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
          usage: {},
        },
      };
    }

    const safetyPostProcessResult = await postProcessStudioAgentSafetyText({
      text: description,
      route: "describe-image",
      flow: "describe_image",
      source: "describe_output",
      enabled: safetyPostProcessEnabled,
      debug: safetyDebugEnabled,
      profileId: safetyProfileId,
      environment: safetyEnvironment,
      devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
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

    return {
      ok: true,
      payload: {
        description: safeDescription,
        usage: {
          inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
          outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        },
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
      emitDescribeFallbackTelemetry({
        routeLabel,
        failureClass: providerError.failureClass,
        detail,
      });
      return {
        ok: true,
        payload: {
          description: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
          usage: {},
        },
      };
    }
    return {
      ok: false,
      status: 500,
      payload: { error: "Image description failed" },
    };
  }
};
