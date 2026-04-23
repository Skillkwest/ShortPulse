import { readRecoveryGenerationRow } from "../falIntegration/recoveryGenerationLookup";
import { settleGenerationOutcome } from "./generationBilling";
import { lookupGenerationAttemptByProviderRequest } from "./generationAttempts";
import { persistGenerationOutputRecords } from "./generationOutputs";
import { applyGenerationLifecycleTransition } from "./generationLifecycleTransitionService";
import { upsertGenerationProjection } from "./generationProjection";
import { upsertGenerationPublication } from "./generationPublications";
import { getSupabaseAdmin } from "./supabaseAdmin";

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
  const mergedMetadata = mergeSettlementMetadata({
    metadata: generationMetadata,
    nowIso,
    providerState,
    outcome: "success",
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

  const persistedOutputRows = await persistGenerationOutputRecords({
    generationId: generation.id,
    userId: generation.user_id,
    generationAttemptId: attempt?.id,
    providerRequestId: generation.request_id,
    resultUrls: normalizedResultUrls,
    mediaFileIds: [],
    metadata: {
      direct_terminal_settlement: true,
      direct_terminal_settlement_outcome: "success",
      direct_terminal_provider_state: providerState,
    },
  });

  const hiddenInReferenceGrid =
    readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
    false;

  await Promise.all(
    persistedOutputRows.map((row) => {
      if (!row.id) return Promise.resolve();
      return upsertGenerationPublication({
        generationId: generation.id,
        generationOutputId: row.id,
        userId: generation.user_id,
        generationAttemptId: attempt?.id ?? null,
        publicationState: "published",
        reusable: true,
        visibleInAiStudio: true,
        visibleInReferenceGrid: !hiddenInReferenceGrid,
        previewUrl: row.resultUrl,
        fullUrl: row.resultUrl,
        publishedAt: nowIso,
        metadata: {
          direct_terminal_settlement: true,
          direct_terminal_settlement_outcome: "success",
          direct_terminal_provider_state: providerState,
        },
      });
    })
  );

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
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
    saveState: "idle",
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
    publicationState: "published",
    resultUrls: normalizedResultUrls,
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
    outcome: "success",
    reason: "Provider completed and canonical results were persisted synchronously.",
    routeLabel,
    detail: {
      generation_id: generation.id,
      output_count: normalizedResultUrls.length,
      direct_terminal_settlement: true,
      provider_state: providerState,
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
  const mergedMetadata = mergeSettlementMetadata({
    metadata: generationMetadata,
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
    readMetadataBoolean(generationMetadata, "hidden_in_reference_grid", "hiddenInReferenceGrid") ??
    false;

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
    },
  });

  return {
    ok: true,
    generationId: generation.id,
    requestId: generation.request_id,
  };
};
