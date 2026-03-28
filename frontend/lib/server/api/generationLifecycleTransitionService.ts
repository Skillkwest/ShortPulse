/**
 * Shared lifecycle orchestrator for forward-path generation mutations.
 * It coordinates generation-row updates with either accepted-running attempt
 * creation or attempt state updates so callers can share one ordering model.
 */
import {
  ensureAcceptedRunningGenerationAttempt,
  updateGenerationAttemptState,
} from "./generationAttempts";

type TransitionStage = "generation" | "record" | "running" | "attempt";

type GenerationMutationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type AttemptMutationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      stage: Exclude<TransitionStage, "generation">;
      error: string;
    };

type AcceptedRunningAttemptMutation = {
  kind: "accepted_running";
  input: Parameters<typeof ensureAcceptedRunningGenerationAttempt>[0];
};

type AttemptStateMutation = {
  kind: "state_update";
  input: Parameters<typeof updateGenerationAttemptState>[0];
  allowMissingAttempt?: boolean;
};

type AttemptMutation = AcceptedRunningAttemptMutation | AttemptStateMutation;

type ApplyGenerationLifecycleTransitionInput = {
  order?: "generation_first" | "attempt_first";
  applyGenerationMutation?: (() => Promise<GenerationMutationResult>) | null;
  attemptMutation?: AttemptMutation | null;
};

export type GenerationLifecycleTransitionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      stage: TransitionStage;
      error: string;
    };

const runAttemptMutation = async (
  mutation: AttemptMutation | null
): Promise<AttemptMutationResult> => {
  if (!mutation) return { ok: true };

  if (mutation.kind === "accepted_running") {
    const result = await ensureAcceptedRunningGenerationAttempt(mutation.input);
    if (!result.ok) {
      return {
        ok: false,
        stage: result.stage,
        error: result.error,
      };
    }
    return { ok: true };
  }

  const result = await updateGenerationAttemptState(mutation.input);
  if (!result.ok) {
    if (mutation.allowMissingAttempt && result.error === "attempt_not_found") {
      return { ok: true };
    }
    return {
      ok: false,
      stage: "attempt",
      error: result.error,
    };
  }
  return { ok: true };
};

const runGenerationMutation = async (
  applyGenerationMutation: (() => Promise<GenerationMutationResult>) | null
): Promise<GenerationMutationResult> => {
  if (!applyGenerationMutation) return { ok: true };
  return applyGenerationMutation();
};

export const applyGenerationLifecycleTransition = async ({
  order = "generation_first",
  applyGenerationMutation = null,
  attemptMutation = null,
}: ApplyGenerationLifecycleTransitionInput): Promise<GenerationLifecycleTransitionResult> => {
  if (order === "attempt_first") {
    const attemptResult = await runAttemptMutation(attemptMutation);
    if (!attemptResult.ok) {
      return attemptResult;
    }

    const generationResult = await runGenerationMutation(applyGenerationMutation);
    if (!generationResult.ok) {
      return {
        ok: false,
        stage: "generation",
        error: generationResult.error,
      };
    }

    return { ok: true };
  }

  const generationResult = await runGenerationMutation(applyGenerationMutation);
  if (!generationResult.ok) {
    return {
      ok: false,
      stage: "generation",
      error: generationResult.error,
    };
  }

  const attemptResult = await runAttemptMutation(attemptMutation);
  if (!attemptResult.ok) {
    return attemptResult;
  }

  return { ok: true };
};
