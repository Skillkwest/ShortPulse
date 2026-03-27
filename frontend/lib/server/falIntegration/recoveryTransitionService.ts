import { updateGenerationAttemptState } from "../api/generationAttempts";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
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

const applyAttemptTransitionBestEffort = async ({
  generation,
  transition,
}: {
  generation: RecoveryGenerationRow;
  transition: RecoveryAttemptTransition;
}) => {
  if (!generation.request_id) return;
  const result = await updateGenerationAttemptState({
    providerRequestId: generation.request_id,
    userId: generation.user_id,
    status: transition.status,
    observedAt: transition.observedAt,
    completedAt: transition.completedAt ?? null,
    failureReasonCode: transition.failureReasonCode ?? null,
    errorMessage: transition.errorMessage ?? null,
    metadata: transition.metadata ?? {},
  });
  if (!result.ok && result.error !== "attempt_not_found") {
    throw new Error(result.error);
  }
};

export const applyRecoveryTransition = async ({
  generation,
  generationUpdates = null,
  attemptTransition = null,
}: ApplyRecoveryTransitionInput): Promise<void> => {
  if (attemptTransition) {
    await applyAttemptTransitionBestEffort({
      generation,
      transition: attemptTransition,
    });
  }
  if (generationUpdates) {
    await applyGenerationRecoveryUpdates({
      generation,
      updates: generationUpdates,
    });
  }
};
