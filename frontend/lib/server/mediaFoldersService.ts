/**
 * Media folder domain service.
 * Centralizes folder CRUD and membership batch operations with ownership validation.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

export const MEDIA_LIBRARY_ROOT_FOLDER_ID = "all_items" as const;

const FOLDER_NAME_MAX_LENGTH = 64;
const FOLDER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbErrorLike = { code?: string | null; message?: string | null };

export type MediaFolderRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type FolderMembershipBatchAction = "assign" | "unassign";

export type FolderMembershipBatchInput = {
  userId: string;
  folderId: string;
  action: FolderMembershipBatchAction;
  mediaIds: string[];
  promptIds: string[];
};

export type FolderMembershipBatchResult = {
  folderId: string;
  action: FolderMembershipBatchAction;
  mediaAssigned: number;
  mediaUnassigned: number;
  promptsAssigned: number;
  promptsUnassigned: number;
};

/**
 * Returns true when a value is a valid folder UUID (excluding root virtual id).
 */
export const isCustomMediaFolderId = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized || normalized === MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
  return FOLDER_ID_REGEX.test(normalized);
};

/**
 * Normalizes user-provided folder names.
 */
export const sanitizeMediaFolderName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > FOLDER_NAME_MAX_LENGTH) return null;
  return normalized;
};

const isUniqueViolation = (error: unknown): boolean => {
  const dbError = error as DbErrorLike;
  return dbError?.code === "23505";
};

const toOwnedIdsSet = async ({
  table,
  idColumn,
  userId,
  ids,
}: {
  table: "media_files" | "media_prompts";
  idColumn: "id";
  userId: string;
  ids: string[];
}): Promise<Set<string>> => {
  if (!ids.length) return new Set();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(idColumn)
    .eq("user_id", userId)
    .in(idColumn, ids);
  if (error) {
    throw new Error(error.message || `Failed to validate ${table} ownership`);
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const value = (row as Record<string, unknown>)[idColumn];
    if (typeof value === "string" && value.trim()) {
      set.add(value.trim());
    }
  }
  return set;
};

/**
 * Lists custom folders for a user sorted case-insensitively by name.
 */
export const listMediaFoldersForUser = async (userId: string): Promise<MediaFolderRow[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .select("id, user_id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to list media folders");
  }

  return ((data ?? []) as MediaFolderRow[]).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "accent" })
  );
};

/**
 * Creates a custom folder for a user.
 */
export const createMediaFolderForUser = async ({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<MediaFolderRow> => {
  const supabaseAdmin = getSupabaseAdmin();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .insert({
      user_id: userId,
      name,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select("id, user_id, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to create folder");
  }
  if (!data) {
    throw new Error("Failed to create folder");
  }

  return data as MediaFolderRow;
};

/**
 * Renames a custom folder owned by the user.
 */
export const renameMediaFolderForUser = async ({
  userId,
  folderId,
  name,
}: {
  userId: string;
  folderId: string;
  name: string;
}): Promise<MediaFolderRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select("id, user_id, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to rename folder");
  }

  return (data as MediaFolderRow | null) ?? null;
};

/**
 * Deletes a custom folder owned by the user.
 */
export const deleteMediaFolderForUser = async ({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string;
}): Promise<boolean> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error, count } = await supabaseAdmin
    .from("media_folders")
    .delete({ count: "exact" })
    .eq("id", folderId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to delete folder");
  }

  return (count ?? 0) > 0;
};

/**
 * Applies assign/unassign operations for media and prompt folder memberships.
 */
export const applyFolderMembershipBatch = async (
  input: FolderMembershipBatchInput
): Promise<FolderMembershipBatchResult> => {
  const { action, folderId, mediaIds, promptIds, userId } = input;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: folderRow, error: folderError } = await supabaseAdmin
    .from("media_folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (folderError) {
    throw new Error(folderError.message || "Failed to load folder");
  }
  if (!folderRow) {
    throw new Error("Folder not found");
  }

  const ownedMediaIds = await toOwnedIdsSet({
    table: "media_files",
    idColumn: "id",
    userId,
    ids: mediaIds,
  });
  const ownedPromptIds = await toOwnedIdsSet({
    table: "media_prompts",
    idColumn: "id",
    userId,
    ids: promptIds,
  });

  if (ownedMediaIds.size !== mediaIds.length || ownedPromptIds.size !== promptIds.length) {
    throw new Error("One or more item ids are invalid for this user");
  }

  let mediaAssigned = 0;
  let mediaUnassigned = 0;
  let promptsAssigned = 0;
  let promptsUnassigned = 0;

  if (action === "assign") {
    if (mediaIds.length) {
      const mediaRows = mediaIds.map((mediaFileId) => ({
        folder_id: folderId,
        media_file_id: mediaFileId,
        user_id: userId,
      }));
      const { data, error } = await supabaseAdmin
        .from("media_folder_media_items")
        .upsert(mediaRows, { onConflict: "folder_id,media_file_id" })
        .select("media_file_id");
      if (error) {
        throw new Error(error.message || "Failed to assign media items");
      }
      mediaAssigned = (data ?? []).length;
    }

    if (promptIds.length) {
      const promptRows = promptIds.map((promptId) => ({
        folder_id: folderId,
        prompt_id: promptId,
        user_id: userId,
      }));
      const { data, error } = await supabaseAdmin
        .from("media_folder_prompt_items")
        .upsert(promptRows, { onConflict: "folder_id,prompt_id" })
        .select("prompt_id");
      if (error) {
        throw new Error(error.message || "Failed to assign prompt items");
      }
      promptsAssigned = (data ?? []).length;
    }
  } else {
    if (mediaIds.length) {
      const { error, count } = await supabaseAdmin
        .from("media_folder_media_items")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("folder_id", folderId)
        .in("media_file_id", mediaIds);
      if (error) {
        throw new Error(error.message || "Failed to unassign media items");
      }
      mediaUnassigned = count ?? 0;
    }

    if (promptIds.length) {
      const { error, count } = await supabaseAdmin
        .from("media_folder_prompt_items")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("folder_id", folderId)
        .in("prompt_id", promptIds);
      if (error) {
        throw new Error(error.message || "Failed to unassign prompt items");
      }
      promptsUnassigned = count ?? 0;
    }
  }

  return {
    folderId,
    action,
    mediaAssigned,
    mediaUnassigned,
    promptsAssigned,
    promptsUnassigned,
  };
};
