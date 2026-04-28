/**
 * Shared generation recovery execution engine.
 * Centralizes retrieval, persistence, settlement, and lifecycle transitions.
 */
import { settleGenerationOutcome } from "../api/generationBilling";
import {
  persistGenerationOutputRecords,
  readPersistedGenerationOutputs,
  type PersistedGenerationOutputRow,
} from "../api/generationOutputs";
import { upsertGenerationProjection } from "../api/generationProjection";
import { upsertGenerationPublication } from "../api/generationPublications";
import { readGenerationAbandonmentContext } from "../api/generationAbandonment";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT,
  GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE,
} from "../api/errorTelemetryPolicy";
import {
  canTransitionToSuccess,
  collectRecoveredUrls,
  resolveRetryDelaySeconds,
} from "./recoveryExecutionRuntime";
import { readRecoveryGenerationRow } from "./recoveryGenerationLookup";
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
import { requestGenerationControlPlaneWake } from "../generationControlPlane/controlPlaneWake";
import { probeGenerationProviderResult } from "../providerIntegration/recoveryProviderDispatcher";
import { readProviderContentPolicyMessage } from "../providerIntegration/statusProviderPayload";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import { canAutoPersistRecoveryMedia } from "../../mediaAutosavePolicy";
import { normalizeExplicitContentFailure } from "../../explicitContentFailure";
import { applyRecoveryTransition } from "./recoveryTransitionService";

type JsonObject = Record<string, unknown>;

export type RecoveryProbeState = "running" | "failed" | "completed";
export type RecoveryActor = "reconciler" | "admin_replay" | "webhook" | "poll";
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

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readMetadataObject = (metadata: JsonObject, ...keys: string[]): JsonObject => {
  for (const key of keys) {
    const value = metadata[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonObject;
    }
  }
  return {};
};

const readMetadataBoolean = (metadata: JsonObject, ...keys: string[]): boolean | undefined => {
  for (const key of keys) {
    if (typeof metadata[key] === "boolean") {
      return metadata[key] as boolean;
    }
  }
  return undefined;
};

const resolveGenerationAgeSeconds = (createdAtIso: string, now: Date): number => {
  const createdAtMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdAtMs)) return Number.POSITIVE_INFINITY;
  const diffMs = now.getTime() - createdAtMs;
  return Math.max(0, Math.floor(diffMs / 1000));
};

const isTerminalMediaPersistenceError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("media_files insert failed") &&
    normalized.includes("media_files_user_id_fkey")
  );
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

const logRecoveryMediaVisibleEvent = async ({
  actor,
  autosaveEnabled,
  generation,
  mediaFileCount,
  mediaVisibleAt,
  providerTerminalObservedAtIso,
  recoveredUrls,
  routeLabel,
  usedExistingMediaRows,
  usedObservationMediaUrls,
  usedObservationPayload,
}: {
  actor: RecoveryActor;
  autosaveEnabled: boolean;
  generation: {
    id: string;
    user_id: string;
    request_id: string | null;
    model_id: string;
    provider: string;
    created_at: string;
    recovery_attempts: number;
  };
  mediaFileCount: number;
  mediaVisibleAt: Date;
  providerTerminalObservedAtIso: string;
  recoveredUrls: string[];
  routeLabel: string;
  usedExistingMediaRows: boolean;
  usedObservationMediaUrls: boolean;
  usedObservationPayload: boolean;
}) => {
  try {
    const mediaVisibleAtIso = mediaVisibleAt.toISOString();
    const providerTerminalObservedAtMs = Date.parse(providerTerminalObservedAtIso);
    const mediaVisibleAtMs = mediaVisibleAt.getTime();
    const generationCreatedAtMs = Date.parse(generation.created_at);
    await writeAppErrorLog({
      source: GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE,
      scope: "generation",
      severity: "low",
      message: GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT,
      route: routeLabel,
      endpoint: routeLabel.startsWith("/") ? routeLabel : `/${routeLabel}`,
      requestId: generation.request_id,
      userId: generation.user_id,
      metadata: {
        generation_id: generation.id,
        provider_request_id: generation.request_id,
        model_id: generation.model_id,
        provider: generation.provider,
        recovery_actor: actor,
        recovery_attempts: generation.recovery_attempts,
        result_url_count: recoveredUrls.length,
        media_file_count: mediaFileCount,
        provider_terminal_state: "completed",
        provider_terminal_observed_at: providerTerminalObservedAtIso,
        media_visible_at: mediaVisibleAtIso,
        provider_terminal_to_media_visible_ms: Number.isFinite(providerTerminalObservedAtMs)
          ? Math.max(0, mediaVisibleAtMs - providerTerminalObservedAtMs)
          : null,
        generation_created_at: generation.created_at,
        generation_age_ms: Number.isFinite(generationCreatedAtMs)
          ? Math.max(0, mediaVisibleAtMs - generationCreatedAtMs)
          : null,
        autosave_enabled: autosaveEnabled,
        used_existing_media_rows: usedExistingMediaRows,
        used_observation_payload: usedObservationPayload,
        used_observation_media_urls: usedObservationMediaUrls,
      },
    });
  } catch {
    // best-effort telemetry only
  }
};

const syncRecoveredGenerationProjection = async ({
  actor,
  autosaveDecision,
  generation,
  mediaFileIds,
  nowIso,
  persistedOutputRows,
  recoveredUrls,
}: {
  actor: RecoveryActor;
  autosaveDecision: "autosave_skipped" | "auto_persisted";
  generation: {
    id: string;
    user_id: string;
    request_id: string | null;
    provider: string;
    model_id: string;
    prompt_text: string;
    created_at: string;
    metadata: JsonObject;
  };
  mediaFileIds: string[];
  nowIso: string;
  persistedOutputRows?: PersistedGenerationOutputRow[] | null;
  recoveredUrls: string[];
}): Promise<void> => {
  const outputRows =
    persistedOutputRows && persistedOutputRows.length
      ? persistedOutputRows
      : await readPersistedGenerationOutputs({
          generationId: generation.id,
          userId: generation.user_id,
        });
  const normalizedResultUrls = outputRows.length
    ? outputRows.map((row) => row.resultUrl)
    : recoveredUrls;
  const normalizedSavedMediaIds = mediaFileIds
    .map((value) => asOptionalString(value))
    .filter((value): value is string => Boolean(value));
  const hasCanonicalOwnedMedia =
    outputRows.length > 0 &&
    outputRows.every(
      (row) => typeof row.mediaFileId === "string" && row.mediaFileId.trim().length > 0
    );
  const generationMetadata = asObject(generation.metadata);
  const abandonment = await readGenerationAbandonmentContext({
    userId: generation.user_id,
    generationId: generation.id,
    requestId: generation.request_id,
    sourceRef: asOptionalString(generationMetadata?.source_ref),
    metadata: generationMetadata,
  });
  const hiddenInReferenceGrid =
    abandonment.abandoned ||
    (readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
      false);
  const publicationState =
    hasCanonicalOwnedMedia && !abandonment.abandoned ? "published" : "suppressed";

  if (hasCanonicalOwnedMedia) {
    await Promise.all(
      outputRows.map((row) => {
        if (!row.id) return Promise.resolve();
        return upsertGenerationPublication({
          generationId: generation.id,
          generationOutputId: row.id,
          userId: generation.user_id,
          publicationState,
          reusable: true,
          visibleInAiStudio: true,
          visibleInReferenceGrid: !hiddenInReferenceGrid,
          ownedMediaFileId: row.mediaFileId,
          previewUrl: row.resultUrl,
          fullUrl: row.resultUrl,
          publishedAt: nowIso,
          metadata: {
            recovery_actor: actor,
            recovery_execution: true,
            autosave_decision: autosaveDecision,
            user_abandoned: abandonment.abandoned,
          },
        });
      })
    );
  }

  await upsertGenerationProjection({
    generationId: generation.id,
    userId: generation.user_id,
    sourceRef: asOptionalString(generationMetadata?.source_ref),
    requestId: generation.request_id,
    provider: generation.provider,
    providerRequestId: generation.request_id,
    status: "ready",
    taskState: "success",
    displayPrompt: generation.prompt_text,
    modelId: generation.model_id,
    previewUrl: normalizedResultUrls[0] ?? null,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
    saveState: "idle",
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
    publicationState,
    resultUrls: normalizedResultUrls,
    savedMediaIds: normalizedSavedMediaIds,
    generationReplay: readMetadataObject(
      generationMetadata,
      "generation_replay",
      "generationReplay"
    ),
    characterContext: readMetadataObject(
      generationMetadata,
      "character_context",
      "characterContext"
    ),
    styleContext: readMetadataObject(generationMetadata, "style_context", "styleContext"),
    startedAt: generation.created_at,
    completedAt: nowIso,
  });
};

const syncFailedGenerationProjection = async ({
  completedAt,
  errorDetail,
  errorMessage,
  errorMessageShort,
  generation,
}: {
  completedAt: string;
  errorDetail: string;
  errorMessage: string;
  errorMessageShort: string;
  generation: {
    id: string;
    user_id: string;
    request_id: string | null;
    provider: string;
    model_id: string;
    prompt_text: string;
    created_at: string;
    metadata: JsonObject;
  };
}): Promise<void> => {
  const generationMetadata = asObject(generation.metadata);
  const abandonment = await readGenerationAbandonmentContext({
    userId: generation.user_id,
    generationId: generation.id,
    requestId: generation.request_id,
    sourceRef: asOptionalString(generationMetadata?.source_ref),
    metadata: generationMetadata,
  });
  const hiddenInReferenceGrid =
    abandonment.abandoned ||
    (readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
      false);

  await upsertGenerationProjection({
    generationId: generation.id,
    userId: generation.user_id,
    sourceRef: asOptionalString(generationMetadata?.source_ref),
    requestId: generation.request_id,
    provider: generation.provider,
    providerRequestId: generation.request_id,
    status: "ready",
    taskState: "fail",
    displayPrompt: generation.prompt_text,
    modelId: generation.model_id,
    errorMessage,
    errorMessageShort,
    errorDetail,
    saveState: "idle",
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
    publicationState: "suppressed",
    resultUrls: [],
    savedMediaIds: [],
    generationReplay: readMetadataObject(
      generationMetadata,
      "generation_replay",
      "generationReplay"
    ),
    characterContext: readMetadataObject(
      generationMetadata,
      "character_context",
      "characterContext"
    ),
    styleContext: readMetadataObject(generationMetadata, "style_context", "styleContext"),
    startedAt: generation.created_at,
    completedAt,
  });
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
  const runningHardTimeoutSeconds = Math.max(runtimeFlags.runningHardTimeoutSeconds, 0);
  const attempts = Number(generation.recovery_attempts ?? 0);
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const generationAgeSeconds = resolveGenerationAgeSeconds(generation.created_at, nowDate);
  const generationMetadata = asObject(generation.metadata);
  const abandonment = await readGenerationAbandonmentContext({
    userId: generation.user_id,
    generationId: generation.id,
    requestId: generation.request_id,
    sourceRef: asOptionalString(generationMetadata.source_ref),
    metadata: generationMetadata,
  });
  const settleRecoveryOutcome = (input: {
    outcome: "success" | "fail";
    reason: string;
    detail: JsonObject;
  }) =>
    settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id ?? "",
      outcome: input.outcome,
      reason: input.reason,
      routeLabel,
      detail: {
        ...input.detail,
        user_abandoned: abandonment.abandoned,
      },
      abandonedNoRefund: input.outcome === "fail" && abandonment.abandoned && abandonment.noRefund,
    });

  if (generation.status.toLowerCase() === "success") {
    const existingRows = await readExistingRecoveryMediaRows(generation.id);
    if (existingRows.length) {
      const persistedOutputRows = await readPersistedGenerationOutputs({
        generationId: generation.id,
        userId: generation.user_id,
      });
      await syncRecoveredGenerationProjection({
        actor,
        autosaveDecision: "auto_persisted",
        generation,
        mediaFileIds: existingRows.map((row) => row.id),
        nowIso: generation.completed_at ?? nowIso,
        persistedOutputRows,
        recoveredUrls: persistedOutputRows.map((row) => row.resultUrl),
      });
      await applyRecoveryTransition({
        generation,
        attemptTransition: {
          status: "succeeded",
          observedAt: nowIso,
          completedAt: generation.completed_at ?? nowIso,
          metadata: {
            recovery_actor: actor,
            recovery_outcome: "already_persisted",
          },
        },
      });
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
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildMissingRequestUpdate(nowIso),
    });
    await syncFailedGenerationProjection({
      completedAt: nowIso,
      errorDetail: "Generation recovery exhausted because the provider request id is missing.",
      errorMessage: "Generation recovery exhausted.",
      errorMessageShort: "Generation failed",
      generation,
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
    const persistedOutputRows = await readPersistedGenerationOutputs({
      generationId: generation.id,
      userId: generation.user_id,
    });
    await syncRecoveredGenerationProjection({
      actor,
      autosaveDecision: "auto_persisted",
      generation,
      mediaFileIds: existingRows.map((row) => row.id),
      nowIso,
      persistedOutputRows,
      recoveredUrls: persistedOutputRows.map((row) => row.resultUrl),
    });
    await settleRecoveryOutcome({
      outcome: "success",
      reason: "Recovered generation media already persisted.",
      detail: {
        actor,
        generation_id: generation.id,
        existing_media_count: existingRows.length,
      },
    });
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildAlreadyPersistedSuccessUpdate({
        completedAt: generation.completed_at,
        nowIso,
      }),
    });
    void requestGenerationControlPlaneWake({
      routeLabel,
      reason: "already_persisted_success",
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
  const providerTerminalObservedAtIso = nowIso;

  if (currentObservation.state === "running" && recoveredUrls.length === 0) {
    const hardTimeoutReached =
      runningHardTimeoutSeconds > 0 && generationAgeSeconds >= runningHardTimeoutSeconds;
    if (hardTimeoutReached) {
      await applyRecoveryTransition({
        generation,
        attemptTransition: {
          status: "timed_out",
          observedAt: nowIso,
          completedAt: nowIso,
          failureReasonCode: "provider_running_timeout",
          errorMessage: "Provider exceeded running hard-timeout during recovery execution.",
          metadata: {
            recovery_actor: actor,
            recovery_outcome: "running_timeout",
          },
        },
      });
      try {
        await writeAppErrorLog({
          source: GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE,
          scope: "generation",
          severity: "high",
          message: GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT,
          route: routeLabel,
          endpoint: routeLabel.startsWith("/") ? routeLabel : `/${routeLabel}`,
          requestId: generation.request_id,
          userId: generation.user_id,
          metadata: {
            actor,
            generation_id: generation.id,
            model_id: generation.model_id,
            provider: generation.provider,
            recovery_attempts: attempts,
            generation_age_seconds: generationAgeSeconds,
            running_hard_timeout_seconds: runningHardTimeoutSeconds,
          },
        });
      } catch {
        // best-effort telemetry signal only
      }
      await settleRecoveryOutcome({
        outcome: "fail",
        reason: "Provider exceeded running hard-timeout during recovery execution.",
        detail: {
          actor,
          generation_id: generation.id,
          generation_age_seconds: generationAgeSeconds,
          running_hard_timeout_seconds: runningHardTimeoutSeconds,
        },
      });
      await syncFailedGenerationProjection({
        completedAt: nowIso,
        errorDetail: "Provider exceeded running hard-timeout during recovery execution.",
        errorMessage: "Generation timed out during recovery.",
        errorMessageShort: "Generation timed out",
        generation,
      });
      await applyRecoveryTransition({
        generation,
        generationUpdates: {
          status: "fail",
          completed_at: nowIso,
          recovery_state: "exhausted",
          failure_reason_code: "provider_running_timeout",
          last_recovery_at: nowIso,
          next_recovery_at: null,
        },
      });
      void requestGenerationControlPlaneWake({
        routeLabel,
        reason: "running_hard_timeout",
      });
      return {
        ok: true,
        state: "exhausted",
        generationId: generation.id,
        requestId: generation.request_id,
        mediaFileIds: [],
        mediaUrls: [],
        processed: true,
        note: "running_hard_timeout",
      };
    }

    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1), "running");
    const queuePlanBase = buildRecoveryQueuePlan({
      attempts,
      effectiveMaxAttempts,
      nextDelaySeconds,
      generationAgeSeconds,
      exhaustMinAgeSeconds: runningExhaustMinAgeSeconds,
      enforceMinAgeForExhaustion: true,
    });
    const generationCreatedAtMs = Date.parse(generation.created_at);
    const runningDeadlineAtIso =
      runningHardTimeoutSeconds > 0 && Number.isFinite(generationCreatedAtMs)
        ? new Date(generationCreatedAtMs + runningHardTimeoutSeconds * 1000).toISOString()
        : null;
    const queuePlan = {
      ...queuePlanBase,
      nextRecoveryAt:
        queuePlanBase.nextRecoveryAt && runningDeadlineAtIso
          ? new Date(queuePlanBase.nextRecoveryAt).getTime() >
            new Date(runningDeadlineAtIso).getTime()
            ? runningDeadlineAtIso
            : queuePlanBase.nextRecoveryAt
          : queuePlanBase.nextRecoveryAt,
    };
    await applyRecoveryTransition({
      generation,
      attemptTransition: {
        status: queuePlan.isExhausted ? "timed_out" : "running",
        observedAt: nowIso,
        completedAt: queuePlan.isExhausted ? nowIso : null,
        failureReasonCode: queuePlan.isExhausted ? "recovery_exhausted" : null,
        errorMessage: queuePlan.isExhausted
          ? "Provider remained running after recovery attempts were exhausted."
          : null,
        metadata: {
          recovery_actor: actor,
          recovery_outcome: queuePlan.isExhausted ? "running_exhausted" : "provider_running",
        },
      },
    });
    if (queuePlan.isExhausted) {
      await settleRecoveryOutcome({
        outcome: "fail",
        reason: "Provider remained running after recovery attempts were exhausted.",
        detail: {
          actor,
          generation_id: generation.id,
          recovery_attempts: attempts,
          recovery_max_attempts: effectiveMaxAttempts,
        },
      });
    }
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildProviderRunningUpdate({ nowIso, attempts, queuePlan }),
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
    const observationDetailRecords = Array.isArray(currentObservation.payload?.detail)
      ? currentObservation.payload.detail.map((item) => asObject(item))
      : [];
    const hasStructuredContentPolicyViolation =
      observationDetailRecords.some(
        (row) => asOptionalString(row.type)?.toLowerCase() === "content_policy_violation"
      ) ||
      JSON.stringify(currentObservation.payload ?? {})
        .toLowerCase()
        .includes("content_policy_violation");
    const providerContentPolicyMessage = currentObservation.payload
      ? (readProviderContentPolicyMessage({
          provider: generation.provider,
          payload: currentObservation.payload,
        }) ??
        observationDetailRecords.reduce<string | null>((matched, row) => {
          if (matched) return matched;
          if (asOptionalString(row.type)?.toLowerCase() !== "content_policy_violation") {
            return null;
          }
          return asOptionalString(row.msg) ?? asOptionalString(row.message);
        }, null) ??
        (hasStructuredContentPolicyViolation ? "Blocked by provider content policy." : null))
      : null;
    const explicitContentFailure = normalizeExplicitContentFailure({
      message: providerContentPolicyMessage,
      detail: providerContentPolicyMessage,
      force: hasStructuredContentPolicyViolation || Boolean(providerContentPolicyMessage),
    });
    const failureReasonCode = explicitContentFailure ? "content_policy_block" : "provider_error";
    const providerFailureMessage =
      asOptionalString(currentObservation.payload?.error) ??
      asOptionalString(currentObservation.payload?.detail);
    const failureMessage =
      explicitContentFailure?.errorDetail ??
      providerFailureMessage ??
      "Provider reported failed state during recovery execution.";
    const failureShortMessage = explicitContentFailure?.errorMessageShort ?? "Generation failed";
    await applyRecoveryTransition({
      generation,
      attemptTransition: {
        status: "failed",
        observedAt: nowIso,
        completedAt: nowIso,
        failureReasonCode,
        errorMessage: failureMessage,
        metadata: {
          recovery_actor: actor,
          recovery_outcome: "provider_failed",
        },
      },
    });
    await settleRecoveryOutcome({
      outcome: "fail",
      reason: failureMessage,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    await syncFailedGenerationProjection({
      completedAt: nowIso,
      errorDetail: failureMessage,
      errorMessage: explicitContentFailure?.errorMessage ?? "Generation failed.",
      errorMessageShort: failureShortMessage,
      generation,
    });
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildProviderFailedUpdate(nowIso, failureReasonCode),
    });
    void requestGenerationControlPlaneWake({
      routeLabel,
      reason: "provider_failed",
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
    const nextDelaySeconds = resolveRetryDelaySeconds(
      Math.max(attempts, 1),
      "terminal_success_no_media"
    );
    const queuePlan = buildRecoveryQueuePlan({
      attempts,
      effectiveMaxAttempts,
      nextDelaySeconds,
      generationAgeSeconds,
      exhaustMinAgeSeconds: runtimeFlags.noMediaExhaustMinAgeSeconds,
      enforceMinAgeForExhaustion: true,
    });
    await applyRecoveryTransition({
      generation,
      attemptTransition: {
        status: "succeeded",
        observedAt: nowIso,
        completedAt: nowIso,
        failureReasonCode: "terminal_success_no_media",
        errorMessage: "Provider terminal success without media payload.",
        metadata: {
          recovery_actor: actor,
          recovery_outcome: "terminal_success_no_media",
        },
      },
    });
    if (queuePlan.isExhausted) {
      await settleRecoveryOutcome({
        outcome: "fail",
        reason: "Provider terminal success without media payload.",
        detail: {
          actor,
          generation_id: generation.id,
        },
      });
      await syncFailedGenerationProjection({
        completedAt: nowIso,
        errorDetail: "Provider terminal success without media payload.",
        errorMessage: "Generation failed.",
        errorMessageShort: "No media returned.",
        generation,
      });
    }
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildNoMediaUpdate({ nowIso, attempts, queuePlan }),
    });
    void requestGenerationControlPlaneWake({
      routeLabel,
      reason: queuePlan.isExhausted ? "no_media_exhausted" : "no_media_requeue",
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
    await applyRecoveryTransition({
      generation,
      attemptTransition: {
        status: "succeeded",
        observedAt: nowIso,
        completedAt: nowIso,
        metadata: {
          recovery_actor: actor,
          recovery_outcome: "recovered_success",
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: autosavePolicyDecision.reason,
        },
      },
    });
    const persistedOutputRows = await persistGenerationOutputRecords({
      generationId: generation.id,
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      resultUrls: recoveredUrls,
      mediaFileIds: [],
      metadata: {
        actor,
        autosave_decision: "autosave_skipped",
        autosave_decision_reason: autosavePolicyDecision.reason,
        recovery_execution: true,
      },
    });
    await syncRecoveredGenerationProjection({
      actor,
      autosaveDecision: "autosave_skipped",
      generation,
      mediaFileIds: [],
      nowIso,
      persistedOutputRows,
      recoveredUrls,
    });
    await settleRecoveryOutcome({
      outcome: "success",
      reason: "Generation recovered; autosave skipped by user preference.",
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
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildRecoveredSuccessUpdate({
        nowIso,
        metadata: {
          ...asObject(generation.metadata),
          ...(abandonment.abandoned
            ? {
                user_abandoned: true,
                abandoned_no_refund: abandonment.noRefund,
                hidden_in_reference_grid: true,
              }
            : {}),
        },
        actor,
        autosaveEnabled: mediaAutosaveEnabled,
        autosaveDecision: "autosave_skipped",
        autosaveDecisionReason: autosavePolicyDecision.reason,
      }),
    });
    void requestGenerationControlPlaneWake({
      routeLabel,
      reason: "recovered_success",
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

  let mediaFileIds: string[];
  try {
    mediaFileIds = await persistRecoveryMediaFilesForGeneration({
      generation,
      mediaUrls: recoveredUrls,
    });
  } catch (error) {
    if (!isTerminalMediaPersistenceError(error)) {
      throw error;
    }
    const failureMessage =
      "Generated media could not be saved because the generation owner is no longer active.";
    await applyRecoveryTransition({
      generation,
      attemptTransition: {
        status: "failed",
        observedAt: nowIso,
        completedAt: nowIso,
        failureReasonCode: "media_persistence_failed",
        errorMessage: failureMessage,
        metadata: {
          recovery_actor: actor,
          recovery_outcome: "media_persistence_failed",
        },
      },
    });
    await settleRecoveryOutcome({
      outcome: "fail",
      reason: failureMessage,
      detail: {
        actor,
        generation_id: generation.id,
        persistence_error_class: "invalid_generation_owner",
      },
    }).catch(() => undefined);
    await syncFailedGenerationProjection({
      completedAt: nowIso,
      errorDetail: failureMessage,
      errorMessage: "Generation failed.",
      errorMessageShort: "Generation failed",
      generation,
    }).catch(() => undefined);
    await applyRecoveryTransition({
      generation,
      generationUpdates: buildProviderFailedUpdate(nowIso, "media_persistence_failed"),
    });
    void requestGenerationControlPlaneWake({
      routeLabel,
      reason: "media_persistence_failed",
    });
    return {
      ok: true,
      state: "exhausted",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: recoveredUrls,
      processed: true,
      note: "media_persistence_failed",
    };
  }
  await applyRecoveryTransition({
    generation,
    attemptTransition: {
      status: "succeeded",
      observedAt: nowIso,
      completedAt: nowIso,
      metadata: {
        recovery_actor: actor,
        recovery_outcome: "recovered_success",
        autosave_decision: "auto_persisted",
        autosave_decision_reason: autosavePolicyDecision.reason,
        media_file_count: mediaFileIds.length,
      },
    },
  });
  const persistedOutputRows = await persistGenerationOutputRecords({
    generationId: generation.id,
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    resultUrls: recoveredUrls,
    mediaFileIds,
    metadata: {
      actor,
      autosave_decision: "auto_persisted",
      autosave_decision_reason: autosavePolicyDecision.reason,
      recovery_execution: true,
    },
  });
  await syncRecoveredGenerationProjection({
    actor,
    autosaveDecision: "auto_persisted",
    generation,
    mediaFileIds,
    nowIso,
    persistedOutputRows,
    recoveredUrls,
  });
  const metadata = asObject(generation.metadata);
  await settleRecoveryOutcome({
    outcome: "success",
    reason: "Generation recovered with persisted media.",
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
  await logRecoveryMediaVisibleEvent({
    actor,
    autosaveEnabled: mediaAutosaveEnabled,
    generation,
    mediaFileCount: mediaFileIds.length,
    mediaVisibleAt: new Date(),
    providerTerminalObservedAtIso,
    recoveredUrls,
    routeLabel,
    usedExistingMediaRows: false,
    usedObservationMediaUrls: currentObservation.mediaUrls.length > 0,
    usedObservationPayload: Boolean(currentObservation.payload),
  });
  await applyRecoveryTransition({
    generation,
    generationUpdates: buildRecoveredSuccessUpdate({
      nowIso,
      metadata: {
        ...metadata,
        ...(abandonment.abandoned
          ? {
              user_abandoned: true,
              abandoned_no_refund: abandonment.noRefund,
              hidden_in_reference_grid: true,
            }
          : {}),
      },
      actor,
      autosaveEnabled: mediaAutosaveEnabled,
      autosaveDecision: "auto_persisted",
      autosaveDecisionReason: autosavePolicyDecision.reason,
    }),
  });
  void requestGenerationControlPlaneWake({
    routeLabel,
    reason: "recovered_success",
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
