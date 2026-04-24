/**
 * Project Media Library folder-canvas persistence service.
 * Owns project-scoped get/save operations for custom-folder canvas snapshots.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { isCustomMediaFolderId } from "./mediaFoldersService";

type ProjectFolderCanvasDbRow = {
  user_id: string;
  project_id: string;
  folder_id: string;
  schema_version: number;
  snapshot: Record<string, unknown>;
  save_seq: number;
  created_at: string;
  updated_at: string;
};

export type ProjectMediaFolderCanvasStateRecord = {
  userId: string;
  projectId: string;
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
  saveSeq: number;
  createdAt: string;
  updatedAt: string;
};

const toStateRecord = (row: ProjectFolderCanvasDbRow): ProjectMediaFolderCanvasStateRecord => ({
  userId: row.user_id,
  projectId: row.project_id,
  folderId: row.folder_id,
  schemaVersion: row.schema_version,
  snapshot: row.snapshot,
  saveSeq: row.save_seq,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const assertOwnedProjectFolder = async ({
  userId,
  projectId,
  folderId,
}: {
  userId: string;
  projectId: string;
  folderId: string;
}): Promise<void> => {
  if (!isCustomMediaFolderId(folderId)) {
    throw new Error("Invalid folder id");
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_media_folders")
    .select("id")
    .eq("id", folderId)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "Failed to validate project folder");
  }
  if (!data) {
    throw new Error("Folder not found");
  }
};

export const getProjectMediaFolderCanvasStateForUser = async ({
  userId,
  projectId,
  folderId,
}: {
  userId: string;
  projectId: string;
  folderId: string;
}): Promise<ProjectMediaFolderCanvasStateRecord | null> => {
  await assertOwnedProjectFolder({ userId, projectId, folderId });
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_media_folder_canvas_states")
    .select(
      "user_id, project_id, folder_id, schema_version, snapshot, save_seq, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("folder_id", folderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load project media folder canvas state");
  }
  if (!data) return null;
  return toStateRecord(data as ProjectFolderCanvasDbRow);
};

export const saveProjectMediaFolderCanvasStateForUser = async ({
  userId,
  projectId,
  folderId,
  schemaVersion,
  snapshot,
}: {
  userId: string;
  projectId: string;
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
}): Promise<ProjectMediaFolderCanvasStateRecord> => {
  await assertOwnedProjectFolder({ userId, projectId, folderId });
  const supabaseAdmin = getSupabaseAdmin();
  const timestamp = new Date().toISOString();

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from("project_media_folder_canvas_states")
    .select("save_seq")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("folder_id", folderId)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message || "Failed to load existing project folder canvas state");
  }
  const nextSaveSeq = Math.max(0, Number(existingRow?.save_seq ?? 0)) + 1;

  const { data, error } = await supabaseAdmin
    .from("project_media_folder_canvas_states")
    .upsert(
      {
        user_id: userId,
        project_id: projectId,
        folder_id: folderId,
        schema_version: schemaVersion,
        snapshot,
        save_seq: nextSaveSeq,
        updated_at: timestamp,
      },
      {
        onConflict: "user_id,project_id,folder_id",
      }
    )
    .select(
      "user_id, project_id, folder_id, schema_version, snapshot, save_seq, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to save project media folder canvas state");
  }
  if (!data) {
    throw new Error("Failed to save project media folder canvas state");
  }
  return toStateRecord(data as ProjectFolderCanvasDbRow);
};
