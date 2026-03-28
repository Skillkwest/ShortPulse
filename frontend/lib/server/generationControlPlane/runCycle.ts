import { logApiRouteException } from "../api/appErrorLogs";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { dispatchGenerationSubmitQueueBatch } from "../api/generationQueue/dispatch";
import { repairGenerationRequestIdsFromReservations } from "../api/generationQueue/requestIdRepair";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { executeGenerationRecovery } from "../falIntegration/recoveryExecution";
import { claimGenerationRecoveryBatch, type ClaimedGeneration } from "./recoveryBatchAcquisition";
import type { GenerationControlPlaneCycleResult, GenerationControlPlaneLogContext } from "./types";

type JsonObject = Record<string, unknown>;

type ReservationCleanupMetrics = {
  scanned: number;
  released: number;
  errors: number;
};

const ALLOWLIST_SKIP_RETRY_DELAY_SECONDS = 15 * 60;

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

const isAllowedModel = (modelId: string, allowlist: Set<string>): boolean => {
  if (!allowlist.size) return true;
  for (const item of allowlist) {
    if (item === "*") return true;
    if (item.endsWith("*") && modelId.startsWith(item.slice(0, -1))) return true;
    if (item === modelId) return true;
  }
  return false;
};

const requeueAllowlistSkippedGeneration = async ({
  supabaseAdmin,
  row,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  row: ClaimedGeneration;
}) => {
  const previousAttempts = Math.max((row.recovery_attempts ?? 1) - 1, 0);
  const retryAtIso = new Date(Date.now() + ALLOWLIST_SKIP_RETRY_DELAY_SECONDS * 1000).toISOString();
  return supabaseAdmin
    .from("ai_generations")
    .update({
      recovery_state: "queued",
      recovery_attempts: previousAttempts,
      next_recovery_at: retryAtIso,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id);
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
}: {
  context: GenerationControlPlaneLogContext;
}): Promise<GenerationControlPlaneCycleResult> => {
  const flags = readFalRuntimeFlags();
  const supabaseAdmin = getSupabaseAdmin();
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

  if (flags.queueEnabled) {
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
    await repairGenerationRequestIdsFromReservations({
      limit: flags.reconcilerBatchSize,
    });
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
    batchSize: flags.reconcilerBatchSize,
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

  let recovered = 0;
  let requeued = 0;
  let exhausted = 0;
  let skipped = 0;
  let duplicates = 0;
  let processed = 0;
  let errors = 0;

  for (const row of claimedRows) {
    if (!isAllowedModel(row.model_id, flags.modelAllowlist)) {
      skipped += 1;
      try {
        await requeueAllowlistSkippedGeneration({
          supabaseAdmin,
          row,
        });
      } catch (error) {
        errors += 1;
        await logControlPlaneException({
          context,
          error,
          metadata: {
            stage: "allowlist_skip_requeue",
            generation_id: row.id,
            model_id: row.model_id,
          },
        });
      }
      continue;
    }
    try {
      const result = await executeGenerationRecovery({
        actor: "reconciler",
        generationId: row.id,
        requestId: row.request_id,
        maxAttempts: flags.reconcilerMaxAttempts,
        routeLabel: context.routeLabel,
      });
      if (result.processed) processed += 1;
      if (result.state === "recovered") {
        recovered += 1;
        continue;
      }
      if (result.state === "already_persisted") {
        duplicates += 1;
        recovered += 1;
        continue;
      }
      if (result.state === "provider_running" || result.state === "no_media") {
        requeued += 1;
        continue;
      }
      if (result.state === "exhausted" || result.state === "provider_failed") {
        exhausted += 1;
        continue;
      }
      if (result.state === "skipped") {
        skipped += 1;
      }
    } catch (error) {
      errors += 1;
      await logControlPlaneException({
        context,
        error,
        metadata: {
          stage: "execute_generation_recovery",
          generation_id: row.id,
          request_id: row.request_id,
        },
      });
      const retryAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("ai_generations")
        .update({
          recovery_state: "queued",
          next_recovery_at: retryAt,
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id);
    }
  }

  return {
    ok: true,
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
