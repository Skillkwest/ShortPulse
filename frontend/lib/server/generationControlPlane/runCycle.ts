import { logApiRouteException } from "../api/appErrorLogs";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { dispatchGenerationSubmitQueueBatch } from "../api/generationQueue/dispatch";
import { repairGenerationRequestIdsFromReservations } from "../api/generationQueue/requestIdRepair";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { executeGenerationRecovery } from "../falIntegration/recoveryExecution";
import type { GenerationControlPlaneCycleResult, GenerationControlPlaneLogContext } from "./types";

type JsonObject = Record<string, unknown>;

type ClaimedGeneration = {
  id: string;
  user_id: string;
  request_id: string | null;
  provider: string | null;
  model_id: string;
  status: string;
  recovery_state: string | null;
  recovery_attempts: number | null;
};

type ReservationCleanupMetrics = {
  scanned: number;
  released: number;
  errors: number;
};

const ALLOWLIST_SKIP_RETRY_DELAY_SECONDS = 15 * 60;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

const parseClaimedGeneration = (value: unknown): ClaimedGeneration | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const status = asString(row.status);
  if (!id || !userId || !modelId || !status) return null;
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    provider: asString(row.provider),
    model_id: modelId,
    status,
    recovery_state: asString(row.recovery_state),
    recovery_attempts: asNumber(row.recovery_attempts),
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

const isSupportedRecoveryProvider = (provider: string | null): boolean => {
  if (!provider) return false;
  const normalized = provider.trim().toLowerCase();
  return normalized.startsWith("fal") || normalized.startsWith("kie");
};

const claimFallback = async ({
  batchSize,
  maxAttempts,
  minAgeSeconds,
  leaseSeconds,
}: {
  batchSize: number;
  maxAttempts: number;
  minAgeSeconds: number;
  leaseSeconds: number;
}): Promise<ClaimedGeneration[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const oldestCreatedAtIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select(
      "id, user_id, request_id, provider, model_id, status, recovery_state, recovery_attempts"
    )
    .in("recovery_state", ["queued", "recovering"])
    .lte("created_at", oldestCreatedAtIso)
    .or(`next_recovery_at.is.null,next_recovery_at.lte.${nowIso}`)
    .lt("recovery_attempts", maxAttempts)
    .order("next_recovery_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error || !Array.isArray(data)) return [];

  const claimed: ClaimedGeneration[] = [];
  for (const raw of data) {
    const row = parseClaimedGeneration(raw);
    if (!row) continue;
    if (!isSupportedRecoveryProvider(row.provider)) continue;
    const nextAttempts = (row.recovery_attempts ?? 0) + 1;
    let updateQuery = supabaseAdmin
      .from("ai_generations")
      .update({
        recovery_state: "recovering",
        recovery_attempts: nextAttempts,
        last_recovery_at: nowIso,
        next_recovery_at: leaseUntilIso,
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
      .eq("status", row.status)
      .eq("recovery_state", row.recovery_state ?? "queued");
    if (row.recovery_attempts === null) {
      updateQuery = updateQuery.is("recovery_attempts", null);
    } else {
      updateQuery = updateQuery.eq("recovery_attempts", row.recovery_attempts);
    }

    const { data: updateRows, error: updateError } = await updateQuery.select("id");
    if (!updateError && Array.isArray(updateRows) && updateRows.length === 1) {
      claimed.push({ ...row, recovery_attempts: nextAttempts, recovery_state: "recovering" });
    }
  }

  return claimed;
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

  const claimResponse = await supabaseAdmin.rpc("claim_generation_recovery_batch", {
    p_limit: flags.reconcilerBatchSize,
    p_max_attempts: flags.reconcilerMaxAttempts,
    p_min_age_seconds: flags.reconcilerMinAgeSeconds,
    p_lease_seconds: flags.reconcilerLeaseSeconds,
  });
  let claimedRows: ClaimedGeneration[] = [];
  if (!claimResponse.error && Array.isArray(claimResponse.data)) {
    claimedRows = claimResponse.data
      .map((row) => parseClaimedGeneration(row))
      .filter((row): row is ClaimedGeneration => Boolean(row));
  } else {
    if (claimResponse.error) {
      await logControlPlaneException({
        context,
        error: claimResponse.error,
        metadata: {
          stage: "claim_generation_recovery_batch_rpc",
        },
      });
    }
    claimedRows = await claimFallback({
      batchSize: flags.reconcilerBatchSize,
      maxAttempts: flags.reconcilerMaxAttempts,
      minAgeSeconds: flags.reconcilerMinAgeSeconds,
      leaseSeconds: flags.reconcilerLeaseSeconds,
    });
  }

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
