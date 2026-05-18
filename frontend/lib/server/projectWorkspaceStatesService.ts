/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import { parseAiStudioSessionSnapshotShape } from "../ai-studio-session/sessionSnapshotShape";
import { createAiStudioProjectWorkspaceSnapshot } from "../ai-studio-session/projectWorkspaceSnapshot";
import { parseAiStudioSessionSnapshot } from "./api/aiStudioSessions";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import {
  backfillProjectGenerationAssociationsForSnapshot,
  hydrateProjectSnapshotGeneratedOutputs,
} from "./projectGenerationAssociationsService";

const PROJECT_WORKSPACE_SELECT_COLUMNS =
  "project_id, user_id, schema_version, snapshot, created_at, updated_at" as const;

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

const sanitizeProjectWorkspaceOutputs = ({
  snapshot,
  ownedMediaFileIds,
  ownedPromptIds,
  ownedGenerationIds,
}: {
  snapshot: Record<string, unknown>;
  ownedMediaFileIds: readonly string[];
  ownedPromptIds: readonly string[];
  ownedGenerationIds: readonly string[];
}): Record<string, unknown> => {
  const outputsRecord = asRecord(snapshot.outputs);
  const allowedMediaFileIds = new Set(ownedMediaFileIds);
  const allowedPromptIds = new Set(ownedPromptIds);
  const allowedGenerationIds = new Set(ownedGenerationIds);
  const isFailedWorkspaceOutputRow = (row: Record<string, unknown>): boolean =>
    typeof row.taskState === "string" && row.taskState.trim() === "fail";

  const sanitizeRows = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        if (isFailedWorkspaceOutputRow(normalizedRow)) {
          return null;
        }
        const generationId =
          typeof normalizedRow.generationId === "string" ? normalizedRow.generationId.trim() : "";
        const promptId =
          typeof normalizedRow.promptId === "string" ? normalizedRow.promptId.trim() : "";
        const savedMediaIds = Array.isArray(normalizedRow.savedMediaIds)
          ? Array.from(
              new Set(
                normalizedRow.savedMediaIds
                  .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                  .filter((entry) => entry.length > 0 && allowedMediaFileIds.has(entry))
              )
            )
          : [];

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

        return nextRow;
      })
      .filter((row): row is Record<string, unknown> => Boolean(row));
  };

  const active = sanitizeRows(outputsRecord.active);
  const archived = sanitizeRows(outputsRecord.archived);
  const outputIds = new Set<string>(
    [...active, ...archived]
      .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
      .filter((value) => value.length > 0)
  );
  const activeOutputId =
    typeof outputsRecord.activeOutputId === "string" &&
    outputIds.has(outputsRecord.activeOutputId.trim())
      ? outputsRecord.activeOutputId.trim()
      : null;
  const filterOutputIds = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0 && outputIds.has(entry))
      : [];

  return {
    ...snapshot,
    outputs: {
      ...outputsRecord,
      active,
      archived,
      activeOutputId,
      curatedReferenceIds: filterOutputIds(outputsRecord.curatedReferenceIds),
      removedFromAllRefsIds: filterOutputIds(outputsRecord.removedFromAllRefsIds),
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
  if (ids.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(idColumn)
    .eq("user_id", userId)
    .in(idColumn, ids);

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
  if (generationIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id")
    .eq("user_id", userId)
    .in("id", generationIds);

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

const canonicalizeProjectWorkspaceSnapshot = async ({
  userId,
  projectId,
  snapshot,
  backfillAssociations = false,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  backfillAssociations?: boolean;
}): Promise<Record<string, unknown>> => {
  let ownedMediaFileIds: string[] = [];
  let ownedPromptIds: string[] = [];
  let ownedGenerationIds: string[] = [];
  try {
    ({ ownedMediaFileIds, ownedPromptIds, ownedGenerationIds } =
      await resolveOwnedSnapshotAssociationIds({
        userId,
        snapshot,
      }));
  } catch (error) {
    throw wrapProjectWorkspaceSaveStageError({
      stage: "owned id resolution",
      error,
    });
  }
  const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
    snapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  });

  if (backfillAssociations) {
    try {
      await backfillProjectAssetAssociationsForSnapshot({
        userId,
        projectId,
        snapshot: sanitizedOutputsSnapshot,
      });
    } catch (error) {
      throw wrapProjectWorkspaceSaveStageError({
        stage: "project association backfill",
        error,
      });
    }
  }

  let hydratedSnapshot = sanitizedOutputsSnapshot;
  try {
    hydratedSnapshot = await hydrateProjectSnapshotGeneratedOutputs({
      userId,
      projectId,
      snapshot: sanitizedOutputsSnapshot,
    });
  } catch (error) {
    logProjectWorkspaceBestEffortFailure({
      stage: "generated output hydration",
      projectId,
      error,
    });
  }
  const hydratedGenerationIds = collectSnapshotGenerationIds(hydratedSnapshot);

  return sanitizeProjectWorkspaceOutputs({
    snapshot: hydratedSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds: [...new Set([...ownedGenerationIds, ...hydratedGenerationIds])],
  });
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
  let fallbackSnapshot = snapshot;
  try {
    const { ownedMediaFileIds, ownedPromptIds, ownedGenerationIds } =
      await resolveOwnedSnapshotAssociationIds({
        userId,
        snapshot,
      });
    const sanitizedOutputsSnapshot = sanitizeProjectWorkspaceOutputs({
      snapshot,
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
    const hydratedGenerationIds = collectSnapshotGenerationIds(hydratedSnapshot);

    return sanitizeProjectWorkspaceOutputs({
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
    return fallbackSnapshot;
  }
};

const toProjectWorkspaceStateRecord = (
  row: ProjectWorkspaceStateRow
): ProjectWorkspaceStateRecord => ({
  projectId: row.project_id,
  userId: row.user_id,
  schemaVersion: row.schema_version,
  snapshot: row.snapshot,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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
  const record = toProjectWorkspaceStateRecord(data as ProjectWorkspaceStateRow);
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
  const canonicalSnapshot = await canonicalizeProjectWorkspaceSnapshot({
    userId,
    projectId,
    snapshot: sanitizedSnapshot,
    backfillAssociations: true,
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
        snapshot: canonicalSnapshot,
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
  const record = toProjectWorkspaceStateRecord(data as ProjectWorkspaceStateRow);
  return {
    ...record,
    snapshot: canonicalSnapshot,
  };
};
