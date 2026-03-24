/**
 * Recovery lifecycle transition helpers.
 * Keeps update payload shaping and queue/exhaustion policy centralized.
 */

type JsonObject = Record<string, unknown>;

export type RecoveryQueuePlan = {
  isExhausted: boolean;
  exhaustionDeferredByMinAge: boolean;
  recoveryState: "queued" | "exhausted";
  nextRecoveryAt: string | null;
};

export const buildRecoveryQueuePlan = ({
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
}): RecoveryQueuePlan => {
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
  queuePlan,
}: {
  nowIso: string;
  attempts: number;
  queuePlan: RecoveryQueuePlan;
}): Record<string, unknown> => {
  if (queuePlan.isExhausted) {
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
    next_recovery_at: queuePlan.nextRecoveryAt,
    recovery_attempts: queuePlan.exhaustionDeferredByMinAge ? Math.max(attempts - 1, 0) : attempts,
  };
};

export const buildProviderFailedUpdate = (nowIso: string): Record<string, unknown> => ({
  status: "fail",
  completed_at: nowIso,
  failure_reason_code: "provider_error",
  recovery_state: "exhausted",
  last_recovery_at: nowIso,
  next_recovery_at: null,
});

export const buildNoMediaUpdate = ({
  nowIso,
  queuePlan,
}: {
  nowIso: string;
  queuePlan: RecoveryQueuePlan;
}): Record<string, unknown> => ({
  status: "fail",
  completed_at: nowIso,
  failure_reason_code: "terminal_success_no_media",
  recovery_state: queuePlan.recoveryState,
  last_recovery_at: nowIso,
  next_recovery_at: queuePlan.nextRecoveryAt,
});

export const buildRecoveredSuccessUpdate = ({
  nowIso,
  metadata,
  mediaUrls,
  mediaFileIds,
  actor,
  autosaveEnabled,
  autosaveDecision,
  autosaveDecisionReason,
}: {
  nowIso: string;
  metadata: JsonObject;
  mediaUrls: string[];
  mediaFileIds: string[];
  actor: "reconciler" | "admin_replay" | "webhook";
  autosaveEnabled?: boolean;
  autosaveDecision?: string;
  autosaveDecisionReason?: string;
}): Record<string, unknown> => ({
  status: "success",
  completed_at: nowIso,
  metadata: {
    ...metadata,
    result_urls: mediaUrls,
    media_file_ids: mediaFileIds,
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
