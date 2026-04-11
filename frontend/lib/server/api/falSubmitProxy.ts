/**
 * Shared charged submit proxy for Fal generation endpoints.
 */
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import { chargeGenerationRequest } from "./generationBilling";
import { resolveRuntimeSafetyProfile } from "./agentSafetyPolicyControlPlane";
import { logGenerationFailure } from "./appErrorLogs";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import {
  hasFreshLocalGenerationWorkerHeartbeat,
  isLocalDevGenerationWorkerRequired,
} from "../generationControlPlane/localWorkerHeartbeat";
import { requestGenerationControlPlaneWake } from "../generationControlPlane/controlPlaneWake";
import { evaluateGenerationAdmissionDecision } from "./generationAdmission/generationAdmissionPolicy";
import { evaluateScopedGenerationAdmission } from "./generationAdmission/generationAdmissionService";
import { shouldEmitRecoveryBackpressureTelemetry } from "./generationAdmission/recoveryBackpressure";
import type { SubmitTarget } from "../falIntegration/contracts";
import {
  countUserQueuedGenerationSubmits,
  enqueueGenerationSubmit,
} from "./generationQueue/service";
import { upsertGenerationProjection } from "./generationProjection";
import { resolveWebhookCallbackUrl, withWebhookTargets } from "./falSubmitTargeting";
import {
  resolveGenerationAspectFromPayload,
  resolveGenerationModeFromPayload,
  resolveGenerationPromptFromPayload,
  resolveGenerationResolutionFromPayload,
  readGenerationDurationSeconds,
} from "./generationQueue/metadata";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import { dispatchProviderSubmit } from "../providerIntegration/submitProviderDispatcher";
import { getModelPayloadValidationSpec } from "../../model-runtime/modelCatalog";
import { evaluateFalPayloadContractForModel } from "./falPayloadValidation";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import { resolveSafetyEnvironment } from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { enforceServerGenerationSafetyPayload } from "../../../features/agent-runtime/safetyPolicy/generationSafetyPolicy";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";
import {
  isVideoGenerationModelId,
  normalizeVideoSubmitIngressPayload,
  wrapQueueSubmitPayloadEnvelope,
} from "./videoSubmitContracts";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { applyAcceptedRunningGenerationTransition } from "./generationAcceptedTransitionService";
import { buildAcceptedRunningGenerationUpdate } from "./generationRequestTransitions";

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

const selectEffectiveAdmissionDecision = ({
  providerDecision,
  userDecision,
}: {
  providerDecision: ReturnType<typeof evaluateGenerationAdmissionDecision> | null;
  userDecision: ReturnType<typeof evaluateGenerationAdmissionDecision>;
}) => {
  if (providerDecision?.enforced) return providerDecision;
  if (userDecision.wouldLimit) return userDecision;
  if (providerDecision?.wouldLimit) return providerDecision;
  return userDecision;
};

const resolveAdmissionScope = ({
  providerDecision,
  admissionDecision,
}: {
  providerDecision: ReturnType<typeof evaluateGenerationAdmissionDecision> | null;
  admissionDecision: ReturnType<typeof evaluateGenerationAdmissionDecision>;
}): "shared_provider" | "per_user" =>
  providerDecision &&
  admissionDecision.snapshot.globalMax === providerDecision.snapshot.globalMax &&
  admissionDecision.snapshot.tierMax === providerDecision.snapshot.tierMax
    ? "shared_provider"
    : "per_user";

const buildAdmissionLimitPayload = ({
  retryAfterSeconds,
  snapshot,
  admissionScope,
  admissionReason,
}: {
  retryAfterSeconds: number;
  snapshot: {
    globalMax: number;
    globalActive: number;
    tier: string;
    tierMax: number;
    tierActive: number;
  };
  admissionScope: "shared_provider" | "per_user";
  admissionReason: string | null;
}) => ({
  error: "Too many active generations. Please retry shortly.",
  code: "GENERATION_ADMISSION_LIMIT",
  retryAfterSeconds,
  admissionScope,
  admissionReason,
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

const buildQueueWorkerUnavailablePayload = (retryAfterSeconds: number) => ({
  error:
    "Generation queue worker is not running in local development. Start `npm run dev:generation-worker` and retry.",
  code: "GENERATION_QUEUE_WORKER_UNAVAILABLE",
  retryAfterSeconds,
});

const buildWorkerOwnedSubmitMisconfiguredPayload = (retryAfterSeconds: number) => ({
  error:
    "Worker-owned generation submit requires the durable submit queue to be enabled. Fix the runtime configuration and retry.",
  code: "GENERATION_WORKER_OWNED_SUBMIT_MISCONFIGURED",
  retryAfterSeconds,
});

const buildQueueRequiredPayload = (retryAfterSeconds: number) => ({
  error:
    "Durable queue-backed generation submit is required for this runtime. Enable the queue and retry.",
  code: "GENERATION_QUEUE_REQUIRED",
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

const isWorkerOwnedSubmitMisconfigured = ({
  queueEnabled,
  workerOwnedSubmitEnabled,
}: {
  queueEnabled: boolean;
  workerOwnedSubmitEnabled: boolean;
}): boolean => workerOwnedSubmitEnabled && !queueEnabled;

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

const asProviderString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveInlineSubmitTargets = ({
  submitTargets,
  submitUrl,
}: {
  submitTargets?: SubmitTarget[];
  submitUrl?: string;
}): SubmitTarget[] => {
  if (Array.isArray(submitTargets) && submitTargets.length > 0) {
    return submitTargets;
  }
  if (typeof submitUrl === "string" && submitUrl.trim().length > 0) {
    return [{ submitUrl: submitUrl.trim() }];
  }
  return [];
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
    if (!(await requireApiUser(req, res))) {
      return;
    }

    const providerKey = provider.trim().toLowerCase();
    try {
      readProviderApiKey(providerKey);
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
    const runtimeFlags = readFalRuntimeFlags();
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
      fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
        sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
        scopedRawValue:
          process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT,
      }),
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
    if (runtimeFlags.videoSubmitCanonicalMode !== "off") {
      const normalizedVideoContract = normalizeVideoSubmitIngressPayload({ modelId, payload });
      if (!normalizedVideoContract.ok) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.fal_submit.video_contract_violation",
          message: normalizedVideoContract.error,
          statusCode: runtimeFlags.videoSubmitCanonicalMode === "on" ? 400 : 200,
          metadata: {
            model_id: modelId,
            code: normalizedVideoContract.code,
            detail: normalizedVideoContract.detail ?? null,
            enforce_mode: runtimeFlags.videoSubmitCanonicalMode,
          },
        });
        if (runtimeFlags.videoSubmitCanonicalMode === "on") {
          return res.status(400).json({
            error: normalizedVideoContract.error,
            code: normalizedVideoContract.code,
            detail: normalizedVideoContract.detail ?? null,
          });
        }
      } else {
        payload = normalizedVideoContract.payload;
        if (normalizedVideoContract.aliasUsage.length) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.video_alias_normalized",
            message: "Normalized video submit alias fields to canonical names.",
            statusCode: 200,
            metadata: {
              model_id: modelId,
              alias_usage: normalizedVideoContract.aliasUsage,
              enforce_mode: runtimeFlags.videoSubmitCanonicalMode,
            },
          });
        }
      }
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
      const evaluateAdmissionForScope = async ({
        scopeUserId,
        globalMax,
      }: {
        scopeUserId?: string | null;
        globalMax: number;
      }) => {
        const { decision, capacitySnapshot, backpressure } =
          await evaluateScopedGenerationAdmission({
            scopeUserId,
            provider: providerKey,
            modelId,
            config: runtimeFlags.admission,
            globalMax,
            staleIgnoreMinAgeSeconds: runtimeFlags.queueMaxWaitSeconds,
            activeGenerationStaleIgnoreMinAgeSeconds: Math.max(
              runtimeFlags.runningExhaustMinAgeSeconds,
              runtimeFlags.providerAttachedReservationCleanupMinAgeSeconds
            ),
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
        if (
          scopeUserId == null &&
          backpressure &&
          shouldEmitRecoveryBackpressureTelemetry({
            actor: "submit",
            provider: providerKey,
            level: backpressure.level,
            effectiveGlobalMax: backpressure.effectiveGlobalMax,
          })
        ) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.recovery_backpressure_applied",
            message: "Applied recovery-lag backpressure to shared-provider admission.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              requested_global_max: backpressure.requestedGlobalMax,
              effective_global_max: backpressure.effectiveGlobalMax,
              reduction: backpressure.reduction,
              backpressure_level: backpressure.level,
              stale_provider_attached_reservations:
                backpressure.signals.staleProviderAttachedReservations,
              stale_recoverable_generations: backpressure.signals.staleRecoverableGenerations,
              recent_queue_wait_timeouts: backpressure.signals.recentQueueWaitTimeouts,
              recent_recovery_p95_ms: backpressure.signals.recentRecoveryP95Ms,
            },
          });
        }
        return decision;
      };

      const sharedProviderDecision = runtimeFlags.admission.sharedProviderEnabled
        ? await evaluateAdmissionForScope({
            scopeUserId: null,
            globalMax: runtimeFlags.admission.sharedProviderGlobalMax,
          })
        : null;
      const userAdmissionDecision = await evaluateAdmissionForScope({
        scopeUserId: charge.userId,
        globalMax: runtimeFlags.admission.globalMax,
      });
      const admissionDecision = selectEffectiveAdmissionDecision({
        providerDecision: sharedProviderDecision,
        userDecision: userAdmissionDecision,
      });
      const admissionScope = resolveAdmissionScope({
        providerDecision: sharedProviderDecision,
        admissionDecision,
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
            admission_scope: admissionScope,
          },
        });
      }

      const queuedSubmitSelected = runtimeFlags.queueEnabled;
      const inlineSubmitTargets = resolveInlineSubmitTargets({ submitTargets, submitUrl });
      const canUseInlineImageSubmit =
        providerKey === "fal" &&
        generationMode === "image" &&
        inlineSubmitTargets.length > 0 &&
        !admissionDecision.wouldLimit;
      const workerOwnedSubmitMisconfigured = isWorkerOwnedSubmitMisconfigured({
        queueEnabled: runtimeFlags.queueEnabled,
        workerOwnedSubmitEnabled: runtimeFlags.workerOwnedSubmitEnabled,
      });

      if (canUseInlineImageSubmit) {
        const webhookCallbackUrl = resolveWebhookCallbackUrl(runtimeFlags, {
          userId: charge.userId,
          modelId,
          requestHeaders: req.headers,
        });
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const dispatchAtIso = new Date().toISOString();
          const preparedTargets = withWebhookTargets(inlineSubmitTargets, webhookCallbackUrl);
          const submitResult = await dispatchProviderSubmit({
            provider: providerKey,
            modelId,
            targets: preparedTargets,
            payload: payload as JsonValue,
            apiKey: readProviderApiKey(providerKey),
            signal: controller.signal,
            requestStartTimeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
          });

          if (!submitResult.response.ok || !submitResult.providerRequestId) {
            const upstreamMessage =
              asProviderString(submitResult.data.error) ??
              asProviderString(submitResult.data.message) ??
              asProviderString(submitResult.data.detail) ??
              (submitResult.providerRequestId
                ? "Provider submit failed."
                : "Provider submit response missing request id.");
            await charge.refund("Auto-release: inline provider submit failed.", {
              reason: submitResult.providerRequestId
                ? "direct_submit_failed"
                : "direct_submit_missing_request_id",
              upstream_status: submitResult.response.status,
              upstream_target_url: submitResult.targetUrl,
              upstream_target_index: submitResult.targetIndex,
              upstream_payload: submitResult.data,
            });
            await logGenerationFailure({
              req,
              routeLabel,
              source: "api.fal_submit.direct_submit_failed",
              message: upstreamMessage,
              statusCode: submitResult.response.status || 502,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                source_ref: charge.sourceRef,
                upstream_status: submitResult.response.status,
                upstream_target_url: submitResult.targetUrl,
                upstream_target_index: submitResult.targetIndex,
                provider_request_id: submitResult.providerRequestId,
              },
            });
            return res.status(submitResult.response.status || 502).json({
              error: upstreamMessage,
              detail: submitResult.data,
            });
          }

          const providerRequestId = submitResult.providerRequestId;
          const markSubmittedResult = await charge.markSubmitted(providerRequestId, {
            generation_submit_authority: "direct",
            submit_route: req.url ?? routeLabel,
            submit_marked_at: dispatchAtIso,
            provider: providerKey,
            model_id: modelId,
            upstream_target_url: submitResult.targetUrl,
            upstream_target_index: submitResult.targetIndex,
            fal_webhook_callback_url: webhookCallbackUrl,
          });

          if (!markSubmittedResult.ok) {
            await charge.refund(
              "Auto-release: failed to bind provider request id after direct submit.",
              {
                reason: "direct_submit_mark_submitted_failed",
                provider_request_id: providerRequestId,
                source_ref: charge.sourceRef,
                submit_link_status: markSubmittedResult.status,
                submit_link_code: markSubmittedResult.code ?? null,
                submit_link_message: markSubmittedResult.message ?? null,
              }
            );
            await logGenerationFailure({
              req,
              routeLabel,
              source: "api.fal_submit.direct_submit_mark_submitted_failed",
              message:
                markSubmittedResult.message ??
                "Failed to record provider request ownership after direct submit.",
              statusCode: 500,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                submit_link_status: markSubmittedResult.status,
                submit_link_code: markSubmittedResult.code ?? null,
              },
            });
            return res.status(500).json({
              error: "Failed to start generation tracking. Please retry.",
            });
          }

          const generationId = randomUUID();
          const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
          const generationMetadata = {
            source_ref: charge.sourceRef,
            generation_submit_authority: "direct",
            route: req.url ?? null,
            route_label: routeLabel,
            fal_webhook_callback_url: webhookCallbackUrl,
            upstream_target_url: submitResult.targetUrl,
            upstream_target_index: submitResult.targetIndex,
            provider_diagnostics: submitResult.providerDiagnostics ?? null,
          };
          const transitionResult = await applyAcceptedRunningGenerationTransition({
            applyGenerationMutation: async () => {
              const response = await getSupabaseAdmin()
                .from("ai_generations")
                .insert({
                  id: generationId,
                  user_id: charge.userId,
                  mode: resolveGenerationModeFromPayload(modelId, payload),
                  provider: providerKey,
                  model_id: modelId,
                  prompt_text: resolveGenerationPromptFromPayload(routeLabel, payload),
                  aspect: resolveGenerationAspectFromPayload(payload),
                  duration_seconds: readGenerationDurationSeconds(payload),
                  resolution: resolveGenerationResolutionFromPayload(payload),
                  ...buildAcceptedRunningGenerationUpdate({
                    provider: providerKey,
                    modelId,
                    providerRequestId,
                    nextRecoveryAtIso,
                    metadata: generationMetadata,
                  }),
                })
                .select("id")
                .single();
              if (response.error) {
                return {
                  ok: false,
                  error: response.error.message ?? "generation_insert_failed",
                };
              }
              return { ok: true };
            },
            attemptInput: {
              generationId,
              userId: charge.userId,
              provider: providerKey,
              modelId,
              providerRequestId,
              dispatchSource: "direct_submit",
              submitRoute: req.url ?? routeLabel,
              metadata: {
                source_ref: charge.sourceRef,
                generation_submit_authority: "direct",
                submit_target_url: submitResult.targetUrl,
                submit_target_index: submitResult.targetIndex,
                provider_diagnostics: submitResult.providerDiagnostics ?? null,
              },
              observedAt: dispatchAtIso,
            },
          });

          if (!transitionResult.ok) {
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.api.fal_submit.direct_transition_failed",
              message: "Direct submit accepted, but generation transition failed.",
              statusCode: 200,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                generation_id: generationId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                stage: transitionResult.stage,
                error: transitionResult.error,
              },
            });
            return res.status(200).json({ request_id: providerRequestId });
          }

          try {
            await upsertGenerationProjection({
              generationId,
              userId: charge.userId,
              sourceRef: charge.sourceRef,
              requestId: providerRequestId,
              provider: providerKey,
              providerRequestId,
              status: "ready",
              taskState: "running",
              queueState: "dispatched",
              displayPrompt: resolveGenerationPromptFromPayload(routeLabel, payload),
              modelId,
              saveState: "idle",
              publicationState: "pending",
              resultUrls: [],
              savedMediaIds: [],
              startedAt: dispatchAtIso,
            });
          } catch (projectionError) {
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.api.fal_submit.direct_projection_failed",
              message: "Direct submit projection sync failed.",
              statusCode: 200,
              userId: charge.userId,
              metadata: {
                generation_id: generationId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                projection_error:
                  projectionError instanceof Error
                    ? projectionError.message
                    : String(projectionError),
              },
            }).catch(() => undefined);
          }

          void requestGenerationControlPlaneWake({
            routeLabel,
            reason: "direct_submit_accepted",
          });
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.direct_submitted",
            message: "Generation submitted directly to provider.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              generation_id: generationId,
              source_ref: charge.sourceRef,
              provider_request_id: providerRequestId,
              upstream_target_url: submitResult.targetUrl,
              upstream_target_index: submitResult.targetIndex,
            },
          });

          return res.status(200).json({
            request_id: providerRequestId,
            generationId,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          await charge.refund(
            "Auto-release: direct provider submit threw before request tracking completed.",
            {
              reason: "direct_submit_error",
              detail,
            }
          );
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.direct_submit_error",
            message: detail,
            statusCode: 502,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              source_ref: charge.sourceRef,
            },
          });
          return res.status(502).json({
            error: "Failed to submit generation to provider. Please retry.",
          });
        } finally {
          clearTimeout(timeoutHandle);
        }
      }

      if (workerOwnedSubmitMisconfigured) {
        const retryAfterSeconds = 20;
        await charge.refund(
          "Auto-release: worker-owned submit requires queue-enabled runtime configuration.",
          {
            reason: "worker_owned_submit_queue_disabled",
            queue_enabled: runtimeFlags.queueEnabled,
            worker_owned_submit_enabled: runtimeFlags.workerOwnedSubmitEnabled,
          }
        );
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.fal_submit.worker_owned_submit_misconfigured",
          message: "Worker-owned submit was enabled while the durable submit queue was disabled.",
          statusCode: 503,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            source_ref: charge.sourceRef,
            queue_enabled: runtimeFlags.queueEnabled,
            worker_owned_submit_enabled: runtimeFlags.workerOwnedSubmitEnabled,
          },
        });
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return res.status(503).json(buildWorkerOwnedSubmitMisconfiguredPayload(retryAfterSeconds));
      }

      if (runtimeFlags.queueEnabled && (admissionDecision.enforced || queuedSubmitSelected)) {
        if (
          isLocalDevGenerationWorkerRequired(runtimeFlags) &&
          !(await hasFreshLocalGenerationWorkerHeartbeat())
        ) {
          await charge.refund("Auto-release: local generation queue worker heartbeat missing.", {
            reason: "local_queue_worker_missing",
            app_base_url: runtimeFlags.publicApiBaseUrl,
          });
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.queue_worker_unavailable",
            message: "Local generation queue worker heartbeat missing while queueing was required.",
            statusCode: 503,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              source_ref: charge.sourceRef,
              app_base_url: runtimeFlags.publicApiBaseUrl,
            },
          });
          res.setHeader("Retry-After", "5");
          return res.status(503).json(buildQueueWorkerUnavailablePayload(5));
        }

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
              admissionScope,
              admissionReason: admissionDecision.reason,
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

        const queuedSubmitPayload =
          runtimeFlags.videoQueueCompatNormalizationEnabled && isVideoGenerationModelId(modelId)
            ? (wrapQueueSubmitPayloadEnvelope({
                modelId,
                payload: payload as JsonValue,
              }) as JsonValue)
            : (payload as JsonValue);
        const webhookCallbackUrl = resolveWebhookCallbackUrl(runtimeFlags, {
          userId: charge.userId,
          modelId,
          requestHeaders: req.headers,
        });
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
          submitPayload: queuedSubmitPayload,
          timeoutMs,
          metadata: {
            source_ref: charge.sourceRef,
            generation_submit_authority: "worker",
            route: req.url ?? null,
            route_label: routeLabel,
            queue_payload_contract:
              runtimeFlags.videoQueueCompatNormalizationEnabled && isVideoGenerationModelId(modelId)
                ? "video_submit_payload_v2"
                : "legacy_raw",
            queue_reason: queuedSubmitSelected
              ? (admissionDecision.reason ?? "queue_enabled_default")
              : admissionDecision.reason,
            queue_snapshot: {
              global_active: admissionDecision.snapshot.globalActive,
              global_max: admissionDecision.snapshot.globalMax,
              tier: admissionDecision.snapshot.tier,
              tier_active: admissionDecision.snapshot.tierActive,
              tier_max: admissionDecision.snapshot.tierMax,
            },
            admission_scope: admissionScope,
            fal_webhook_callback_url: webhookCallbackUrl,
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
        try {
          await upsertGenerationProjection({
            generationId: enqueueResult.generationId,
            userId: charge.userId,
            sourceRef: queuedSourceRef,
            provider: providerKey,
            status: "ready",
            taskState: "pending",
            queueState: "queued",
            displayPrompt: resolveGenerationPromptFromPayload(routeLabel, payload),
            modelId,
            saveState: "idle",
            publicationState: "pending",
            resultUrls: [],
            savedMediaIds: [],
          });
        } catch (projectionError) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.queue_projection_failed",
            message: "Queued generation projection sync failed.",
            statusCode: 202,
            userId: charge.userId,
            metadata: {
              generation_id: enqueueResult.generationId,
              source_ref: queuedSourceRef,
              projection_error:
                projectionError instanceof Error
                  ? projectionError.message
                  : String(projectionError),
            },
          }).catch(() => undefined);
        }
        void requestGenerationControlPlaneWake({
          routeLabel,
          reason: "queued_submit",
        });
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
            worker_owned_submit: queuedSubmitSelected,
            global_active: admissionDecision.snapshot.globalActive,
            global_max: admissionDecision.snapshot.globalMax,
            tier: admissionDecision.snapshot.tier,
            tier_active: admissionDecision.snapshot.tierActive,
            tier_max: admissionDecision.snapshot.tierMax,
            queue_depth: queueDepth + (enqueueResult.status === "queued" ? 1 : 0),
            queue_max: runtimeFlags.queueMaxPerUser,
            admission_scope: admissionScope,
          },
        });

        return res.status(202).json(
          buildQueuedSubmitPayload({
            sourceRef: queuedSourceRef,
            generationId: enqueueResult.generationId,
          })
        );
      }

      const retryAfterSeconds = 20;
      await charge.refund("Auto-release: durable queue-backed submit is required.", {
        reason: "queue_required",
        queue_enabled: runtimeFlags.queueEnabled,
        worker_owned_submit_enabled: runtimeFlags.workerOwnedSubmitEnabled,
        admission_enforced: admissionDecision.enforced,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.queue_required",
        message: "Durable queue-backed submit was required before reaching any inline path.",
        statusCode: 503,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          source_ref: charge.sourceRef,
          queue_enabled: runtimeFlags.queueEnabled,
          worker_owned_submit_enabled: runtimeFlags.workerOwnedSubmitEnabled,
          admission_enforced: admissionDecision.enforced,
        },
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json(buildQueueRequiredPayload(retryAfterSeconds));
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.admission_check_failed",
        message: "Generation admission check failed; submit failed closed.",
        statusCode: 500,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          detail: String(error),
        },
      });
      const retryAfterSeconds = runtimeFlags.admission.retryAfterSeconds;
      await charge.refund("Auto-refund: generation admission check failed.", {
        model_id: modelId,
        detail: String(error),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json(buildAdmissionUnavailablePayload(retryAfterSeconds));
    }

    return;
  };
};
