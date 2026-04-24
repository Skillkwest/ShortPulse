/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const backfillProjectAssetAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
}): Promise<void> => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const [ownedMediaFileIds, ownedPromptIds] = await Promise.all([
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
  ]);

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (ownedMediaFileIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_media_items").upsert(
      ownedMediaFileIds.map((mediaFileId) => ({
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

  if (ownedPromptIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_prompt_items").upsert(
      ownedPromptIds.map((promptId) => ({
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
  return {
    ...record,
    snapshot: await hydrateProjectSnapshotGeneratedOutputs({
      userId,
      projectId,
      snapshot: record.snapshot,
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
    throw new Error("Invalid project workspace snapshot");
  }

  const normalizedSchemaVersion =
    typeof schemaVersion === "number" && Number.isFinite(schemaVersion)
      ? Math.max(1, Math.min(100, Math.trunc(schemaVersion)))
      : 2;

  await backfillProjectAssetAssociationsForSnapshot({
    userId,
    projectId,
    snapshot: parsedSnapshot,
  });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_workspace_states")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        schema_version: normalizedSchemaVersion,
        snapshot: parsedSnapshot,
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
  return toProjectWorkspaceStateRecord(data as ProjectWorkspaceStateRow);
};
