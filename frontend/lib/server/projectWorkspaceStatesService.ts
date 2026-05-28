/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import { parseAiStudioSessionSnapshotShape } from "../ai-studio-session/sessionSnapshotShape";
import { createAiStudioProjectWorkspaceSnapshot } from "../ai-studio-session/projectWorkspaceSnapshot";
import { isUserScopedMediaStoragePath } from "../mediaStoragePath";
import { parseAiStudioSessionSnapshot } from "./api/aiStudioSessions";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import {
  backfillProjectGenerationAssociationsForSnapshot,
  hydrateProjectSnapshotGeneratedOutputs,
} from "./projectGenerationAssociationsService";

const PROJECT_WORKSPACE_SELECT_COLUMNS =
  "project_id, user_id, schema_version, snapshot, created_at, updated_at" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProjectWorkspaceStateRow = {
  project_id: string;
  user_id: string;
  schema_version: number;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProjectWorkspaceStateRecord = {
  projectId: string;
  userId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  saveOutcome?: ProjectWorkspaceSaveOutcome;
};

export type ProjectWorkspaceSaveOutcomeStatus = "saved" | "saved_with_repair_pending";

export type ProjectWorkspaceSaveOutcome = {
  status: ProjectWorkspaceSaveOutcomeStatus;
  repairStage?: "project_association_backfill";
  repairMessage?: string | null;
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

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

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
  repairStage: "project_association_backfill";
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
  snapshot: Record<string, unknown>
): Record<string, unknown> =>
  createAiStudioProjectWorkspaceSnapshot(
    snapshot as Record<string, unknown> & {
      schemaVersion: number;
      updatedAt: string;
    }
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

const collectSnapshotGenerationIds = (snapshot: Record<string, unknown>): string[] => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const generationIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedRow = asRecord(row);
    const generationId =
      typeof normalizedRow.generationId === "string" ? normalizedRow.generationId.trim() : "";
    if (generationId) {
      generationIds.add(generationId);
    }
  });

  return [...generationIds];
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
}: {
  userId: string;
  snapshot: Record<string, unknown>;
  ownedMediaFileIds: readonly string[];
  ownedPromptIds: readonly string[];
  ownedGenerationIds: readonly string[];
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
        const generationId = normalizeUuid(normalizedRow.generationId) ?? "";
        const promptId = normalizeUuid(normalizedRow.promptId) ?? "";
        const savedMediaIds = normalizeUuidList(normalizedRow.savedMediaIds).filter((entry) =>
          allowedMediaFileIds.has(entry)
        );

        if (generationId && !allowedGenerationIds.has(generationId)) {
          return null;
        }
        const nextRow: Record<string, unknown> = {
          ...normalizedRow,
          ...(generationId ? { generationId } : {}),
          ...(promptId && allowedPromptIds.has(promptId) ? { promptId } : {}),
          ...(savedMediaIds.length > 0 ? { savedMediaIds } : {}),
        };

        if (!generationId && "generationId" in nextRow) {
          delete nextRow.generationId;
        }
        if ((!promptId || !allowedPromptIds.has(promptId)) && "promptId" in nextRow) {
          delete nextRow.promptId;
        }
        if (savedMediaIds.length === 0 && "savedMediaIds" in nextRow) {
          delete nextRow.savedMediaIds;
        }
        sanitizeScopedStoragePathFields(nextRow);

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
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(idColumn)
    .eq("user_id", userId)
    .in(idColumn, canonicalIds);

  if (error) {
    const tableLabel = table === "media_files" ? "media ids" : "prompt ids";
    throw new Error(error.message || `Failed to resolve owned ${tableLabel}`);
  }

  return Array.isArray(data)
    ? data
        .map((row) => {
          const record = asRecord(row);
          const idValue = record[idColumn];
          return typeof idValue === "string" ? idValue.trim() : "";
        })
        .filter((value) => value.length > 0)
    : [];
};

const resolveOwnedGenerationIds = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<string[]> => {
  const canonicalGenerationIds = normalizeUuidList(generationIds);
  if (canonicalGenerationIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id")
    .eq("user_id", userId)
    .in("id", canonicalGenerationIds);

  if (error) {
    throw new Error(error.message || "Failed to resolve owned generation ids");
  }

  return Array.isArray(data)
    ? data
        .map((row) => {
          const idValue = asRecord(row).id;
          return typeof idValue === "string" ? idValue.trim() : "";
        })
        .filter((value) => value.length > 0)
    : [];
};

const resolveOwnedSnapshotAssociationIds = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}) => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
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
      generationIds: collectSnapshotGenerationIds(snapshot),
    }),
  ]);

  return {
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  };
};

const backfillProjectAssetAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
  ownedMediaFileIds,
  ownedPromptIds,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  ownedMediaFileIds?: string[];
  ownedPromptIds?: string[];
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
}> => {
  const baseSanitizedSnapshot = sanitizeProjectWorkspaceOutputsByShape({
    userId,
    snapshot,
  });
  let ownedMediaFileIds: string[] = [];
  let ownedPromptIds: string[] = [];
  let ownedGenerationIds: string[] = [];
  try {
    ({ ownedMediaFileIds, ownedPromptIds, ownedGenerationIds } =
      await resolveOwnedSnapshotAssociationIds({
        userId,
        snapshot: baseSanitizedSnapshot,
      }));
  } catch (error) {
    throw wrapProjectWorkspaceSaveStageError({
      stage: "owned id resolution",
      error,
    });
  }
  const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
    userId,
    snapshot: baseSanitizedSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  });

  return {
    snapshot: sanitizedOutputsSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
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
  let fallbackSnapshot = baseSanitizedSnapshot;
  try {
    const { ownedMediaFileIds, ownedPromptIds, ownedGenerationIds } =
      await resolveOwnedSnapshotAssociationIds({
        userId,
        snapshot: baseSanitizedSnapshot,
      });
    const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
      userId,
      snapshot: baseSanitizedSnapshot,
      ownedMediaFileIds,
      ownedPromptIds,
      ownedGenerationIds,
    });
    fallbackSnapshot = sanitizedOutputsSnapshot;

    const hydratedSnapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId,
      projectId,
      snapshot: sanitizedOutputsSnapshot,
    });
    if (hydratedSnapshot === sanitizedOutputsSnapshot) {
      return sanitizedOutputsSnapshot;
    }
    const hydratedGenerationIds = collectSnapshotGenerationIds(hydratedSnapshot);

    return sanitizeProjectWorkspaceOutputs({
      userId,
      snapshot: hydratedSnapshot,
      ownedMediaFileIds,
      ownedPromptIds,
      ownedGenerationIds: [...new Set([...ownedGenerationIds, ...hydratedGenerationIds])],
    });
  } catch (error) {
    console.warn("[project-workspace] read enrichment failed; returning sanitized snapshot", {
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    void writeAppErrorLog({
      source: "telemetry.ai_studio.project_workspace.read_enrichment_fallback",
      message:
        "Project workspace read enrichment fell back to the sanitized snapshot after an enrichment failure.",
      userId,
      statusCode: 200,
      metadata: {
        project_id: projectId,
        fallback_stage: "read_enrichment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch(() => undefined);
    return fallbackSnapshot;
  }
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
  const sanitizedSnapshot = sanitizeProjectWorkspaceSnapshot(record.snapshot);
  return {
    ...record,
    snapshot: await canonicalizeProjectWorkspaceSnapshotForRead({
      userId,
      projectId,
      snapshot: sanitizedSnapshot,
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
  const parsedSnapshot = parseAiStudioSessionSnapshot(snapshot);
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

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_workspace_states")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        schema_version: normalizedSchemaVersion,
        snapshot: preparedSnapshot.snapshot,
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
  const savedRow = data as ProjectWorkspaceStateRow;

  try {
    await backfillProjectAssetAssociationsForSnapshot({
      userId,
      projectId,
      snapshot: preparedSnapshot.snapshot,
      ownedMediaFileIds: preparedSnapshot.ownedMediaFileIds,
      ownedPromptIds: preparedSnapshot.ownedPromptIds,
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
    return toProjectWorkspaceStateRecord({
      row: savedRow,
      snapshot: preparedSnapshot.snapshot,
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "project_association_backfill",
        repairMessage,
      },
    });
  }

  return toProjectWorkspaceStateRecord({
    row: savedRow,
    snapshot: preparedSnapshot.snapshot,
    saveOutcome: {
      status: "saved",
    },
  });
};
