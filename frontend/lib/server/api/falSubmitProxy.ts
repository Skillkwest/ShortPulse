/**
 * Shared charged submit proxy for Fal generation endpoints.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "./generationBilling";
import { resolveRuntimeSafetyProfile } from "./agentSafetyPolicyControlPlane";
import { logGenerationFailure } from "./appErrorLogs";
import { ensureSubmittedGenerationRecord } from "./generationSubmitPersistence";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import { evaluateUserGenerationAdmission } from "./generationAdmission/generationAdmissionService";
import { evaluateGenerationAdmissionDecision } from "./generationAdmission/generationAdmissionPolicy";
import type { SubmitTarget } from "../falIntegration/contracts";
import {
  countUserQueuedGenerationSubmits,
  enqueueGenerationSubmit,
} from "./generationQueue/service";
import {
  resolveGenerationAspectFromPayload,
  resolveGenerationModeFromPayload,
  resolveGenerationPromptFromPayload,
  resolveGenerationResolutionFromPayload,
  readGenerationDurationSeconds,
} from "./generationQueue/metadata";
import { readActiveProviderCapacitySnapshot } from "./generationQueue/activeProviderCapacity";
import { resolveWebhookCallbackUrl, withWebhookTargets } from "./falSubmitTargeting";
import { dispatchProviderSubmit } from "../providerIntegration/submitProviderDispatcher";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import { getModelPayloadValidationSpec } from "../../model-runtime/modelCatalog";
import { evaluateFalPayloadContractForModel } from "./falPayloadValidation";
import { runStudioAgentSafetyInputPrecheck } from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import { resolveSafetyEnvironment } from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { enforceServerGenerationSafetyPayload } from "../../../features/agent-runtime/safetyPolicy/generationSafetyPolicy";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";

type FalSubmitConfig = {
  modelId: string;
  provider?: string;
  submitUrl?: string;
  submitTargets?: SubmitTarget[];
  skipBilling?: boolean;
  routeLabel: string;
  timeoutMs?: number;
  validatePayload?: (payload: Record<string, unknown>) =>
    | {
        valid: true;
        projectedPayload: Record<string, unknown>;
      }
    | {
        valid: false;
        code?: string;
        error: string;
        detail?: unknown;
      }
    | {
        code?: string;
        error: string;
        detail?: unknown;
      }
    | null;
};

type JsonValue = Record<string, unknown>;

const buildAdmissionLimitPayload = ({
  retryAfterSeconds,
  snapshot,
}: {
  retryAfterSeconds: number;
  snapshot: {
    globalMax: number;
    globalActive: number;
    tier: string;
    tierMax: number;
    tierActive: number;
  };
}) => ({
  error: "Too many active generations. Please retry shortly.",
  code: "GENERATION_ADMISSION_LIMIT",
  retryAfterSeconds,
  limits: {
    globalMax: snapshot.globalMax,
    globalActive: snapshot.globalActive,
    tier: snapshot.tier,
    tierMax: snapshot.tierMax,
    tierActive: snapshot.tierActive,
  },
});

const buildAdmissionUnavailablePayload = (retryAfterSeconds: number) => ({
  error: "Generation admission is temporarily unavailable. Please retry shortly.",
  code: "GENERATION_ADMISSION_UNAVAILABLE",
  retryAfterSeconds,
});

const buildQueuedSubmitPayload = ({
  sourceRef,
  generationId,
}: {
  sourceRef: string;
  generationId: string;
}) => ({
  status: "queued",
  code: "GENERATION_QUEUED",
  sourceRef,
  generationId,
  pollAfterMs: 2000,
});

const applyRewrittenPromptToPayload = ({
  payload,
  rewrittenPrompt,
}: {
  payload: Record<string, unknown>;
  rewrittenPrompt: string;
}): void => {
  if (typeof payload.prompt === "string") {
    payload.prompt = rewrittenPrompt;
  } else if (typeof payload.input === "string") {
    payload.input = rewrittenPrompt;
  } else if (typeof payload.description === "string") {
    payload.description = rewrittenPrompt;
  } else {
    payload.prompt = rewrittenPrompt;
  }
};

/**
 * Builds a Next.js API handler that debits credits before forwarding to Fal.
 */
export const createFalSubmitHandler = ({
  modelId,
  provider = "fal",
  submitUrl,
  submitTargets,
  skipBilling = false,
  routeLabel,
  timeoutMs = 20000,
  validatePayload,
}: FalSubmitConfig) => {
  const evaluateSharedPayloadContract = evaluateFalPayloadContractForModel(modelId, {
    projectAllowedTopLevelFields: true,
    enforceAllowedTopLevelFields: true,
  });

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const providerKey = provider.trim().toLowerCase();
    let apiKey: string;
    try {
      apiKey = readProviderApiKey(providerKey);
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.config_missing",
        message: String(error),
        statusCode: 500,
        metadata: { model_id: modelId, provider: providerKey },
      });
      return res.status(500).json({ error: String(error) });
    }

    const rawPayload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    let payload = rawPayload;
    const generationPrecheckEnabled =
      process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED === "true";
    const safetyProfile = await resolveRuntimeSafetyProfile({
      envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
    });
    const safetyPolicyDocument = resolveSafetyPolicyDocument({
      activePolicy: safetyProfile.activePolicy,
      profileId: safetyProfile.profileId,
    });
    const generationMode = resolveGenerationModeFromPayload(modelId, payload);
    const promptForPolicy = resolveGenerationPromptFromPayload(routeLabel, payload);
    const promptPrecheck = runStudioAgentSafetyInputPrecheck({
      enabled: generationPrecheckEnabled,
      messages: [{ role: "user", content: promptForPolicy }],
      context: {},
      canonicalPrompt: null,
      modality: generationMode,
      profileId: safetyProfile.profileId,
      environment: resolveSafetyEnvironment(process.env.NODE_ENV),
      devAbsoluteZeroEnabled: process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true",
      policyDocument: safetyPolicyDocument,
    });
    if (promptPrecheck.outcome === "refusal") {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.safety_blocked",
        message: "Generation submit blocked by pre-provider safety policy.",
        statusCode: 422,
        metadata: {
          model_id: modelId,
          policy_version: safetyProfile.policyVersion,
          profile_id: safetyProfile.profileId,
          category: promptPrecheck.decision?.category ?? null,
          decision_action: promptPrecheck.decision?.action ?? "refuse",
          refusal_field: promptPrecheck.scopeTelemetry.refusalField,
          rewritten_fields: promptPrecheck.scopeTelemetry.rewrittenFields,
          non_blocking_signal_count: promptPrecheck.scopeTelemetry.nonBlockingSignalCount,
        },
      });
      return res.status(422).json({
        error: "Generation blocked by safety policy.",
        code: "GENERATION_SAFETY_BLOCKED",
      });
    }
    if (promptPrecheck.outcome === "rewritten") {
      const rewrittenPrompt = promptPrecheck.messages[0]?.content ?? promptForPolicy;
      applyRewrittenPromptToPayload({
        payload,
        rewrittenPrompt,
      });
    }
    const contractValidation = evaluateSharedPayloadContract(payload);
    if (!contractValidation.valid) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.validation_failed",
        message: contractValidation.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          code: contractValidation.code,
          detail: contractValidation.detail ?? null,
        },
      });
      return res.status(400).json({
        error: contractValidation.error,
        code: contractValidation.code,
        detail: contractValidation.detail ?? null,
      });
    }
    payload = contractValidation.projectedPayload;

    const payloadValidation = validatePayload?.(payload);
    if (payloadValidation && "valid" in payloadValidation && payloadValidation.valid) {
      payload = payloadValidation.projectedPayload;
    } else if (payloadValidation) {
      const validationCode = payloadValidation.code ?? "GENERATION_PAYLOAD_CONTRACT_VIOLATION";
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.validation_failed",
        message: payloadValidation.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          code: validationCode,
          detail: payloadValidation.detail ?? null,
        },
      });
      return res.status(400).json({
        error: payloadValidation.error,
        code: validationCode,
        detail: payloadValidation.detail ?? null,
      });
    }
    const generationSpec = getModelPayloadValidationSpec(modelId);
    const safetyEnforcement = enforceServerGenerationSafetyPayload({
      payload,
      modelId,
      modality: generationMode === "video" ? "video" : "image",
      spec: generationSpec,
      policyDocument: safetyPolicyDocument,
    });
    if (safetyEnforcement.enforced) {
      console.info(
        "[fal-submit][safety-input-precheck]",
        JSON.stringify({
          route: routeLabel,
          model_id: modelId,
          safety_stage: "input_precheck",
          safety_outcome: promptPrecheck.outcome,
          policy_version: safetyProfile.policyVersion,
          profile_id: safetyProfile.profileId,
          category: promptPrecheck.decision?.category ?? null,
          decision_action: promptPrecheck.decision?.action ?? null,
          refusal_field: promptPrecheck.scopeTelemetry.refusalField,
          rewritten_fields: promptPrecheck.scopeTelemetry.rewrittenFields,
          non_blocking_signal_count: promptPrecheck.scopeTelemetry.nonBlockingSignalCount,
          generation_safety_level: safetyEnforcement.enforcedLevel,
        })
      );
    }
    const charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload,
      reason: `${routeLabel} generation`,
      skipBilling,
    });
    if (!charge) return;
    const runtimeFlags = readFalRuntimeFlags();
    if (runtimeFlags.admission.mode === "enforce" && charge.billingMode !== "reservation") {
      const retryAfterSeconds = runtimeFlags.admission.retryAfterSeconds;
      await charge.refund("Auto-refund: admission unavailable without reservation mode.", {
        billing_mode: charge.billingMode,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.admission_unavailable",
        message: "Generation admission unavailable while reservation mode is degraded.",
        statusCode: 503,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          admission_mode: runtimeFlags.admission.mode,
          billing_mode: charge.billingMode,
        },
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json(buildAdmissionUnavailablePayload(retryAfterSeconds));
    }

    try {
      const evaluateQueueAdmissionDecision = async () => {
        const capacitySnapshot = await readActiveProviderCapacitySnapshot({
          userId: charge.userId,
          modelId,
          staleIgnoreMinAgeSeconds: runtimeFlags.queueMaxWaitSeconds,
          orphanGraceSeconds: Math.max(60, runtimeFlags.queueBaseBackoffSeconds * 12),
        });
        if (capacitySnapshot.staleIgnoredGlobal > 0) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.capacity_stale_ignored",
            message:
              "Ignored stale provider-attached reservations while evaluating submit admission.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              tier: capacitySnapshot.tier,
              stale_ignored_global: capacitySnapshot.staleIgnoredGlobal,
              stale_ignored_tier: capacitySnapshot.staleIgnoredTier,
            },
          });
        }
        return evaluateGenerationAdmissionDecision({
          mode: runtimeFlags.admission.mode,
          retryAfterSeconds: runtimeFlags.admission.retryAfterSeconds,
          snapshot: {
            // Admission snapshot is computed as post-submit state.
            globalActive: capacitySnapshot.globalActive + 1,
            globalMax: runtimeFlags.admission.globalMax,
            tier: capacitySnapshot.tier,
            tierActive: capacitySnapshot.tierActive + 1,
            tierMax: runtimeFlags.admission.tierLimits[capacitySnapshot.tier],
          },
        });
      };

      const admissionDecision = runtimeFlags.queueEnabled
        ? await evaluateQueueAdmissionDecision()
        : await evaluateUserGenerationAdmission({
            userId: charge.userId,
            modelId,
            config: runtimeFlags.admission,
          });

      if (admissionDecision.wouldLimit) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.api.fal_submit.admission_limited",
          message: "Generation admission limit reached.",
          statusCode: 429,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            mode: admissionDecision.mode,
            reason: admissionDecision.reason,
            global_active: admissionDecision.snapshot.globalActive,
            global_max: admissionDecision.snapshot.globalMax,
            tier: admissionDecision.snapshot.tier,
            tier_active: admissionDecision.snapshot.tierActive,
            tier_max: admissionDecision.snapshot.tierMax,
          },
        });
      }

      if (runtimeFlags.queueEnabled && admissionDecision.enforced) {
        const queueDepth = await countUserQueuedGenerationSubmits(charge.userId);
        if (queueDepth >= runtimeFlags.queueMaxPerUser) {
          await charge.refund("Auto-release: generation queue depth limit reached.", {
            reason: "queue_depth_limit",
            queue_depth: queueDepth,
            queue_max: runtimeFlags.queueMaxPerUser,
            global_active: admissionDecision.snapshot.globalActive,
            global_max: admissionDecision.snapshot.globalMax,
            tier: admissionDecision.snapshot.tier,
            tier_active: admissionDecision.snapshot.tierActive,
            tier_max: admissionDecision.snapshot.tierMax,
          });
          res.setHeader("Retry-After", String(admissionDecision.retryAfterSeconds));
          return res.status(429).json(
            buildAdmissionLimitPayload({
              retryAfterSeconds: admissionDecision.retryAfterSeconds,
              snapshot: {
                globalMax: admissionDecision.snapshot.globalMax,
                globalActive: admissionDecision.snapshot.globalActive,
                tier: admissionDecision.snapshot.tier,
                tierMax: admissionDecision.snapshot.tierMax,
                tierActive: admissionDecision.snapshot.tierActive,
              },
            })
          );
        }

        const enqueueResult = await enqueueGenerationSubmit({
          userId: charge.userId,
          sourceRef: charge.sourceRef,
          provider: providerKey,
          modelId,
          promptText: resolveGenerationPromptFromPayload(routeLabel, payload),
          mode: resolveGenerationModeFromPayload(modelId, payload),
          aspect: resolveGenerationAspectFromPayload(payload),
          durationSeconds: readGenerationDurationSeconds(payload),
          resolution: resolveGenerationResolutionFromPayload(payload),
          submitRoute: req.url ?? routeLabel,
          submitPayload: payload as JsonValue,
          timeoutMs,
          metadata: {
            source_ref: charge.sourceRef,
            route: req.url ?? null,
            route_label: routeLabel,
            queue_reason: admissionDecision.reason,
            queue_snapshot: {
              global_active: admissionDecision.snapshot.globalActive,
              global_max: admissionDecision.snapshot.globalMax,
              tier: admissionDecision.snapshot.tier,
              tier_active: admissionDecision.snapshot.tierActive,
              tier_max: admissionDecision.snapshot.tierMax,
            },
          },
        });

        if (!enqueueResult.generationId || enqueueResult.status === "failed") {
          await charge.refund("Auto-release: generation enqueue failed.", {
            reason: "queue_enqueue_failed",
            enqueue_status: enqueueResult.status,
            enqueue_message: enqueueResult.message,
          });
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.queue_enqueue_failed",
            message: "Failed to enqueue over-cap generation.",
            statusCode: 500,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              source_ref: charge.sourceRef,
              enqueue_status: enqueueResult.status,
              enqueue_message: enqueueResult.message,
            },
          });
          return res.status(500).json({ error: "Failed to queue generation. Please retry." });
        }

        const queuedSourceRef = enqueueResult.sourceRef || charge.sourceRef;
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.api.fal_submit.queued",
          message: "Generation accepted into submit queue.",
          statusCode: 202,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            source_ref: queuedSourceRef,
            generation_id: enqueueResult.generationId,
            queue_status: enqueueResult.queueStatus,
            admission_reason: admissionDecision.reason,
            global_active: admissionDecision.snapshot.globalActive,
            global_max: admissionDecision.snapshot.globalMax,
            tier: admissionDecision.snapshot.tier,
            tier_active: admissionDecision.snapshot.tierActive,
            tier_max: admissionDecision.snapshot.tierMax,
            queue_depth: queueDepth + (enqueueResult.status === "queued" ? 1 : 0),
            queue_max: runtimeFlags.queueMaxPerUser,
          },
        });

        return res.status(202).json(
          buildQueuedSubmitPayload({
            sourceRef: queuedSourceRef,
            generationId: enqueueResult.generationId,
          })
        );
      }

      if (admissionDecision.enforced) {
        await charge.refund("Auto-release: generation admission limited.", {
          reason: admissionDecision.reason,
          global_active: admissionDecision.snapshot.globalActive,
          global_max: admissionDecision.snapshot.globalMax,
          tier: admissionDecision.snapshot.tier,
          tier_active: admissionDecision.snapshot.tierActive,
          tier_max: admissionDecision.snapshot.tierMax,
        });
        res.setHeader("Retry-After", String(admissionDecision.retryAfterSeconds));
        return res.status(429).json(
          buildAdmissionLimitPayload({
            retryAfterSeconds: admissionDecision.retryAfterSeconds,
            snapshot: {
              globalMax: admissionDecision.snapshot.globalMax,
              globalActive: admissionDecision.snapshot.globalActive,
              tier: admissionDecision.snapshot.tier,
              tierMax: admissionDecision.snapshot.tierMax,
              tierActive: admissionDecision.snapshot.tierActive,
            },
          })
        );
      }
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.admission_check_failed",
        message: "Generation admission check failed; submit proceeded fail-open.",
        statusCode: 500,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          detail: String(error),
        },
      });
    }

    const resolvedSubmitTargets: SubmitTarget[] =
      submitTargets && submitTargets.length ? submitTargets : submitUrl ? [{ submitUrl }] : [];
    if (!resolvedSubmitTargets.length) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.config_missing_target",
        message: "No Fal submit target configured for route",
        statusCode: 500,
        metadata: { model_id: modelId },
      });
      return res.status(500).json({ error: "No Fal submit target configured for route" });
    }
    const webhookCallbackUrl = resolveWebhookCallbackUrl(runtimeFlags, {
      userId: charge.userId,
      modelId,
    });
    const resolvedTargetsWithWebhook = withWebhookTargets(
      resolvedSubmitTargets,
      webhookCallbackUrl
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstreamResult = await dispatchProviderSubmit({
        provider: providerKey,
        modelId,
        targets: resolvedTargetsWithWebhook,
        payload,
        apiKey,
        signal: controller.signal,
        requestStartTimeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
      });
      const upstream = upstreamResult.response;
      const data = upstreamResult.data;

      let persistedGenerationId: string | null = null;

      if (!upstream.ok) {
        await charge.refund("Auto-refund: Fal submit rejected.", {
          upstream_status: upstream.status,
          upstream_error: data,
          upstream_target_url: upstreamResult.targetUrl,
        });
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.fal_submit.upstream_error",
          message:
            (typeof data.error === "string" && data.error) ||
            (typeof data.message === "string" && data.message) ||
            `${routeLabel} submit rejected`,
          statusCode: upstream.status,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            upstream_payload: data,
            upstream_target_url: upstreamResult.targetUrl,
            upstream_target_index: upstreamResult.targetIndex,
          },
        });
      } else {
        const providerRequestId = upstreamResult.providerRequestId;
        if (!providerRequestId) {
          await charge.refund("Auto-refund: Fal submit missing request id.", {
            upstream_status: upstream.status,
            upstream_payload: data,
          });
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.missing_request_id",
            message: `${routeLabel} submit response did not include request_id`,
            statusCode: 502,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              upstream_payload: data,
            },
          });
          return res.status(502).json({
            error: `${routeLabel} submit response did not include request_id`,
          });
        }
        await charge.markSubmitted(providerRequestId, {
          route: req.url ?? null,
          upstream_status: upstream.status,
          upstream_target_url: upstreamResult.targetUrl,
          upstream_target_index: upstreamResult.targetIndex,
          webhook_callback_url: webhookCallbackUrl,
          webhook_registered: Boolean(webhookCallbackUrl),
        });
        const persistenceResult = await ensureSubmittedGenerationRecord({
          userId: charge.userId,
          modelId,
          routeLabel,
          payload,
          providerRequestId,
          sourceRef: charge.sourceRef,
          submitTargetUrl: upstreamResult.targetUrl,
          submitTargetIndex: upstreamResult.targetIndex,
        });
        if (!persistenceResult.ok) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.persist_generation_failed",
            message: "Failed to persist ai_generations row after submit.",
            statusCode: 500,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              provider_request_id: providerRequestId,
              source_ref: charge.sourceRef,
              persistence_error: persistenceResult.error,
            },
          });
        } else {
          persistedGenerationId = persistenceResult.generationId ?? null;
        }
      }
      const responsePayload = {
        ...data,
        ...(upstreamResult.providerRequestId &&
        typeof data.request_id !== "string" &&
        typeof data.requestId !== "string"
          ? { request_id: upstreamResult.providerRequestId }
          : {}),
        ...(persistedGenerationId != null ? { generationId: persistedGenerationId } : {}),
      };
      return res.status(upstream.status).json(responsePayload);
    } catch (error) {
      await charge.refund("Auto-refund: Fal submit transport failure.", {
        error: String(error),
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.transport_error",
        message: `${routeLabel} submit failed`,
        statusCode: 500,
        userId: charge.userId,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        metadata: {
          model_id: modelId,
          detail: String(error),
        },
      });
      return res.status(500).json({ error: `${routeLabel} submit failed`, detail: String(error) });
    } finally {
      clearTimeout(timeoutId);
    }
  };
};
