/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
} from "../../features/ai-studio/logic/sessionSnapshot";
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

const sanitizeProjectWorkspaceSnapshot = (
  snapshot: Record<string, unknown>
): Record<string, unknown> =>
  createAiStudioProjectWorkspaceSnapshot(
    snapshot as unknown as AiStudioSessionSnapshot
  ) as unknown as Record<string, unknown>;

const hasSettledOutputPayload = (row: Record<string, unknown>): boolean => {
  if (
    Array.isArray(row.resultUrls) &&
    row.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0)
  ) {
    return true;
  }
  if (typeof row.previewUrl === "string" && row.previewUrl.trim().length > 0) return true;
  if (typeof row.previewText === "string" && row.previewText.trim().length > 0) return true;
  if (typeof row.previewStoragePath === "string" && row.previewStoragePath.trim().length > 0) {
    return true;
  }
  if (typeof row.fullStoragePath === "string" && row.fullStoragePath.trim().length > 0) {
    return true;
  }
  if (
    Array.isArray(row.savedMediaIds) &&
    row.savedMediaIds.some((value) => typeof value === "string" && value.trim().length > 0)
  ) {
    return true;
  }
  return row.status === "saved";
};

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

  const sanitizeRows = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
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
        if (!generationId && hasSettledOutputPayload(normalizedRow)) {
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
    throw new Error(error.message || `Failed to resolve owned ${table} ids`);
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
    throw new Error(error.message || "Failed to resolve owned ai_generations ids");
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
      throw new Error(error.message || "Failed to associate project media items");
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
      throw new Error(error.message || "Failed to associate project prompt items");
    }
  }

  await backfillProjectGenerationAssociationsForSnapshot({
    userId,
    projectId,
    snapshot,
  });
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

  if (backfillAssociations) {
    await backfillProjectAssetAssociationsForSnapshot({
      userId,
      projectId,
      snapshot: sanitizedOutputsSnapshot,
    });
  }

  const hydratedSnapshot = await hydrateProjectSnapshotGeneratedOutputs({
    userId,
    projectId,
    snapshot: sanitizedOutputsSnapshot,
  });

  return sanitizeProjectWorkspaceOutputs({
    snapshot: hydratedSnapshot,
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  });
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
    snapshot: await canonicalizeProjectWorkspaceSnapshot({
      userId,
      projectId,
      snapshot: sanitizedSnapshot,
      backfillAssociations: false,
    }),
  };
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
  if (!parsedSnapshot) {
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
    throw new Error(error.message || "Failed to save project workspace state");
  }
  if (!data) {
    throw new Error("Failed to save project workspace state");
  }
  const record = toProjectWorkspaceStateRecord(data as ProjectWorkspaceStateRow);
  return {
    ...record,
    snapshot: canonicalSnapshot,
  };
};
