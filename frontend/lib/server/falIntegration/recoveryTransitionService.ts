import { applyGenerationLifecycleTransition } from "../api/generationLifecycleTransitionService";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { releaseMotionReferenceVideoLeasesForGeneration } from "../motionReferenceVideoAssetLease";
import type { RecoveryGenerationRow } from "./recoveryGenerationLookup";

type JsonObject = Record<string, unknown>;

type RecoveryAttemptTransition = {
  status: "running" | "succeeded" | "failed" | "timed_out";
  observedAt: string;
  completedAt?: string | null;
  failureReasonCode?: string | null;
  errorMessage?: string | null;
  metadata?: JsonObject;
};

type ApplyRecoveryTransitionInput = {
  generation: RecoveryGenerationRow;
  generationUpdates?: Record<string, unknown> | null;
  attemptTransition?: RecoveryAttemptTransition | null;
};

const applyGenerationRecoveryUpdates = async ({
  generation,
  updates,
}: {
  generation: RecoveryGenerationRow;
  updates: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update(updates)
    .eq("id", generation.id)
    .eq("user_id", generation.user_id);
  if (error) throw error;
};

export const applyRecoveryTransition = async ({
  generation,
  generationUpdates = null,
  attemptTransition = null,
}: ApplyRecoveryTransitionInput): Promise<void> => {
  const intent =
    attemptTransition?.status === "running"
      ? "provider_running_observed"
      : attemptTransition?.status === "succeeded"
        ? "provider_completed_observed"
        : attemptTransition?.status === "failed"
          ? "provider_failed_observed"
          : attemptTransition?.status === "timed_out"
            ? "provider_timed_out"
            : generationUpdates
              ? "completion_finalized"
              : "outputs_recorded";
  const result = await applyGenerationLifecycleTransition({
    intent,
    applyGenerationMutation: generationUpdates
      ? async () => {
          try {
            await applyGenerationRecoveryUpdates({
              generation,
              updates: generationUpdates,
            });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      : null,
    attemptMutation:
      attemptTransition && generation.request_id
        ? {
            kind: "state_update",
            input: {
              providerRequestId: generation.request_id,
              userId: generation.user_id,
              status: attemptTransition.status,
              observedAt: attemptTransition.observedAt,
              completedAt: attemptTransition.completedAt ?? null,
              failureReasonCode: attemptTransition.failureReasonCode ?? null,
              errorMessage: attemptTransition.errorMessage ?? null,
              metadata: attemptTransition.metadata ?? {},
            },
            allowMissingAttempt: true,
          }
        : null,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  const resolvedStatus =
    generationUpdates && typeof generationUpdates.status === "string"
      ? generationUpdates.status.trim().toLowerCase()
      : null;
  const resolvedCompletedAt =
    generationUpdates && typeof generationUpdates.completed_at === "string"
      ? generationUpdates.completed_at.trim()
      : null;
  const shouldReleaseMotionReferenceLease =
    Boolean(resolvedCompletedAt) || resolvedStatus === "success" || resolvedStatus === "fail";
  if (!shouldReleaseMotionReferenceLease) return;

  try {
    await releaseMotionReferenceVideoLeasesForGeneration({
      generationId: generation.id,
      userId: generation.user_id,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.motion_reference_video.lease_release_failed",
      message: "Motion reference video lease release failed after recovery transition.",
      requestId: generation.request_id,
      userId: generation.user_id,
      statusCode: 200,
      metadata: {
        generation_id: generation.id,
        recovery_status: resolvedStatus,
        lease_error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }
};
