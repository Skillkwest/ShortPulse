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
const MEDIA_FOLDER_SELECT_COLUMNS =
  "id, user_id, name, parent_folder_id, created_at, updated_at" as const;
const LEGACY_MEDIA_FOLDER_SELECT_COLUMNS = "id, user_id, name, created_at, updated_at" as const;

export type MediaFolderRow = {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FolderMembershipBatchAction = "assign" | "unassign" | "move";

export type FolderMembershipBatchInput = {
  userId: string;
  action: FolderMembershipBatchAction;
  folderId?: string;
  sourceFolderId?: string;
  targetFolderId?: string;
  mediaIds: string[];
  promptIds: string[];
};

export type FolderMembershipBatchResult = {
  action: FolderMembershipBatchAction;
  folderId: string | null;
  sourceFolderId: string | null;
  targetFolderId: string | null;
  mediaAssigned: number;
  mediaUnassigned: number;
  promptsAssigned: number;
  promptsUnassigned: number;
  mediaDuplicates: number;
  promptDuplicates: number;
  mediaSkipped: number;
  promptSkipped: number;
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

/**
 * Normalizes a requested parent folder id.
 * `null` means root (`All Media`), `undefined` means invalid input.
 */
export const sanitizeMediaFolderParentId = (value: unknown): string | null | undefined => {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized === MEDIA_LIBRARY_ROOT_FOLDER_ID) {
    return null;
  }
  return FOLDER_ID_REGEX.test(normalized) ? normalized : undefined;
};

const isUniqueViolation = (error: unknown): boolean => {
  const dbError = error as DbErrorLike;
  return dbError?.code === "23505";
};

const isHierarchyConflict = (error: unknown): boolean => {
  const dbError = error as DbErrorLike;
  const message = dbError?.message?.toLowerCase() ?? "";
  return (
    message.includes("folder cannot be its own parent") ||
    message.includes("folder hierarchy cannot contain cycles")
  );
};

const isMissingParentFolderColumnError = (error: unknown): boolean => {
  const message = ((error as DbErrorLike)?.message ?? "").toLowerCase();
  return message.includes("parent_folder_id") && message.includes("column");
};

const toMediaFolderRow = (
  row: Record<string, unknown> | null | undefined,
  { parentFolderId = null }: { parentFolderId?: string | null } = {}
): MediaFolderRow | null => {
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const userId = typeof row.user_id === "string" ? row.user_id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at.trim() : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at.trim() : "";
  if (!id || !userId || !name) return null;
  return {
    id,
    user_id: userId,
    name,
    parent_folder_id:
      typeof row.parent_folder_id === "string"
        ? row.parent_folder_id.trim() || null
        : parentFolderId,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const assertOwnedFolderExists = async ({
  supabaseAdmin,
  userId,
  folderId,
  missingMessage = "Folder not found",
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  folderId: string;
  missingMessage?: string;
}): Promise<void> => {
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
    throw new Error(missingMessage);
  }
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

const toCharacterScopedMediaIdSet = async ({
  userId,
  ids,
}: {
  userId: string;
  ids: string[];
}): Promise<Set<string>> => {
  if (!ids.length) return new Set();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .select("id, storage_path")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) {
    throw new Error(error.message || "Failed to validate character-scoped media membership");
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const value = record.id;
    if (typeof value === "string" && value.trim()) {
      const storagePath = typeof record.storage_path === "string" ? record.storage_path.trim() : "";
      if (storagePath.startsWith(`${userId}/characters/`)) {
        set.add(value.trim());
      }
    }
  }
  return set;
};

/**
 * Lists custom folders for a user with explicit parent references.
 */
export const listMediaFoldersForUser = async (userId: string): Promise<MediaFolderRow[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .select(MEDIA_FOLDER_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error && !isMissingParentFolderColumnError(error)) {
    throw new Error(error.message || "Failed to list media folders");
  }
  if (!error) {
    return (data ?? []) as MediaFolderRow[];
  }

  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from("media_folders")
    .select(LEGACY_MEDIA_FOLDER_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (legacyError) {
    throw new Error(legacyError.message || "Failed to list media folders");
  }
  return (legacyData ?? [])
    .map((row) => toMediaFolderRow(row as Record<string, unknown>, { parentFolderId: null }))
    .filter((row): row is MediaFolderRow => Boolean(row));
};

/**
 * Creates a custom folder for a user.
 */
export const createMediaFolderForUser = async ({
  userId,
  name,
  parentFolderId,
}: {
  userId: string;
  name: string;
  parentFolderId: string | null;
}): Promise<MediaFolderRow> => {
  const supabaseAdmin = getSupabaseAdmin();
  if (parentFolderId) {
    if (!isCustomMediaFolderId(parentFolderId)) {
      throw new Error("Invalid parent folder id");
    }
    await assertOwnedFolderExists({
      supabaseAdmin,
      userId,
      folderId: parentFolderId,
      missingMessage: "Parent folder not found",
    });
  }
  const timestamp = new Date().toISOString();
  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    name,
    parent_folder_id: parentFolderId,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .insert(insertPayload)
    .select(MEDIA_FOLDER_SELECT_COLUMNS)
    .maybeSingle();

  if (error && !isMissingParentFolderColumnError(error)) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to create folder");
  }
  if (!error && data) {
    return data as MediaFolderRow;
  }
  if (parentFolderId) {
    throw new Error("Nested folders require the latest database migration");
  }
  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from("media_folders")
    .insert({
      user_id: userId,
      name,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(LEGACY_MEDIA_FOLDER_SELECT_COLUMNS)
    .maybeSingle();

  if (legacyError) {
    if (isUniqueViolation(legacyError)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(legacyError.message || "Failed to create folder");
  }
  const folder = toMediaFolderRow(legacyData as Record<string, unknown>, { parentFolderId: null });
  if (!folder) {
    throw new Error("Failed to create folder");
  }
  return folder;
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
    .select(MEDIA_FOLDER_SELECT_COLUMNS)
    .maybeSingle();

  if (error && !isMissingParentFolderColumnError(error)) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to rename folder");
  }
  if (!error) {
    return (data as MediaFolderRow | null) ?? null;
  }
  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from("media_folders")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select(LEGACY_MEDIA_FOLDER_SELECT_COLUMNS)
    .maybeSingle();
  if (legacyError) {
    if (isUniqueViolation(legacyError)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(legacyError.message || "Failed to rename folder");
  }
  return toMediaFolderRow(legacyData as Record<string, unknown>, { parentFolderId: null });
};

/**
 * Moves a custom folder to a new parent.
 */
export const moveMediaFolderForUser = async ({
  userId,
  folderId,
  parentFolderId,
}: {
  userId: string;
  folderId: string;
  parentFolderId: string | null;
}): Promise<MediaFolderRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!isCustomMediaFolderId(folderId)) {
    throw new Error("Invalid folder id");
  }
  if (parentFolderId != null && !isCustomMediaFolderId(parentFolderId)) {
    throw new Error("Invalid parent folder id");
  }
  if (parentFolderId === folderId) {
    throw new Error("Folder cannot be its own parent");
  }

  const { data: folderRow, error: folderError } = await supabaseAdmin
    .from("media_folders")
    .select("id, parent_folder_id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (folderError) {
    if (isMissingParentFolderColumnError(folderError)) {
      throw new Error("Nested folders require the latest database migration");
    }
    throw new Error(folderError.message || "Failed to load folder");
  }
  if (!folderRow) {
    return null;
  }
  const currentParentFolderId =
    typeof (folderRow as Record<string, unknown>).parent_folder_id === "string"
      ? ((folderRow as Record<string, unknown>).parent_folder_id as string).trim() || null
      : null;
  if (currentParentFolderId === parentFolderId) {
    const { data: existingRow, error: existingError } = await supabaseAdmin
      .from("media_folders")
      .select(MEDIA_FOLDER_SELECT_COLUMNS)
      .eq("id", folderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      throw new Error(existingError.message || "Failed to load folder");
    }
    return (existingRow as MediaFolderRow | null) ?? null;
  }

  if (parentFolderId) {
    await assertOwnedFolderExists({
      supabaseAdmin,
      userId,
      folderId: parentFolderId,
      missingMessage: "Parent folder not found",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("media_folders")
    .update({
      parent_folder_id: parentFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select(MEDIA_FOLDER_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    if (isHierarchyConflict(error)) {
      throw new Error("Invalid folder hierarchy");
    }
    throw new Error(error.message || "Failed to move folder");
  }

  return (data as MediaFolderRow | null) ?? null;
};

/**
 * Deletes a custom folder owned by the user.
 * Descendant folders cascade through the parent hierarchy FK.
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
  const { action, mediaIds, promptIds, userId } = input;
  const fallbackFolderId = input.folderId?.trim() ?? "";
  const sourceFolderId =
    action === "move" ? (input.sourceFolderId?.trim() ?? "") : fallbackFolderId;
  const targetFolderId =
    action === "move" ? (input.targetFolderId?.trim() ?? "") : fallbackFolderId;
  const supabaseAdmin = getSupabaseAdmin();

  const listExistingMembershipIds = async (
    table: "media_folder_media_items" | "media_folder_prompt_items",
    idColumn: "media_file_id" | "prompt_id",
    folderId: string,
    ids: string[]
  ): Promise<Set<string>> => {
    if (!ids.length) return new Set();
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(idColumn)
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .in(idColumn, ids);
    if (error) {
      throw new Error(error.message || `Failed to load ${table} memberships`);
    }
    const existing = new Set<string>();
    for (const row of data ?? []) {
      const value = (row as Record<string, unknown>)[idColumn];
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (!normalized) continue;
      existing.add(normalized);
    }
    return existing;
  };

  if (!sourceFolderId || !targetFolderId) {
    throw new Error("Invalid folder id");
  }
  if (
    sourceFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID ||
    targetFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID
  ) {
    throw new Error("Invalid folder id");
  }
  if (action === "move" && sourceFolderId === targetFolderId) {
    return {
      action,
      folderId: null,
      sourceFolderId,
      targetFolderId,
      mediaAssigned: 0,
      mediaUnassigned: 0,
      promptsAssigned: 0,
      promptsUnassigned: 0,
      mediaDuplicates: 0,
      promptDuplicates: 0,
      mediaSkipped: mediaIds.length,
      promptSkipped: promptIds.length,
    };
  }

  await assertOwnedFolderExists({ supabaseAdmin, userId, folderId: sourceFolderId });
  if (targetFolderId !== sourceFolderId) {
    await assertOwnedFolderExists({ supabaseAdmin, userId, folderId: targetFolderId });
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
  if (mediaIds.length) {
    const characterScopedMediaIds = await toCharacterScopedMediaIdSet({
      userId,
      ids: mediaIds,
    });
    if (characterScopedMediaIds.size > 0) {
      throw new Error("Character-scoped media ids are not allowed in media-library folders");
    }
  }

  let mediaAssigned = 0;
  let mediaUnassigned = 0;
  let promptsAssigned = 0;
  let promptsUnassigned = 0;
  let mediaDuplicates = 0;
  let promptDuplicates = 0;
  let mediaSkipped = 0;
  let promptSkipped = 0;

  if (action === "assign" || action === "move") {
    if (mediaIds.length) {
      const existingTargetMedia = await listExistingMembershipIds(
        "media_folder_media_items",
        "media_file_id",
        targetFolderId,
        mediaIds
      );
      mediaDuplicates = existingTargetMedia.size;
      const mediaIdsToAssign = mediaIds.filter((id) => !existingTargetMedia.has(id));
      if (mediaIdsToAssign.length) {
        const mediaRows = mediaIdsToAssign.map((mediaFileId) => ({
          folder_id: targetFolderId,
          media_file_id: mediaFileId,
          user_id: userId,
        }));
        const { error } = await supabaseAdmin
          .from("media_folder_media_items")
          .upsert(mediaRows, { onConflict: "folder_id,media_file_id" });
        if (error) {
          throw new Error(error.message || "Failed to assign media items");
        }
        mediaAssigned = mediaIdsToAssign.length;
      }
    }

    if (promptIds.length) {
      const existingTargetPrompts = await listExistingMembershipIds(
        "media_folder_prompt_items",
        "prompt_id",
        targetFolderId,
        promptIds
      );
      promptDuplicates = existingTargetPrompts.size;
      const promptIdsToAssign = promptIds.filter((id) => !existingTargetPrompts.has(id));
      if (promptIdsToAssign.length) {
        const promptRows = promptIdsToAssign.map((promptId) => ({
          folder_id: targetFolderId,
          prompt_id: promptId,
          user_id: userId,
        }));
        const { error } = await supabaseAdmin
          .from("media_folder_prompt_items")
          .upsert(promptRows, { onConflict: "folder_id,prompt_id" });
        if (error) {
          throw new Error(error.message || "Failed to assign prompt items");
        }
        promptsAssigned = promptIdsToAssign.length;
      }
    }
  }

  if (action === "unassign" || action === "move") {
    const unassignFolderId = action === "move" ? sourceFolderId : targetFolderId;

    if (mediaIds.length) {
      const existingSourceMedia = await listExistingMembershipIds(
        "media_folder_media_items",
        "media_file_id",
        unassignFolderId,
        mediaIds
      );
      const { error, count } = await supabaseAdmin
        .from("media_folder_media_items")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("folder_id", unassignFolderId)
        .in("media_file_id", mediaIds);
      if (error) {
        throw new Error(error.message || "Failed to unassign media items");
      }
      mediaUnassigned = count ?? 0;
      mediaSkipped = Math.max(0, mediaIds.length - existingSourceMedia.size);
    }

    if (promptIds.length) {
      const existingSourcePrompts = await listExistingMembershipIds(
        "media_folder_prompt_items",
        "prompt_id",
        unassignFolderId,
        promptIds
      );
      const { error, count } = await supabaseAdmin
        .from("media_folder_prompt_items")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("folder_id", unassignFolderId)
        .in("prompt_id", promptIds);
      if (error) {
        throw new Error(error.message || "Failed to unassign prompt items");
      }
      promptsUnassigned = count ?? 0;
      promptSkipped = Math.max(0, promptIds.length - existingSourcePrompts.size);
    }
  }

  return {
    action,
    folderId: action === "move" ? null : targetFolderId,
    sourceFolderId: action === "move" ? sourceFolderId : null,
    targetFolderId: action === "move" ? targetFolderId : null,
    mediaAssigned,
    mediaUnassigned,
    promptsAssigned,
    promptsUnassigned,
    mediaDuplicates,
    promptDuplicates,
    mediaSkipped,
    promptSkipped,
  };
};
