/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import { parseAiStudioSessionSnapshotShape } from "../ai-studio-session/sessionSnapshotShape";
import {
  createAiStudioProjectWorkspaceSnapshot,
  hasProjectDurableOutputAuthority,
  hasProjectRecoverableRuntimeIdentity,
  isProjectGeneratedWorkspaceOutput,
} from "../ai-studio-session/projectWorkspaceSnapshot";
import {
  filterTrustedMediaDirectPreviewUrls,
  isSupabaseRenderImageUrl,
} from "../mediaPreviewTrustPolicy";
import { isUserScopedMediaStoragePath } from "../mediaStoragePath";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import {
  backfillProjectGenerationAssociationsForSnapshot,
  hydrateProjectSnapshotGeneratedOutputs,
} from "./projectGenerationAssociationsService";
import {
  areProjectWorkspaceCheckpointsStructurallyEqual,
  createLightweightProjectWorkspaceCheckpointSnapshot,
  materializeProjectWorkspaceSnapshotForUser,
  projectWorkspaceCheckpointNeedsCompaction,
  syncProjectOutputDisplayItemsForSnapshot,
} from "./projectOutputDisplayItemsService";
import { chunkValues } from "./queryBatching";

const PROJECT_WORKSPACE_SELECT_COLUMNS =
  "project_id, user_id, schema_version, snapshot, snapshot_updated_at, checkpoint_revision, created_at, updated_at" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES = 900_000;

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

export class InvalidProjectWorkspaceSnapshotError extends Error {
  constructor(message = "Invalid project workspace snapshot") {
    super(message);
    this.name = "InvalidProjectWorkspaceSnapshotError";
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseProjectWorkspaceSnapshotPayload = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const snapshotBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (snapshotBytes > PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIsoTimestamp = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const normalizeUuid = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeUuidList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => normalizeUuid(entry))
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    : [];

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => normalizeOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const safeStringifyError = (error: unknown): string | null => {
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : null;
  } catch {
    return null;
  }
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const record = asRecord(error);
  const parts = [
    normalizeOptionalString(record.message),
    normalizeOptionalString(record.details),
    normalizeOptionalString(record.hint),
    normalizeOptionalString(record.code),
  ].filter((entry): entry is string => Boolean(entry));
  if (parts.length > 0) return parts.join(" ");
  return safeStringifyError(error) ?? fallback;
};

const compareIsoTimestamps = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
  if (leftTime === rightTime) return 0;
  return leftTime > rightTime ? 1 : -1;
};

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

const sanitizeProjectWorkspaceSnapshot = (
  snapshot: Record<string, unknown>,
  options: {
    trimGeneratedOutputDeliveryUrls?: boolean;
    trimGeneratedOutputMetadata?: boolean;
  } = {}
): Record<string, unknown> =>
  createAiStudioProjectWorkspaceSnapshot(
    snapshot as Record<string, unknown> & {
      schemaVersion: number;
      updatedAt: string;
    },
    options
  ) as unknown as Record<string, unknown>;

const collectSnapshotAssociationIds = (snapshot: Record<string, unknown>) => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const mediaFileIds = new Set<string>();
  const promptIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedRow = asRecord(row);
    const promptId =
      typeof normalizedRow.promptId === "string" ? normalizedRow.promptId.trim() : "";
    if (promptId) {
      promptIds.add(promptId);
    }
    const savedMediaIds = Array.isArray(normalizedRow.savedMediaIds)
      ? normalizedRow.savedMediaIds
      : [];
    savedMediaIds.forEach((value) => {
      const mediaFileId = typeof value === "string" ? value.trim() : "";
      if (mediaFileId) {
        mediaFileIds.add(mediaFileId);
      }
    });
  });

  return {
    mediaFileIds: [...mediaFileIds],
    promptIds: [...promptIds],
  };
};

const collectSnapshotGenerationAuthorityKeys = (snapshot: Record<string, unknown>) => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const generationIds = new Set<string>();
  const runtimeRequestIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedRow = asRecord(row);
    const generationId =
      typeof normalizedRow.generationId === "string" ? normalizedRow.generationId.trim() : "";
    if (generationId) {
      generationIds.add(generationId);
    }
    const taskId = normalizeOptionalString(normalizedRow.taskId);
    if (taskId) {
      runtimeRequestIds.add(taskId);
    }
    const sourceRef = normalizeOptionalString(normalizedRow.sourceRef);
    if (sourceRef) {
      runtimeRequestIds.add(sourceRef);
    }
  });

  return {
    generationIds: [...generationIds],
    runtimeRequestIds: [...runtimeRequestIds],
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
      if (typeof value === "string" && isSupabaseRenderImageUrl(value)) {
        delete row[field];
      }
    }
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
        }

        return nextRow;
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

const resolveOwnedIds = async ({
  table,
  idColumn,
  userId,
  ids,
}: {
  table: "media_files" | "media_prompts";
  idColumn: "id";
  userId: string;
  ids: string[];
}): Promise<string[]> => {
  const canonicalIds = normalizeUuidList(ids);
  if (canonicalIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const ownedIds = new Set<string>();

  for (const idChunk of chunkValues(canonicalIds)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(idColumn)
      .eq("user_id", userId)
      .in(idColumn, idChunk);

    if (error) {
      const tableLabel = table === "media_files" ? "media ids" : "prompt ids";
      throw new Error(error.message || `Failed to resolve owned ${tableLabel}`);
    }

    (Array.isArray(data) ? data : []).forEach((row) => {
      const record = asRecord(row);
      const idValue = record[idColumn];
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedIds.add(idValue.trim());
      }
    });
  }

  return [...ownedIds];
};

const resolveOwnedGenerationIds = async ({
  userId,
  generationIds,
  runtimeRequestIds,
}: {
  userId: string;
  generationIds: string[];
  runtimeRequestIds: string[];
}): Promise<string[]> => {
  const canonicalGenerationIds = normalizeUuidList(generationIds);
  const canonicalRuntimeRequestIds = Array.from(
    new Set(
      runtimeRequestIds
        .map((value) => normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (canonicalGenerationIds.length === 0 && canonicalRuntimeRequestIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const ownedGenerationIds = new Set<string>();

  for (const generationIdChunk of chunkValues(canonicalGenerationIds)) {
    const [
      { data: generationData, error: generationError },
      { data: projectionData, error: projectionError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_generations")
        .select("id")
        .eq("user_id", userId)
        .in("id", generationIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("generation_id", generationIdChunk),
    ]);

    if (generationError) {
      throw new Error(generationError.message || "Failed to resolve owned generation ids");
    }
    if (projectionError) {
      throw new Error(
        projectionError.message || "Failed to resolve owned generation projection ids"
      );
    }

    (Array.isArray(generationData) ? generationData : []).forEach((row) => {
      const idValue = asRecord(row).id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
    (Array.isArray(projectionData) ? projectionData : []).forEach((row) => {
      const idValue = asRecord(row).generation_id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
  }

  for (const requestIdChunk of chunkValues(canonicalRuntimeRequestIds)) {
    const [
      { data: generationData, error: generationError },
      { data: projectionRequestData, error: projectionRequestError },
      { data: projectionSourceRefData, error: projectionSourceRefError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_generations")
        .select("id")
        .eq("user_id", userId)
        .in("request_id", requestIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("request_id", requestIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("source_ref", requestIdChunk),
    ]);

    if (generationError) {
      throw new Error(generationError.message || "Failed to resolve owned generation request ids");
    }
    if (projectionRequestError) {
      throw new Error(
        projectionRequestError.message ||
          "Failed to resolve owned generation projection request ids"
      );
    }
    if (projectionSourceRefError) {
      throw new Error(
        projectionSourceRefError.message ||
          "Failed to resolve owned generation projection source refs"
      );
    }

    (Array.isArray(generationData) ? generationData : []).forEach((row) => {
      const idValue = asRecord(row).id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
    [projectionRequestData, projectionSourceRefData].forEach((data) => {
      (Array.isArray(data) ? data : []).forEach((row) => {
        const idValue = asRecord(row).generation_id;
        if (typeof idValue === "string" && idValue.trim().length > 0) {
          ownedGenerationIds.add(idValue.trim());
        }
      });
    });
  }

  return [...ownedGenerationIds];
};

const resolveOwnedSnapshotAssociationIds = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}) => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const [ownedMediaFileIds, ownedPromptIds, ownedGenerationIds] = await Promise.all([
    resolveOwnedIds({
      table: "media_files",
      idColumn: "id",
      userId,
      ids: mediaFileIds,
    }),
    resolveOwnedIds({
      table: "media_prompts",
      idColumn: "id",
      userId,
      ids: promptIds,
    }),
    resolveOwnedGenerationIds({
      userId,
      generationIds,
      runtimeRequestIds,
    }),
  ]);

  return {
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  };
};

const resolveOwnedSnapshotAssociationIdsForWrite = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Promise<{
  ownedMediaFileIds: string[];
  ownedPromptIds: string[];
  ownedGenerationIds: string[];
  failedAuthorities: string[];
  failureMessages: string[];
}> => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const [mediaResult, promptResult, generationResult] = await Promise.allSettled([
    resolveOwnedIds({
      table: "media_files",
      idColumn: "id",
      userId,
      ids: mediaFileIds,
    }),
    resolveOwnedIds({
      table: "media_prompts",
      idColumn: "id",
      userId,
      ids: promptIds,
    }),
    resolveOwnedGenerationIds({
      userId,
      generationIds,
      runtimeRequestIds,
    }),
  ]);

  const failedAuthorities: string[] = [];
  const failureMessages: string[] = [];
  const resolveSettledIds = ({
    result,
    authority,
  }: {
    result: PromiseSettledResult<string[]>;
    authority: string;
  }): string[] => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    failedAuthorities.push(authority);
    failureMessages.push(toErrorMessage(result.reason, `${authority} ownership unavailable`));
    return [];
  };

  return {
    ownedMediaFileIds: resolveSettledIds({
      result: mediaResult,
      authority: "media",
    }),
    ownedPromptIds: resolveSettledIds({
      result: promptResult,
      authority: "prompt",
    }),
    ownedGenerationIds: resolveSettledIds({
      result: generationResult,
      authority: "generation",
    }),
    failedAuthorities,
    failureMessages,
  };
};

const resolveOwnedSnapshotAssociationIdsForRead = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Promise<{
  ownedMediaFileIds: string[];
  ownedPromptIds: string[];
  ownedGenerationIds: string[];
  failedAuthorities: string[];
  failureMessages: string[];
}> => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const [mediaResult, promptResult, generationResult] = await Promise.allSettled([
    resolveOwnedIds({
      table: "media_files",
      idColumn: "id",
      userId,
      ids: mediaFileIds,
    }),
    resolveOwnedIds({
      table: "media_prompts",
      idColumn: "id",
      userId,
      ids: promptIds,
    }),
    resolveOwnedGenerationIds({
      userId,
      generationIds,
      runtimeRequestIds,
    }),
  ]);

  const failedAuthorities: string[] = [];
  const failureMessages: string[] = [];
  const resolveSettledIds = ({
    result,
    authority,
  }: {
    result: PromiseSettledResult<string[]>;
    authority: string;
  }): string[] => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    failedAuthorities.push(authority);
    failureMessages.push(toErrorMessage(result.reason, `${authority} ownership unavailable`));
    return [];
  };

  return {
    ownedMediaFileIds: resolveSettledIds({
      result: mediaResult,
      authority: "media",
    }),
    ownedPromptIds: resolveSettledIds({
      result: promptResult,
      authority: "prompt",
    }),
    ownedGenerationIds: resolveSettledIds({
      result: generationResult,
      authority: "generation",
    }),
    failedAuthorities,
    failureMessages,
  };
};

const backfillProjectAssetAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
  ownedMediaFileIds,
  ownedPromptIds,
  ownedGenerationIds,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  ownedMediaFileIds?: string[];
  ownedPromptIds?: string[];
  ownedGenerationIds?: string[];
}): Promise<void> => {
  const resolvedOwnedIds =
    ownedMediaFileIds && ownedPromptIds
      ? { ownedMediaFileIds, ownedPromptIds }
      : await resolveOwnedSnapshotAssociationIds({ userId, snapshot });

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (resolvedOwnedIds.ownedMediaFileIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_media_items").upsert(
      resolvedOwnedIds.ownedMediaFileIds.map((mediaFileId) => ({
        project_id: projectId,
        media_file_id: mediaFileId,
        user_id: userId,
        updated_at: nowIso,
      })),
      {
        onConflict: "project_id,media_file_id",
      }
    );
    if (error) {
      throw new Error(error.message || "Failed to backfill project media associations");
    }
  }

  if (resolvedOwnedIds.ownedPromptIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_prompt_items").upsert(
      resolvedOwnedIds.ownedPromptIds.map((promptId) => ({
        project_id: projectId,
        prompt_id: promptId,
        user_id: userId,
        updated_at: nowIso,
      })),
      {
        onConflict: "project_id,prompt_id",
      }
    );
    if (error) {
      throw new Error(error.message || "Failed to backfill project prompt associations");
    }
  }

  try {
    await backfillProjectGenerationAssociationsForSnapshot({
      userId,
      projectId,
      snapshot,
      ownedGenerationIds,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to backfill project generation associations"));
  }
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
  const baseSanitizedSnapshot = sanitizeProjectWorkspaceOutputsByShape({
    userId,
    snapshot,
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
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
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
    const reSanitizedSnapshot = sanitizeProjectWorkspaceSnapshot(sanitizedOutputsSnapshot);

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

const prepareProjectWorkspaceSnapshotForReadResponse = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const materializedSnapshot = await materializeProjectWorkspaceSnapshotForUser({
    userId,
    projectId,
    snapshot,
  });
  const sanitizedSnapshot = await canonicalizeProjectWorkspaceSnapshotForRead({
    userId,
    projectId,
    snapshot: materializedSnapshot,
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
  });
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
}: {
  userId: string;
  projectId: string;
  schemaVersion?: number;
  snapshot: unknown;
}): Promise<ProjectWorkspaceStateRecord> => {
  const parsedSnapshot = parseProjectWorkspaceSnapshotPayload(snapshot);
  if (!parsedSnapshot || !parseAiStudioSessionSnapshotShape(parsedSnapshot)) {
    throw new InvalidProjectWorkspaceSnapshotError();
  }
  const sanitizedSnapshot = sanitizeProjectWorkspaceSnapshot(parsedSnapshot);
  const preparedSnapshot = await prepareProjectWorkspaceSnapshotForWrite({
    userId,
    snapshot: sanitizedSnapshot,
  });

  const normalizedSchemaVersion =
    typeof schemaVersion === "number" && Number.isFinite(schemaVersion)
      ? Math.max(1, Math.min(100, Math.trunc(schemaVersion)))
      : 2;
  const snapshotUpdatedAt =
    normalizeIsoTimestamp(preparedSnapshot.snapshot.updatedAt) ?? new Date().toISOString();

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
      snapshot: await prepareProjectWorkspaceSnapshotForReadResponse({
        userId,
        projectId,
        snapshot: existingRow.snapshot,
      }),
      saveOutcome: {
        status: "saved",
      },
    });
  }

  const existingCheckpointRevision = existingRow?.checkpoint_revision ?? 0;
  const nextCheckpointRevision = existingCheckpointRevision + 1;
  const lightweightCheckpointSnapshot = createLightweightProjectWorkspaceCheckpointSnapshot({
    snapshot: preparedSnapshot.snapshot,
    checkpointRevision: nextCheckpointRevision,
  });
  const checkpointStructureChanged =
    !existingRow ||
    projectWorkspaceCheckpointNeedsCompaction(existingRow.snapshot) ||
    !areProjectWorkspaceCheckpointsStructurallyEqual(
      existingRow.snapshot,
      lightweightCheckpointSnapshot
    );
  // Advance workspace freshness on newer display-only saves without bumping structural revision.
  const shouldPersistWorkspaceRow =
    !existingRow ||
    checkpointStructureChanged ||
    compareIsoTimestamps(existingRow.snapshot_updated_at, snapshotUpdatedAt) < 0;
  const workspaceSnapshotForWrite =
    checkpointStructureChanged || !existingRow
      ? lightweightCheckpointSnapshot
      : existingRow.snapshot;
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
      .select(PROJECT_WORKSPACE_SELECT_COLUMNS)
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
    savedRow = data as ProjectWorkspaceStateRow;
  }
  const staleWriteIgnored =
    compareIsoTimestamps(savedRow.snapshot_updated_at, snapshotUpdatedAt) > 0;

  if (staleWriteIgnored) {
    return toProjectWorkspaceStateRecord({
      row: savedRow,
      snapshot: await prepareProjectWorkspaceSnapshotForReadResponse({
        userId,
        projectId,
        snapshot: savedRow.snapshot,
      }),
      saveOutcome: {
        status: "saved",
      },
    });
  }

  let displaySyncResult: Awaited<
    ReturnType<typeof syncProjectOutputDisplayItemsForSnapshot>
  > | null = null;
  try {
    displaySyncResult = await syncProjectOutputDisplayItemsForSnapshot({
      userId,
      projectId,
      snapshot: preparedSnapshot.snapshot,
      snapshotUpdatedAt,
      deferDeletes: checkpointStructureChanged,
    });
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

  if (checkpointStructureChanged && displaySyncResult?.deletedCount === 0) {
    try {
      await syncProjectOutputDisplayItemsForSnapshot({
        userId,
        projectId,
        snapshot: preparedSnapshot.snapshot,
        snapshotUpdatedAt,
        deferDeletes: false,
      });
    } catch (error) {
      logProjectWorkspaceBestEffortFailure({
        stage: "project output display cleanup",
        projectId,
        error,
      });
    }
  }

  try {
    await backfillProjectAssetAssociationsForSnapshot({
      userId,
      projectId,
      snapshot: preparedSnapshot.snapshot,
      ownedMediaFileIds: preparedSnapshot.ownedMediaFileIds,
      ownedPromptIds: preparedSnapshot.ownedPromptIds,
      ownedGenerationIds: preparedSnapshot.ownedGenerationIds,
    });
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
      snapshot: await materializeProjectWorkspaceSnapshotForUser({
        userId,
        projectId,
        snapshot: savedRow.snapshot,
      }),
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage,
        repairMessage,
      },
    });
  }

  return toProjectWorkspaceStateRecord({
    row: savedRow,
    snapshot: await materializeProjectWorkspaceSnapshotForUser({
      userId,
      projectId,
      snapshot: savedRow.snapshot,
    }),
    saveOutcome: {
      status: "saved",
    },
  });
};
