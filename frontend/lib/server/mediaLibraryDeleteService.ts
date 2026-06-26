/**
 * Server-owned Media Library delete service.
 * Owns media row deletion, associated storage cleanup, and generated-audio hidden asset cleanup.
 */
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { cleanupAudioCompanionArt } from "./audioCompanionArt/cleanup";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const MEDIA_BUCKET = "media_library";
const STORAGE_DELETE_BATCH_SIZE = 100;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type MediaDeleteRow = {
  id?: unknown;
  storage_path?: unknown;
  file_type?: unknown;
  source?: unknown;
  source_ref?: unknown;
  thumb_variant_path?: unknown;
  poster_variant_path?: unknown;
  preview_variant_path?: unknown;
};

type MediaVariantPathRow = {
  storage_path?: unknown;
};

export type DeleteMediaFileForUserResult = {
  deletedMediaId: string;
  deletedStoragePaths: string[];
  cleanedGeneratedAudioCompanionArt: boolean;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isAudioFileType = (value: unknown): boolean =>
  typeof value === "string" && value.trim().toLowerCase().startsWith("audio");

const toUserScopedPath = (value: unknown, userId: string): string | null => {
  const path = asTrimmedString(value);
  if (!path) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path,
      userId,
      label: "Media Library delete path",
    });
  } catch {
    return null;
  }
};

const collectMediaStoragePathsForServerDelete = async ({
  mediaId,
  mediaRow,
  userId,
  supabaseAdmin,
}: {
  mediaId: string;
  mediaRow: MediaDeleteRow;
  userId: string;
  supabaseAdmin: SupabaseAdmin;
}): Promise<string[]> => {
  const paths = [
    mediaRow.storage_path,
    mediaRow.thumb_variant_path,
    mediaRow.poster_variant_path,
    mediaRow.preview_variant_path,
  ]
    .map((value) => toUserScopedPath(value, userId))
    .filter((value): value is string => Boolean(value));

  const { data, error } = await supabaseAdmin
    .from("media_asset_variants")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("media_file_id", mediaId);
  if (!error && Array.isArray(data)) {
    data.forEach((row) => {
      const scopedPath = toUserScopedPath((row as MediaVariantPathRow).storage_path, userId);
      if (scopedPath) paths.push(scopedPath);
    });
  }

  return Array.from(new Set(paths));
};

const removeStoragePaths = async ({
  paths,
  supabaseAdmin,
}: {
  paths: string[];
  supabaseAdmin: SupabaseAdmin;
}): Promise<string[]> => {
  const deletedPaths: string[] = [];
  for (let start = 0; start < paths.length; start += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(start, start + STORAGE_DELETE_BATCH_SIZE);
    const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(batch);
    if (error) throw new Error(error.message || "Failed to remove media storage.");
    deletedPaths.push(...batch);
  }
  return deletedPaths;
};

export const deleteMediaFileForUser = async ({
  userId,
  mediaFileId,
  supabaseAdmin,
}: {
  userId: string;
  mediaFileId: string;
  supabaseAdmin?: SupabaseAdmin;
}): Promise<DeleteMediaFileForUserResult> => {
  const normalizedUserId = asTrimmedString(userId);
  const normalizedMediaFileId = asTrimmedString(mediaFileId);
  if (!normalizedUserId || !normalizedMediaFileId) {
    throw new Error("Missing required media delete fields.");
  }

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const { data: mediaData, error: mediaError } = await adminClient
    .from("media_files")
    .select(
      "id, storage_path, file_type, source, source_ref, thumb_variant_path, poster_variant_path, preview_variant_path"
    )
    .eq("id", normalizedMediaFileId)
    .eq("user_id", normalizedUserId)
    .limit(1)
    .maybeSingle();
  if (mediaError) throw new Error(mediaError.message || "Failed to load media.");
  const mediaRow = (mediaData as MediaDeleteRow | null) ?? null;
  if (!mediaRow?.id) throw new Error("Unable to delete media.");

  const deletePaths = await collectMediaStoragePathsForServerDelete({
    mediaId: normalizedMediaFileId,
    mediaRow,
    userId: normalizedUserId,
    supabaseAdmin: adminClient,
  });

  const { data: deletedRow, error: deleteError } = await adminClient
    .from("media_files")
    .delete()
    .eq("id", normalizedMediaFileId)
    .eq("user_id", normalizedUserId)
    .select("id")
    .maybeSingle();
  if (deleteError) throw new Error(deleteError.message || "Failed to delete media.");
  const deletedMediaId = asTrimmedString((deletedRow as { id?: unknown } | null)?.id);
  if (!deletedMediaId) throw new Error("Unable to delete media.");

  let deletedStoragePaths: string[] = [];
  try {
    deletedStoragePaths = await removeStoragePaths({
      paths: deletePaths,
      supabaseAdmin: adminClient,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.media_library.delete_storage_cleanup_failed",
      message: "Media Library storage cleanup failed after media row deletion.",
      userId: normalizedUserId,
      statusCode: 200,
      metadata: {
        media_file_id: normalizedMediaFileId,
        storage_paths: deletePaths,
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }

  let cleanedGeneratedAudioCompanionArt = false;
  const generationId = asTrimmedString(mediaRow.source_ref);
  if (
    asTrimmedString(mediaRow.source) === "ai_studio" &&
    generationId &&
    isAudioFileType(mediaRow.file_type)
  ) {
    await cleanupAudioCompanionArt({
      generationId,
      userId: normalizedUserId,
      clearProjection: true,
      supabaseAdmin: adminClient,
    });
    cleanedGeneratedAudioCompanionArt = true;
  }

  return {
    deletedMediaId,
    deletedStoragePaths,
    cleanedGeneratedAudioCompanionArt,
  };
};
