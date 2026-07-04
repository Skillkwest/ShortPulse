/**
 * Pure policy helpers for shared generation recovery execution.
 */
import type { GenerationAbandonmentContext } from "../api/generationAbandonment";

export type JsonObject = Record<string, unknown>;

export type RecoveryActor = "reconciler" | "admin_replay" | "webhook" | "poll" | "user_reconcile";

export type RecoveryTerminalAbandonmentPolicy = {
  abandonment: GenerationAbandonmentContext;
  metadata: JsonObject;
  ignoredLegacyAbandonment: boolean;
};

export const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

export const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const buildRecoveryOutputMetadata = ({
  actor,
  autosaveDecision,
  autosaveDecisionReason,
  autosavePreferenceSource,
  visibilityState,
}: {
  actor: RecoveryActor;
  autosaveDecision: "autosave_skipped" | "auto_persisted";
  autosaveDecisionReason: string;
  autosavePreferenceSource: string;
  visibilityState: "settlement_pending" | "settled";
}): JsonObject => ({
  actor,
  autosave_preference_source: autosavePreferenceSource,
  autosave_decision: autosaveDecision,
  autosave_decision_reason: autosaveDecisionReason,
  recovery_execution: true,
  recovery_visibility_state: visibilityState,
});

export const readMetadataObject = (metadata: JsonObject, ...keys: string[]): JsonObject => {
  for (const key of keys) {
    const value = metadata[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonObject;
    }
  }
  return {};
};

const clearLegacyLocalAbandonmentMetadata = ({
  actor,
  metadata,
  nowIso,
}: {
  actor: RecoveryActor;
  metadata: JsonObject;
  nowIso: string;
}): JsonObject => {
  const remaining = { ...metadata };
  delete remaining.user_abandoned;
  delete remaining.abandoned_no_refund;
  delete remaining.abandoned_at;
  delete remaining.abandon_reason;
  delete remaining.no_refund;
  delete remaining.hidden_in_reference_grid;
  delete remaining.hiddenInReferenceGrid;
  return {
    ...remaining,
    legacy_abandonment_recovered_at: nowIso,
    legacy_abandonment_recovery_actor: actor,
  };
};

export const resolveTerminalAbandonmentPolicy = ({
  actor,
  abandonment,
  generation,
  metadata,
  nowIso,
}: {
  actor: RecoveryActor;
  abandonment: GenerationAbandonmentContext;
  generation: {
    failure_reason_code: string | null;
  };
  metadata: JsonObject;
  nowIso: string;
}): RecoveryTerminalAbandonmentPolicy => {
  const isLegacyLocalAbandonment =
    abandonment.abandoned &&
    asOptionalString(generation.failure_reason_code)?.toLowerCase() === "user_abandoned" &&
    metadata.reference_grid_suppressed !== true;

  if (!isLegacyLocalAbandonment) {
    return {
      abandonment,
      metadata,
      ignoredLegacyAbandonment: false,
    };
  }

  return {
    abandonment: { abandoned: false, noRefund: false, source: null },
    metadata: clearLegacyLocalAbandonmentMetadata({ actor, metadata, nowIso }),
    ignoredLegacyAbandonment: true,
  };
};

export const resolveGenerationAgeSeconds = (createdAtIso: string, now: Date): number => {
  const createdAtMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdAtMs)) return Number.POSITIVE_INFINITY;
  const diffMs = now.getTime() - createdAtMs;
  return Math.max(0, Math.floor(diffMs / 1000));
};

export const isTerminalMediaPersistenceError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("media_files insert failed") &&
    normalized.includes("media_files_user_id_fkey")
  );
};
