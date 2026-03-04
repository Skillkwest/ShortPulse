import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException, logGenerationFailure } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import { dispatchGenerationSubmitQueueBatch } from "../../../lib/server/api/generationQueue/dispatch";
import { claimDueQueueStatusRecovery } from "../../../lib/server/api/generationQueue/statusRecoveryKick";
import { readGenerationQueueStatus } from "../../../lib/server/api/generationQueue/service";
import { executeGenerationRecovery } from "../../../lib/server/falIntegration/recoveryExecution";

const asQueryString = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") {
      const trimmed = first.trim();
      return trimmed.length ? trimmed : null;
    }
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const flags = readFalRuntimeFlags();
  if (!flags.queueEnabled) {
    return res.status(404).json({ error: "Not found" });
  }

  const sourceRef = asQueryString(req.query.sourceRef);
  const generationId = asQueryString(req.query.generationId);
  if (!sourceRef && !generationId) {
    return res.status(400).json({
      error: "Either sourceRef or generationId is required.",
    });
  }

  try {
    const queueStatusDispatchKickEnabled = flags.queueStatusDispatchKickEnabled ?? true;
    if (queueStatusDispatchKickEnabled) {
      try {
        const kickMetrics = await dispatchGenerationSubmitQueueBatch({
          req,
          routeLabel: "api/fal/queue-status",
          limit: 1,
          userId: user.id,
        });
        if (kickMetrics.errors > 0 || kickMetrics.exhausted > 0) {
          await logGenerationFailure({
            req,
            routeLabel: "api/fal/queue-status",
            source: "telemetry.queue.status.kick_partial_failure",
            message: "Queue status dispatch kick completed with queue errors.",
            statusCode: 200,
            userId: user.id,
            userEmail: user.email ?? null,
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
          routeLabel: "api/fal/queue-status",
          source: "telemetry.queue.status.kick_failed",
          message: "Queue status dispatch kick failed; continuing with status read.",
          statusCode: 500,
          userId: user.id,
          userEmail: user.email ?? null,
          metadata: {
            source_ref: sourceRef,
            generation_id: generationId,
            detail: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    const recoveryClaim = await claimDueQueueStatusRecovery({
      userId: user.id,
      generationId,
      sourceRef,
    });
    if (recoveryClaim.reason === "db_error") {
      await logGenerationFailure({
        req,
        routeLabel: "api/fal/queue-status",
        source: "telemetry.queue.status.recovery_claim_failed",
        message: "Queue status recovery claim failed at claim stage; continuing with status read.",
        statusCode: 500,
        userId: user.id,
        userEmail: user.email ?? null,
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
          userId: user.id,
          maxAttempts: flags.reconcilerMaxAttempts,
          routeLabel: "api/fal/queue-status",
        });
      } catch (error) {
        await logGenerationFailure({
          req,
          routeLabel: "api/fal/queue-status",
          source: "telemetry.queue.status.recovery_kick_failed",
          message: "Queue status recovery execution failed; continuing with status read.",
          statusCode: 500,
          userId: user.id,
          userEmail: user.email ?? null,
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

    const status = await readGenerationQueueStatus({
      userId: user.id,
      sourceRef,
      generationId,
    });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(status);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/fal/queue-status",
      user,
      metadata: {
        source_ref: sourceRef,
        generation_id: generationId,
      },
    });
    return res.status(500).json({
      error: "Unable to resolve queued generation status.",
    });
  }
}
