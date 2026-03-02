/**
 * Shared generation recovery execution engine.
 * Centralizes retrieval, persistence, settlement, and lifecycle transitions.
 */
import { settleGenerationOutcome } from "../api/generationBilling";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  canTransitionToSuccess,
  collectRecoveredUrls,
  resolveRetryDelaySeconds,
} from "./recoveryExecutionRuntime";
import { readRecoveryGenerationRow, type RecoveryGenerationRow } from "./recoveryGenerationLookup";
import {
  buildAlreadyPersistedSuccessUpdate,
  buildMissingRequestUpdate,
  buildNoMediaUpdate,
  buildProviderFailedUpdate,
  buildProviderRunningUpdate,
  buildRecoveredSuccessUpdate,
  buildRecoveryQueuePlan,
} from "./recoveryLifecycleTransitions";
import {
  persistRecoveryMediaFilesForGeneration,
  readExistingRecoveryMediaRows,
} from "./recoveryMediaPersistence";
import { probeGenerationProviderResult } from "../providerIntegration/recoveryProviderDispatcher";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import { canAutoPersistRecoveryMedia } from "../../mediaAutosavePolicy";

type JsonObject = Record<string, unknown>;

type GenerationRow = RecoveryGenerationRow;

export type RecoveryProbeState = "running" | "failed" | "completed";
export type RecoveryActor = "reconciler" | "admin_replay" | "webhook" | "status_proxy";
export type RecoveryResultState =
  | "recovered"
  | "already_persisted"
  | "no_media"
  | "provider_running"
  | "provider_failed"
  | "exhausted"
  | "skipped"
  | "missing_generation";

export type RecoveryObservation = {
  state: RecoveryProbeState;
  payload: JsonObject | null;
  mediaUrls: string[];
};

export type RecoveryExecutionResult = {
  ok: boolean;
  state: RecoveryResultState;
  generationId: string | null;
  requestId: string | null;
  mediaFileIds: string[];
  mediaUrls: string[];
  processed: boolean;
  note?: string;
};

type ExecuteRecoveryInput = {
  actor: RecoveryActor;
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
  maxAttempts?: number;
  observation?: RecoveryObservation | null;
  routeLabel: string;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const resolveGenerationAgeSeconds = (createdAtIso: string, now: Date): number => {
  const createdAtMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdAtMs)) return Number.POSITIVE_INFINITY;
  const diffMs = now.getTime() - createdAtMs;
  return Math.max(0, Math.floor(diffMs / 1000));
};

const readMediaAutosaveEnabledForUser = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("user_preferences")
      .select("media_autosave_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return true;
    const value = (data as { media_autosave_enabled?: unknown } | null)?.media_autosave_enabled;
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
};

const logRecoveryAutosaveDecisionEvent = async ({
  generationId,
  userId,
  requestId,
  actor,
  autosaveEnabled,
  autosaveDecision,
  decisionReason,
}: {
  generationId: string;
  userId: string;
  requestId: string | null;
  actor: RecoveryActor;
  autosaveEnabled: boolean;
  autosaveDecision: string;
  decisionReason: string;
}) => {
  try {
    await getSupabaseAdmin()
      .from("media_events")
      .insert({
        user_id: userId,
        event_type: "generation_autosave_decision",
        entity_type: "ai_generation",
        entity_id: generationId,
        metadata: {
          request_id: requestId,
          actor,
          autosave_enabled: autosaveEnabled,
          autosave_decision: autosaveDecision,
          decision_reason: decisionReason,
        },
      });
  } catch {
    // best-effort observability only
  }
};

const updateGenerationRecoveryState = async ({
  generation,
  updates,
}: {
  generation: GenerationRow;
  updates: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update(updates)
    .eq("id", generation.id)
    .eq("user_id", generation.user_id);
  if (error) throw error;
};

/**
 * Execute shared recovery flow for reconciler, admin replay, webhook, and status proxy.
 */
export const executeGenerationRecovery = async ({
  actor,
  generationId,
  requestId,
  userId,
  maxAttempts,
  observation,
  routeLabel,
}: ExecuteRecoveryInput): Promise<RecoveryExecutionResult> => {
  const generation = await readRecoveryGenerationRow({ generationId, requestId, userId });
  if (!generation) {
    return {
      ok: false,
      state: "missing_generation",
      generationId: null,
      requestId: requestId ?? null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: false,
      note: "generation_not_found",
    };
  }
  const runtimeFlags = readFalRuntimeFlags();
  const effectiveMaxAttempts = Math.max(maxAttempts ?? runtimeFlags.reconcilerMaxAttempts, 1);
  const runningExhaustMinAgeSeconds = Math.max(runtimeFlags.runningExhaustMinAgeSeconds, 0);
  const attempts = Number(generation.recovery_attempts ?? 0);
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const generationAgeSeconds = resolveGenerationAgeSeconds(generation.created_at, nowDate);

  if (generation.status.toLowerCase() === "success") {
    const existingRows = await readExistingRecoveryMediaRows(generation.id);
    if (existingRows.length) {
      return {
        ok: true,
        state: "already_persisted",
        generationId: generation.id,
        requestId: generation.request_id,
        mediaFileIds: existingRows.map((row) => row.id),
        mediaUrls: [],
        processed: false,
      };
    }
  }

  if (!generation.request_id) {
    await updateGenerationRecoveryState({
      generation,
      updates: buildMissingRequestUpdate(nowIso),
    });
    return {
      ok: true,
      state: "exhausted",
      generationId: generation.id,
      requestId: null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
      note: "missing_request_id",
    };
  }

  const existingRows = await readExistingRecoveryMediaRows(generation.id);
  if (existingRows.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "success",
      reason: "Recovered generation media already persisted.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
        existing_media_count: existingRows.length,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: buildAlreadyPersistedSuccessUpdate({
        completedAt: generation.completed_at,
        nowIso,
      }),
    });
    return {
      ok: true,
      state: "already_persisted",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: existingRows.map((row) => row.id),
      mediaUrls: [],
      processed: true,
    };
  }

  let currentObservation = observation ?? null;
  if (!currentObservation) {
    const apiKey = readProviderApiKey(generation.provider);
    currentObservation = await probeGenerationProviderResult({
      provider: generation.provider,
      requestId: generation.request_id,
      modelId: generation.model_id,
      apiKey,
    });
  }

  const recoveredUrls = collectRecoveredUrls({
    mediaUrls: currentObservation.mediaUrls,
    payload: currentObservation.payload,
    provider: generation.provider,
    modelId: generation.model_id,
  });

  if (currentObservation.state === "running") {
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    const queuePlan = buildRecoveryQueuePlan({
      attempts,
      effectiveMaxAttempts,
      nextDelaySeconds,
      generationAgeSeconds,
      exhaustMinAgeSeconds: runningExhaustMinAgeSeconds,
      enforceMinAgeForExhaustion: true,
    });
    if (queuePlan.isExhausted) {
      await settleGenerationOutcome({
        userId: generation.user_id,
        providerRequestId: generation.request_id,
        outcome: "fail",
        reason: "Provider remained running after recovery attempts were exhausted.",
        routeLabel,
        detail: {
          actor,
          generation_id: generation.id,
          recovery_attempts: attempts,
          recovery_max_attempts: effectiveMaxAttempts,
        },
      });
    }
    await updateGenerationRecoveryState({
      generation,
      updates: buildProviderRunningUpdate({ nowIso, attempts, queuePlan }),
    });
    return {
      ok: true,
      state: queuePlan.isExhausted ? "exhausted" : "provider_running",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (currentObservation.state === "failed") {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider reported failed state during recovery execution.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: buildProviderFailedUpdate(nowIso),
    });
    return {
      ok: true,
      state: "provider_failed",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (!recoveredUrls.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider terminal success without media payload.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    const queuePlan = buildRecoveryQueuePlan({
      attempts,
      effectiveMaxAttempts,
      nextDelaySeconds,
    });
    await updateGenerationRecoveryState({
      generation,
      updates: buildNoMediaUpdate({ nowIso, queuePlan }),
    });
    return {
      ok: true,
      state: queuePlan.isExhausted ? "exhausted" : "no_media",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (
    !canTransitionToSuccess({
      status: generation.status,
      failureReasonCode: generation.failure_reason_code,
      recoveryState: generation.recovery_state,
    })
  ) {
    return {
      ok: true,
      state: "skipped",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: recoveredUrls,
      processed: false,
      note: "transition_blocked",
    };
  }

  const mediaAutosaveEnabled = await readMediaAutosaveEnabledForUser(generation.user_id);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  if (!autosavePolicyDecision.allowed) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "success",
      reason: "Generation recovered; autosave skipped by user preference.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
        media_file_count: 0,
        autosave_enabled: mediaAutosaveEnabled,
        autosave_decision: "autosave_skipped",
        decision_reason: autosavePolicyDecision.reason,
      },
    });
    await logRecoveryAutosaveDecisionEvent({
      generationId: generation.id,
      userId: generation.user_id,
      requestId: generation.request_id,
      actor,
      autosaveEnabled: mediaAutosaveEnabled,
      autosaveDecision: "autosave_skipped",
      decisionReason: autosavePolicyDecision.reason,
    });
    await updateGenerationRecoveryState({
      generation,
      updates: buildRecoveredSuccessUpdate({
        nowIso,
        metadata: asObject(generation.metadata),
        mediaUrls: recoveredUrls,
        mediaFileIds: [],
        actor,
        autosaveEnabled: mediaAutosaveEnabled,
        autosaveDecision: "autosave_skipped",
        autosaveDecisionReason: autosavePolicyDecision.reason,
      }),
    });
    return {
      ok: true,
      state: "recovered",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: recoveredUrls,
      processed: true,
      note: "autosave_skipped",
    };
  }

  const mediaFileIds = await persistRecoveryMediaFilesForGeneration({
    generation,
    mediaUrls: recoveredUrls,
  });
  const metadata = asObject(generation.metadata);
  await settleGenerationOutcome({
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    outcome: "success",
    reason: "Generation recovered with persisted media.",
    routeLabel,
    detail: {
      actor,
      generation_id: generation.id,
      media_file_count: mediaFileIds.length,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_decision: "auto_persisted",
      decision_reason: autosavePolicyDecision.reason,
    },
  });
  await logRecoveryAutosaveDecisionEvent({
    generationId: generation.id,
    userId: generation.user_id,
    requestId: generation.request_id,
    actor,
    autosaveEnabled: mediaAutosaveEnabled,
    autosaveDecision: "auto_persisted",
    decisionReason: autosavePolicyDecision.reason,
  });
  await updateGenerationRecoveryState({
    generation,
    updates: buildRecoveredSuccessUpdate({
      nowIso,
      metadata,
      mediaUrls: recoveredUrls,
      mediaFileIds,
      actor,
      autosaveEnabled: mediaAutosaveEnabled,
      autosaveDecision: "auto_persisted",
      autosaveDecisionReason: autosavePolicyDecision.reason,
    }),
  });
  return {
    ok: true,
    state: "recovered",
    generationId: generation.id,
    requestId: generation.request_id,
    mediaFileIds,
    mediaUrls: recoveredUrls,
    processed: true,
  };
};
