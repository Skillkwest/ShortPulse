import type { ReservationRpcResult, ReservationRpcState } from "../generationBilling/types";
import type { QueueMutationResult } from "./service";

type QueueTransitionStep =
  | "reservation_submitted"
  | "generation_attempt_recorded"
  | "generation_mark_running"
  | "identity_check"
  | "queue_retry"
  | "queue_exhaust"
  | "queue_release"
  | "queue_remove";

type QueueTransitionCompensationAction = "retry" | "exhaust";

export class QueueTransitionError extends Error {
  readonly code: string;
  readonly step: QueueTransitionStep;
  readonly retryable: boolean;

  constructor({
    code,
    step,
    message,
    retryable,
  }: {
    code: string;
    step: QueueTransitionStep;
    message: string;
    retryable: boolean;
  }) {
    super(message);
    this.code = code;
    this.step = step;
    this.retryable = retryable;
  }
}

const acceptedReservationStatuses = new Set<ReservationRpcState>([
  "reserved",
  "already_reserved",
  "already_captured",
]);

const retryableReservationStatuses = new Set<ReservationRpcState>(["failed"]);

export const assertReservationSubmissionAccepted = ({
  result,
}: {
  result: ReservationRpcResult;
}): void => {
  if (acceptedReservationStatuses.has(result.status)) {
    return;
  }
  const code = `RESERVATION_SUBMIT_${String(result.status).toUpperCase()}`;
  throw new QueueTransitionError({
    code,
    step: "reservation_submitted",
    message: result.message ?? "Reservation submit could not be confirmed.",
    retryable: retryableReservationStatuses.has(result.status),
  });
};

export const assertGenerationMarkedRunning = ({
  affectedCount,
  errorMessage,
}: {
  affectedCount: number;
  errorMessage: string | null;
}): void => {
  if (errorMessage) {
    throw new QueueTransitionError({
      code: "GENERATION_MARK_RUNNING_DB_ERROR",
      step: "generation_mark_running",
      message: errorMessage,
      retryable: true,
    });
  }
  if (affectedCount === 1) {
    return;
  }
  throw new QueueTransitionError({
    code:
      affectedCount === 0
        ? "GENERATION_MARK_RUNNING_NOT_FOUND"
        : "GENERATION_MARK_RUNNING_AFFECTED_COUNT",
    step: "generation_mark_running",
    message: `Expected one generation row update, received ${affectedCount}.`,
    retryable: false,
  });
};

export const assertGenerationAttemptRecorded = ({
  ok,
  errorMessage,
}: {
  ok: boolean;
  errorMessage: string | null;
}): void => {
  if (ok) {
    return;
  }
  throw new QueueTransitionError({
    code: "GENERATION_ATTEMPT_RECORD_FAILED",
    step: "generation_attempt_recorded",
    message: errorMessage ?? "Generation attempt could not be persisted.",
    retryable: true,
  });
};

export const assertQueueMutationApplied = ({
  result,
  step,
}: {
  result: QueueMutationResult;
  step: QueueTransitionStep;
}): void => {
  if (result.ok) {
    return;
  }
  throw new QueueTransitionError({
    code: `QUEUE_${result.operation.toUpperCase()}_${result.reason.toUpperCase()}`,
    step,
    message:
      result.errorMessage ??
      `Queue mutation ${result.operation} failed (${result.reason}) for ${result.queueId}.`,
    retryable: result.reason === "db_error",
  });
};

export const assertQueueIdentityInvariant = ({
  queueSourceRef,
  generationSourceRef,
  reservationSourceRef,
}: {
  queueSourceRef: string;
  generationSourceRef?: string | null;
  reservationSourceRef?: string | null;
}): void => {
  if (generationSourceRef && generationSourceRef !== queueSourceRef) {
    throw new QueueTransitionError({
      code: "QUEUE_IDENTITY_MISMATCH",
      step: "identity_check",
      message: `Generation metadata source_ref mismatch for queued submit (${generationSourceRef} != ${queueSourceRef}).`,
      retryable: false,
    });
  }
  if (reservationSourceRef && reservationSourceRef !== queueSourceRef) {
    throw new QueueTransitionError({
      code: "QUEUE_IDENTITY_MISMATCH",
      step: "identity_check",
      message: `Reservation source_ref mismatch for queued submit (${reservationSourceRef} != ${queueSourceRef}).`,
      retryable: false,
    });
  }
};

export const decideQueueTransitionCompensation = ({
  attemptNumber,
  maxAttempts,
  error,
  submitAccepted,
}: {
  attemptNumber: number;
  maxAttempts: number;
  error: unknown;
  submitAccepted: boolean;
}): QueueTransitionCompensationAction => {
  if (attemptNumber >= maxAttempts) {
    return "exhaust";
  }
  if (
    submitAccepted &&
    error instanceof QueueTransitionError &&
    (error.step === "generation_mark_running" || error.step === "generation_attempt_recorded")
  ) {
    // Provider already accepted the submit; retrying this queue item could double-submit.
    return "exhaust";
  }
  if (error instanceof QueueTransitionError && error.retryable) {
    return "retry";
  }
  return "exhaust";
};
