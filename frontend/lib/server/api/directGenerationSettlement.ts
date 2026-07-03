import { readRecoveryGenerationRow } from "../falIntegration/recoveryGenerationLookup";
import { persistRecoveryMediaFilesForGeneration } from "../falIntegration/recoveryMediaPersistence";
import { settleGenerationOutcome } from "./generationBilling";
import { resolveGenerationLineageByProviderRequest } from "./generationLineageResolver";
import { persistGenerationOutputRecords } from "./generationOutputs";
import { applyGenerationLifecycleTransition } from "./generationLifecycleTransitionService";
import { writeAppErrorLog } from "./appErrorLogs";
import {
  describeBestEffortWriteFailure,
  logBestEffortGenerationProjectionWriteFailure,
  logBestEffortGenerationPublicationWriteFailure,
} from "./terminalConvergenceBestEffortLogging";
import { applyTerminalAbandonmentMetadata } from "./terminalConvergenceMetadata";
import {
  readTerminalConvergenceProjectIdFromMetadata,
  syncTerminalFailureViewState,
  syncTerminalSuccessViewState,
} from "./terminalConvergenceViewSync";
import {
  readGenerationAbandonmentContext,
  isGenerationAbandonedMetadata,
} from "./generationAbandonment";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readMediaAutosaveEnabledForUser } from "./mediaAutosavePreference";
import { resolveMediaAutosavePreferenceLookupUserMessage } from "./mediaAutosavePreference";
import { canAutoPersistRecoveryMedia } from "../../mediaAutosavePolicy";
import { normalizeCustomerFacingProviderError } from "../../customerFacingProviderText";
import { associateGenerationWithProjectForUserBestEffort } from "../projectGenerationAssociationsService";
import { releaseMotionReferenceVideoLeasesForGeneration } from "../motionReferenceVideoAssetLease";

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
  errorPayload?: unknown;
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

const refreshProjectGenerationAssociationFromMetadata = async ({
  generationId,
  metadata,
  modelId,
  provider,
  requestId,
  routeLabel,
  userId,
}: {
  generationId: string;
  metadata: JsonObject;
  modelId: string | null;
  provider: string | null;
  requestId: string | null;
  routeLabel: string;
  userId: string;
}): Promise<void> => {
  const projectId = readTerminalConvergenceProjectIdFromMetadata(metadata);
  if (!projectId) return;

  await associateGenerationWithProjectForUserBestEffort({
    userId,
    projectId,
    generationId,
    onError: async ({ projectId: normalizedProjectId, error }) => {
      await writeAppErrorLog({
        source: "telemetry.direct_generation_settlement.project_association_failed",
        message: "Direct generation settlement project association refresh failed.",
        requestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          project_id: normalizedProjectId,
          provider,
          model_id: modelId,
          route_label: routeLabel,
          association_error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    },
  });
};

const logBestEffortProjectionFailure = async ({
  generationId,
  requestId,
  routeLabel,
  userId,
  provider,
  modelId,
  providerState,
  projectionStage,
  error,
}: {
  generationId: string;
  requestId: string | null;
  routeLabel: string;
  userId: string;
  provider: string | null;
  modelId: string | null;
  providerState: string | null;
  projectionStage: "success" | "fail";
  error: unknown;
}): Promise<void> => {
  await logBestEffortGenerationProjectionWriteFailure({
    source: "telemetry.direct_generation_settlement.projection_write_failed",
    message:
      "Direct generation settlement projection write failed after canonical settlement state succeeded.",
    generationId,
    requestId,
    routeLabel,
    userId,
    provider,
    modelId,
    metadata: {
      provider_state: providerState,
      projection_stage: projectionStage,
      projection_error: describeBestEffortWriteFailure(error),
    },
  });
};

const logBestEffortPublicationFailure = async ({
  generationId,
  requestId,
  routeLabel,
  userId,
  provider,
  modelId,
  providerState,
  error,
}: {
  generationId: string;
  requestId: string | null;
  routeLabel: string;
  userId: string;
  provider: string | null;
  modelId: string | null;
  providerState: string | null;
  error: unknown;
}): Promise<void> => {
  await logBestEffortGenerationPublicationWriteFailure({
    source: "telemetry.direct_generation_settlement.publication_write_failed",
    message:
      "Direct generation settlement publication write failed after canonical settlement state succeeded.",
    generationId,
    requestId,
    routeLabel,
    userId,
    provider,
    modelId,
    metadata: {
      provider_state: providerState,
      publication_error: describeBestEffortWriteFailure(error),
    },
  });
};

const stringifyDetail = (value: unknown, fallback: string): string => {
  return normalizeCustomerFacingProviderError(value, fallback);
};

const tryReleaseMotionReferenceVideoLeases = async ({
  generationId,
  requestId,
  routeLabel,
  userId,
}: {
  generationId: string;
  requestId: string | null;
  routeLabel: string;
  userId: string;
}): Promise<void> => {
  try {
    await releaseMotionReferenceVideoLeasesForGeneration({
      generationId,
      userId,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.motion_reference_video.lease_release_failed",
      message: "Motion reference video lease release failed after direct terminal settlement.",
      requestId,
      userId,
      statusCode: 200,
      metadata: {
        generation_id: generationId,
        route_label: routeLabel,
        lease_error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }
};

const buildUnsettledBillingError = (note: string): string =>
  `Generation billing settlement did not complete: ${note}`;

const buildDirectTerminalOutputMetadata = ({
  autosaveDecision,
  autosaveDecisionReason,
  autosaveEnabled,
  autosavePreferenceSource,
  outcome,
  providerState,
  visibilityState,
}: {
  autosaveDecision: string;
  autosaveDecisionReason: string;
  autosaveEnabled: boolean;
  autosavePreferenceSource: string;
  outcome: "success";
  providerState: string;
  visibilityState: "settlement_pending" | "settled";
}): JsonObject => ({
  direct_terminal_settlement: true,
  direct_terminal_settlement_outcome: outcome,
  direct_terminal_provider_state: providerState,
  direct_terminal_visibility_state: visibilityState,
  autosave_enabled: autosaveEnabled,
  autosave_preference_source: autosavePreferenceSource,
  autosave_decision: autosaveDecision,
  autosave_decision_reason: autosaveDecisionReason,
});

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
  const lineage = await resolveGenerationLineageByProviderRequest({
    providerRequestId: requestId,
    userId,
    includeProjection: false,
  });
  return lineage.generationAttemptId
    ? {
        id: lineage.generationAttemptId,
      }
    : null;
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
    metadata: applyTerminalAbandonmentMetadata({
      metadata: generationMetadata,
      abandonment,
    }),
    nowIso,
    providerState,
    outcome: "success",
  });
  const mediaAutosavePreference = await readMediaAutosaveEnabledForUser({
    userId: generation.user_id,
  });
  const mediaAutosaveEnabled = mediaAutosavePreference.enabled;
  const autosavePreferenceLookupMessage =
    resolveMediaAutosavePreferenceLookupUserMessage(mediaAutosavePreference);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });

  let mediaFileIds: string[] = [];
  let autosaveDecision: "auto_persisted" | "autosave_skipped" = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;

  let persistedOutputRows = await persistGenerationOutputRecords({
    generationId: generation.id,
    userId: generation.user_id,
    generationAttemptId: attempt?.id,
    providerRequestId: generation.request_id,
    resultUrls: normalizedResultUrls,
    mediaFileIds: [],
    metadata: buildDirectTerminalOutputMetadata({
      autosaveDecision: autosavePolicyDecision.allowed
        ? "provider_urls_persisted"
        : "autosave_skipped",
      autosaveDecisionReason: autosavePolicyDecision.allowed
        ? "canonical_outputs_before_media_autosave"
        : autosavePolicyDecision.reason,
      autosaveEnabled: mediaAutosaveEnabled,
      autosavePreferenceSource: mediaAutosavePreference.source,
      outcome: "success",
      providerState,
      visibilityState: "settlement_pending",
    }),
  });

  if (autosavePolicyDecision.allowed) {
    try {
      mediaFileIds = await persistRecoveryMediaFilesForGeneration({
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
        projectId: readTerminalConvergenceProjectIdFromMetadata(generationMetadata),
      });
      persistedOutputRows = await persistGenerationOutputRecords({
        generationId: generation.id,
        userId: generation.user_id,
        generationAttemptId: attempt?.id,
        providerRequestId: generation.request_id,
        resultUrls: normalizedResultUrls,
        mediaFileIds,
        metadata: buildDirectTerminalOutputMetadata({
          autosaveDecision: "auto_persisted",
          autosaveDecisionReason: autosavePolicyDecision.reason,
          autosaveEnabled: mediaAutosaveEnabled,
          autosavePreferenceSource: mediaAutosavePreference.source,
          outcome: "success",
          providerState,
          visibilityState: "settlement_pending",
        }),
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.direct_generation_settlement.media_autosave_failed",
        message:
          "Direct generation settlement kept provider result URLs after media autosave failed.",
        requestId: generation.request_id,
        userId: generation.user_id,
        statusCode: 200,
        metadata: {
          generation_id: generation.id,
          provider: generation.provider,
          model_id: generation.model_id,
          route_label: routeLabel,
          autosave_preference_source: mediaAutosavePreference.source,
          autosave_error: autosaveDecisionReason,
        },
      }).catch(() => undefined);
    }
  }
  const billingSettlement = await settleGenerationOutcome({
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
      autosave_preference_source: mediaAutosavePreference.source,
      autosave_decision: autosaveDecision,
      autosave_decision_reason: autosaveDecisionReason,
    },
  });
  if (!billingSettlement.settled) {
    return {
      ok: false,
      error: buildUnsettledBillingError(billingSettlement.note),
    };
  }

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
  await tryReleaseMotionReferenceVideoLeases({
    generationId: generation.id,
    requestId: generation.request_id,
    routeLabel,
    userId: generation.user_id,
  });

  persistedOutputRows = await persistGenerationOutputRecords({
    generationId: generation.id,
    userId: generation.user_id,
    generationAttemptId: attempt?.id,
    providerRequestId: generation.request_id,
    resultUrls: normalizedResultUrls,
    mediaFileIds,
    metadata: buildDirectTerminalOutputMetadata({
      autosaveDecision,
      autosaveDecisionReason,
      autosaveEnabled: mediaAutosaveEnabled,
      autosavePreferenceSource: mediaAutosavePreference.source,
      outcome: "success",
      providerState,
      visibilityState: "settled",
    }),
  });

  await syncTerminalSuccessViewState({
    generation: {
      id: generation.id,
      user_id: generation.user_id,
      request_id: generation.request_id,
      provider: generation.provider,
      model_id: generation.model_id,
      prompt_text: generation.prompt_text,
      created_at: generation.created_at,
      metadata: generationMetadata,
    },
    abandoned: isAbandoned,
    autosaveDecisionReason,
    autosavePreferenceLookupMessage,
    mediaFileIds,
    nowIso,
    persistedOutputRows,
    publicationGenerationAttemptId: attempt?.id ?? null,
    publicationMetadata: {
      direct_terminal_settlement: true,
      direct_terminal_settlement_outcome: "success",
      direct_terminal_provider_state: providerState,
      user_abandoned: isAbandoned,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_preference_source: mediaAutosavePreference.source,
      autosave_decision: autosaveDecision,
      autosave_decision_reason: autosaveDecisionReason,
    },
    publicationWritePolicy: "always",
    projectionLatestAttemptId: attempt?.id ?? null,
    projectionQueueState: "dispatched",
    resultUrls: normalizedResultUrls,
    savedMediaIdsPolicy: "all_if_canonical",
    includeProjectionStoragePaths: true,
    onPublicationFailure: async (error) => {
      await logBestEffortPublicationFailure({
        generationId: generation.id,
        requestId: generation.request_id,
        routeLabel,
        userId: generation.user_id,
        provider: generation.provider,
        modelId: generation.model_id,
        providerState,
        error,
      });
    },
    onProjectionFailure: async (error) => {
      await logBestEffortProjectionFailure({
        generationId: generation.id,
        requestId: generation.request_id,
        routeLabel,
        userId: generation.user_id,
        provider: generation.provider,
        modelId: generation.model_id,
        providerState,
        projectionStage: "success",
        error,
      });
    },
  });

  await refreshProjectGenerationAssociationFromMetadata({
    generationId: generation.id,
    metadata: generationMetadata,
    modelId: generation.model_id,
    provider: generation.provider,
    requestId: generation.request_id,
    routeLabel,
    userId: generation.user_id,
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
  errorPayload,
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
  const durableErrorPayload = errorPayload ?? errorDetail ?? null;
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
    metadata: applyTerminalAbandonmentMetadata({
      metadata: generationMetadata,
      abandonment,
    }),
    nowIso,
    providerState,
    outcome: "fail",
  });

  const billingSettlement = await settleGenerationOutcome({
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
      error_payload: durableErrorPayload,
      user_abandoned: isAbandoned,
    },
    abandonedNoRefund: isAbandoned && abandonment.noRefund,
  });
  if (!billingSettlement.settled) {
    return {
      ok: false,
      error: buildUnsettledBillingError(billingSettlement.note),
    };
  }

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
  await tryReleaseMotionReferenceVideoLeases({
    generationId: generation.id,
    requestId: generation.request_id,
    routeLabel,
    userId: generation.user_id,
  });

  await syncTerminalFailureViewState({
    generation: {
      id: generation.id,
      user_id: generation.user_id,
      request_id: generation.request_id,
      provider: generation.provider,
      model_id: generation.model_id,
      prompt_text: generation.prompt_text,
      created_at: generation.created_at,
      metadata: generationMetadata,
    },
    abandoned: isAbandoned,
    completedAt: nowIso,
    errorDetail: normalizedErrorDetail,
    errorPayload: durableErrorPayload,
    errorMessage: normalizedErrorMessage,
    errorMessageShort: normalizedErrorMessage,
    projectionLatestAttemptId: attempt?.id ?? null,
    projectionQueueState: "failed",
    onProjectionFailure: async (error) => {
      await logBestEffortProjectionFailure({
        generationId: generation.id,
        requestId: generation.request_id,
        routeLabel,
        userId: generation.user_id,
        provider: generation.provider,
        modelId: generation.model_id,
        providerState,
        projectionStage: "fail",
        error,
      });
    },
  });

  return {
    ok: true,
    generationId: generation.id,
    requestId: generation.request_id,
  };
};
