/**
 * Shared terminal convergence view-sync helpers.
 * Aligns publication/projection persistence across direct settlement and shared recovery.
 */
import {
  readPersistedGenerationOutputs,
  type PersistedGenerationOutputRow,
} from "./generationOutputs";
import { upsertGenerationProjection } from "./generationProjection";
import { upsertGenerationPublication } from "./generationPublications";
import { readMediaDeliveryPathsById } from "./mediaDeliveryPaths";
import { resolveAutosaveProjectionSaveOutcome } from "./terminalConvergenceProjectionState";
import {
  resolveTerminalFailureVisibilityState,
  resolveTerminalSuccessVisibilityState,
} from "./terminalConvergenceVisibility";

type JsonObject = Record<string, unknown>;

type TerminalConvergenceGeneration = {
  id: string;
  user_id: string;
  request_id: string | null;
  provider: string;
  model_id: string;
  prompt_text: string;
  created_at: string;
  metadata: JsonObject;
};

type SuccessSavedMediaIdsPolicy = "verified_only" | "all_if_canonical";
type SuccessPublicationWritePolicy = "always" | "canonical_owned_only";

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

const readMetadataBoolean = (metadata: JsonObject, ...keys: string[]): boolean | null => {
  for (const key of keys) {
    if (typeof metadata[key] === "boolean") {
      return metadata[key] as boolean;
    }
  }
  return null;
};

/**
 * Read the canonical project id from generation metadata.
 */
export const readTerminalConvergenceProjectIdFromMetadata = (
  metadata: JsonObject
): string | null => {
  const shortpulseContext = readMetadataObject(metadata, "shortpulse_context", "shortpulseContext");
  return (
    asOptionalString(shortpulseContext.project_id) ?? asOptionalString(shortpulseContext.projectId)
  );
};

/**
 * Sync terminal success publications and projection without changing caller-owned settlement flow.
 */
export const syncTerminalSuccessViewState = async ({
  generation,
  abandoned,
  autosaveDecisionReason,
  autosavePreferenceLookupMessage = null,
  mediaFileIds,
  nowIso,
  persistedOutputRows,
  publicationGenerationAttemptId,
  publicationMetadata,
  publicationWritePolicy = "canonical_owned_only",
  projectionLatestAttemptId,
  projectionQueueState,
  resultUrls,
  savedMediaIdsPolicy = "verified_only",
  includeProjectionStoragePaths = false,
  onPublicationFailure,
  onProjectionFailure,
}: {
  generation: TerminalConvergenceGeneration;
  abandoned: boolean;
  autosaveDecisionReason: string;
  autosavePreferenceLookupMessage?: string | null;
  mediaFileIds: string[];
  nowIso: string;
  persistedOutputRows?: PersistedGenerationOutputRow[];
  publicationGenerationAttemptId?: string | null;
  publicationMetadata: JsonObject;
  publicationWritePolicy?: SuccessPublicationWritePolicy;
  projectionLatestAttemptId?: string | null;
  projectionQueueState?: string | null;
  resultUrls: string[];
  savedMediaIdsPolicy?: SuccessSavedMediaIdsPolicy;
  includeProjectionStoragePaths?: boolean;
  onPublicationFailure: (error: unknown) => Promise<void>;
  onProjectionFailure: (error: unknown) => Promise<void>;
}): Promise<{
  hasCanonicalOwnedMedia: boolean;
  projectId: string | null;
  savedMediaIds: string[];
}> => {
  const outputRows =
    persistedOutputRows && persistedOutputRows.length > 0
      ? persistedOutputRows
      : await readPersistedGenerationOutputs({
          generationId: generation.id,
          userId: generation.user_id,
        });
  const normalizedResultUrls = outputRows.length
    ? outputRows.map((row) => row.resultUrl)
    : resultUrls;
  const normalizedMediaFileIds = mediaFileIds
    .map((value) => asOptionalString(value))
    .filter((value): value is string => Boolean(value));
  const deliveryPathsByMediaId = await readMediaDeliveryPathsById({
    mediaFileIds: outputRows
      .map((row) => row.mediaFileId)
      .filter((value): value is string => Boolean(value)),
    userId: generation.user_id,
  });
  const hasCanonicalOwnedMedia =
    outputRows.length > 0 &&
    outputRows.every(
      (row) => typeof row.mediaFileId === "string" && deliveryPathsByMediaId.has(row.mediaFileId)
    );
  const hasDisplayableResultMedia = normalizedResultUrls.length > 0;
  const generationMetadata = asObject(generation.metadata);
  const { hiddenInReferenceGrid, publicationState, referenceGridVisible } =
    resolveTerminalSuccessVisibilityState({
      metadata: {
        hiddenInReferenceGrid: readMetadataBoolean(
          generationMetadata,
          "hidden_in_reference_grid",
          "hiddenInReferenceGrid"
        ),
      },
      abandoned,
      hasCanonicalOwnedMedia,
      hasDisplayableResultMedia,
    });
  const savedMediaIds =
    savedMediaIdsPolicy === "all_if_canonical"
      ? hasCanonicalOwnedMedia
        ? normalizedMediaFileIds
        : []
      : normalizedMediaFileIds.filter((mediaFileId) => deliveryPathsByMediaId.has(mediaFileId));
  const projectionSaveOutcome = resolveAutosaveProjectionSaveOutcome({
    savedMediaIds,
    autosaveDecisionReason,
    autosavePreferenceLookupMessage,
  });
  const shouldWritePublications =
    outputRows.length > 0 && (publicationWritePolicy === "always" || hasCanonicalOwnedMedia);

  if (shouldWritePublications) {
    try {
      await Promise.all(
        outputRows.map((row) => {
          if (!row.id) return Promise.resolve();
          const deliveryPaths = row.mediaFileId
            ? (deliveryPathsByMediaId.get(row.mediaFileId) ?? null)
            : null;
          return upsertGenerationPublication({
            generationId: generation.id,
            generationOutputId: row.id,
            userId: generation.user_id,
            generationAttemptId: publicationGenerationAttemptId,
            publicationState,
            reusable: true,
            visibleInAiStudio: true,
            visibleInReferenceGrid: referenceGridVisible,
            ownedMediaFileId: row.mediaFileId,
            previewUrl: row.resultUrl,
            fullUrl: row.resultUrl,
            previewStoragePath: deliveryPaths?.previewStoragePath ?? null,
            fullStoragePath: deliveryPaths?.fullStoragePath ?? null,
            publishedAt: nowIso,
            metadata: publicationMetadata,
          });
        })
      );
    } catch (error) {
      await onPublicationFailure(error);
    }
  }

  const projectId = readTerminalConvergenceProjectIdFromMetadata(generationMetadata);
  const firstOwnedDeliveryPaths =
    outputRows.length > 0 && outputRows[0]?.mediaFileId
      ? (deliveryPathsByMediaId.get(outputRows[0].mediaFileId) ?? null)
      : null;

  try {
    await upsertGenerationProjection({
      generationId: generation.id,
      userId: generation.user_id,
      projectId,
      sourceRef: asOptionalString(generationMetadata.source_ref),
      requestId: generation.request_id,
      provider: generation.provider,
      providerRequestId: generation.request_id,
      ...(projectionLatestAttemptId !== undefined
        ? { latestAttemptId: projectionLatestAttemptId }
        : {}),
      status: "ready",
      taskState: "success",
      ...(projectionQueueState !== undefined ? { queueState: projectionQueueState } : {}),
      displayPrompt: generation.prompt_text,
      modelId: generation.model_id,
      previewUrl: normalizedResultUrls[0] ?? null,
      ...(includeProjectionStoragePaths
        ? {
            previewStoragePath: firstOwnedDeliveryPaths?.previewStoragePath ?? null,
            fullStoragePath: firstOwnedDeliveryPaths?.fullStoragePath ?? null,
          }
        : {}),
      errorMessage: null,
      errorMessageShort: null,
      errorDetail: null,
      saveState: projectionSaveOutcome.saveState,
      saveError: projectionSaveOutcome.saveError,
      hiddenInReferenceGrid,
      referenceGridVisible,
      publicationState,
      resultUrls: normalizedResultUrls,
      savedMediaIds,
      generationReplay: readMetadataObject(
        generationMetadata,
        "generation_replay",
        "generationReplay"
      ),
      workflowReload: readMetadataObject(generationMetadata, "workflow_reload", "workflowReload"),
      characterContext: readMetadataObject(
        generationMetadata,
        "character_context",
        "characterContext"
      ),
      styleContext: readMetadataObject(generationMetadata, "style_context", "styleContext"),
      startedAt: generation.created_at,
      completedAt: nowIso,
    });
  } catch (error) {
    await onProjectionFailure(error);
  }

  return {
    hasCanonicalOwnedMedia,
    projectId,
    savedMediaIds,
  };
};

/**
 * Sync terminal failure projection state without changing caller-owned failure settlement flow.
 */
export const syncTerminalFailureViewState = async ({
  generation,
  abandoned,
  completedAt,
  errorDetail,
  errorMessage,
  errorMessageShort,
  projectionLatestAttemptId,
  projectionQueueState,
  onProjectionFailure,
}: {
  generation: TerminalConvergenceGeneration;
  abandoned: boolean;
  completedAt: string;
  errorDetail: string;
  errorMessage: string;
  errorMessageShort: string;
  projectionLatestAttemptId?: string | null;
  projectionQueueState?: string | null;
  onProjectionFailure: (error: unknown) => Promise<void>;
}): Promise<void> => {
  const generationMetadata = asObject(generation.metadata);
  const { hiddenInReferenceGrid, referenceGridVisible } = resolveTerminalFailureVisibilityState({
    metadata: {
      hiddenInReferenceGrid: readMetadataBoolean(
        generationMetadata,
        "hidden_in_reference_grid",
        "hiddenInReferenceGrid"
      ),
    },
    abandoned,
  });

  try {
    await upsertGenerationProjection({
      generationId: generation.id,
      userId: generation.user_id,
      projectId: readTerminalConvergenceProjectIdFromMetadata(generationMetadata),
      sourceRef: asOptionalString(generationMetadata.source_ref),
      requestId: generation.request_id,
      provider: generation.provider,
      providerRequestId: generation.request_id,
      ...(projectionLatestAttemptId !== undefined
        ? { latestAttemptId: projectionLatestAttemptId }
        : {}),
      status: "ready",
      taskState: "fail",
      ...(projectionQueueState !== undefined ? { queueState: projectionQueueState } : {}),
      displayPrompt: generation.prompt_text,
      modelId: generation.model_id,
      errorMessage,
      errorMessageShort,
      errorDetail,
      saveState: "idle",
      hiddenInReferenceGrid,
      referenceGridVisible,
      publicationState: "suppressed",
      resultUrls: [],
      savedMediaIds: [],
      generationReplay: readMetadataObject(
        generationMetadata,
        "generation_replay",
        "generationReplay"
      ),
      workflowReload: readMetadataObject(generationMetadata, "workflow_reload", "workflowReload"),
      characterContext: readMetadataObject(
        generationMetadata,
        "character_context",
        "characterContext"
      ),
      styleContext: readMetadataObject(generationMetadata, "style_context", "styleContext"),
      startedAt: generation.created_at,
      completedAt,
    });
  } catch (error) {
    await onProjectionFailure(error);
  }
};
