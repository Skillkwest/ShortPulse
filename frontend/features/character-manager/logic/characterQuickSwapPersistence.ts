/**
 * Character Quick Swap Deck persistence.
 * Handles dynamic quick-swap read/write flows with active/archive limits and legacy fallback reads.
 */
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  CHARACTER_MANAGER_SLOT_DEFINITIONS,
  CHARACTER_QUICK_SWAP_ACTIVE_LIMIT,
} from "../constants";
import type { CharacterQuickSwapItem } from "../types";
import {
  asErrorMessage,
  cleanupOrphanedMedia,
  createCharacterMediaAsset,
  loadSlotFilesForCharacterSheet,
  resolveSupabaseContext,
} from "./characterManagerPersistenceCore";
import {
  isCharacterMediaV2ReadsEnabled,
  isCharacterMediaV2WritesEnabled,
} from "./characterMediaIsolationFlags";

const MEDIA_BUCKET = "media_library";
const CHARACTER_QUICKSWAP_SOURCE = "character_quickswap";

type QuickSwapStatus = "active" | "archived";

type QuickSwapRow = {
  id: string;
  media_file_id: string | null;
  character_media_id?: string | null;
  storage_path: string;
  status: QuickSwapStatus;
  created_at: string;
  archived_at: string | null;
};

type CharacterSheetRow = {
  id: string;
};

const isMissingRelationError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );

const isMissingColumnError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );

export type QuickSwapArchivedCursor = {
  createdAt: string;
  id: string;
};

export type QuickSwapArchivedPage = {
  items: CharacterQuickSwapItem[];
  nextCursor: QuickSwapArchivedCursor | null;
};

const sanitizeFilenameSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const inferFileExtension = (filename: string, mimeType: string): string => {
  const filenameParts = filename.trim().toLowerCase().split(".");
  if (filenameParts.length > 1) {
    const extension = filenameParts[filenameParts.length - 1]?.trim();
    if (extension) return extension.replace(/[^a-z0-9]/g, "") || "jpg";
  }

  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime.includes("png")) return "png";
  if (normalizedMime.includes("webp")) return "webp";
  if (normalizedMime.includes("avif")) return "avif";
  if (normalizedMime.includes("heic")) return "heic";
  if (normalizedMime.includes("heif")) return "heif";
  return "jpg";
};

const sanitizeFileStem = (filename: string) => {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "reference";
};

const createCharacterQuickSwapStoragePath = ({
  userId,
  characterId,
  filename,
  mimeType,
}: {
  userId: string;
  characterId: string;
  filename: string;
  mimeType: string;
}) => {
  const extension = inferFileExtension(filename, mimeType);
  const stem = sanitizeFileStem(filename);
  return assertUserScopedMediaStoragePath({
    path: `${userId}/characters/${characterId}/quickswap/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`,
    userId,
    label: "Character quick swap storage path",
  });
};

const sortByCreatedDesc = <T extends { createdAt: string; id: string }>(rows: T[]): T[] =>
  [...rows].sort((left, right) => {
    const createdDiff = right.createdAt.localeCompare(left.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return right.id.localeCompare(left.id);
  });

const buildArchivedCursorFilter = (cursor: QuickSwapArchivedCursor): string | null => {
  const createdAt = cursor.createdAt.trim();
  const id = cursor.id.trim();
  if (!createdAt || !id) return null;
  // Preserve deterministic DESC pagination when multiple rows share created_at.
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
};

const hydrateQuickSwapRows = async (rows: QuickSwapRow[]): Promise<CharacterQuickSwapItem[]> => {
  if (!rows.length) return [];
  const v2ReadsEnabled = isCharacterMediaV2ReadsEnabled();
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths: rows.map((row) => row.storage_path),
  });
  const items: CharacterQuickSwapItem[] = [];
  for (const row of rows) {
    const previewUrl = signedByPath.get(row.storage_path) ?? null;
    if (!previewUrl) continue;
    const mediaReferenceId = (
      v2ReadsEnabled
        ? row.character_media_id?.trim() || row.media_file_id?.trim() || ""
        : row.media_file_id?.trim() || row.character_media_id?.trim() || ""
    ).trim();
    if (!mediaReferenceId) continue;
    items.push({
      id: row.id,
      mediaFileId: mediaReferenceId,
      storagePath: row.storage_path,
      previewUrl,
      status: row.status,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
      legacySlotKey: null,
    });
  }
  return items;
};

const fetchQuickSwapRows = async (
  characterId: string,
  status: QuickSwapStatus,
  limit: number
): Promise<QuickSwapRow[]> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const safeLimit = Math.max(1, Math.min(limit, 2000));
  let data: unknown[] | null = null;
  let error: unknown = null;
  const nextRowsResponse = await supabase
    .from("character_quick_swap_items")
    .select("id, media_file_id, character_media_id, storage_path, status, created_at, archived_at")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);
  data = nextRowsResponse.data ?? null;
  error = nextRowsResponse.error ?? null;
  if (error && isMissingColumnError(error)) {
    const legacyRowsResponse = await supabase
      .from("character_quick_swap_items")
      .select("id, media_file_id, storage_path, status, created_at, archived_at")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(safeLimit);
    data = legacyRowsResponse.data ?? null;
    error = legacyRowsResponse.error ?? null;
  }
  if (error && !isMissingRelationError(error)) {
    throw new Error(asErrorMessage(error, "Failed to load quick swap references."));
  }
  if (error && isMissingRelationError(error)) {
    return [];
  }
  return (data ?? []) as QuickSwapRow[];
};

const countQuickSwapRows = async (
  characterId: string,
  status: QuickSwapStatus
): Promise<number> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { count, error } = await supabase
    .from("character_quick_swap_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .eq("status", status);
  if (error && !isMissingRelationError(error)) {
    throw new Error(asErrorMessage(error, "Failed to count quick swap references."));
  }
  if (error && isMissingRelationError(error)) {
    return 0;
  }
  return Number(count ?? 0);
};

const archiveOverflowForCharacter = async (
  characterId: string,
  keepCount = CHARACTER_QUICK_SWAP_ACTIVE_LIMIT
) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("character_quick_swap_items")
    .select("id")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error && !isMissingRelationError(error)) {
    throw new Error(asErrorMessage(error, "Failed to enforce quick swap limits."));
  }
  if (error && isMissingRelationError(error)) {
    return;
  }
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length <= keepCount) return;
  const overflowIds = rows.slice(keepCount).map((row) => row.id);
  if (!overflowIds.length) return;

  const { error: archiveError } = await supabase
    .from("character_quick_swap_items")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .in("id", overflowIds);
  if (archiveError && !isMissingRelationError(archiveError)) {
    throw new Error(asErrorMessage(archiveError, "Failed to archive quick swap overflow."));
  }
};

const getLatestCharacterSheetId = async (characterId: string): Promise<string | null> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("character_reference_packs")
    .select("id")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to resolve fallback quick swap references."));
  }
  return ((data as CharacterSheetRow | null)?.id ?? null) as string | null;
};

const loadLegacyQuickSwapFallback = async (
  characterId: string
): Promise<CharacterQuickSwapItem[]> => {
  const characterSheetId = await getLatestCharacterSheetId(characterId);
  if (!characterSheetId) return [];
  const slots = await loadSlotFilesForCharacterSheet(characterSheetId);

  const legacyItems: CharacterQuickSwapItem[] = [];
  for (const slot of CHARACTER_MANAGER_SLOT_DEFINITIONS) {
    const slotFile = slots[slot.key];
    if (!slotFile) continue;
    legacyItems.push({
      id: `legacy:${characterSheetId}:${slot.key}`,
      mediaFileId: slotFile.mediaFileId,
      storagePath: slotFile.storagePath,
      previewUrl: slotFile.previewUrl,
      status: "active",
      createdAt: slotFile.updatedAt,
      archivedAt: null,
      legacySlotKey: slot.key,
    });
  }
  return sortByCreatedDesc(legacyItems);
};

const parseLegacyQuickSwapId = (
  itemId: string
): { characterSheetId: string; slotKey: string } | null => {
  if (!itemId.startsWith("legacy:")) return null;
  const parts = itemId.split(":");
  if (parts.length !== 3) return null;
  const characterSheetId = parts[1]?.trim();
  const slotKey = parts[2]?.trim();
  if (!characterSheetId || !slotKey) return null;
  return { characterSheetId, slotKey };
};

const removeLegacyQuickSwapItem = async (itemId: string) => {
  const parsed = parseLegacyQuickSwapId(itemId);
  if (!parsed) return false;
  const { supabase, userId } = await resolveSupabaseContext();

  const { data: existingRow, error: existingError } = await supabase
    .from("character_reference_images")
    .select("id, media_file_id, character_media_id, storage_path")
    .eq("user_id", userId)
    .eq("character_sheet_id", parsed.characterSheetId)
    .eq("slot_key", parsed.slotKey)
    .maybeSingle();
  if (existingError) {
    throw new Error(asErrorMessage(existingError, "Failed to load legacy quick swap item."));
  }
  if (!existingRow) return true;

  const { error: deleteError } = await supabase
    .from("character_reference_images")
    .delete()
    .eq("id", existingRow.id)
    .eq("user_id", userId);
  if (deleteError) {
    throw new Error(asErrorMessage(deleteError, "Failed to remove legacy quick swap item."));
  }
  const mediaReferenceId = (
    existingRow.character_media_id?.trim() ||
    existingRow.media_file_id?.trim() ||
    ""
  ).trim();
  if (!mediaReferenceId) return true;

  await cleanupOrphanedMedia({
    mediaFileId: mediaReferenceId,
    storagePath: existingRow.storage_path ?? null,
  });
  return true;
};

const validateQuickSwapFiles = (files: File[]) => {
  for (const file of files) {
    if (!file.type.toLowerCase().startsWith("image/")) {
      throw new Error("Only image files are supported in QuickSwap Deck.");
    }
    if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
      throw new Error("One or more images exceed the maximum allowed file size.");
    }
  }
};

/**
 * Lists active quick swap items. Falls back to legacy fixed slots when no v2 rows exist.
 */
export const listQuickSwapActive = async (
  characterId: string,
  options?: { limit?: number; includeLegacyFallback?: boolean }
): Promise<CharacterQuickSwapItem[]> => {
  const trimmedCharacterId = characterId.trim();
  if (!trimmedCharacterId) return [];

  const rows = await fetchQuickSwapRows(
    trimmedCharacterId,
    "active",
    options?.limit ?? CHARACTER_QUICK_SWAP_ACTIVE_LIMIT
  );
  if (rows.length) {
    return hydrateQuickSwapRows(rows);
  }
  if (options?.includeLegacyFallback === false) {
    return [];
  }
  return loadLegacyQuickSwapFallback(trimmedCharacterId);
};

/**
 * Counts archived quick swap items.
 */
export const countQuickSwapArchived = async (characterId: string): Promise<number> => {
  const trimmedCharacterId = characterId.trim();
  if (!trimmedCharacterId) return 0;
  return countQuickSwapRows(trimmedCharacterId, "archived");
};

/**
 * Lists archived quick swap items using created_at/id cursor pagination.
 */
export const listQuickSwapArchived = async (
  characterId: string,
  options?: { cursor?: QuickSwapArchivedCursor | null; pageSize?: number }
): Promise<QuickSwapArchivedPage> => {
  const trimmedCharacterId = characterId.trim();
  if (!trimmedCharacterId) {
    return { items: [], nextCursor: null };
  }
  const { supabase, userId } = await resolveSupabaseContext();
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? 40, 200));
  const fetchSize = pageSize + 1;

  let query = supabase
    .from("character_quick_swap_items")
    .select("id, media_file_id, character_media_id, storage_path, status, created_at, archived_at")
    .eq("user_id", userId)
    .eq("character_id", trimmedCharacterId)
    .eq("status", "archived")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(fetchSize);

  const cursor = options?.cursor;
  const cursorFilter = cursor ? buildArchivedCursorFilter(cursor) : null;
  if (cursorFilter) {
    query = query.or(cursorFilter);
  }

  let data: unknown[] | null = null;
  let error: unknown = null;
  const nextRowsResponse = await query;
  data = nextRowsResponse.data ?? null;
  error = nextRowsResponse.error ?? null;
  if (error && isMissingColumnError(error)) {
    const legacyQuery = supabase
      .from("character_quick_swap_items")
      .select("id, media_file_id, storage_path, status, created_at, archived_at")
      .eq("user_id", userId)
      .eq("character_id", trimmedCharacterId)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(fetchSize);
    const nextCursorFilter = options?.cursor ? buildArchivedCursorFilter(options.cursor) : null;
    const legacyRowsResponse = nextCursorFilter
      ? await legacyQuery.or(nextCursorFilter)
      : await legacyQuery;
    data = legacyRowsResponse.data ?? null;
    error = legacyRowsResponse.error ?? null;
  }
  if (error && !isMissingRelationError(error)) {
    throw new Error(asErrorMessage(error, "Failed to load archived quick swap references."));
  }
  if (error && isMissingRelationError(error)) {
    return { items: [], nextCursor: null };
  }
  const rows = (data ?? []) as QuickSwapRow[];
  const pageRows = rows.slice(0, pageSize);
  const items = await hydrateQuickSwapRows(pageRows);
  const nextRow = rows.length > pageSize ? rows[pageSize] : null;
  const nextCursor = nextRow
    ? {
        createdAt: nextRow.created_at,
        id: nextRow.id,
      }
    : null;
  return {
    items,
    nextCursor,
  };
};

/**
 * Uploads and appends files to the quick swap deck, then archives overflow beyond the active cap.
 */
export const appendQuickSwapFiles = async ({
  characterId,
  files,
}: {
  characterId: string;
  files: File[];
}): Promise<void> => {
  const trimmedCharacterId = characterId.trim();
  if (!trimmedCharacterId || !files.length) return;
  validateQuickSwapFiles(files);

  const { supabase, userId } = await resolveSupabaseContext();
  const characterMediaWritesEnabled = isCharacterMediaV2WritesEnabled();

  for (const file of files) {
    const mimeType = file.type || "image/jpeg";
    const safeName = sanitizeFilenameSegment(file.name) || "reference-image";
    const storagePath = createCharacterQuickSwapStoragePath({
      userId,
      characterId: trimmedCharacterId,
      filename: safeName,
      mimeType,
    });

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, file, {
        upsert: false,
        contentType: mimeType,
      });
    if (uploadError) {
      throw new Error(asErrorMessage(uploadError, "Failed to upload quick swap image."));
    }

    let mediaReferenceId: string;
    if (characterMediaWritesEnabled) {
      try {
        const createdAsset = await createCharacterMediaAsset({
          userId,
          characterId: trimmedCharacterId,
          assetKind: "quickswap",
          storagePath,
          filename: file.name,
          fileType: "image",
          fileSize: file.size,
          metadata: {
            role: "character_quickswap",
          },
        });
        mediaReferenceId = createdAsset.id;
      } catch (nextError) {
        await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
        throw new Error(asErrorMessage(nextError, "Failed to save quick swap image metadata."));
      }
    } else {
      const { data: mediaRow, error: mediaError } = await supabase
        .from("media_files")
        .insert({
          user_id: userId,
          filename: file.name,
          storage_path: storagePath,
          file_type: "image",
          file_size: file.size,
          source: CHARACTER_QUICKSWAP_SOURCE,
          metadata: {
            character_id: trimmedCharacterId,
          },
        })
        .select("id")
        .single();
      if (mediaError || !mediaRow?.id) {
        await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
        throw new Error(asErrorMessage(mediaError, "Failed to save quick swap image metadata."));
      }
      mediaReferenceId = mediaRow.id;
    }

    const { error: quickSwapError } = await supabase.from("character_quick_swap_items").insert({
      user_id: userId,
      character_id: trimmedCharacterId,
      media_file_id: characterMediaWritesEnabled ? null : mediaReferenceId,
      character_media_id: characterMediaWritesEnabled ? mediaReferenceId : null,
      storage_path: storagePath,
      status: "active",
      archived_at: null,
    });
    if (quickSwapError) {
      await cleanupOrphanedMedia({
        mediaFileId: mediaReferenceId,
        storagePath,
      });
      if (isMissingRelationError(quickSwapError)) {
        throw new Error(
          "QuickSwap Deck migration is missing in this environment. Apply migration 045 and retry."
        );
      }
      throw new Error(asErrorMessage(quickSwapError, "Failed to append quick swap image."));
    }
  }

  await archiveOverflowForCharacter(trimmedCharacterId, CHARACTER_QUICK_SWAP_ACTIVE_LIMIT);
};

/**
 * Attaches an existing user-owned image media row to the quick swap deck idempotently.
 * Existing archived items are restored to active; existing active items remain stable.
 */
export const appendQuickSwapExistingMediaReference = async ({
  characterId,
  mediaFileId,
}: {
  characterId: string;
  mediaFileId: string;
}): Promise<void> => {
  const trimmedCharacterId = characterId.trim();
  const trimmedMediaFileId = mediaFileId.trim();
  if (!trimmedCharacterId || !trimmedMediaFileId) return;
  if (isCharacterMediaV2WritesEnabled()) {
    throw new Error(
      "Attach-existing quick swap references are disabled when Character Media V2 writes are enabled."
    );
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const { data: mediaRow, error: mediaError } = await supabase
    .from("media_files")
    .select("id, storage_path, file_type")
    .eq("user_id", userId)
    .eq("id", trimmedMediaFileId)
    .maybeSingle();
  if (mediaError) {
    throw new Error(asErrorMessage(mediaError, "Failed to load dropped media reference."));
  }
  const typedMediaRow = mediaRow as {
    id: string;
    storage_path: string | null;
    file_type: string | null;
  } | null;
  if (!typedMediaRow?.id) {
    throw new Error("Dropped media reference is unavailable.");
  }
  const mediaFileType = (typedMediaRow.file_type ?? "").trim().toLowerCase();
  if (!mediaFileType.startsWith("image")) {
    throw new Error("Dropped media reference is not an image.");
  }
  const rawStoragePath = (typedMediaRow.storage_path ?? "").trim();
  if (!rawStoragePath) {
    throw new Error("Dropped media reference is missing storage metadata.");
  }
  const storagePath = assertUserScopedMediaStoragePath({
    path: rawStoragePath,
    userId,
    label: "Dropped quick swap media storage path",
  });

  const { data: existingRow, error: existingError } = await supabase
    .from("character_quick_swap_items")
    .select("id")
    .eq("user_id", userId)
    .eq("character_id", trimmedCharacterId)
    .eq("media_file_id", typedMediaRow.id)
    .maybeSingle();
  if (existingError) {
    if (isMissingRelationError(existingError)) {
      throw new Error(
        "QuickSwap Deck migration is missing in this environment. Apply migration 045 and retry."
      );
    }
    throw new Error(asErrorMessage(existingError, "Failed to append quick swap image."));
  }
  if (existingRow?.id) {
    const { error: reactivateError } = await supabase
      .from("character_quick_swap_items")
      .update({
        status: "active",
        archived_at: null,
        storage_path: storagePath,
      })
      .eq("id", existingRow.id)
      .eq("user_id", userId)
      .eq("character_id", trimmedCharacterId);
    if (reactivateError) {
      throw new Error(asErrorMessage(reactivateError, "Failed to append quick swap image."));
    }
  } else {
    const { error: insertError } = await supabase.from("character_quick_swap_items").insert({
      user_id: userId,
      character_id: trimmedCharacterId,
      media_file_id: typedMediaRow.id,
      storage_path: storagePath,
      status: "active",
      archived_at: null,
    });
    if (insertError) {
      if (isMissingRelationError(insertError)) {
        throw new Error(
          "QuickSwap Deck migration is missing in this environment. Apply migration 045 and retry."
        );
      }
      throw new Error(asErrorMessage(insertError, "Failed to append quick swap image."));
    }
  }

  await archiveOverflowForCharacter(trimmedCharacterId, CHARACTER_QUICK_SWAP_ACTIVE_LIMIT);
};

/**
 * Removes a quick swap item and cleans orphaned media when no longer referenced.
 */
export const removeQuickSwapItem = async ({
  characterId,
  itemId,
}: {
  characterId: string;
  itemId: string;
}): Promise<void> => {
  const trimmedCharacterId = characterId.trim();
  const trimmedItemId = itemId.trim();
  if (!trimmedCharacterId || !trimmedItemId) return;

  if (trimmedItemId.startsWith("legacy:")) {
    await removeLegacyQuickSwapItem(trimmedItemId);
    return;
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingError } = await supabase
    .from("character_quick_swap_items")
    .select("id, media_file_id, character_media_id, storage_path")
    .eq("user_id", userId)
    .eq("character_id", trimmedCharacterId)
    .eq("id", trimmedItemId)
    .maybeSingle();
  if (existingError && !isMissingRelationError(existingError)) {
    throw new Error(asErrorMessage(existingError, "Failed to load quick swap item."));
  }
  if (existingError && isMissingRelationError(existingError)) {
    return;
  }
  if (!existingRow) return;

  const { error: deleteError } = await supabase
    .from("character_quick_swap_items")
    .delete()
    .eq("user_id", userId)
    .eq("character_id", trimmedCharacterId)
    .eq("id", trimmedItemId);
  if (deleteError && !isMissingRelationError(deleteError)) {
    throw new Error(asErrorMessage(deleteError, "Failed to remove quick swap item."));
  }
  if (deleteError && isMissingRelationError(deleteError)) {
    return;
  }
  const mediaReferenceId = (
    existingRow.character_media_id?.trim() ||
    existingRow.media_file_id?.trim() ||
    ""
  ).trim();
  if (!mediaReferenceId) return;

  await cleanupOrphanedMedia({
    mediaFileId: mediaReferenceId,
    storagePath: existingRow.storage_path,
  });
};

/**
 * Restores an archived item and enforces active cap by archiving oldest active overflow.
 */
export const restoreQuickSwapItem = async ({
  characterId,
  itemId,
}: {
  characterId: string;
  itemId: string;
}): Promise<void> => {
  const trimmedCharacterId = characterId.trim();
  const trimmedItemId = itemId.trim();
  if (!trimmedCharacterId || !trimmedItemId || trimmedItemId.startsWith("legacy:")) return;

  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase
    .from("character_quick_swap_items")
    .update({ status: "active", archived_at: null })
    .eq("user_id", userId)
    .eq("character_id", trimmedCharacterId)
    .eq("id", trimmedItemId)
    .eq("status", "archived");
  if (error && !isMissingRelationError(error)) {
    throw new Error(asErrorMessage(error, "Failed to restore archived quick swap item."));
  }
  if (error && isMissingRelationError(error)) {
    return;
  }

  await archiveOverflowForCharacter(trimmedCharacterId, CHARACTER_QUICK_SWAP_ACTIVE_LIMIT);
};
