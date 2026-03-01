import type { NextApiRequest } from "next";
import { getSupabaseAdmin } from "../supabaseAdmin";
import { logGenerationFailure } from "../appErrorLogs";
import { readFalRuntimeFlags } from "../falRuntimeFlags";
import {
  markGenerationReservationSubmitted,
  releaseGenerationReservationBySourceRef,
} from "../generationBilling/reservationRpcAdapter";
import { resolveGenerationAdmissionTier } from "../../../model-runtime/generationAdmissionTiers";
import { getFalModelProfileByModelId } from "../../falIntegration/modelProfiles";
import type { SubmitTarget } from "../../falIntegration/contracts";
import { resolveWebhookCallbackUrl, withWebhookTargets } from "../falSubmitTargeting";
import { dispatchProviderSubmit } from "../../providerIntegration/submitProviderDispatcher";
import {
  readProviderApiKey,
  resolveKieSubmitTargetsForModel,
  resolveProviderFromGenerationContext,
} from "../../providerIntegration/providerRuntimeConfig";
import { isFalProviderKey, isKieProviderKey } from "../../providerIntegration/providerKey";
import {
  claimGenerationSubmitQueueBatch,
  markQueueItemExhausted,
  releaseQueueLeaseBackToQueued,
  removeQueueItem,
  updateQueueItemForRetry,
  type ClaimedGenerationQueueItem,
} from "./service";
import {
  QueueTransitionError,
  assertGenerationMarkedRunning,
  assertQueueMutationApplied,
  assertReservationSubmissionAccepted,
  decideQueueTransitionCompensation,
} from "./transitionGuard";

type JsonObject = Record<string, unknown>;

type QueueDispatchMetrics = {
  claimed: number;
  submitted: number;
  retried: number;
  requeuedNoCapacity: number;
  exhausted: number;
  skipped: number;
  errors: number;
};

type DispatchOptions = {
  req: NextApiRequest;
  routeLabel: string;
  limit: number;
  userId?: string | null;
};

const retryableSubmitStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const isRetryableTransportError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const detail = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|econnreset|etimedout|eai_again/i.test(detail);
};

const isRetryableUpstreamFailure = ({
  status,
  payload,
}: {
  status: number;
  payload: JsonObject;
}): boolean => {
  if (retryableSubmitStatuses.has(status)) return true;
  const upstreamCode = String(payload.code ?? "").toLowerCase();
  return upstreamCode === "rate_limit" || upstreamCode === "overloaded";
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const asString = String(error ?? "").trim();
  return asString.length ? asString : "queue_dispatch_failed";
};

const readErrorCode = (error: unknown): string => {
  if (error instanceof QueueTransitionError) return error.code;
  return "DISPATCH_EXCEPTION";
};

const asObject = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readProviderActiveReservationModelIds = async (userId: string): Promise<string[]> => {
  const { data } = await getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("model_id")
    .eq("user_id", userId)
    .eq("status", "reserved")
    .not("provider_request_id", "is", null);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => asString((row as JsonObject).model_id))
    .filter((modelId): modelId is string => Boolean(modelId));
};

const isAtProviderConcurrencyCap = async ({
  userId,
  modelId,
}: {
  userId: string;
  modelId: string;
}): Promise<boolean> => {
  const flags = readFalRuntimeFlags();
  const activeModelIds = await readProviderActiveReservationModelIds(userId);
  const globalActive = activeModelIds.length;
  const globalAtCap = globalActive >= flags.admission.globalMax;
  const tier = resolveGenerationAdmissionTier(modelId);
  const tierActive = activeModelIds.filter(
    (activeModelId) => resolveGenerationAdmissionTier(activeModelId) === tier
  ).length;
  const tierAtCap = tierActive >= flags.admission.tierLimits[tier];
  return globalAtCap || tierAtCap;
};

const resolveBackoffSeconds = ({
  baseSeconds,
  attempts,
}: {
  baseSeconds: number;
  attempts: number;
}) => {
  const exponent = Math.max(0, Math.min(8, attempts));
  return Math.max(1, Math.min(300, baseSeconds * 2 ** exponent));
};

const toIsoAfterSeconds = (seconds: number): string =>
  new Date(Date.now() + seconds * 1000).toISOString();

const parseIsoTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const readQueueAgeSeconds = (createdAt: string | null): number | null => {
  const parsedCreatedAt = parseIsoTimestamp(createdAt);
  if (parsedCreatedAt === null) return null;
  return Math.max(0, Math.floor((Date.now() - parsedCreatedAt) / 1000));
};

const readQueueSubmitTargets = ({
  provider,
  modelId,
}: {
  provider: string;
  modelId: string;
}): {
  targets: SubmitTarget[];
  resolutionErrorCode: string | null;
  resolutionErrorMessage: string | null;
} => {
  if (isFalProviderKey(provider)) {
    const profile = getFalModelProfileByModelId(modelId);
    if (!profile?.submitTargets?.length) {
      return {
        targets: [],
        resolutionErrorCode: null,
        resolutionErrorMessage: null,
      };
    }
    return {
      targets: profile.submitTargets,
      resolutionErrorCode: null,
      resolutionErrorMessage: null,
    };
  }
  if (isKieProviderKey(provider)) {
    try {
      return {
        targets: resolveKieSubmitTargetsForModel(modelId),
        resolutionErrorCode: null,
        resolutionErrorMessage: null,
      };
    } catch (error) {
      const message = normalizeError(error);
      const lowerMessage = message.toLowerCase();
      const errorCode = lowerMessage.includes("disabled by runtime flag")
        ? "KIE_RUNTIME_DISABLED"
        : lowerMessage.includes("not allowlisted")
          ? "KIE_MODEL_NOT_ALLOWLISTED"
          : "KIE_SUBMIT_TARGET_RESOLUTION_FAILED";
      return {
        targets: [],
        resolutionErrorCode: errorCode,
        resolutionErrorMessage: message,
      };
    }
  }
  return {
    targets: [],
    resolutionErrorCode: null,
    resolutionErrorMessage: null,
  };
};

const setGenerationFailed = async ({
  generationId,
  userId,
  message,
}: {
  generationId: string;
  userId: string;
  message: string;
}) => {
  await getSupabaseAdmin()
    .from("ai_generations")
    .update({
      status: "fail",
      error_message: message,
      failure_reason_code: "queue_dispatch_exhausted",
      completed_at: new Date().toISOString(),
      recovery_state: "exhausted",
      next_recovery_at: null,
    })
    .eq("id", generationId)
    .eq("user_id", userId);
};

const mergeGenerationMetadata = (existing: unknown, patch: JsonObject): JsonObject => {
  const base = asObject(existing);
  return {
    ...base,
    ...patch,
  };
};

const processClaimedQueueItem = async ({
  req,
  routeLabel,
  item,
  maxAttempts,
  baseBackoffSeconds,
}: {
  req: NextApiRequest;
  routeLabel: string;
  item: ClaimedGenerationQueueItem;
  maxAttempts: number;
  baseBackoffSeconds: number;
}): Promise<
  Pick<
    QueueDispatchMetrics,
    "submitted" | "retried" | "requeuedNoCapacity" | "exhausted" | "skipped" | "errors"
  >
> => {
  const metrics = {
    submitted: 0,
    retried: 0,
    requeuedNoCapacity: 0,
    exhausted: 0,
    skipped: 0,
    errors: 0,
  };

  const generationLookup = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id, status, request_id, provider, metadata")
    .eq("id", item.generationId)
    .eq("user_id", item.userId)
    .maybeSingle();
  const generationRow = asObject(generationLookup.data);
  const attemptNumber = item.attempts + 1;
  const provider = resolveProviderFromGenerationContext({
    provider: asString(generationRow.provider),
    modelId: item.modelId,
    fallback: "fal",
  });

  const existingRequestId = asString(generationRow.request_id);
  if (existingRequestId) {
    try {
      const reservationResult = await markGenerationReservationSubmitted({
        userId: item.userId,
        sourceRef: item.sourceRef,
        providerRequestId: existingRequestId,
        metadata: {
          queue_reconcile_at: new Date().toISOString(),
          queue_id: item.queueId,
          queue_attempts: attemptNumber,
          queue_reconcile_reason: "existing_request_id",
        },
      });
      assertReservationSubmissionAccepted({ result: reservationResult });

      const removeResult = await removeQueueItem(item.queueId);
      assertQueueMutationApplied({ result: removeResult, step: "queue_remove" });
      metrics.skipped += 1;
    } catch (error) {
      const message = normalizeError(error);
      const errorCode = readErrorCode(error);
      const compensation = decideQueueTransitionCompensation({
        attemptNumber,
        maxAttempts,
        error,
        submitAccepted: false,
      });
      if (compensation === "retry") {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toIsoAfterSeconds(
            resolveBackoffSeconds({ baseSeconds: baseBackoffSeconds, attempts: attemptNumber })
          ),
          lastError: message,
          lastErrorCode: errorCode,
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
      } else {
        const exhaustResult = await markQueueItemExhausted({
          queueId: item.queueId,
          attempts: attemptNumber,
          lastError: message,
          lastErrorCode: errorCode,
        });
        assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
        metrics.exhausted += 1;
      }
      metrics.errors += 1;
    }
    return metrics;
  }

  const runtimeFlags = readFalRuntimeFlags();

  if (await isAtProviderConcurrencyCap({ userId: item.userId, modelId: item.modelId })) {
    const queueAgeSeconds = readQueueAgeSeconds(item.createdAt);
    if (queueAgeSeconds !== null && queueAgeSeconds >= runtimeFlags.queueMaxWaitSeconds) {
      const message = "Queued generation exceeded max wait time without available capacity.";
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: item.attempts,
        lastError: message,
        lastErrorCode: "QUEUE_WAIT_TIMEOUT",
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit exceeded max wait time without capacity.",
        metadata: {
          queue_id: item.queueId,
          queue_attempts: item.attempts,
          queue_age_seconds: queueAgeSeconds,
          queue_max_wait_seconds: runtimeFlags.queueMaxWaitSeconds,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message: "Generation timed out in queue. Please retry.",
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: 408,
        message,
        userId: item.userId,
        metadata: {
          queue_id: item.queueId,
          generation_id: item.generationId,
          source_ref: item.sourceRef,
          attempts: item.attempts,
          model_id: item.modelId,
          error_code: "QUEUE_WAIT_TIMEOUT",
          queue_age_seconds: queueAgeSeconds,
          queue_max_wait_seconds: runtimeFlags.queueMaxWaitSeconds,
        },
      });
      metrics.exhausted += 1;
      return metrics;
    }

    const releaseResult = await releaseQueueLeaseBackToQueued({
      queueId: item.queueId,
      nextAttemptAt: toIsoAfterSeconds(Math.max(1, baseBackoffSeconds)),
    });
    assertQueueMutationApplied({ result: releaseResult, step: "queue_release" });
    metrics.requeuedNoCapacity += 1;
    return metrics;
  }

  let apiKey: string;
  try {
    apiKey = readProviderApiKey(provider);
  } catch (error) {
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: item.attempts,
      lastError: normalizeError(error),
      lastErrorCode: "PROVIDER_KEY_MISSING",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation queue dispatch failed due to missing server configuration.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  if (attemptNumber > maxAttempts) {
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: attemptNumber,
      lastError: "Queue dispatch attempts exhausted before submit.",
      lastErrorCode: "QUEUE_ATTEMPTS_EXHAUSTED",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await releaseGenerationReservationBySourceRef({
      userId: item.userId,
      sourceRef: item.sourceRef,
      reason: "Auto-release: queue dispatch attempts exhausted.",
      metadata: {
        queue_id: item.queueId,
        queue_attempts: attemptNumber,
      },
    });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation failed while waiting in the submit queue. Please retry.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  const webhookCallbackUrl = resolveWebhookCallbackUrl(runtimeFlags);
  const providerSubmitTargetResolution = readQueueSubmitTargets({
    provider,
    modelId: item.modelId,
  });
  const providerSubmitTargets = providerSubmitTargetResolution.targets;
  const submitTargets = isFalProviderKey(provider)
    ? withWebhookTargets(providerSubmitTargets, webhookCallbackUrl)
    : providerSubmitTargets;
  if (!submitTargets.length) {
    const resolutionErrorCode = providerSubmitTargetResolution.resolutionErrorCode;
    const resolutionErrorMessage = providerSubmitTargetResolution.resolutionErrorMessage;
    const missingTargetMessage =
      resolutionErrorMessage && resolutionErrorMessage !== "queue_dispatch_failed"
        ? `No submit target configured for queued model/provider (${provider}): ${resolutionErrorMessage}`
        : `No submit target configured for queued model/provider (${provider}).`;
    const exhaustResult = await markQueueItemExhausted({
      queueId: item.queueId,
      attempts: attemptNumber,
      lastError: missingTargetMessage,
      lastErrorCode: resolutionErrorCode ?? "MISSING_SUBMIT_TARGET",
    });
    assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
    await releaseGenerationReservationBySourceRef({
      userId: item.userId,
      sourceRef: item.sourceRef,
      reason: "Auto-release: queued submit model missing target.",
      metadata: {
        queue_id: item.queueId,
        model_id: item.modelId,
        provider_target_resolution_error_code: resolutionErrorCode,
        provider_target_resolution_error_message: resolutionErrorMessage,
      },
    });
    await setGenerationFailed({
      generationId: item.generationId,
      userId: item.userId,
      message: "Generation failed to start from queue. Please retry.",
    });
    metrics.exhausted += 1;
    return metrics;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, item.timeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let submitAccepted = false;

  try {
    const submitResult = await dispatchProviderSubmit({
      provider,
      modelId: item.modelId,
      targets: submitTargets,
      payload: item.submitPayload,
      apiKey,
      signal: controller.signal,
      requestStartTimeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
    });
    const upstream = submitResult.response;
    const upstreamData = asObject(submitResult.data);

    if (!upstream.ok) {
      const message =
        asString(upstreamData.error) ??
        asString(upstreamData.message) ??
        `Queued submit rejected (${upstream.status})`;
      const retryable = isRetryableUpstreamFailure({
        status: upstream.status,
        payload: upstreamData,
      });
      if (retryable && attemptNumber < maxAttempts) {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toIsoAfterSeconds(
            resolveBackoffSeconds({ baseSeconds: baseBackoffSeconds, attempts: attemptNumber })
          ),
          lastError: message,
          lastErrorCode: asString(upstreamData.code),
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.queue.dispatch.retry",
          statusCode: upstream.status,
          message,
          userId: item.userId,
          metadata: {
            queue_id: item.queueId,
            generation_id: item.generationId,
            source_ref: item.sourceRef,
            attempts: attemptNumber,
            model_id: item.modelId,
          },
        });
        return metrics;
      }

      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: asString(upstreamData.code),
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit rejected by provider.",
        metadata: {
          queue_id: item.queueId,
          upstream_status: upstream.status,
          upstream_error: upstreamData,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message,
      });
      metrics.exhausted += 1;
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: upstream.status,
        message,
        userId: item.userId,
        metadata: {
          queue_id: item.queueId,
          generation_id: item.generationId,
          source_ref: item.sourceRef,
          attempts: attemptNumber,
          model_id: item.modelId,
        },
      });
      return metrics;
    }

    const providerRequestId = submitResult.providerRequestId;
    if (!providerRequestId) {
      const message = "Queued submit response did not include request_id.";
      if (attemptNumber < maxAttempts) {
        const retryResult = await updateQueueItemForRetry({
          queueId: item.queueId,
          attempts: attemptNumber,
          nextAttemptAt: toIsoAfterSeconds(
            resolveBackoffSeconds({ baseSeconds: baseBackoffSeconds, attempts: attemptNumber })
          ),
          lastError: message,
          lastErrorCode: "MISSING_REQUEST_ID",
        });
        assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
        metrics.retried += 1;
        return metrics;
      }

      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: "MISSING_REQUEST_ID",
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      await releaseGenerationReservationBySourceRef({
        userId: item.userId,
        sourceRef: item.sourceRef,
        reason: "Auto-release: queued submit response missing request id.",
        metadata: {
          queue_id: item.queueId,
          upstream_payload: upstreamData,
        },
      });
      await setGenerationFailed({
        generationId: item.generationId,
        userId: item.userId,
        message: "Generation failed to start from queue. Please retry.",
      });
      metrics.exhausted += 1;
      return metrics;
    }

    submitAccepted = true;
    const reservationResult = await markGenerationReservationSubmitted({
      userId: item.userId,
      sourceRef: item.sourceRef,
      providerRequestId,
      metadata: {
        queue_dispatch_at: new Date().toISOString(),
        queue_id: item.queueId,
        queue_attempts: attemptNumber,
        submit_route: item.submitRoute,
        upstream_target_url: submitResult.targetUrl,
        upstream_target_index: submitResult.targetIndex,
      },
    });
    assertReservationSubmissionAccepted({ result: reservationResult });

    const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const generationUpdate = await getSupabaseAdmin()
      .from("ai_generations")
      .update({
        provider,
        request_id: providerRequestId,
        status: "running",
        failure_reason_code: null,
        error_message: null,
        completed_at: null,
        recovery_state: "queued",
        recovery_attempts: 0,
        last_recovery_at: null,
        next_recovery_at: nextRecoveryAtIso,
        metadata: mergeGenerationMetadata(generationRow.metadata, {
          source_ref: item.sourceRef,
          queue_dispatched_at: new Date().toISOString(),
          queue_id: item.queueId,
          queue_attempts: attemptNumber,
          provider,
          provider_request_id: providerRequestId,
          upstream_target_url: submitResult.targetUrl,
          upstream_target_index: submitResult.targetIndex,
          submit_webhook_url: isFalProviderKey(provider) ? webhookCallbackUrl : null,
          submit_webhook_registered: isFalProviderKey(provider)
            ? Boolean(webhookCallbackUrl)
            : false,
        }),
      })
      .eq("id", item.generationId)
      .eq("user_id", item.userId)
      .select("id");
    assertGenerationMarkedRunning({
      affectedCount: Array.isArray(generationUpdate.data) ? generationUpdate.data.length : 0,
      errorMessage: generationUpdate.error?.message ?? null,
    });

    const removeResult = await removeQueueItem(item.queueId);
    assertQueueMutationApplied({ result: removeResult, step: "queue_remove" });
    metrics.submitted += 1;
    await logGenerationFailure({
      req,
      routeLabel,
      source: "telemetry.queue.dispatch.submitted",
      statusCode: 200,
      message: "Queued generation submit dispatched.",
      userId: item.userId,
      metadata: {
        queue_id: item.queueId,
        generation_id: item.generationId,
        source_ref: item.sourceRef,
        attempts: attemptNumber,
        model_id: item.modelId,
        provider_request_id: providerRequestId,
      },
    });
    return metrics;
  } catch (error) {
    const message = normalizeError(error);
    if (!submitAccepted && isRetryableTransportError(error) && attemptNumber < maxAttempts) {
      const retryResult = await updateQueueItemForRetry({
        queueId: item.queueId,
        attempts: attemptNumber,
        nextAttemptAt: toIsoAfterSeconds(
          resolveBackoffSeconds({ baseSeconds: baseBackoffSeconds, attempts: attemptNumber })
        ),
        lastError: message,
        lastErrorCode: "TRANSPORT_RETRYABLE",
      });
      assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
      metrics.retried += 1;
      return metrics;
    }

    const errorCode = readErrorCode(error);
    const compensation = decideQueueTransitionCompensation({
      attemptNumber,
      maxAttempts,
      error,
      submitAccepted,
    });
    if (compensation === "retry") {
      const retryResult = await updateQueueItemForRetry({
        queueId: item.queueId,
        attempts: attemptNumber,
        nextAttemptAt: toIsoAfterSeconds(
          resolveBackoffSeconds({ baseSeconds: baseBackoffSeconds, attempts: attemptNumber })
        ),
        lastError: message,
        lastErrorCode: errorCode,
      });
      assertQueueMutationApplied({ result: retryResult, step: "queue_retry" });
      metrics.retried += 1;
    } else {
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.queueId,
        attempts: attemptNumber,
        lastError: message,
        lastErrorCode: errorCode,
      });
      assertQueueMutationApplied({ result: exhaustResult, step: "queue_exhaust" });
      if (!submitAccepted) {
        await releaseGenerationReservationBySourceRef({
          userId: item.userId,
          sourceRef: item.sourceRef,
          reason: "Auto-release: queue dispatch exception.",
          metadata: {
            queue_id: item.queueId,
            queue_attempts: attemptNumber,
            error: message,
            error_code: errorCode,
          },
        });
        await setGenerationFailed({
          generationId: item.generationId,
          userId: item.userId,
          message: "Generation failed while queued. Please retry.",
        });
      }
      metrics.exhausted += 1;
    }

    metrics.errors += 1;
    return metrics;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const dispatchGenerationSubmitQueueBatch = async ({
  req,
  routeLabel,
  limit,
  userId,
}: DispatchOptions): Promise<QueueDispatchMetrics> => {
  const flags = readFalRuntimeFlags();
  const metrics: QueueDispatchMetrics = {
    claimed: 0,
    submitted: 0,
    retried: 0,
    requeuedNoCapacity: 0,
    exhausted: 0,
    skipped: 0,
    errors: 0,
  };

  if (!flags.queueEnabled) {
    return metrics;
  }

  const claimed = await claimGenerationSubmitQueueBatch({
    limit,
    leaseSeconds: flags.queueLeaseSeconds,
    userId,
  }).catch(async (error) => {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "telemetry.queue.dispatch.claim_failed",
      statusCode: 500,
      message: "Failed to claim queued generation dispatch batch.",
      userId: userId ?? undefined,
      metadata: {
        queue_limit: limit,
        queue_lease_seconds: flags.queueLeaseSeconds,
        queue_enabled: flags.queueEnabled,
        detail: normalizeError(error),
      },
    });
    throw error;
  });

  metrics.claimed = claimed.length;
  for (const item of claimed) {
    const result = await processClaimedQueueItem({
      req,
      routeLabel,
      item,
      maxAttempts: flags.queueMaxAttempts,
      baseBackoffSeconds: flags.queueBaseBackoffSeconds,
    });
    metrics.submitted += result.submitted;
    metrics.retried += result.retried;
    metrics.requeuedNoCapacity += result.requeuedNoCapacity;
    metrics.exhausted += result.exhausted;
    metrics.skipped += result.skipped;
    metrics.errors += result.errors;
  }

  return metrics;
};
