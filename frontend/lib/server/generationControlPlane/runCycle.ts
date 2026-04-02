import { logApiRouteException } from "../api/appErrorLogs";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { dispatchGenerationSubmitQueueBatch } from "../api/generationQueue/dispatch";
import { repairGenerationRequestIdsFromReservations } from "../api/generationQueue/requestIdRepair";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { processPendingGenerationObservations } from "./observationBatchExecution";
import { claimGenerationRecoveryBatch } from "./recoveryBatchAcquisition";
import { executeClaimedRecoveryBatch } from "./recoveryBatchExecution";
import type { GenerationControlPlaneCycleResult, GenerationControlPlaneLogContext } from "./types";

type JsonObject = Record<string, unknown>;

type ReservationCleanupMetrics = {
  scanned: number;
  released: number;
  errors: number;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseCleanupMetrics = (value: unknown): ReservationCleanupMetrics => {
  const row =
    Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === "object"
      ? (value[0] as JsonObject)
      : value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
  if (!row) {
    return { scanned: 0, released: 0, errors: 0 };
  }

  const scanned = asNumber(row.scanned_count) ?? asNumber(row.scanned) ?? 0;
  const released = asNumber(row.released_count) ?? asNumber(row.released) ?? 0;
  const errors = asNumber(row.error_count) ?? asNumber(row.errors) ?? 0;
  return {
    scanned: Math.max(0, Math.trunc(scanned)),
    released: Math.max(0, Math.trunc(released)),
    errors: Math.max(0, Math.trunc(errors)),
  };
};

const logControlPlaneException = async ({
  context,
  error,
  metadata,
}: {
  context: GenerationControlPlaneLogContext;
  error: unknown;
  metadata: Record<string, unknown>;
}) =>
  logApiRouteException({
    req: context.req,
    error,
    routeLabel: context.routeLabel,
    metadata,
  });

export const runGenerationControlPlaneCycle = async ({
  context,
  mode = "primary",
}: {
  context: GenerationControlPlaneLogContext;
  mode?: "primary" | "rescue";
}): Promise<GenerationControlPlaneCycleResult> => {
  const flags = readFalRuntimeFlags();
  const supabaseAdmin = getSupabaseAdmin();
  const rescueMode = mode === "rescue";
  const effectiveReconcilerBatchSize = rescueMode
    ? Math.min(flags.reconcilerBatchSize, 5)
    : flags.reconcilerBatchSize;
  const shouldRunRequestIdRepair = !rescueMode && flags.legacyDirectSubmitEnabled;
  let reservationCleanupScanned = 0;
  let reservationCleanupReleased = 0;
  let reservationCleanupErrors = 0;
  let queueClaimed = 0;
  let queueSubmitted = 0;
  let queueRetried = 0;
  let queueRequeuedNoCapacity = 0;
  let queueExhausted = 0;
  let queueSkipped = 0;
  let queueDispatchErrors = 0;
  let observationClaimed = 0;
  let observationProcessed = 0;
  let observationIgnored = 0;
  let observationFailed = 0;
  let observationErrors = 0;

  if (flags.reservationCleanupEnabled) {
    const cleanupResponse = await supabaseAdmin.rpc("release_stale_generation_reservations", {
      p_limit: flags.reservationCleanupBatchSize,
      p_min_age_seconds: flags.reservationCleanupMinAgeSeconds,
    });
    if (cleanupResponse.error) {
      reservationCleanupErrors = 1;
      await logControlPlaneException({
        context,
        error: cleanupResponse.error,
        metadata: {
          stage: "reservation_cleanup",
        },
      });
    } else {
      const metrics = parseCleanupMetrics(cleanupResponse.data);
      reservationCleanupScanned = metrics.scanned;
      reservationCleanupReleased = metrics.released;
      reservationCleanupErrors = metrics.errors;
    }
  }

  if (flags.providerAttachedReservationCleanupEnabled) {
    const providerCleanupResponse = await supabaseAdmin.rpc(
      "release_stale_provider_attached_generation_reservations",
      {
        p_limit: flags.reservationCleanupBatchSize,
        p_min_age_seconds: flags.providerAttachedReservationCleanupMinAgeSeconds,
        p_orphan_min_age_seconds: flags.providerAttachedReservationOrphanMinAgeSeconds,
      }
    );
    if (providerCleanupResponse.error) {
      reservationCleanupErrors += 1;
      await logControlPlaneException({
        context,
        error: providerCleanupResponse.error,
        metadata: {
          stage: "provider_attached_reservation_cleanup",
        },
      });
    } else {
      const metrics = parseCleanupMetrics(providerCleanupResponse.data);
      reservationCleanupScanned += metrics.scanned;
      reservationCleanupReleased += metrics.released;
      reservationCleanupErrors += metrics.errors;
    }
  }

  if (!rescueMode && flags.queueEnabled) {
    try {
      const queueMetrics = await dispatchGenerationSubmitQueueBatch({
        req: context.req,
        routeLabel: context.routeLabel,
        limit: flags.queueDispatchBatchSize,
      });
      queueClaimed = queueMetrics.claimed;
      queueSubmitted = queueMetrics.submitted;
      queueRetried = queueMetrics.retried;
      queueRequeuedNoCapacity = queueMetrics.requeuedNoCapacity;
      queueExhausted = queueMetrics.exhausted;
      queueSkipped = queueMetrics.skipped;
      queueDispatchErrors = queueMetrics.errors;
    } catch (error) {
      queueDispatchErrors += 1;
      await logControlPlaneException({
        context,
        error,
        metadata: {
          stage: "queue_dispatch",
        },
      });
    }
  }

  try {
    const observationMetrics = await processPendingGenerationObservations({
      limit: effectiveReconcilerBatchSize,
      routeLabel: context.routeLabel,
    });
    observationClaimed = observationMetrics.claimed;
    observationProcessed = observationMetrics.processed;
    observationIgnored = observationMetrics.ignored;
    observationFailed = observationMetrics.failed;
    observationErrors = observationMetrics.errors;
  } catch (error) {
    observationErrors += 1;
    await logControlPlaneException({
      context,
      error,
      metadata: {
        stage: "observation_inbox_processing",
      },
    });
  }

  try {
    if (shouldRunRequestIdRepair) {
      await repairGenerationRequestIdsFromReservations({
        limit: effectiveReconcilerBatchSize,
      });
    }
  } catch (error) {
    await logControlPlaneException({
      context,
      error,
      metadata: {
        stage: "request_id_repair_batch",
      },
    });
  }

  const claimBatch = await claimGenerationRecoveryBatch({
    supabaseAdmin,
    batchSize: effectiveReconcilerBatchSize,
    maxAttempts: flags.reconcilerMaxAttempts,
    minAgeSeconds: flags.reconcilerMinAgeSeconds,
    leaseSeconds: flags.reconcilerLeaseSeconds,
  });
  if (claimBatch.rpcError) {
    await logControlPlaneException({
      context,
      error: claimBatch.rpcError,
      metadata: {
        stage: "claim_generation_recovery_batch_rpc",
      },
    });
  }
  const claimedRows = claimBatch.rows;

  const { recovered, requeued, exhausted, skipped, duplicates, processed, errors } =
    await executeClaimedRecoveryBatch({
      supabaseAdmin,
      rows: claimedRows,
      modelAllowlist: flags.modelAllowlist,
      maxAttempts: flags.reconcilerMaxAttempts,
      routeLabel: context.routeLabel,
      logException: ({ error, metadata }) =>
        logControlPlaneException({
          context,
          error,
          metadata,
        }),
    });

  return {
    ok: true,
    observationClaimed,
    observationProcessed,
    observationIgnored,
    observationFailed,
    observationErrors,
    claimed: claimedRows.length,
    processed,
    recovered,
    requeued,
    exhausted,
    duplicates,
    errors,
    skipped,
    reservationCleanupScanned,
    reservationCleanupReleased,
    reservationCleanupErrors,
    queueClaimed,
    queueSubmitted,
    queueRetried,
    queueRequeuedNoCapacity,
    queueExhausted,
    queueSkipped,
    queueDispatchErrors,
  };
};
