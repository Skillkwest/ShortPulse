/**
 * Coordinates accepted submit transitions so forward-path callers do not each
 * hand-roll the same generation-row and attempt-running mutation sequence.
 */
import { applyGenerationLifecycleTransition } from "./generationLifecycleTransitionService";

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
  attemptInput: Parameters<
    typeof import("./generationAttempts").ensureAcceptedRunningGenerationAttempt
  >[0];
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
  const result = await applyGenerationLifecycleTransition({
    intent: "provider_submit_accepted",
    applyGenerationMutation,
    attemptMutation: {
      kind: "accepted_running",
      input: attemptInput,
    },
  });

  if (result.ok) return result;
  return {
    ok: false,
    stage:
      result.stage === "request"
        ? "generation"
        : result.stage === "attempt_record"
          ? "record"
          : "running",
    error: result.error,
  };
};
