import { readRecoveryGenerationRow } from "../falIntegration/recoveryGenerationLookup";
import { persistRecoveryMediaFilesForGeneration } from "../falIntegration/recoveryMediaPersistence";
import { settleGenerationOutcome } from "./generationBilling";
import { lookupGenerationAttemptByProviderRequest } from "./generationAttempts";
import { persistGenerationOutputRecords } from "./generationOutputs";
import { applyGenerationLifecycleTransition } from "./generationLifecycleTransitionService";
import { upsertGenerationProjection } from "./generationProjection";
import { upsertGenerationPublication } from "./generationPublications";
import {
  readGenerationAbandonmentContext,
  isGenerationAbandonedMetadata,
} from "./generationAbandonment";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { canAutoPersistRecoveryMedia } from "../../mediaAutosavePolicy";

type JsonObject = Record<string, unknown>;

type DirectGenerationSettlementInput = {
  generationId?: string | null;
  requestId: string;
  userId: string;
  routeLabel: string;
};

type DirectGenerationSuccessInput = DirectGenerationSettlementInput & {
  providerState: string;
  resultUrls: string[];
};

type DirectGenerationFailureInput = DirectGenerationSettlementInput & {
  providerState: string | null;
  errorMessage: string;
  errorDetail?: unknown;
  failureReasonCode?: string;
};

type DirectGenerationSettlementResult =
  | {
      ok: true;
      generationId: string;
      requestId: string;
    }
  | {
      ok: false;
      error: string;
    };

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readMetadataObject = (
  metadata: JsonObject,
  snakeCaseKey: string,
  camelCaseKey?: string
): JsonObject => {
  const primary = asObject(metadata[snakeCaseKey]);
  if (Object.keys(primary).length > 0) return primary;
  if (!camelCaseKey) return {};
  return asObject(metadata[camelCaseKey]);
};

const readMetadataBoolean = (
  metadata: JsonObject,
  snakeCaseKey: string,
  camelCaseKey?: string
): boolean | null => {
  if (typeof metadata[snakeCaseKey] === "boolean") return metadata[snakeCaseKey] as boolean;
  if (camelCaseKey && typeof metadata[camelCaseKey] === "boolean") {
    return metadata[camelCaseKey] as boolean;
  }
  return null;
};

const stringifyDetail = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  if (value == null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const mergeSettlementMetadata = ({
  metadata,
  nowIso,
  providerState,
  outcome,
}: {
  metadata: JsonObject;
  nowIso: string;
  providerState: string | null;
  outcome: "success" | "fail";
}): JsonObject => ({
  ...metadata,
  direct_terminal_settlement: true,
  direct_terminal_settlement_outcome: outcome,
  direct_terminal_settlement_at: nowIso,
  ...(providerState ? { direct_terminal_provider_state: providerState } : {}),
});

const updateGenerationRow = async ({
  generationId,
  userId,
  updates,
}: {
  generationId: string;
  userId: string;
  updates: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update(updates)
    .eq("id", generationId)
    .eq("user_id", userId);
  if (error) throw error;
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

const readMediaStoragePathsById = async ({
  mediaFileIds,
  userId,
}: {
  mediaFileIds: string[];
  userId: string;
}): Promise<Map<string, string>> => {
  const ids = mediaFileIds
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));
  if (!ids.length) return new Map();

  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select("id, preview_storage_path, storage_path")
    .in("id", ids)
    .eq("user_id", userId)
    .limit(ids.length);
  if (error || !Array.isArray(data)) return new Map();

  const map = new Map<string, string>();
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const mediaFileId = asString(row.id);
    const storagePath = asString(row.preview_storage_path) ?? asString(row.storage_path);
    if (mediaFileId && storagePath) {
      map.set(mediaFileId, storagePath);
    }
  }
  return map;
};

const readGenerationContext = async ({
  generationId,
  requestId,
  userId,
}: DirectGenerationSettlementInput) => {
  return await readRecoveryGenerationRow({
    generationId,
    requestId,
    userId,
  });
};

const readAttemptContext = async ({ requestId, userId }: { requestId: string; userId: string }) => {
  const lookup = await lookupGenerationAttemptByProviderRequest({
    providerRequestId: requestId,
    userId,
  });
  if (lookup.error) return null;
  return lookup.data;
};

export const settleDirectGenerationSuccess = async ({
  generationId,
  requestId,
  userId,
  routeLabel,
  providerState,
  resultUrls,
}: DirectGenerationSuccessInput): Promise<DirectGenerationSettlementResult> => {
  const generation = await readGenerationContext({
    generationId,
    requestId,
    userId,
    routeLabel,
  });
  if (!generation?.request_id) {
    return { ok: false, error: "generation_not_found" };
  }

  const normalizedResultUrls = resultUrls
    .map((value) => asString(value))
    .filter(Boolean) as string[];
  if (!normalizedResultUrls.length) {
    return { ok: false, error: "missing_result_urls" };
  }

  const attempt = await readAttemptContext({
    requestId: generation.request_id,
    userId: generation.user_id,
  });
  const nowIso = new Date().toISOString();
  const generationMetadata = asObject(generation.metadata);
  const abandonment = await readGenerationAbandonmentContext({
    userId: generation.user_id,
    generationId: generation.id,
    requestId: generation.request_id,
    sourceRef: asString(generationMetadata.source_ref),
    metadata: generationMetadata,
  });
  const isAbandoned = abandonment.abandoned;
  const mergedMetadata = mergeSettlementMetadata({
    metadata: isAbandoned
      ? {
          ...generationMetadata,
          user_abandoned: true,
          abandoned_no_refund: abandonment.noRefund,
          hidden_in_reference_grid: true,
        }
      : generationMetadata,
    nowIso,
    providerState,
    outcome: "success",
  });
  const mediaAutosaveEnabled = await readMediaAutosaveEnabledForUser(generation.user_id);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });

  const transition = await applyGenerationLifecycleTransition({
    intent: "provider_completed_observed",
    applyGenerationMutation: async () => {
      try {
        await updateGenerationRow({
          generationId: generation.id,
          userId: generation.user_id,
          updates: {
            status: "success",
            completed_at: nowIso,
            failure_reason_code: null,
            error_message: null,
            recovery_state: "recovered",
            last_recovery_at: nowIso,
            next_recovery_at: null,
            last_media_detected_at: nowIso,
            metadata: mergedMetadata,
          },
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    attemptMutation: {
      kind: "state_update",
      input: {
        providerRequestId: generation.request_id,
        userId: generation.user_id,
        status: "succeeded",
        observedAt: nowIso,
        completedAt: nowIso,
        metadata: {
          direct_terminal_settlement: true,
          direct_terminal_settlement_outcome: "success",
          direct_terminal_provider_state: providerState,
        },
      },
      allowMissingAttempt: true,
    },
  });
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }

  const mediaFileIds = autosavePolicyDecision.allowed
    ? await persistRecoveryMediaFilesForGeneration({
        generation: {
          id: generation.id,
          user_id: generation.user_id,
          request_id: generation.request_id,
          model_id: generation.model_id,
          provider: generation.provider,
          prompt_text: generation.prompt_text,
          metadata: generationMetadata,
        },
        mediaUrls: normalizedResultUrls,
      })
    : [];

  const persistedOutputRows = await persistGenerationOutputRecords({
    generationId: generation.id,
    userId: generation.user_id,
    generationAttemptId: attempt?.id,
    providerRequestId: generation.request_id,
    resultUrls: normalizedResultUrls,
    mediaFileIds,
    metadata: {
      direct_terminal_settlement: true,
      direct_terminal_settlement_outcome: "success",
      direct_terminal_provider_state: providerState,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_decision: autosavePolicyDecision.allowed ? "auto_persisted" : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.reason,
    },
  });
  const storagePathByMediaId = await readMediaStoragePathsById({
    mediaFileIds: persistedOutputRows
      .map((row) => row.mediaFileId)
      .filter((value): value is string => Boolean(value)),
    userId: generation.user_id,
  });
  const hasCanonicalStorageAuthority =
    persistedOutputRows.length > 0 &&
    persistedOutputRows.every((row) => {
      if (!row.mediaFileId) return false;
      return storagePathByMediaId.has(row.mediaFileId);
    });

  const hiddenInReferenceGrid =
    isAbandoned ||
    (readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
      false);
  const publicationState =
    hasCanonicalStorageAuthority && !isAbandoned ? "published" : "suppressed";

  await Promise.all(
    persistedOutputRows.map((row) => {
      if (!row.id) return Promise.resolve();
      const storagePath = row.mediaFileId
        ? (storagePathByMediaId.get(row.mediaFileId) ?? null)
        : null;
      return upsertGenerationPublication({
        generationId: generation.id,
        generationOutputId: row.id,
        userId: generation.user_id,
        generationAttemptId: attempt?.id ?? null,
        publicationState,
        reusable: true,
        visibleInAiStudio: true,
        visibleInReferenceGrid: !hiddenInReferenceGrid,
        ownedMediaFileId: row.mediaFileId,
        previewUrl: row.resultUrl,
        fullUrl: row.resultUrl,
        previewStoragePath: storagePath,
        fullStoragePath: storagePath,
        publishedAt: nowIso,
        metadata: {
          direct_terminal_settlement: true,
          direct_terminal_settlement_outcome: "success",
          direct_terminal_provider_state: providerState,
          user_abandoned: isAbandoned,
          autosave_enabled: mediaAutosaveEnabled,
          autosave_decision: autosavePolicyDecision.allowed ? "auto_persisted" : "autosave_skipped",
          autosave_decision_reason: autosavePolicyDecision.reason,
        },
      });
    })
  );
  const firstOwnedStoragePath =
    persistedOutputRows.length > 0 && persistedOutputRows[0]?.mediaFileId
      ? (storagePathByMediaId.get(persistedOutputRows[0].mediaFileId) ?? null)
      : null;

  await upsertGenerationProjection({
    generationId: generation.id,
    userId: generation.user_id,
    sourceRef: asString(generationMetadata.source_ref),
    requestId: generation.request_id,
    provider: generation.provider,
    providerRequestId: generation.request_id,
    latestAttemptId: attempt?.id ?? null,
    status: "ready",
    taskState: "success",
    queueState: "dispatched",
    displayPrompt: generation.prompt_text,
    modelId: generation.model_id,
    previewUrl: normalizedResultUrls[0] ?? null,
    previewStoragePath: firstOwnedStoragePath,
    fullStoragePath: firstOwnedStoragePath,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
    saveState: "idle",
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
    publicationState,
    resultUrls: normalizedResultUrls,
    savedMediaIds: hasCanonicalStorageAuthority ? mediaFileIds : [],
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

  await settleGenerationOutcome({
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    outcome: "success",
    reason: "Provider completed and canonical results were persisted synchronously.",
    routeLabel,
    detail: {
      generation_id: generation.id,
      output_count: normalizedResultUrls.length,
      direct_terminal_settlement: true,
      provider_state: providerState,
      user_abandoned: isAbandoned,
    },
  });

  return {
    ok: true,
    generationId: generation.id,
    requestId: generation.request_id,
  };
};

export const settleDirectGenerationFailure = async ({
  generationId,
  requestId,
  userId,
  routeLabel,
  providerState,
  errorMessage,
  errorDetail,
  failureReasonCode = "provider_error",
}: DirectGenerationFailureInput): Promise<DirectGenerationSettlementResult> => {
  const generation = await readGenerationContext({
    generationId,
    requestId,
    userId,
    routeLabel,
  });
  if (!generation?.request_id) {
    return { ok: false, error: "generation_not_found" };
  }

  const attempt = await readAttemptContext({
    requestId: generation.request_id,
    userId: generation.user_id,
  });
  const nowIso = new Date().toISOString();
  const normalizedErrorMessage = asString(errorMessage) ?? "Generation failed";
  const normalizedErrorDetail = stringifyDetail(errorDetail, normalizedErrorMessage);
  const generationMetadata = asObject(generation.metadata);
  const abandonment = await readGenerationAbandonmentContext({
    userId: generation.user_id,
    generationId: generation.id,
    requestId: generation.request_id,
    sourceRef: asString(generationMetadata.source_ref),
    metadata: generationMetadata,
  });
  const isAbandoned = abandonment.abandoned || isGenerationAbandonedMetadata(generationMetadata);
  const mergedMetadata = mergeSettlementMetadata({
    metadata: isAbandoned
      ? {
          ...generationMetadata,
          user_abandoned: true,
          abandoned_no_refund: abandonment.noRefund,
          hidden_in_reference_grid: true,
        }
      : generationMetadata,
    nowIso,
    providerState,
    outcome: "fail",
  });

  const transition = await applyGenerationLifecycleTransition({
    intent: "provider_failed_observed",
    applyGenerationMutation: async () => {
      try {
        await updateGenerationRow({
          generationId: generation.id,
          userId: generation.user_id,
          updates: {
            status: "fail",
            completed_at: nowIso,
            failure_reason_code: failureReasonCode,
            error_message: normalizedErrorMessage,
            recovery_state: "exhausted",
            last_recovery_at: nowIso,
            next_recovery_at: null,
            metadata: mergedMetadata,
          },
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    attemptMutation: {
      kind: "state_update",
      input: {
        providerRequestId: generation.request_id,
        userId: generation.user_id,
        status: "failed",
        observedAt: nowIso,
        completedAt: nowIso,
        failureReasonCode,
        errorMessage: normalizedErrorMessage,
        metadata: {
          direct_terminal_settlement: true,
          direct_terminal_settlement_outcome: "fail",
          ...(providerState ? { direct_terminal_provider_state: providerState } : {}),
        },
      },
      allowMissingAttempt: true,
    },
  });
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }

  const hiddenInReferenceGrid =
    isAbandoned ||
    (readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
      false);

  await upsertGenerationProjection({
    generationId: generation.id,
    userId: generation.user_id,
    sourceRef: asString(generationMetadata.source_ref),
    requestId: generation.request_id,
    provider: generation.provider,
    providerRequestId: generation.request_id,
    latestAttemptId: attempt?.id ?? null,
    status: "ready",
    taskState: "fail",
    queueState: "failed",
    displayPrompt: generation.prompt_text,
    modelId: generation.model_id,
    errorMessage: normalizedErrorMessage,
    errorMessageShort: normalizedErrorMessage,
    errorDetail: normalizedErrorDetail,
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
    completedAt: nowIso,
  });

  await settleGenerationOutcome({
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    outcome: "fail",
    reason: normalizedErrorMessage,
    routeLabel,
    detail: {
      generation_id: generation.id,
      failure_reason_code: failureReasonCode,
      direct_terminal_settlement: true,
      provider_state: providerState,
      error_detail: normalizedErrorDetail,
      user_abandoned: isAbandoned,
    },
    abandonedNoRefund: isAbandoned && abandonment.noRefund,
  });

  return {
    ok: true,
    generationId: generation.id,
    requestId: generation.request_id,
  };
};
