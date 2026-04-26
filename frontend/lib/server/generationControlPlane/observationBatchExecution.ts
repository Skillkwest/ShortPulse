import {
  claimPendingGenerationObservations,
  markGenerationObservationProcessingState,
  type ClaimedGenerationObservation,
} from "../api/generationObservationInbox";
import {
  executeGenerationRecovery,
  type RecoveryObservation,
} from "../falIntegration/recoveryExecution";

export type ObservationBatchExecutionMetrics = {
  claimed: number;
  processed: number;
  ignored: number;
  failed: number;
  errors: number;
};

const resolveRecoveryObservationState = (
  observationType: string
): RecoveryObservation["state"] | null => {
  switch (observationType.trim().toLowerCase()) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return null;
  }
};

const resolveObservationOutcome = (
  resultState: string
):
  | { processingState: "processed"; metric: "processed" }
  | { processingState: "ignored"; metric: "ignored" }
  | { processingState: "pending"; metric: "failed" } => {
  if (resultState === "missing_generation") {
    return {
      processingState: "pending",
      metric: "failed",
    };
  }
  if (resultState === "skipped") {
    return {
      processingState: "ignored",
      metric: "ignored",
    };
  }
  return {
    processingState: "processed",
    metric: "processed",
  };
};

const buildObservation = (row: ClaimedGenerationObservation): RecoveryObservation | null => {
  const state = resolveRecoveryObservationState(row.observationType);
  if (!state) return null;
  return {
    state,
    payload: row.payload,
    mediaUrls: [],
  };
};

export const processPendingGenerationObservations = async ({
  limit,
  leaseSeconds,
  routeLabel,
}: {
  limit: number;
  leaseSeconds: number;
  routeLabel: string;
}): Promise<ObservationBatchExecutionMetrics> => {
  const rows = await claimPendingGenerationObservations({
    limit,
    leaseSeconds,
  });

  let processed = 0;
  let ignored = 0;
  let failed = 0;
  let errors = 0;

  for (const row of rows) {
    const observation = buildObservation(row);
    if (!observation) {
      ignored += 1;
      await markGenerationObservationProcessingState({
        idempotencyKey: row.idempotencyKey,
        processingState: "ignored",
        processingError: "unsupported_observation_type",
      });
      continue;
    }

    try {
      const result = await executeGenerationRecovery({
        actor: "reconciler",
        generationId: row.generationId,
        requestId: row.providerRequestId,
        userId: row.userId,
        observation,
        routeLabel,
      });

      const outcome = resolveObservationOutcome(result.state);
      if (outcome.metric === "ignored") {
        ignored += 1;
      } else if (outcome.metric === "failed") {
        failed += 1;
      } else {
        processed += 1;
      }

      await markGenerationObservationProcessingState({
        idempotencyKey: row.idempotencyKey,
        processingState: outcome.processingState,
        processingError: result.note ?? null,
      });
    } catch (error) {
      failed += 1;
      errors += 1;
      await markGenerationObservationProcessingState({
        idempotencyKey: row.idempotencyKey,
        processingState: "failed",
        processingError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    claimed: rows.length,
    processed,
    ignored,
    failed,
    errors,
  };
};
