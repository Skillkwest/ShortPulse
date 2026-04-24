/**
 * Project workspace persistence helpers.
 * Owns server-authoritative read/write access for user-owned project workspace snapshots.
 */
import { parseAiStudioSessionSnapshot } from "./api/aiStudioSessions";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

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
  return toProjectWorkspaceStateRecord(data as ProjectWorkspaceStateRow);
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
