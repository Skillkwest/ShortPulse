/**
 * Queue-status side-effect orchestrator.
 * Runs optional queue dispatch/recovery kicks for authenticated queue-status flows.
 */
import type { NextApiRequest } from "next";
import { logGenerationFailure } from "../appErrorLogs";
import { dispatchGenerationSubmitQueueBatch } from "./dispatch";
import { claimDueQueueStatusRecovery } from "./statusRecoveryKick";
import { executeGenerationRecovery } from "../../falIntegration/recoveryExecution";

export type QueueStatusSideEffectsFlags = {
  queueStatusDispatchKickEnabled: boolean;
  queueStatusRecoveryKickEnabled: boolean;
  reconcilerMaxAttempts: number;
};

export type QueueStatusSideEffectsResult = {
  dispatchKickAttempted: boolean;
  dispatchKickErrors: number;
  dispatchKickExhausted: number;
  recoveryKickAttempted: boolean;
  recoveryClaimed: boolean;
  recoveryClaimReason: string | null;
};

type RunQueueStatusSideEffectsParams = {
  req: NextApiRequest;
  routeLabel: string;
  userId: string;
  userEmail: string | null;
  sourceRef: string | null;
  generationId: string | null;
  flags: QueueStatusSideEffectsFlags;
};

/**
 * Executes queue status side effects and logs non-fatal failures as telemetry.
 */
export const runQueueStatusSideEffects = async ({
  req,
  routeLabel,
  userId,
  userEmail,
  sourceRef,
  generationId,
  flags,
}: RunQueueStatusSideEffectsParams): Promise<QueueStatusSideEffectsResult> => {
  const result: QueueStatusSideEffectsResult = {
    dispatchKickAttempted: false,
    dispatchKickErrors: 0,
    dispatchKickExhausted: 0,
    recoveryKickAttempted: false,
    recoveryClaimed: false,
    recoveryClaimReason: null,
  };

  if (flags.queueStatusDispatchKickEnabled) {
    result.dispatchKickAttempted = true;
    try {
      const kickMetrics = await dispatchGenerationSubmitQueueBatch({
        req,
        routeLabel,
        limit: 1,
        userId,
      });
      result.dispatchKickErrors = kickMetrics.errors;
      result.dispatchKickExhausted = kickMetrics.exhausted;
      if (kickMetrics.errors > 0 || kickMetrics.exhausted > 0) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.queue.status.kick_partial_failure",
          message: "Queue status dispatch kick completed with queue errors.",
          statusCode: 200,
          userId,
          userEmail,
          metadata: {
            source_ref: sourceRef,
            generation_id: generationId,
            claimed: kickMetrics.claimed,
            submitted: kickMetrics.submitted,
            retried: kickMetrics.retried,
            requeued_no_capacity: kickMetrics.requeuedNoCapacity,
            exhausted: kickMetrics.exhausted,
            skipped: kickMetrics.skipped,
            errors: kickMetrics.errors,
          },
        });
      }
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.status.kick_failed",
        message: "Queue status dispatch kick failed; continuing with status read.",
        statusCode: 500,
        userId,
        userEmail,
        metadata: {
          source_ref: sourceRef,
          generation_id: generationId,
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (!flags.queueStatusRecoveryKickEnabled) {
    return result;
  }

  result.recoveryKickAttempted = true;
  const recoveryClaim = await claimDueQueueStatusRecovery({
    userId,
    generationId,
    sourceRef,
  });
  result.recoveryClaimReason = recoveryClaim.reason;
  result.recoveryClaimed = recoveryClaim.claimed;

  if (recoveryClaim.reason === "db_error") {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "telemetry.queue.status.recovery_claim_failed",
      message: "Queue status recovery claim failed at claim stage; continuing with status read.",
      statusCode: 500,
      userId,
      userEmail,
      metadata: {
        source_ref: sourceRef,
        generation_id: generationId,
        claim_reason: recoveryClaim.reason,
        detail: recoveryClaim.errorMessage,
      },
    });
  }

  if (recoveryClaim.claimed && recoveryClaim.generationId) {
    try {
      await executeGenerationRecovery({
        actor: "status_proxy",
        generationId: recoveryClaim.generationId,
        requestId: recoveryClaim.requestId,
        userId,
        maxAttempts: flags.reconcilerMaxAttempts,
        routeLabel,
      });
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.queue.status.recovery_kick_failed",
        message: "Queue status recovery execution failed; continuing with status read.",
        statusCode: 500,
        userId,
        userEmail,
        metadata: {
          source_ref: sourceRef,
          generation_id: generationId,
          claimed_generation_id: recoveryClaim.generationId,
          claim_reason: recoveryClaim.reason,
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return result;
};
