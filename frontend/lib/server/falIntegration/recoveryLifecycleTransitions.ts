/**
 * Recovery lifecycle transition helpers.
 * Keeps update payload shaping and retry/exhaustion policy centralized.
 */

type JsonObject = Record<string, unknown>;
type RecoveryLifecycleActor = "reconciler" | "admin_replay" | "webhook" | "poll" | "user_reconcile";

export type RecoveryRetryPlan = {
  isExhausted: boolean;
  exhaustionDeferredByMinAge: boolean;
  recoveryState: "queued" | "exhausted";
  nextRecoveryAt: string | null;
};

export const buildRecoveryRetryPlan = ({
  attempts,
  effectiveMaxAttempts,
  nextDelaySeconds,
  generationAgeSeconds = Number.POSITIVE_INFINITY,
  exhaustMinAgeSeconds = 0,
  enforceMinAgeForExhaustion = false,
}: {
  attempts: number;
  effectiveMaxAttempts: number;
  nextDelaySeconds: number;
  generationAgeSeconds?: number;
  exhaustMinAgeSeconds?: number;
  enforceMinAgeForExhaustion?: boolean;
}): RecoveryRetryPlan => {
  const reachedAttemptBudget = attempts >= effectiveMaxAttempts;
  const reachedExhaustAge = generationAgeSeconds >= Math.max(exhaustMinAgeSeconds, 0);
  const exhaustionDeferredByMinAge =
    enforceMinAgeForExhaustion && reachedAttemptBudget && !reachedExhaustAge;
  const isExhausted = reachedAttemptBudget && (!enforceMinAgeForExhaustion || reachedExhaustAge);
  return {
    isExhausted,
    exhaustionDeferredByMinAge,
    recoveryState: isExhausted ? "exhausted" : "queued",
    nextRecoveryAt: isExhausted
      ? null
      : new Date(Date.now() + nextDelaySeconds * 1000).toISOString(),
  };
};

export const buildMissingRequestUpdate = (nowIso: string): Record<string, unknown> => ({
  recovery_state: "exhausted",
  failure_reason_code: "recovery_exhausted",
  next_recovery_at: null,
  last_recovery_at: nowIso,
});

export const buildAlreadyPersistedSuccessUpdate = ({
  completedAt,
  nowIso,
}: {
  completedAt: string | null;
  nowIso: string;
}): Record<string, unknown> => ({
  status: "success",
  completed_at: completedAt ?? nowIso,
  recovery_state: "recovered",
  next_recovery_at: null,
  last_recovery_at: nowIso,
  last_media_detected_at: nowIso,
  failure_reason_code: null,
});

export const buildProviderRunningUpdate = ({
  nowIso,
  attempts,
  retryPlan,
}: {
  nowIso: string;
  attempts: number;
  retryPlan: RecoveryRetryPlan;
}): Record<string, unknown> => {
  if (retryPlan.isExhausted) {
    return {
      status: "fail",
      completed_at: nowIso,
      recovery_state: "exhausted",
      failure_reason_code: "recovery_exhausted",
      last_recovery_at: nowIso,
      next_recovery_at: null,
    };
  }

  return {
    recovery_state: "queued",
    failure_reason_code: null,
    last_recovery_at: nowIso,
    next_recovery_at: retryPlan.nextRecoveryAt,
    recovery_attempts: retryPlan.exhaustionDeferredByMinAge ? Math.max(attempts - 1, 0) : attempts,
  };
};

export const buildProviderFailedUpdate = (
  nowIso: string,
  failureReasonCode = "provider_error"
): Record<string, unknown> => ({
  status: "fail",
  completed_at: nowIso,
  failure_reason_code: failureReasonCode,
  recovery_state: "exhausted",
  last_recovery_at: nowIso,
  next_recovery_at: null,
});

export const buildNoMediaUpdate = ({
  nowIso,
  attempts,
  retryPlan,
}: {
  nowIso: string;
  attempts?: number;
  retryPlan: RecoveryRetryPlan;
}): Record<string, unknown> => {
  if (retryPlan.isExhausted) {
    return {
      status: "fail",
      completed_at: nowIso,
      failure_reason_code: "terminal_success_no_media",
      recovery_state: retryPlan.recoveryState,
      last_recovery_at: nowIso,
      next_recovery_at: retryPlan.nextRecoveryAt,
    };
  }

  const update: Record<string, unknown> = {
    failure_reason_code: "terminal_success_no_media",
    recovery_state: retryPlan.recoveryState,
    last_recovery_at: nowIso,
    next_recovery_at: retryPlan.nextRecoveryAt,
  };
  if (typeof attempts === "number") {
    update.recovery_attempts = retryPlan.exhaustionDeferredByMinAge
      ? Math.max(attempts - 1, 0)
      : attempts;
  }
  return update;
};

export const buildRecoveredSuccessUpdate = ({
  nowIso,
  metadata,
  actor,
  autosaveEnabled,
  autosaveDecision,
  autosaveDecisionReason,
}: {
  nowIso: string;
  metadata: JsonObject;
  actor: RecoveryLifecycleActor;
  autosaveEnabled?: boolean;
  autosaveDecision?: string;
  autosaveDecisionReason?: string;
}): Record<string, unknown> => ({
  status: "success",
  completed_at: nowIso,
  metadata: {
    ...metadata,
    recovery_execution_at: nowIso,
    recovery_execution_actor: actor,
    autosave_enabled: autosaveEnabled ?? true,
    autosave_decision: autosaveDecision ?? "auto_persisted",
    autosave_decision_reason: autosaveDecisionReason ?? "auto_allowed",
    autosave_skipped: autosaveDecision === "autosave_skipped",
  },
  recovery_state: "recovered",
  last_recovery_at: nowIso,
  next_recovery_at: null,
  last_media_detected_at: nowIso,
  failure_reason_code: null,
});
