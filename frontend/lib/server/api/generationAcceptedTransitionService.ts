/**
 * Coordinates accepted submit transitions so forward-path callers do not each
 * hand-roll the same generation-row and attempt-running mutation sequence.
 */
import { ensureAcceptedRunningGenerationAttempt } from "./generationAttempts";

type ApplyGenerationMutationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type ApplyAcceptedRunningGenerationTransitionInput = {
  applyGenerationMutation?: (() => Promise<ApplyGenerationMutationResult>) | null;
  attemptInput: Parameters<typeof ensureAcceptedRunningGenerationAttempt>[0];
};

export type AcceptedRunningGenerationTransitionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      stage: "generation" | "record" | "running";
      error: string;
    };

export const applyAcceptedRunningGenerationTransition = async ({
  applyGenerationMutation = null,
  attemptInput,
}: ApplyAcceptedRunningGenerationTransitionInput): Promise<AcceptedRunningGenerationTransitionResult> => {
  if (applyGenerationMutation) {
    const generationResult = await applyGenerationMutation();
    if (!generationResult.ok) {
      return {
        ok: false,
        stage: "generation",
        error: generationResult.error,
      };
    }
  }

  const attemptResult = await ensureAcceptedRunningGenerationAttempt(attemptInput);
  if (!attemptResult.ok) {
    return {
      ok: false,
      stage: attemptResult.stage,
      error: attemptResult.error,
    };
  }

  return { ok: true };
};
