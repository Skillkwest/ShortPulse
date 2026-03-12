/**
 * Media Library folder-canvas persistence service.
 * Owns user-scoped get/save operations for custom-folder canvas snapshots.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { isCustomMediaFolderId } from "./mediaFoldersService";

const SNAPSHOT_MAX_BYTES = 900_000;

type FolderCanvasDbRow = {
  user_id: string;
  folder_id: string;
  schema_version: number;
  snapshot: Record<string, unknown>;
  save_seq: number;
  created_at: string;
  updated_at: string;
};

export type MediaFolderCanvasStateRecord = {
  userId: string;
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
  saveSeq: number;
  createdAt: string;
  updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStateRecord = (row: FolderCanvasDbRow): MediaFolderCanvasStateRecord => ({
  userId: row.user_id,
  folderId: row.folder_id,
  schemaVersion: row.schema_version,
  snapshot: row.snapshot,
  saveSeq: row.save_seq,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const assertOwnedCustomFolder = async ({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string;
}): Promise<void> => {
  if (!isCustomMediaFolderId(folderId)) {
    throw new Error("Invalid folder id");
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "Failed to validate folder");
  }
  if (!data) {
    throw new Error("Folder not found");
  }
};

export const parseMediaFolderCanvasSnapshot = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  try {
    const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (bytes > SNAPSHOT_MAX_BYTES) return null;
    return value;
  } catch {
    return null;
  }
};

export const getMediaFolderCanvasStateForUser = async ({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string;
}): Promise<MediaFolderCanvasStateRecord | null> => {
  await assertOwnedCustomFolder({ userId, folderId });
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_folder_canvas_states")
    .select("user_id, folder_id, schema_version, snapshot, save_seq, created_at, updated_at")
    .eq("user_id", userId)
    .eq("folder_id", folderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load media folder canvas state");
  }
  if (!data) return null;
  return toStateRecord(data as FolderCanvasDbRow);
};

export const saveMediaFolderCanvasStateForUser = async ({
  userId,
  folderId,
  schemaVersion,
  snapshot,
}: {
  userId: string;
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
}): Promise<MediaFolderCanvasStateRecord> => {
  await assertOwnedCustomFolder({ userId, folderId });
  const supabaseAdmin = getSupabaseAdmin();
  const timestamp = new Date().toISOString();

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from("media_folder_canvas_states")
    .select("save_seq")
    .eq("user_id", userId)
    .eq("folder_id", folderId)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message || "Failed to load existing folder canvas state");
  }
  const nextSaveSeq = Math.max(0, Number(existingRow?.save_seq ?? 0)) + 1;

  const { data, error } = await supabaseAdmin
    .from("media_folder_canvas_states")
    .upsert(
      {
        user_id: userId,
        folder_id: folderId,
        schema_version: schemaVersion,
        snapshot,
        save_seq: nextSaveSeq,
        updated_at: timestamp,
      },
      {
        onConflict: "user_id,folder_id",
      }
    )
    .select("user_id, folder_id, schema_version, snapshot, save_seq, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to save media folder canvas state");
  }
  if (!data) {
    throw new Error("Failed to save media folder canvas state");
  }
  return toStateRecord(data as FolderCanvasDbRow);
};
