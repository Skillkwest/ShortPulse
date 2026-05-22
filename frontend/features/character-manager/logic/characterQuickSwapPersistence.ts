/**
 * Character Quick Swap Deck persistence.
 * Handles canonical character-owned quick-swap flows backed by quick-swap rows.
 */
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { CHARACTER_MANAGER_MAX_IMAGE_BYTES, CHARACTER_QUICK_SWAP_ACTIVE_LIMIT } from "../constants";
import type { CharacterQuickSwapItem } from "../types";
import {
  asErrorMessage,
  cleanupOrphanedMedia,
  createCharacterMediaAsset,
  resolveSupabaseContext,
} from "./characterManagerPersistenceCore";

const MEDIA_BUCKET = "media_library";

type QuickSwapStatus = "active" | "archived";

type QuickSwapRow = {
  id: string;
  character_media_id: string | null;
  storage_path: string;
  status: QuickSwapStatus;
  created_at: string;
  archived_at: string | null;
};

type MediaFilePreviewRow = {
  id: string;
  filename: string | null;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
};

const isMissingRelationError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
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

const buildArchivedCursorFilter = (cursor: QuickSwapArchivedCursor): string | null => {
  const createdAt = cursor.createdAt.trim();
  const id = cursor.id.trim();
  if (!createdAt || !id) return null;
  // Preserve deterministic DESC pagination when multiple rows share created_at.
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
};

const resolveQuickSwapPreviewPathCandidates = (
  mediaRow: MediaFilePreviewRow | null | undefined,
  fallbackStoragePath: string,
  userId: string
): string[] => {
  const fallbackPath = fallbackStoragePath.trim();
  if (!mediaRow) return fallbackPath ? [fallbackPath] : [];
  const candidates = resolveMediaSigningStoragePaths(mediaRow, userId);
  if (!fallbackPath || candidates.includes(fallbackPath)) return candidates;
  return [...candidates, fallbackPath];
};

const hydrateQuickSwapRows = async (rows: QuickSwapRow[]): Promise<CharacterQuickSwapItem[]> => {
  if (!rows.length) return [];
  const { supabase, userId } = await resolveSupabaseContext();
  const mediaIds = Array.from(
    new Set(
      rows
        .map((row) => row.character_media_id?.trim() ?? "")
        .filter((value): value is string => Boolean(value))
    )
  );
  const mediaRowById = new Map<string, MediaFilePreviewRow>();
  if (mediaIds.length) {
    const { data: mediaRows, error: mediaRowsError } = await supabase
      .from("character_media_assets")
      .select("id, filename, storage_path, file_type, file_size, created_at")
      .eq("user_id", userId)
      .in("id", mediaIds);
    if (mediaRowsError) {
      throw new Error(asErrorMessage(mediaRowsError, "Failed to load quick swap media assets."));
    }
    for (const row of (mediaRows ?? []) as MediaFilePreviewRow[]) {
      mediaRowById.set(row.id, row);
    }
  }
  const previewPathCandidatesByItemId = new Map<string, string[]>();
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths: rows.flatMap((row) => {
      const mediaRow = row.character_media_id?.trim()
        ? mediaRowById.get(row.character_media_id.trim())
        : null;
      const previewPaths = resolveQuickSwapPreviewPathCandidates(
        mediaRow ?? null,
        row.storage_path,
        userId
      );
      previewPathCandidatesByItemId.set(row.id, previewPaths);
      return previewPaths;
    }),
    surface: "character-grid",
  });
  const items: CharacterQuickSwapItem[] = [];
  for (const row of rows) {
    const previewPathCandidates = previewPathCandidatesByItemId.get(row.id) ?? [];
    const previewStoragePath =
      previewPathCandidates.find((path) => Boolean(signedByPath.get(path))) ??
      previewPathCandidates[0] ??
      row.storage_path;
    const previewUrl = signedByPath.get(previewStoragePath) ?? null;
    if (!previewUrl) continue;
    const mediaReferenceId = row.character_media_id?.trim() ?? "";
    if (!mediaReferenceId) continue;
    items.push({
      id: row.id,
      characterMediaId: mediaReferenceId,
      storagePath: row.storage_path,
      previewStoragePath,
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
  const nextRowsResponse = await supabase
    .from("character_quick_swap_items")
    .select("id, character_media_id, storage_path, status, created_at, archived_at")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);
  const data = nextRowsResponse.data ?? null;
  const error = nextRowsResponse.error ?? null;
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
 * Lists active quick swap items.
 */
export const listQuickSwapActive = async (
  characterId: string,
  options?: { limit?: number }
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
  return [];
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
    .select("id, character_media_id, storage_path, status, created_at, archived_at")
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

  const nextRowsResponse = await query;
  const data = nextRowsResponse.data ?? null;
  const error = nextRowsResponse.error ?? null;
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

    const { error: quickSwapError } = await supabase.from("character_quick_swap_items").insert({
      user_id: userId,
      character_id: trimmedCharacterId,
      character_media_id: mediaReferenceId,
      storage_path: storagePath,
      status: "active",
      archived_at: null,
    });
    if (quickSwapError) {
      await cleanupOrphanedMedia({
        characterMediaId: mediaReferenceId,
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

  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingError } = await supabase
    .from("character_quick_swap_items")
    .select("id, character_media_id, storage_path")
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
  const mediaReferenceId = existingRow.character_media_id?.trim() ?? "";
  if (!mediaReferenceId) return;

  await cleanupOrphanedMedia({
    characterMediaId: mediaReferenceId,
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
  if (!trimmedCharacterId || !trimmedItemId) return;

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
