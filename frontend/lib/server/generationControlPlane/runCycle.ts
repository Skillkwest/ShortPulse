import { logApiRouteException } from "../api/appErrorLogs";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { repairStaleTerminalGenerationProjections } from "../api/generationProjection";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { processPendingAudioCompanionArtBatch } from "../audioCompanionArt/processing";
import { processPendingGenerationObservations } from "./observationBatchExecution";
import { claimGenerationRecoveryBatch } from "./recoveryBatchAcquisition";
import { executeClaimedRecoveryBatch } from "./recoveryBatchExecution";
import type {
  GenerationControlPlaneCycleResult,
  GenerationControlPlaneLogContext,
  GenerationControlPlaneStageTimings,
} from "./types";

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

const lastProjectionRepairRunBucketByMode = new Map<string, number>();

const shouldRunProjectionRepair = ({
  intervalSeconds,
  mode,
  nowMs,
  routeLabel,
}: {
  intervalSeconds: number;
  mode: "primary" | "rescue";
  nowMs: number;
  routeLabel: string;
}): boolean => {
  if (intervalSeconds <= 0) return true;
  const intervalMs = intervalSeconds * 1000;
  const bucket = Math.floor(nowMs / intervalMs);
  const elapsedInBucketMs = nowMs - bucket * intervalMs;
  const eligibleWindowMs = Math.min(60_000, intervalMs);
  if (elapsedInBucketMs >= eligibleWindowMs) {
    return false;
  }

  const key = `${routeLabel}:${mode}`;
  const lastRunBucket = lastProjectionRepairRunBucketByMode.get(key);
  if (lastRunBucket === bucket) {
    return false;
  }
  lastProjectionRepairRunBucketByMode.set(key, bucket);
  return true;
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
  const stageTimings: GenerationControlPlaneStageTimings = {
    reservationCleanup: { durationMs: 0 },
    providerAttachedReservationCleanup: { durationMs: 0 },
    observationInboxProcessing: { durationMs: 0 },
    recoveryClaim: { durationMs: 0 },
    recoveryExecution: { durationMs: 0 },
    projectionRepair: { durationMs: 0 },
    audioCompanionArtProcessing: { durationMs: 0 },
  };
  const measureStage = async <T>(
    stageName: keyof GenerationControlPlaneStageTimings,
    work: () => Promise<T>
  ) => {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      stageTimings[stageName].durationMs = Math.max(0, Date.now() - startedAt);
    }
  };
  let reservationCleanupScanned = 0;
  let reservationCleanupReleased = 0;
  let reservationCleanupErrors = 0;
  let projectionRepairRan = false;
  let projectionRepairScanned = 0;
  let projectionRepairRepaired = 0;
  let projectionRepairSkipped = 0;
  let observationClaimed = 0;
  let observationProcessed = 0;
  let observationIgnored = 0;
  let observationFailed = 0;
  let observationErrors = 0;
  let audioCompanionArtClaimed = 0;
  let audioCompanionArtProcessed = 0;
  let audioCompanionArtReady = 0;
  let audioCompanionArtFailed = 0;
  let audioCompanionArtSkipped = 0;
  let audioCompanionArtErrors = 0;

  if (flags.reservationCleanupEnabled) {
    await measureStage("reservationCleanup", async () => {
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
    });
  }

  if (flags.providerAttachedReservationCleanupEnabled) {
    await measureStage("providerAttachedReservationCleanup", async () => {
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
    });
  }

  await measureStage("observationInboxProcessing", async () => {
    try {
      const observationMetrics = await processPendingGenerationObservations({
        limit: effectiveReconcilerBatchSize,
        leaseSeconds: flags.reconcilerLeaseSeconds,
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
  });

  const claimBatch = await measureStage("recoveryClaim", () =>
    claimGenerationRecoveryBatch({
      supabaseAdmin,
      batchSize: effectiveReconcilerBatchSize,
      maxAttempts: flags.reconcilerMaxAttempts,
      minAgeSeconds: flags.reconcilerMinAgeSeconds,
      leaseSeconds: flags.reconcilerLeaseSeconds,
    })
  );
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
    await measureStage("recoveryExecution", () =>
      executeClaimedRecoveryBatch({
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
      })
    );

  if (
    mode === "primary" &&
    shouldRunProjectionRepair({
      intervalSeconds: flags.projectionRepairIntervalSeconds,
      mode,
      nowMs: Date.now(),
      routeLabel: context.routeLabel,
    })
  ) {
    projectionRepairRan = true;
    await measureStage("projectionRepair", async () => {
      try {
        const projectionRepairMetrics = await repairStaleTerminalGenerationProjections({
          supabaseAdmin,
          limit: Math.max(effectiveReconcilerBatchSize, 10),
          onAssociationFailure: async ({
            stage,
            userId,
            projectId,
            generationId,
            mediaFileIds,
            error,
          }) => {
            await logControlPlaneException({
              context,
              error,
              metadata: {
                stage: "projection_repair_project_association",
                association_stage: stage,
                user_id: userId,
                project_id: projectId,
                generation_id: generationId,
                media_file_ids: mediaFileIds ?? [],
              },
            });
          },
        });
        projectionRepairScanned = projectionRepairMetrics.scanned;
        projectionRepairRepaired = projectionRepairMetrics.repaired;
        projectionRepairSkipped = projectionRepairMetrics.skipped;
      } catch (error) {
        await logControlPlaneException({
          context,
          error,
          metadata: {
            stage: "projection_repair",
          },
        });
      }
    });
  }

  await measureStage("audioCompanionArtProcessing", async () => {
    try {
      const audioCompanionMetrics = await processPendingAudioCompanionArtBatch({
        limit: Math.max(1, Math.min(effectiveReconcilerBatchSize, 6)),
      });
      audioCompanionArtClaimed = audioCompanionMetrics.claimed;
      audioCompanionArtProcessed = audioCompanionMetrics.processed;
      audioCompanionArtReady = audioCompanionMetrics.ready;
      audioCompanionArtFailed = audioCompanionMetrics.failed;
      audioCompanionArtSkipped = audioCompanionMetrics.skipped;
      audioCompanionArtErrors = audioCompanionMetrics.errors;
    } catch (error) {
      audioCompanionArtErrors += 1;
      await logControlPlaneException({
        context,
        error,
        metadata: {
          stage: "audio_companion_art_processing",
        },
      });
    }
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
    projectionRepairRan,
    projectionRepairScanned,
    projectionRepairRepaired,
    projectionRepairSkipped,
    audioCompanionArtClaimed,
    audioCompanionArtProcessed,
    audioCompanionArtReady,
    audioCompanionArtFailed,
    audioCompanionArtSkipped,
    audioCompanionArtErrors,
    stageTimings,
  };
};
