/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import {
  createAiStudioProjectWorkspaceSnapshot,
  hasProjectDurableOutputAuthority,
  hasProjectRecoverableRuntimeIdentity,
  isProjectGeneratedWorkspaceOutput,
} from "../ai-studio-session/projectWorkspaceSnapshot";
import {
  isLightweightProjectWorkspaceCheckpointSnapshot,
  readProjectOutputDisplayChecksum,
} from "../ai-studio-session/projectWorkspaceCheckpoint";
import { parseAiStudioSessionSnapshotShape } from "../ai-studio-session/sessionSnapshotShape";
import {
  extractTrustedSupabaseSignedMediaStoragePath,
  filterTrustedMediaDirectPreviewUrls,
  isSupabaseObjectSignedStorageUrl,
  isSupabaseRenderImageUrl,
  isTrustedMediaDirectPreviewUrl,
} from "../mediaPreviewTrustPolicy";
import { isUserScopedMediaStoragePath } from "../mediaStoragePath";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { hydrateProjectSnapshotGeneratedOutputs } from "./projectGenerationAssociationsService";
import {
  areProjectWorkspaceCheckpointsStructurallyEqual,
  computeProjectOutputDisplayChecksumForSnapshot,
  createLightweightProjectWorkspaceCheckpointSnapshot,
  materializeProjectWorkspaceSnapshotForUser,
  projectWorkspaceCheckpointNeedsCompaction,
  syncProjectOutputDisplayItemsForSnapshot,
} from "./projectOutputDisplayItemsService";
import {
  backfillProjectAssetAssociationsForSnapshot,
  computeComparableProjectAssetAssociationChecksum,
  computeProjectAssetAssociationChecksum,
  patchProjectAssetAssociationChecksum,
  readProjectAssetAssociationChecksum,
  resolveOwnedSnapshotAssociationIdsForRead,
  resolveOwnedSnapshotAssociationIdsForWrite,
} from "./projectWorkspaceAssociationAuthority";
import {
  asRecord,
  compareIsoTimestamps,
  normalizeIsoTimestamp,
  normalizeOptionalString,
  normalizeStringList,
  normalizeUuid,
  normalizeUuidList,
  parseProjectWorkspaceSnapshotPayload,
  toErrorMessage,
} from "./projectWorkspaceStateParsing";
import {
  countReferenceGridVisibleOutputs,
  REFERENCE_GRID_MAX_VISIBLE_ITEMS,
} from "../model-runtime/referenceGridLimits";

const PROJECT_WORKSPACE_SELECT_COLUMNS =
  "project_id, user_id, schema_version, snapshot, snapshot_updated_at, checkpoint_revision, created_at, updated_at" as const;
const PROJECT_WORKSPACE_WRITE_RETURN_COLUMNS =
  "project_id, user_id, schema_version, snapshot_updated_at, checkpoint_revision, created_at, updated_at" as const;

const PROJECT_WORKSPACE_POST_WRITE_REPAIR_TIMEOUT_MS = 2_500;
const PROJECT_WORKSPACE_RESPONSE_MATERIALIZATION_TIMEOUT_MS = 2_500;

type ProjectWorkspaceStateRow = {
  project_id: string;
  user_id: string;
  schema_version: number;
  snapshot: Record<string, unknown>;
  snapshot_updated_at: string;
  checkpoint_revision: number;
  created_at: string;
  updated_at: string;
};

type ProjectWorkspaceStateWriteReturnRow = Omit<ProjectWorkspaceStateRow, "snapshot">;

export type ProjectWorkspaceStateRecord = {
  projectId: string;
  userId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
  checkpointRevision: number;
  createdAt: string;
  updatedAt: string;
  saveOutcome?: ProjectWorkspaceSaveOutcome;
};

export type ProjectWorkspaceSaveOutcomeStatus = "saved" | "saved_with_repair_pending";

export type ProjectWorkspaceSaveOutcome = {
  status: ProjectWorkspaceSaveOutcomeStatus;
  repairStage?: ProjectWorkspaceRepairStage;
  repairMessage?: string | null;
};

type ProjectWorkspaceRepairStage =
  | "owned_id_resolution"
  | "project_output_display_sync"
  | "project_association_backfill";

type ProjectWorkspaceRepairPending = {
  stage: ProjectWorkspaceRepairStage;
  message: string;
};

type ProjectWorkspaceMaterializationStage = "workspace read" | "workspace save";

export class InvalidProjectWorkspaceSnapshotError extends Error {
  constructor(message = "Invalid project workspace snapshot") {
    super(message);
    this.name = "InvalidProjectWorkspaceSnapshotError";
  }
}

const wrapProjectWorkspaceSaveStageError = ({
  stage,
  error,
}: {
  stage: string;
  error: unknown;
}): Error =>
  new Error(
    `Project workspace save failed during ${stage}: ${toErrorMessage(error, "Unknown error")}`
  );

const withProjectWorkspaceBestEffortTimeout = async <T>(
  promise: Promise<T>,
  stage: string,
  timeoutMs: number
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${stage} exceeded ${timeoutMs}ms budget`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const logProjectWorkspaceBestEffortFailure = ({
  stage,
  projectId,
  error,
}: {
  stage: string;
  projectId: string;
  error: unknown;
}): void => {
  console.warn("[project-workspace] best-effort save stage failed; persisting sanitized snapshot", {
    projectId,
    stage,
    error: toErrorMessage(error, "Unknown error"),
  });
};

const logProjectWorkspaceRepairPending = async ({
  userId,
  projectId,
  repairStage,
  repairMessage,
}: {
  userId: string;
  projectId: string;
  repairStage: ProjectWorkspaceRepairStage;
  repairMessage: string;
}): Promise<void> => {
  await writeAppErrorLog({
    source: "telemetry.ai_studio.project_workspace.repair_pending",
    message: "Project workspace save completed, but follow-up project repair is still pending.",
    userId,
    statusCode: 200,
    metadata: {
      project_id: projectId,
      repair_stage: repairStage,
      save_outcome: "saved_with_repair_pending",
      repair_message: repairMessage,
    },
  }).catch(() => undefined);
};

const countProjectWorkspaceVisibleActiveOutputs = (snapshot: Record<string, unknown>): number => {
  const outputsRecord = asRecord(snapshot.outputs);
  const activeOutputs = Array.isArray(outputsRecord.active) ? outputsRecord.active : [];
  return countReferenceGridVisibleOutputs(
    activeOutputs.map((row) => ({
      hiddenInReferenceGrid: asRecord(row).hiddenInReferenceGrid === true,
    }))
  );
};

const collectProjectWorkspaceVisibleActiveOutputRows = (
  snapshot: Record<string, unknown>
): Record<string, unknown>[] => {
  const outputsRecord = asRecord(snapshot.outputs);
  const activeOutputs = Array.isArray(outputsRecord.active) ? outputsRecord.active : [];
  return activeOutputs
    .map((row) => asRecord(row))
    .filter((row) => row.hiddenInReferenceGrid !== true);
};

const summarizeProjectWorkspaceOverflowRows = (rows: Record<string, unknown>[]) => {
  const sampleRows = rows.slice(0, 20);
  return {
    trimmed_sample_output_ids: sampleRows
      .map((row) => normalizeOptionalString(row.id))
      .filter((id): id is string => Boolean(id)),
    trimmed_with_durable_authority_count: rows.filter((row) =>
      hasProjectDurableOutputAuthority(row)
    ).length,
    trimmed_with_runtime_identity_count: rows.filter((row) =>
      hasProjectRecoverableRuntimeIdentity(row)
    ).length,
    trimmed_with_saved_media_ids_count: rows.filter(
      (row) => normalizeUuidList(row.savedMediaIds).length > 0
    ).length,
    trimmed_with_prompt_id_count: rows.filter((row) => Boolean(normalizeUuid(row.promptId))).length,
    trimmed_with_generation_id_count: rows.filter((row) => Boolean(normalizeUuid(row.generationId)))
      .length,
  };
};

const maybeLogProjectWorkspaceReferenceGridCapNormalization = ({
  userId,
  projectId,
  incomingSnapshot,
  sanitizedSnapshot,
}: {
  userId: string;
  projectId: string;
  incomingSnapshot: Record<string, unknown>;
  sanitizedSnapshot: Record<string, unknown>;
}) => {
  const incomingVisibleCount = countProjectWorkspaceVisibleActiveOutputs(incomingSnapshot);
  if (incomingVisibleCount <= REFERENCE_GRID_MAX_VISIBLE_ITEMS) return;

  const sanitizedVisibleCount = countProjectWorkspaceVisibleActiveOutputs(sanitizedSnapshot);
  const incomingVisibleRows = collectProjectWorkspaceVisibleActiveOutputRows(incomingSnapshot);
  const overflowRows = incomingVisibleRows.slice(REFERENCE_GRID_MAX_VISIBLE_ITEMS);
  void writeAppErrorLog({
    source: "telemetry.ai_studio.project_workspace.reference_grid_cap_normalized",
    message: "Project workspace save normalized an over-cap Reference Grid before persistence.",
    userId,
    statusCode: 200,
    metadata: {
      project_id: projectId,
      incoming_visible_active_outputs: incomingVisibleCount,
      persisted_visible_active_outputs: sanitizedVisibleCount,
      reference_grid_visible_limit: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      trimmed_visible_active_outputs: Math.max(0, incomingVisibleCount - sanitizedVisibleCount),
      ...summarizeProjectWorkspaceOverflowRows(overflowRows),
    },
  }).catch(() => undefined);
};

const sanitizeProjectWorkspaceSnapshot = (
  snapshot: Record<string, unknown>,
  options: {
    trimGeneratedOutputDeliveryUrls?: boolean;
    trimGeneratedOutputMetadata?: boolean;
    trimGeneratedOutputText?: boolean;
    trimOutputTextSummaries?: boolean;
  } = {}
): Record<string, unknown> =>
  createAiStudioProjectWorkspaceSnapshot(
    snapshot as Record<string, unknown> & {
      schemaVersion: number;
      updatedAt: string;
    },
    options
  ) as unknown as Record<string, unknown>;

const preserveProjectOutputDisplayChecksum = ({
  snapshot,
  outputDisplayChecksum,
}: {
  snapshot: Record<string, unknown>;
  outputDisplayChecksum: string | null;
}): Record<string, unknown> => {
  if (!outputDisplayChecksum) return snapshot;
  return {
    ...snapshot,
    meta: {
      ...asRecord(snapshot.meta),
      outputDisplayChecksum,
    },
  };
};

const normalizeOwnedCanvasStoragePath = ({
  value,
  fallbackUrl,
  userId,
}: {
  value: unknown;
  fallbackUrl: unknown;
  userId: string;
}): string | null => {
  const explicitPath = normalizeOptionalString(value);
  if (explicitPath && isUserScopedMediaStoragePath(explicitPath, userId)) {
    return explicitPath;
  }
  return extractTrustedSupabaseSignedMediaStoragePath(
    typeof fallbackUrl === "string" ? fallbackUrl : null,
    { userId }
  );
};

const isUnsafeProjectWorkspaceMediaUrl = ({
  value,
  userId,
}: {
  value: unknown;
  userId: string;
}): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return true;
  if (isSupabaseRenderImageUrl(normalized)) return true;
  return (
    isSupabaseObjectSignedStorageUrl(normalized) &&
    !isTrustedMediaDirectPreviewUrl(normalized, {
      userId,
      requireUserScope: true,
    })
  );
};

const preserveProjectWorkspaceCanvasStorageAuthority = ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Record<string, unknown> => {
  const canvas = asRecord(snapshot.canvas);
  const scene = asRecord(canvas.scene);
  const items = Array.isArray(scene.items) ? scene.items : null;
  if (!items) return snapshot;

  let changed = false;
  const nextItems = items
    .map((item) => {
      const record = asRecord(item);
      if (record.kind === "image") {
        if (isUnsafeProjectWorkspaceMediaUrl({ value: record.src, userId })) {
          changed = true;
          return null;
        }
        const srcStoragePath = normalizeOwnedCanvasStoragePath({
          value: record.srcStoragePath,
          fallbackUrl: record.src,
          userId,
        });
        if (!srcStoragePath || record.srcStoragePath === srcStoragePath) return item;
        changed = true;
        return {
          ...record,
          srcStoragePath,
        };
      }

      if (record.kind === "video") {
        if (isUnsafeProjectWorkspaceMediaUrl({ value: record.videoUrl, userId })) {
          changed = true;
          return null;
        }
        const videoStoragePath = normalizeOwnedCanvasStoragePath({
          value: record.videoStoragePath,
          fallbackUrl: record.videoUrl,
          userId,
        });
        const posterStoragePath = normalizeOwnedCanvasStoragePath({
          value: record.posterStoragePath,
          fallbackUrl: record.posterUrl,
          userId,
        });
        const nextRecord = {
          ...record,
        };
        if (videoStoragePath && record.videoStoragePath !== videoStoragePath) {
          nextRecord.videoStoragePath = videoStoragePath;
          changed = true;
        }
        if (posterStoragePath && record.posterStoragePath !== posterStoragePath) {
          nextRecord.posterStoragePath = posterStoragePath;
          changed = true;
        }
        if (isUnsafeProjectWorkspaceMediaUrl({ value: record.posterUrl, userId })) {
          delete nextRecord.posterUrl;
          delete nextRecord.posterStoragePath;
          changed = true;
        }
        return nextRecord;
      }

      if (record.kind === "audio") {
        if (isUnsafeProjectWorkspaceMediaUrl({ value: record.audioUrl, userId })) {
          changed = true;
          return null;
        }
        const audioStoragePath = normalizeOwnedCanvasStoragePath({
          value: record.audioStoragePath,
          fallbackUrl: record.audioUrl,
          userId,
        });
        const companionArtStoragePath = normalizeOwnedCanvasStoragePath({
          value: record.companionArtStoragePath,
          fallbackUrl: record.companionArtUrl,
          userId,
        });
        const nextRecord = {
          ...record,
        };
        if (audioStoragePath && record.audioStoragePath !== audioStoragePath) {
          nextRecord.audioStoragePath = audioStoragePath;
          changed = true;
        }
        if (companionArtStoragePath && record.companionArtStoragePath !== companionArtStoragePath) {
          nextRecord.companionArtStoragePath = companionArtStoragePath;
          changed = true;
        }
        if (isUnsafeProjectWorkspaceMediaUrl({ value: record.companionArtUrl, userId })) {
          delete nextRecord.companionArtUrl;
          delete nextRecord.companionArtStoragePath;
          changed = true;
        }
        return nextRecord;
      }

      return item;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!changed) return snapshot;
  return {
    ...snapshot,
    canvas: {
      ...canvas,
      scene: {
        ...scene,
        items: nextItems,
      },
    },
  };
};

const sanitizeProjectWorkspaceOutputsByShape = ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Record<string, unknown> => {
  const outputsRecord = asRecord(snapshot.outputs);
  const sanitizeScopedStoragePathFields = (row: Record<string, unknown>) => {
    for (const field of [
      "previewStoragePath",
      "fullStoragePath",
      "previewPosterStoragePath",
      "companionArtStoragePath",
    ] as const) {
      const value = row[field];
      if (value == null) continue;
      if (typeof value !== "string") {
        delete row[field];
        continue;
      }
      const normalized = value.trim();
      if (!normalized || !isUserScopedMediaStoragePath(normalized, userId)) {
        delete row[field];
        continue;
      }
      row[field] = normalized;
    }
  };
  const sanitizePreviewUrlFields = (row: Record<string, unknown>) => {
    for (const field of ["previewUrl", "fullUrl", "previewPosterUrl", "companionArtUrl"] as const) {
      const value = row[field];
      if (isUnsafeProjectWorkspaceMediaUrl({ value, userId })) {
        delete row[field];
        continue;
      }
    }
    if (!("resultUrls" in row)) return;
    const resultUrls = normalizeStringList(row.resultUrls).filter(
      (url) => !isUnsafeProjectWorkspaceMediaUrl({ value: url, userId })
    );
    if (resultUrls.length === 0) {
      delete row.resultUrls;
      return;
    }
    row.resultUrls = resultUrls;
  };
  const keepTrustedMediaPreviewUrlForUser = (url: string): boolean => {
    const trustedIgnoringScope = filterTrustedMediaDirectPreviewUrls([url], {
      userId,
      requireUserScope: false,
    });
    if (trustedIgnoringScope.length === 0) {
      return true;
    }
    return (
      filterTrustedMediaDirectPreviewUrls([url], {
        userId,
        requireUserScope: true,
      }).length > 0
    );
  };
  const sanitizeGeneratedDirectPreviewFields = (row: Record<string, unknown>) => {
    for (const field of ["previewUrl", "fullUrl", "previewPosterUrl", "companionArtUrl"] as const) {
      const value = normalizeOptionalString(row[field]);
      if (!value) {
        if (field in row) delete row[field];
        continue;
      }
      if (!keepTrustedMediaPreviewUrlForUser(value)) {
        delete row[field];
        continue;
      }
      row[field] = value;
    }

    if (!("resultUrls" in row)) return;
    const resultUrls = normalizeStringList(row.resultUrls).filter((url) =>
      keepTrustedMediaPreviewUrlForUser(url)
    );
    if (resultUrls.length === 0) {
      delete row.resultUrls;
      return;
    }
    row.resultUrls = resultUrls;
  };
  const isFailedWorkspaceOutputRow = (row: Record<string, unknown>): boolean =>
    typeof row.taskState === "string" && row.taskState.trim() === "fail";

  const sanitizeRowsByShape = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        if (isFailedWorkspaceOutputRow(normalizedRow)) {
          return null;
        }

        const generationId = normalizeUuid(normalizedRow.generationId);
        const hadGenerationId = normalizeOptionalString(normalizedRow.generationId);
        if (hadGenerationId && !generationId) {
          return null;
        }

        const promptId = normalizeUuid(normalizedRow.promptId);
        const savedMediaIds = normalizeUuidList(normalizedRow.savedMediaIds);
        const nextRow: Record<string, unknown> = {
          ...normalizedRow,
          ...(generationId ? { generationId } : {}),
          ...(promptId ? { promptId } : {}),
          ...(savedMediaIds.length > 0 ? { savedMediaIds } : {}),
        };

        if (!generationId && "generationId" in nextRow) {
          delete nextRow.generationId;
        }
        if (!promptId && "promptId" in nextRow) {
          delete nextRow.promptId;
        }
        if (savedMediaIds.length === 0 && "savedMediaIds" in nextRow) {
          delete nextRow.savedMediaIds;
        }
        sanitizeScopedStoragePathFields(nextRow);
        sanitizePreviewUrlFields(nextRow);
        if (isProjectGeneratedWorkspaceOutput(nextRow)) {
          sanitizeGeneratedDirectPreviewFields(nextRow);
        }

        return nextRow;
      })
      .filter((row): row is Record<string, unknown> => Boolean(row));
  };

  const sanitizeOutputIdCollections = ({
    active,
    archived,
    outputs,
  }: {
    active: Record<string, unknown>[];
    archived: Record<string, unknown>[];
    outputs: Record<string, unknown>;
  }) => {
    const outputIds = new Set<string>(
      [...active, ...archived]
        .map((row) => normalizeOptionalString(row.id) ?? "")
        .filter((value) => value.length > 0)
    );
    const activeOutputId =
      typeof outputs.activeOutputId === "string" && outputIds.has(outputs.activeOutputId.trim())
        ? outputs.activeOutputId.trim()
        : null;
    const filterOutputIds = (value: unknown) =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry) => entry.length > 0 && outputIds.has(entry))
        : [];

    return {
      activeOutputId,
      curatedReferenceIds: filterOutputIds(outputs.curatedReferenceIds),
      removedFromAllRefsIds: filterOutputIds(outputs.removedFromAllRefsIds),
    };
  };

  const shapeSanitizedActive = sanitizeRowsByShape(outputsRecord.active);
  const shapeSanitizedArchived = sanitizeRowsByShape(outputsRecord.archived);
  const shapeSanitizedCollections = sanitizeOutputIdCollections({
    active: shapeSanitizedActive,
    archived: shapeSanitizedArchived,
    outputs: outputsRecord,
  });
  return {
    ...snapshot,
    outputs: {
      ...outputsRecord,
      active: shapeSanitizedActive,
      archived: shapeSanitizedArchived,
      ...shapeSanitizedCollections,
    },
  };
};

const sanitizeProjectWorkspaceOutputs = ({
  userId,
  snapshot,
  ownedMediaFileIds,
  ownedPromptIds,
  ownedGenerationIds,
  generationAuthorityResolved = true,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
  ownedMediaFileIds: readonly string[];
  ownedPromptIds: readonly string[];
  ownedGenerationIds: readonly string[];
  generationAuthorityResolved?: boolean;
}): Record<string, unknown> => {
  const shapeSanitizedSnapshot = sanitizeProjectWorkspaceOutputsByShape({ userId, snapshot });
  const shapeSanitizedOutputsRecord = asRecord(shapeSanitizedSnapshot.outputs);
  const allowedMediaFileIds = new Set(ownedMediaFileIds);
  const allowedPromptIds = new Set(ownedPromptIds);
  const allowedGenerationIds = new Set(ownedGenerationIds);
  const sanitizeScopedStoragePathFields = (row: Record<string, unknown>) => {
    for (const field of [
      "previewStoragePath",
      "fullStoragePath",
      "previewPosterStoragePath",
    ] as const) {
      const value = row[field];
      if (value == null) continue;
      if (typeof value !== "string") {
        delete row[field];
        continue;
      }
      const normalized = value.trim();
      if (!normalized || !isUserScopedMediaStoragePath(normalized, userId)) {
        delete row[field];
        continue;
      }
      row[field] = normalized;
    }
  };
  const hasProjectRestorableOutputPayload = (row: Record<string, unknown>): boolean =>
    Boolean(
      normalizeOptionalString(row.previewText) ??
      normalizeOptionalString(row.previewUrl) ??
      normalizeOptionalString(row.previewPosterUrl) ??
      normalizeOptionalString(row.fullUrl) ??
      (normalizeStringList(row.resultUrls).length > 0 ? "resultUrls" : null)
    );
  const shouldPreserveNonGeneratedWorkspaceOutput = (row: Record<string, unknown>): boolean =>
    hasProjectDurableOutputAuthority(row) || hasProjectRestorableOutputPayload(row);
  const sanitizeOutputIdCollections = ({
    active,
    archived,
    outputs,
  }: {
    active: Record<string, unknown>[];
    archived: Record<string, unknown>[];
    outputs: Record<string, unknown>;
  }) => {
    const outputIds = new Set<string>(
      [...active, ...archived]
        .map((row) => normalizeOptionalString(row.id) ?? "")
        .filter((value) => value.length > 0)
    );
    const activeOutputId =
      typeof outputs.activeOutputId === "string" && outputIds.has(outputs.activeOutputId.trim())
        ? outputs.activeOutputId.trim()
        : null;
    const filterOutputIds = (value: unknown) =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry) => entry.length > 0 && outputIds.has(entry))
        : [];

    return {
      activeOutputId,
      curatedReferenceIds: filterOutputIds(outputs.curatedReferenceIds),
      removedFromAllRefsIds: filterOutputIds(outputs.removedFromAllRefsIds),
    };
  };

  const sanitizeRows = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        const generatedWorkspaceOutput = isProjectGeneratedWorkspaceOutput(normalizedRow);
        const generationId = normalizeUuid(normalizedRow.generationId) ?? "";
        const promptId = normalizeUuid(normalizedRow.promptId) ?? "";
        const savedMediaIds = normalizeUuidList(normalizedRow.savedMediaIds).filter((entry) =>
          allowedMediaFileIds.has(entry)
        );
        const generationOwned = generationId ? allowedGenerationIds.has(generationId) : false;
        const preserveGenerationId = Boolean(
          generationId && (generationOwned || !generationAuthorityResolved)
        );
        const nextRow: Record<string, unknown> = {
          ...normalizedRow,
          ...(preserveGenerationId ? { generationId } : {}),
          ...(promptId && allowedPromptIds.has(promptId) ? { promptId } : {}),
          ...(savedMediaIds.length > 0 ? { savedMediaIds } : {}),
        };

        if (!preserveGenerationId && "generationId" in nextRow) {
          delete nextRow.generationId;
        }
        if ((!promptId || !allowedPromptIds.has(promptId)) && "promptId" in nextRow) {
          delete nextRow.promptId;
        }
        if (savedMediaIds.length === 0 && "savedMediaIds" in nextRow) {
          delete nextRow.savedMediaIds;
        }
        sanitizeScopedStoragePathFields(nextRow);

        if (generatedWorkspaceOutput) {
          if (hasProjectDurableOutputAuthority(nextRow)) {
            return nextRow;
          }
          if (!generationAuthorityResolved) {
            return null;
          }
          const hasRecoverableRuntimeIdentity =
            hasProjectRecoverableRuntimeIdentity(nextRow) &&
            (preserveGenerationId ||
              Boolean(
                normalizeOptionalString(nextRow.taskId) ??
                normalizeOptionalString(nextRow.sourceRef)
              ));
          if (!hasRecoverableRuntimeIdentity) {
            return null;
          }
          return nextRow;
        }

        return shouldPreserveNonGeneratedWorkspaceOutput(nextRow) ? nextRow : null;
      })
      .filter((row): row is Record<string, unknown> => Boolean(row));
  };

  const active = sanitizeRows(shapeSanitizedOutputsRecord.active);
  const archived = sanitizeRows(shapeSanitizedOutputsRecord.archived);
  const { activeOutputId, curatedReferenceIds, removedFromAllRefsIds } =
    sanitizeOutputIdCollections({
      active,
      archived,
      outputs: shapeSanitizedOutputsRecord,
    });

  return {
    ...shapeSanitizedSnapshot,
    outputs: {
      ...shapeSanitizedOutputsRecord,
      active,
      archived,
      activeOutputId,
      curatedReferenceIds,
      removedFromAllRefsIds,
    },
  };
};

const prepareProjectWorkspaceSnapshotForWrite = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Promise<{
  snapshot: Record<string, unknown>;
  ownedMediaFileIds: string[];
  ownedPromptIds: string[];
  ownedGenerationIds: string[];
  repairPending: ProjectWorkspaceRepairPending | null;
}> => {
  const canvasStorageAuthoritySnapshot = preserveProjectWorkspaceCanvasStorageAuthority({
    userId,
    snapshot,
  });
  const baseSanitizedSnapshot = sanitizeProjectWorkspaceOutputsByShape({
    userId,
    snapshot: canvasStorageAuthoritySnapshot,
  });
  const {
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
    failedAuthorities,
    failureMessages,
  } = await resolveOwnedSnapshotAssociationIdsForWrite({
    userId,
    snapshot: baseSanitizedSnapshot,
  });
  const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
    userId,
    snapshot: baseSanitizedSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
    generationAuthorityResolved: !failedAuthorities.includes("generation"),
  });

  return {
    snapshot: sanitizedOutputsSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
    repairPending:
      failedAuthorities.length > 0
        ? {
            stage: "owned_id_resolution",
            message: `Project workspace save failed during owned id resolution: ${failureMessages.join("; ")}`,
          }
        : null,
  };
};

const canonicalizeProjectWorkspaceSnapshotForRead = async ({
  userId,
  projectId,
  snapshot,
  trimGeneratedOutputMetadata = true,
  trimOutputTextSummaries = true,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  trimGeneratedOutputMetadata?: boolean;
  trimOutputTextSummaries?: boolean;
}): Promise<Record<string, unknown>> => {
  const baseSanitizedSnapshot = sanitizeProjectWorkspaceOutputsByShape({
    userId,
    snapshot,
  });
  try {
    const {
      ownedMediaFileIds,
      ownedPromptIds,
      ownedGenerationIds,
      failedAuthorities,
      failureMessages,
    } = await resolveOwnedSnapshotAssociationIdsForRead({
      userId,
      snapshot: baseSanitizedSnapshot,
    });
    const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
      userId,
      snapshot: baseSanitizedSnapshot,
      ownedMediaFileIds,
      ownedPromptIds,
      ownedGenerationIds,
      generationAuthorityResolved: !failedAuthorities.includes("generation"),
    });
    const reSanitizedSnapshot = sanitizeProjectWorkspaceSnapshot(sanitizedOutputsSnapshot, {
      trimGeneratedOutputMetadata,
      trimOutputTextSummaries,
    });

    if (failedAuthorities.length === 0) {
      return reSanitizedSnapshot;
    }

    console.warn(
      "[project-workspace] read sanitization degraded unresolved ownership associations",
      {
        projectId,
        failedAuthorities,
        errors: failureMessages,
      }
    );
    void writeAppErrorLog({
      source: "telemetry.ai_studio.project_workspace.read_sanitization_fallback",
      message:
        "Project workspace read degraded unresolved ownership associations after read-time ownership resolution failed.",
      userId,
      statusCode: 200,
      metadata: {
        project_id: projectId,
        fallback_stage: "read_sanitization",
        failed_authorities: failedAuthorities,
        errors: failureMessages,
      },
    }).catch(() => undefined);
    return reSanitizedSnapshot;
  } catch (error) {
    console.warn(
      "[project-workspace] read sanitization failed closed to an ownership-safe snapshot",
      {
        projectId,
        error: toErrorMessage(error, "Unknown error"),
      }
    );
    void writeAppErrorLog({
      source: "telemetry.ai_studio.project_workspace.read_sanitization_fallback",
      message:
        "Project workspace read failed closed to an ownership-safe snapshot after read-time sanitization crashed.",
      userId,
      statusCode: 200,
      metadata: {
        project_id: projectId,
        fallback_stage: "read_sanitization",
        failed_authorities: ["media", "prompt", "generation"],
        errors: [toErrorMessage(error, "Unknown error")],
      },
    }).catch(() => undefined);
    return sanitizeProjectWorkspaceSnapshot(
      sanitizeProjectWorkspaceOutputs({
        userId,
        snapshot: baseSanitizedSnapshot,
        ownedMediaFileIds: [],
        ownedPromptIds: [],
        ownedGenerationIds: [],
        generationAuthorityResolved: false,
      })
    );
  }
};

const convergeProjectWorkspaceGeneratedOutputsForRead = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  try {
    return await hydrateProjectSnapshotGeneratedOutputs({
      userId,
      projectId,
      snapshot,
      options: {
        appendMissingProjectOutputs: false,
        patchDurableSnapshotRows: false,
        reorderActiveOutputs: false,
      },
    });
  } catch (error) {
    const message = toErrorMessage(error, "Unknown error");
    console.warn("[project-workspace] generated output read convergence skipped", {
      projectId,
      error: message,
    });
    void writeAppErrorLog({
      source: "telemetry.ai_studio.project_workspace.generated_output_read_convergence_skipped",
      message:
        "Project workspace read skipped generated output convergence after projection refresh failed.",
      userId,
      statusCode: 200,
      metadata: {
        project_id: projectId,
        fallback_stage: "generated_output_read_convergence",
        error: message,
      },
    }).catch(() => undefined);
    return snapshot;
  }
};

const materializeProjectWorkspaceSnapshotForUserSafely = async ({
  userId,
  projectId,
  snapshot,
  stage,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  stage: ProjectWorkspaceMaterializationStage;
}): Promise<{
  snapshot: Record<string, unknown>;
  repairPending: ProjectWorkspaceRepairPending | null;
}> => {
  try {
    return {
      snapshot: await materializeProjectWorkspaceSnapshotForUser({
        userId,
        projectId,
        snapshot,
      }),
      repairPending: null,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error, "Unknown error");
    const repairMessage = `Project workspace ${stage} failed during project output display materialization: ${errorMessage}`;
    console.warn("[project-workspace] output display materialization skipped", {
      projectId,
      stage,
      error: errorMessage,
    });
    void writeAppErrorLog({
      source: "telemetry.ai_studio.project_workspace.output_display_materialization_fallback",
      message:
        "Project workspace continued from the durable checkpoint after output display materialization failed.",
      userId,
      statusCode: 200,
      metadata: {
        project_id: projectId,
        fallback_stage: "project_output_display_materialization",
        workspace_stage: stage,
        repair_stage: "project_output_display_sync",
        error: errorMessage,
      },
    }).catch(() => undefined);
    return {
      snapshot,
      repairPending: {
        stage: "project_output_display_sync",
        message: repairMessage,
      },
    };
  }
};

const prepareProjectWorkspaceSnapshotForReadResponse = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const canvasStorageAuthoritySnapshot = preserveProjectWorkspaceCanvasStorageAuthority({
    userId,
    snapshot,
  });
  const materialized = await materializeProjectWorkspaceSnapshotForUserSafely({
    userId,
    projectId,
    snapshot: canvasStorageAuthoritySnapshot,
    stage: "workspace read",
  });
  const sanitizedSnapshot = await canonicalizeProjectWorkspaceSnapshotForRead({
    userId,
    projectId,
    snapshot: materialized.snapshot,
    trimOutputTextSummaries: false,
  });
  const convergedSnapshot = await convergeProjectWorkspaceGeneratedOutputsForRead({
    userId,
    projectId,
    snapshot: sanitizedSnapshot,
  });

  // Generated-output convergence patches read-only metadata plus safe user-scoped delivery fields.
  // Keep restored detail metadata in the response while preserving lean checkpoint trimming on save.
  return sanitizeProjectWorkspaceSnapshot(convergedSnapshot, {
    trimGeneratedOutputMetadata: false,
    trimOutputTextSummaries: false,
  });
};

const prepareProjectWorkspaceSnapshotForSaveResponse = async ({
  userId,
  projectId,
  snapshot,
  canonicalizeMaterializedResponse = false,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  canonicalizeMaterializedResponse?: boolean;
}): Promise<{
  snapshot: Record<string, unknown>;
  repairPending: ProjectWorkspaceRepairPending | null;
}> => {
  const canvasStorageAuthoritySnapshot = preserveProjectWorkspaceCanvasStorageAuthority({
    userId,
    snapshot,
  });
  const materialized = await materializeProjectWorkspaceSnapshotForUserSafely({
    userId,
    projectId,
    snapshot: canvasStorageAuthoritySnapshot,
    stage: "workspace save",
  });
  return {
    ...materialized,
    snapshot:
      canonicalizeMaterializedResponse && !materialized.repairPending
        ? await canonicalizeProjectWorkspaceSnapshotForRead({
            userId,
            projectId,
            snapshot: materialized.snapshot,
            trimGeneratedOutputMetadata: false,
          })
        : sanitizeProjectWorkspaceOutputsByShape({
            userId,
            snapshot: materialized.snapshot,
          }),
  };
};

const toProjectWorkspaceStateRecord = ({
  row,
  snapshot,
  saveOutcome,
}: {
  row: ProjectWorkspaceStateRow;
  snapshot?: Record<string, unknown>;
  saveOutcome?: ProjectWorkspaceSaveOutcome;
}): ProjectWorkspaceStateRecord => ({
  projectId: row.project_id,
  userId: row.user_id,
  schemaVersion: row.schema_version,
  snapshot: snapshot ?? row.snapshot,
  checkpointRevision: row.checkpoint_revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(saveOutcome ? { saveOutcome } : {}),
});

const toProjectWorkspaceStateRowFromWriteReturn = ({
  row,
  snapshot,
}: {
  row: ProjectWorkspaceStateWriteReturnRow;
  snapshot: Record<string, unknown>;
}): ProjectWorkspaceStateRow => ({
  ...row,
  snapshot,
});

export const getProjectWorkspaceStateForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<ProjectWorkspaceStateRecord | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_workspace_states")
    .select(PROJECT_WORKSPACE_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load project workspace state");
  }
  if (!data) return null;
  const record = toProjectWorkspaceStateRecord({
    row: data as ProjectWorkspaceStateRow,
  });
  return {
    ...record,
    snapshot: await prepareProjectWorkspaceSnapshotForReadResponse({
      userId,
      projectId,
      snapshot: record.snapshot,
    }),
  };
};

export const deleteProjectWorkspaceStateForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<void> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("project_workspace_states")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to delete project workspace state");
  }
};

export const upsertProjectWorkspaceStateForUser = async ({
  userId,
  projectId,
  schemaVersion,
  snapshot,
  includeSnapshotInResponse = true,
}: {
  userId: string;
  projectId: string;
  schemaVersion?: number;
  snapshot: unknown;
  includeSnapshotInResponse?: boolean;
}): Promise<ProjectWorkspaceStateRecord> => {
  const parsedSnapshot = parseProjectWorkspaceSnapshotPayload(snapshot);
  if (!parsedSnapshot || !parseAiStudioSessionSnapshotShape(parsedSnapshot)) {
    throw new InvalidProjectWorkspaceSnapshotError();
  }
  const canvasStorageAuthoritySnapshot = preserveProjectWorkspaceCanvasStorageAuthority({
    userId,
    snapshot: parsedSnapshot,
  });
  const incomingLightweightDisplayChecksum = isLightweightProjectWorkspaceCheckpointSnapshot(
    canvasStorageAuthoritySnapshot
  )
    ? readProjectOutputDisplayChecksum(canvasStorageAuthoritySnapshot)
    : null;
  const displayAuthoritySnapshot = preserveProjectOutputDisplayChecksum({
    snapshot: sanitizeProjectWorkspaceSnapshot(canvasStorageAuthoritySnapshot, {
      trimGeneratedOutputText: false,
      trimOutputTextSummaries: false,
    }),
    outputDisplayChecksum: incomingLightweightDisplayChecksum,
  });
  const sanitizedSnapshot = sanitizeProjectWorkspaceSnapshot(canvasStorageAuthoritySnapshot);
  maybeLogProjectWorkspaceReferenceGridCapNormalization({
    userId,
    projectId,
    incomingSnapshot: canvasStorageAuthoritySnapshot,
    sanitizedSnapshot,
  });
  const normalizedSchemaVersion =
    typeof schemaVersion === "number" && Number.isFinite(schemaVersion)
      ? Math.max(1, Math.min(100, Math.trunc(schemaVersion)))
      : 2;
  const snapshotUpdatedAt =
    normalizeIsoTimestamp(sanitizedSnapshot.updatedAt) ?? new Date().toISOString();

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from("project_workspace_states")
    .select(PROJECT_WORKSPACE_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw wrapProjectWorkspaceSaveStageError({
      stage: "workspace lookup",
      error: existingError,
    });
  }

  const existingRow = (existingData as ProjectWorkspaceStateRow | null) ?? null;
  if (existingRow && compareIsoTimestamps(existingRow.snapshot_updated_at, snapshotUpdatedAt) > 0) {
    return toProjectWorkspaceStateRecord({
      row: existingRow,
      snapshot: includeSnapshotInResponse
        ? await prepareProjectWorkspaceSnapshotForReadResponse({
            userId,
            projectId,
            snapshot: existingRow.snapshot,
          })
        : existingRow.snapshot,
      saveOutcome: {
        status: "saved",
      },
    });
  }
  if (
    existingRow &&
    !includeSnapshotInResponse &&
    compareIsoTimestamps(existingRow.snapshot_updated_at, snapshotUpdatedAt) === 0 &&
    !projectWorkspaceCheckpointNeedsCompaction(existingRow.snapshot)
  ) {
    const comparableProjectAssetAssociationChecksum =
      computeComparableProjectAssetAssociationChecksum(sanitizedSnapshot);
    const existingProjectAssetAssociationChecksum = readProjectAssetAssociationChecksum(
      existingRow.snapshot
    );
    const sameProjectAssetAssociations =
      comparableProjectAssetAssociationChecksum !== null &&
      existingProjectAssetAssociationChecksum === comparableProjectAssetAssociationChecksum;

    if (sameProjectAssetAssociations) {
      const lightweightRetrySnapshot = createLightweightProjectWorkspaceCheckpointSnapshot({
        snapshot: displayAuthoritySnapshot,
        checkpointRevision: existingRow.checkpoint_revision,
      });
      const retryOutputDisplayChecksum =
        readProjectOutputDisplayChecksum(lightweightRetrySnapshot) ??
        computeProjectOutputDisplayChecksumForSnapshot(displayAuthoritySnapshot);
      const existingOutputDisplayChecksum = readProjectOutputDisplayChecksum(existingRow.snapshot);
      const sameDisplay =
        existingOutputDisplayChecksum !== null &&
        existingOutputDisplayChecksum === retryOutputDisplayChecksum;
      const sameCheckpointStructure = areProjectWorkspaceCheckpointsStructurallyEqual(
        existingRow.snapshot,
        lightweightRetrySnapshot
      );

      if (sameDisplay && sameCheckpointStructure) {
        return toProjectWorkspaceStateRecord({
          row: existingRow,
          snapshot: existingRow.snapshot,
          saveOutcome: {
            status: "saved",
          },
        });
      }
    }
  }
  const preparedSnapshot = await prepareProjectWorkspaceSnapshotForWrite({
    userId,
    snapshot: displayAuthoritySnapshot,
  });
  const preparedDisplayAuthoritySnapshot = preserveProjectOutputDisplayChecksum({
    snapshot: sanitizeProjectWorkspaceSnapshot(preparedSnapshot.snapshot, {
      trimGeneratedOutputText: false,
      trimOutputTextSummaries: false,
    }),
    outputDisplayChecksum: incomingLightweightDisplayChecksum,
  });

  const existingCheckpointRevision = existingRow?.checkpoint_revision ?? 0;
  const nextCheckpointRevision = existingCheckpointRevision + 1;
  const lightweightCheckpointSnapshot = createLightweightProjectWorkspaceCheckpointSnapshot({
    snapshot: preparedDisplayAuthoritySnapshot,
    checkpointRevision: nextCheckpointRevision,
  });
  const incomingOutputDisplayChecksum =
    readProjectOutputDisplayChecksum(lightweightCheckpointSnapshot) ??
    computeProjectOutputDisplayChecksumForSnapshot(preparedSnapshot.snapshot);
  const existingOutputDisplayChecksum = existingRow
    ? readProjectOutputDisplayChecksum(existingRow.snapshot)
    : null;
  const incomingProjectAssetAssociationChecksum = computeProjectAssetAssociationChecksum({
    mediaFileIds: preparedSnapshot.ownedMediaFileIds,
    promptIds: preparedSnapshot.ownedPromptIds,
    generationIds: preparedSnapshot.ownedGenerationIds,
  });
  const existingProjectAssetAssociationChecksum = existingRow
    ? readProjectAssetAssociationChecksum(existingRow.snapshot)
    : null;
  const checkpointStructureChanged =
    !existingRow ||
    projectWorkspaceCheckpointNeedsCompaction(existingRow.snapshot) ||
    !areProjectWorkspaceCheckpointsStructurallyEqual(
      existingRow.snapshot,
      lightweightCheckpointSnapshot
    );
  const outputDisplayChanged =
    !existingRow || existingOutputDisplayChecksum !== incomingOutputDisplayChecksum;
  const receivedLightweightDisplayCheckpoint =
    isLightweightProjectWorkspaceCheckpointSnapshot(preparedDisplayAuthoritySnapshot) &&
    readProjectOutputDisplayChecksum(preparedDisplayAuthoritySnapshot) !== null;
  const shouldPreserveExistingOutputDisplayRows = receivedLightweightDisplayCheckpoint;
  const hasOwnedProjectAssetAssociationAuthority =
    preparedSnapshot.ownedMediaFileIds.length > 0 ||
    preparedSnapshot.ownedPromptIds.length > 0 ||
    preparedSnapshot.ownedGenerationIds.length > 0;
  const projectAssetAssociationChanged =
    !existingRow ||
    existingProjectAssetAssociationChecksum !== incomingProjectAssetAssociationChecksum;
  const shouldBackfillProjectAssetAssociations =
    hasOwnedProjectAssetAssociationAuthority && projectAssetAssociationChanged;
  // Advance workspace freshness on newer display-only saves without bumping structural revision.
  const shouldPersistWorkspaceRow =
    !existingRow ||
    checkpointStructureChanged ||
    outputDisplayChanged ||
    projectAssetAssociationChanged ||
    compareIsoTimestamps(existingRow.snapshot_updated_at, snapshotUpdatedAt) < 0;
  const workspaceCheckpointRevisionForWrite =
    checkpointStructureChanged || !existingRow
      ? nextCheckpointRevision
      : existingCheckpointRevision;

  const repairPending: ProjectWorkspaceRepairPending[] = [];
  const addRepairPending = (repair: ProjectWorkspaceRepairPending) => {
    repairPending.push(repair);
  };
  if (preparedSnapshot.repairPending) {
    addRepairPending(preparedSnapshot.repairPending);
    logProjectWorkspaceBestEffortFailure({
      stage: "owned id resolution",
      projectId,
      error: new Error(preparedSnapshot.repairPending.message),
    });
  }

  let projectAssetAssociationChecksumForWrite: string | null =
    preparedSnapshot.repairPending || shouldBackfillProjectAssetAssociations
      ? null
      : incomingProjectAssetAssociationChecksum;

  if (shouldBackfillProjectAssetAssociations) {
    try {
      await withProjectWorkspaceBestEffortTimeout(
        backfillProjectAssetAssociationsForSnapshot({
          userId,
          projectId,
          snapshot: preparedDisplayAuthoritySnapshot,
          ownedMediaFileIds: preparedSnapshot.ownedMediaFileIds,
          ownedPromptIds: preparedSnapshot.ownedPromptIds,
          ownedGenerationIds: preparedSnapshot.ownedGenerationIds,
        }),
        "project association backfill",
        PROJECT_WORKSPACE_POST_WRITE_REPAIR_TIMEOUT_MS
      );
      if (!preparedSnapshot.repairPending) {
        projectAssetAssociationChecksumForWrite = incomingProjectAssetAssociationChecksum;
      }
    } catch (error) {
      const repairMessage = toErrorMessage(
        wrapProjectWorkspaceSaveStageError({
          stage: "project association backfill",
          error,
        }),
        "Project workspace save needs project association repair."
      );
      logProjectWorkspaceBestEffortFailure({
        stage: "project association backfill",
        projectId,
        error,
      });
      await logProjectWorkspaceRepairPending({
        userId,
        projectId,
        repairStage: "project_association_backfill",
        repairMessage,
      });
      addRepairPending({
        stage: "project_association_backfill",
        message: repairMessage,
      });
    }
  }

  const workspaceSnapshotForWrite = patchProjectAssetAssociationChecksum(
    checkpointStructureChanged ||
      outputDisplayChanged ||
      projectAssetAssociationChanged ||
      !existingRow
      ? createLightweightProjectWorkspaceCheckpointSnapshot({
          snapshot: preparedDisplayAuthoritySnapshot,
          checkpointRevision: workspaceCheckpointRevisionForWrite,
        })
      : existingRow.snapshot,
    projectAssetAssociationChecksumForWrite
  );

  let savedRow: ProjectWorkspaceStateRow;
  if (!shouldPersistWorkspaceRow && existingRow) {
    savedRow = existingRow;
  } else {
    const { data, error } = await supabaseAdmin
      .from("project_workspace_states")
      .upsert(
        {
          project_id: projectId,
          user_id: userId,
          schema_version: normalizedSchemaVersion,
          snapshot: workspaceSnapshotForWrite,
          snapshot_updated_at: snapshotUpdatedAt,
          checkpoint_revision: workspaceCheckpointRevisionForWrite,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "project_id",
        }
      )
      .select(PROJECT_WORKSPACE_WRITE_RETURN_COLUMNS)
      .maybeSingle();

    if (error) {
      throw wrapProjectWorkspaceSaveStageError({
        stage: "workspace upsert",
        error,
      });
    }
    if (!data) {
      throw wrapProjectWorkspaceSaveStageError({
        stage: "workspace upsert",
        error: new Error("No workspace row returned"),
      });
    }
    savedRow = toProjectWorkspaceStateRowFromWriteReturn({
      row: data as ProjectWorkspaceStateWriteReturnRow,
      snapshot: workspaceSnapshotForWrite,
    });
  }
  const staleWriteIgnored =
    compareIsoTimestamps(savedRow.snapshot_updated_at, snapshotUpdatedAt) > 0;

  if (staleWriteIgnored) {
    let staleResponseRow = savedRow;
    if (includeSnapshotInResponse) {
      const { data: refreshedData, error: refreshedError } = await supabaseAdmin
        .from("project_workspace_states")
        .select(PROJECT_WORKSPACE_SELECT_COLUMNS)
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (refreshedError) {
        throw wrapProjectWorkspaceSaveStageError({
          stage: "workspace stale refresh",
          error: refreshedError,
        });
      }
      staleResponseRow = (refreshedData as ProjectWorkspaceStateRow | null) ?? savedRow;
    }
    return toProjectWorkspaceStateRecord({
      row: staleResponseRow,
      snapshot: includeSnapshotInResponse
        ? await prepareProjectWorkspaceSnapshotForReadResponse({
            userId,
            projectId,
            snapshot: staleResponseRow.snapshot,
          })
        : staleResponseRow.snapshot,
      saveOutcome: {
        status: "saved",
      },
    });
  }

  let displaySyncResult: Awaited<
    ReturnType<typeof syncProjectOutputDisplayItemsForSnapshot>
  > | null = null;
  try {
    if (
      (!checkpointStructureChanged && !outputDisplayChanged) ||
      shouldPreserveExistingOutputDisplayRows
    ) {
      if (receivedLightweightDisplayCheckpoint && outputDisplayChanged) {
        addRepairPending({
          stage: "project_output_display_sync",
          message:
            "Project workspace received a lightweight checkpoint without rich output display payload; existing display records were preserved.",
        });
      }
      displaySyncResult = {
        outputCount: 0,
        upsertedCount: 0,
        deletedCount: 0,
        deferredDeleteCount: 0,
        skippedStaleCount: 0,
      };
    } else {
      displaySyncResult = await withProjectWorkspaceBestEffortTimeout(
        syncProjectOutputDisplayItemsForSnapshot({
          userId,
          projectId,
          snapshot: preparedDisplayAuthoritySnapshot,
          snapshotUpdatedAt,
          deferDeletes: checkpointStructureChanged,
        }),
        "project output display sync",
        PROJECT_WORKSPACE_POST_WRITE_REPAIR_TIMEOUT_MS
      );
    }
  } catch (error) {
    const repairMessage = toErrorMessage(
      wrapProjectWorkspaceSaveStageError({
        stage: "project output display sync",
        error,
      }),
      "Project workspace save needs project output display repair."
    );
    addRepairPending({
      stage: "project_output_display_sync",
      message: repairMessage,
    });
    logProjectWorkspaceBestEffortFailure({
      stage: "project output display sync",
      projectId,
      error,
    });
  }

  if (checkpointStructureChanged && (displaySyncResult?.deferredDeleteCount ?? 0) > 0) {
    try {
      await withProjectWorkspaceBestEffortTimeout(
        syncProjectOutputDisplayItemsForSnapshot({
          userId,
          projectId,
          snapshot: preparedDisplayAuthoritySnapshot,
          snapshotUpdatedAt,
          deferDeletes: false,
        }),
        "project output display cleanup",
        PROJECT_WORKSPACE_POST_WRITE_REPAIR_TIMEOUT_MS
      );
    } catch (error) {
      logProjectWorkspaceBestEffortFailure({
        stage: "project output display cleanup",
        projectId,
        error,
      });
    }
  }

  let saveResponseSnapshot: {
    snapshot: Record<string, unknown>;
    repairPending: ProjectWorkspaceRepairPending | null;
  };
  try {
    saveResponseSnapshot = includeSnapshotInResponse
      ? await withProjectWorkspaceBestEffortTimeout(
          prepareProjectWorkspaceSnapshotForSaveResponse({
            userId,
            projectId,
            snapshot: savedRow.snapshot,
            canonicalizeMaterializedResponse: repairPending.some(
              (repair) => repair.stage === "project_output_display_sync"
            ),
          }),
          "project workspace save response materialization",
          PROJECT_WORKSPACE_RESPONSE_MATERIALIZATION_TIMEOUT_MS
        )
      : {
          snapshot: savedRow.snapshot,
          repairPending: null,
        };
  } catch (error) {
    const repairMessage = toErrorMessage(
      wrapProjectWorkspaceSaveStageError({
        stage: "project output display materialization",
        error,
      }),
      "Project workspace save needs output display materialization repair."
    );
    logProjectWorkspaceBestEffortFailure({
      stage: "project output display materialization",
      projectId,
      error,
    });
    saveResponseSnapshot = {
      snapshot: savedRow.snapshot,
      repairPending: {
        stage: "project_output_display_sync",
        message: repairMessage,
      },
    };
  }
  if (saveResponseSnapshot.repairPending) {
    addRepairPending(saveResponseSnapshot.repairPending);
  }

  if (repairPending.length > 0) {
    const repairStage = repairPending[0]?.stage ?? "project_association_backfill";
    const repairMessage = repairPending.map((repair) => repair.message).join(" | ");
    if (!repairPending.some((repair) => repair.stage === "project_association_backfill")) {
      await logProjectWorkspaceRepairPending({
        userId,
        projectId,
        repairStage,
        repairMessage,
      });
    }
    return toProjectWorkspaceStateRecord({
      row: savedRow,
      snapshot: saveResponseSnapshot.snapshot,
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage,
        repairMessage,
      },
    });
  }

  return toProjectWorkspaceStateRecord({
    row: savedRow,
    snapshot: saveResponseSnapshot.snapshot,
    saveOutcome: {
      status: "saved",
    },
  });
};
