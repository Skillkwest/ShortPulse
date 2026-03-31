/**
 * Shared lifecycle orchestrator for forward-path generation mutations.
 * It coordinates generation-row updates with either accepted-running attempt
 * creation or attempt state updates so callers can share one ordering model.
 */
import {
  ensureAcceptedRunningGenerationAttempt,
  updateGenerationAttemptState,
} from "./generationAttempts";

export type PostSubmitGenerationLifecycleIntent =
  | "provider_submit_accepted"
  | "queue_dispatch_started"
  | "queue_dispatch_retry"
  | "queue_dispatch_exhausted"
  | "queue_reconcile_running"
  | "request_id_repaired"
  | "provider_running_observed"
  | "provider_completed_observed"
  | "provider_failed_observed"
  | "provider_timed_out"
  | "outputs_recorded"
  | "completion_finalized";

type TransitionOrder = "generation_first" | "attempt_first";

export type GenerationLifecycleTransitionStage =
  | "request"
  | "attempt_record"
  | "attempt_state"
  | "output_record"
  | "completion";

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
      stage: Exclude<
        GenerationLifecycleTransitionStage,
        "request" | "output_record" | "completion"
      >;
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

type TransitionIntentSpec = {
  order: TransitionOrder;
  requiredAttemptMutationKind: AttemptMutation["kind"] | null;
  allowedAttemptStatuses?: ReadonlyArray<AttemptStateMutation["input"]["status"]>;
};

const POST_SUBMIT_TRANSITION_SPECS: Record<
  PostSubmitGenerationLifecycleIntent,
  TransitionIntentSpec
> = {
  provider_submit_accepted: {
    order: "generation_first",
    requiredAttemptMutationKind: "accepted_running",
  },
  queue_dispatch_started: {
    order: "generation_first",
    requiredAttemptMutationKind: null,
  },
  queue_dispatch_retry: {
    order: "generation_first",
    requiredAttemptMutationKind: null,
  },
  queue_dispatch_exhausted: {
    order: "generation_first",
    requiredAttemptMutationKind: null,
  },
  queue_reconcile_running: {
    order: "attempt_first",
    requiredAttemptMutationKind: "state_update",
    allowedAttemptStatuses: ["running"],
  },
  request_id_repaired: {
    order: "attempt_first",
    requiredAttemptMutationKind: "accepted_running",
  },
  provider_running_observed: {
    order: "attempt_first",
    requiredAttemptMutationKind: "state_update",
    allowedAttemptStatuses: ["running"],
  },
  provider_completed_observed: {
    order: "attempt_first",
    requiredAttemptMutationKind: "state_update",
    allowedAttemptStatuses: ["succeeded"],
  },
  provider_failed_observed: {
    order: "attempt_first",
    requiredAttemptMutationKind: "state_update",
    allowedAttemptStatuses: ["failed"],
  },
  provider_timed_out: {
    order: "attempt_first",
    requiredAttemptMutationKind: "state_update",
    allowedAttemptStatuses: ["timed_out"],
  },
  outputs_recorded: {
    order: "generation_first",
    requiredAttemptMutationKind: null,
  },
  completion_finalized: {
    order: "generation_first",
    requiredAttemptMutationKind: null,
  },
};

type ApplyGenerationLifecycleTransitionInput = {
  intent: PostSubmitGenerationLifecycleIntent;
  applyGenerationMutation?: (() => Promise<GenerationMutationResult>) | null;
  attemptMutation?: AttemptMutation | null;
};

export type GenerationLifecycleTransitionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      stage: GenerationLifecycleTransitionStage;
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
        stage: result.stage === "record" ? "attempt_record" : "attempt_state",
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
      stage: "attempt_state",
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

const validateTransitionIntent = ({
  intent,
  attemptMutation,
}: {
  intent: PostSubmitGenerationLifecycleIntent;
  attemptMutation: AttemptMutation | null;
}): { ok: true; spec: TransitionIntentSpec } | { ok: false; error: string } => {
  const spec = POST_SUBMIT_TRANSITION_SPECS[intent];

  if (!attemptMutation) {
    if (spec.requiredAttemptMutationKind) {
      return {
        ok: false,
        error: `attempt_mutation_required_for_${intent}`,
      };
    }
    return { ok: true, spec };
  }

  if (!spec.requiredAttemptMutationKind) {
    return {
      ok: false,
      error: `attempt_mutation_not_allowed_for_${intent}`,
    };
  }

  if (attemptMutation.kind !== spec.requiredAttemptMutationKind) {
    return {
      ok: false,
      error: `invalid_attempt_mutation_for_${intent}`,
    };
  }

  if (
    attemptMutation.kind === "state_update" &&
    spec.allowedAttemptStatuses &&
    !spec.allowedAttemptStatuses.includes(attemptMutation.input.status)
  ) {
    return {
      ok: false,
      error: `invalid_attempt_status_for_${intent}`,
    };
  }

  return { ok: true, spec };
};

export const applyGenerationLifecycleTransition = async ({
  intent,
  applyGenerationMutation = null,
  attemptMutation = null,
}: ApplyGenerationLifecycleTransitionInput): Promise<GenerationLifecycleTransitionResult> => {
  const validation = validateTransitionIntent({
    intent,
    attemptMutation,
  });
  if (!validation.ok) {
    return {
      ok: false,
      stage: "request",
      error: validation.error,
    };
  }

  const {
    spec: { order },
  } = validation;

  if (order === "attempt_first") {
    const attemptResult = await runAttemptMutation(attemptMutation);
    if (!attemptResult.ok) {
      return attemptResult;
    }

    const generationResult = await runGenerationMutation(applyGenerationMutation);
    if (!generationResult.ok) {
      return {
        ok: false,
        stage: "request",
        error: generationResult.error,
      };
    }

    return { ok: true };
  }

  const generationResult = await runGenerationMutation(applyGenerationMutation);
  if (!generationResult.ok) {
    return {
      ok: false,
      stage: "request",
      error: generationResult.error,
    };
  }

  const attemptResult = await runAttemptMutation(attemptMutation);
  if (!attemptResult.ok) {
    return attemptResult;
  }

  return { ok: true };
};
