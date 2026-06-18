/**
 * Media folder domain service.
 * Centralizes folder CRUD and membership batch operations with ownership validation.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { isCharacterScopedMediaStoragePath } from "../mediaStoragePath";

export const MEDIA_LIBRARY_ROOT_FOLDER_ID = "all_items" as const;
export const DEFAULT_MEDIA_LIBRARY_FOLDER_NAME = "New Folder" as const;

const FOLDER_NAME_MAX_LENGTH = 64;
const FOLDER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbErrorLike = { code?: string | null; message?: string | null };
type FolderItemCountRpcRow = {
  folder_id?: unknown;
  item_count?: unknown;
};
const MEDIA_FOLDER_SELECT_COLUMNS =
  "id, user_id, name, parent_folder_id, created_at, updated_at" as const;

export type MediaFolderRow = {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
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

const toNonNegativeCount = (value: unknown): number => {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

export const buildFolderItemCountMap = ({
  folderIds,
  rows,
}: {
  folderIds: string[];
  rows: unknown[] | null | undefined;
}): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const folderId of folderIds) {
    counts.set(folderId, 0);
  }
  for (const row of rows ?? []) {
    const record = row as FolderItemCountRpcRow;
    const folderId = typeof record.folder_id === "string" ? record.folder_id.trim() : "";
    if (!folderId || !counts.has(folderId)) continue;
    counts.set(folderId, toNonNegativeCount(record.item_count));
  }
  return counts;
};

const toFolderItemCountMap = async ({
  supabaseAdmin,
  userId,
  folderIds,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  folderIds: string[];
}): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  for (const folderId of folderIds) {
    counts.set(folderId, 0);
  }
  if (!folderIds.length) return counts;

  const { data, error } = await supabaseAdmin.rpc("get_media_folder_item_counts", {
    p_user_id: userId,
    p_folder_ids: folderIds,
  });
  if (error) {
    throw new Error(error.message || "Failed to load media folder item counts");
  }
  return buildFolderItemCountMap({ folderIds, rows: data as unknown[] | null | undefined });
};

const withFolderItemCount = (
  folder: Omit<MediaFolderRow, "item_count">,
  itemCount: number
): MediaFolderRow => ({
  ...folder,
  item_count: Math.max(0, Math.trunc(itemCount)),
});

const addDirectChildFolderCounts = ({
  counts,
  folders,
}: {
  counts: Map<string, number>;
  folders: Array<Pick<MediaFolderRow, "id" | "parent_folder_id">>;
}): Map<string, number> => {
  const nextCounts = new Map(counts);
  for (const folder of folders) {
    if (!folder.parent_folder_id) continue;
    nextCounts.set(folder.parent_folder_id, (nextCounts.get(folder.parent_folder_id) ?? 0) + 1);
  }
  return nextCounts;
};

const countDirectChildFoldersForUser = async ({
  supabaseAdmin,
  userId,
  folderId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  folderId: string;
}): Promise<number> => {
  const { count, error } = await supabaseAdmin
    .from("media_folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("parent_folder_id", folderId);
  if (error) {
    throw new Error(error.message || "Failed to load child folder counts");
  }
  return Math.max(0, Math.trunc(count ?? 0));
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

/**
 * Validates that one caller-owned custom folder exists.
 */
export const assertMediaFolderAccessForUser = async ({
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
  await assertOwnedFolderExists({
    supabaseAdmin,
    userId,
    folderId,
  });
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

export const listOwnedCharacterScopedMediaIds = async ({
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
      if (isCharacterScopedMediaStoragePath(storagePath, userId)) {
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

  if (error) {
    throw new Error(error.message || "Failed to list media folders");
  }
  const rows = (data ?? []) as Array<Omit<MediaFolderRow, "item_count">>;
  const membershipCounts = await toFolderItemCountMap({
    supabaseAdmin,
    userId,
    folderIds: rows.map((row) => row.id),
  });
  const counts = addDirectChildFolderCounts({ counts: membershipCounts, folders: rows });
  return rows.map((row) => withFolderItemCount(row, counts.get(row.id) ?? 0));
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

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to create folder");
  }
  if (data) {
    return withFolderItemCount(data as Omit<MediaFolderRow, "item_count">, 0);
  }
  throw new Error("Failed to create folder");
};

/**
 * Ensures a first-time user has one default root-level custom folder.
 * Media folders are user-scoped today, so this seed should run only while
 * the user has no existing custom folders.
 */
export const ensureDefaultMediaFolderForUserExists = async (
  userId: string
): Promise<MediaFolderRow | null> => {
  const existingFolders = await listMediaFoldersForUser(userId);
  if (existingFolders.length > 0) return null;
  try {
    return await createMediaFolderForUser({
      userId,
      name: DEFAULT_MEDIA_LIBRARY_FOLDER_NAME,
      parentFolderId: null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Folder name already exists") {
      return null;
    }
    throw error;
  }
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

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Folder name already exists");
    }
    throw new Error(error.message || "Failed to rename folder");
  }
  if (!data) return null;
  const counts = await toFolderItemCountMap({
    supabaseAdmin,
    userId,
    folderIds: [folderId],
  });
  const directChildFolderCount = await countDirectChildFoldersForUser({
    supabaseAdmin,
    userId,
    folderId,
  });
  return withFolderItemCount(
    data as Omit<MediaFolderRow, "item_count">,
    (counts.get(folderId) ?? 0) + directChildFolderCount
  );
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
    if (!existingRow) return null;
    const counts = await toFolderItemCountMap({
      supabaseAdmin,
      userId,
      folderIds: [folderId],
    });
    const directChildFolderCount = await countDirectChildFoldersForUser({
      supabaseAdmin,
      userId,
      folderId,
    });
    return withFolderItemCount(
      existingRow as Omit<MediaFolderRow, "item_count">,
      (counts.get(folderId) ?? 0) + directChildFolderCount
    );
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

  if (!data) return null;
  const counts = await toFolderItemCountMap({
    supabaseAdmin,
    userId,
    folderIds: [folderId],
  });
  const directChildFolderCount = await countDirectChildFoldersForUser({
    supabaseAdmin,
    userId,
    folderId,
  });
  return withFolderItemCount(
    data as Omit<MediaFolderRow, "item_count">,
    (counts.get(folderId) ?? 0) + directChildFolderCount
  );
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
    const characterScopedMediaIds = await listOwnedCharacterScopedMediaIds({
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
