/**
 * Shared media move service for API routes.
 * Executes storage + metadata move with ownership checks and split-brain rollback.
 */
import {
  buildMovedStoragePath,
  getMediaDataTabForRow,
  resolveSourceForDataTab,
  type MediaDataTab,
  type MediaMoveDestination,
  validateMoveDestination,
} from "../../features/media-library/logic/mediaMoveRouting";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

export type MediaFileRow = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source: string | null;
  source_ref: string | null;
  prompt_id: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
  created_at: string;
  updated_at: string;
};

export type MoveMediaServiceSuccess = {
  file: MediaFileRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
  previousStoragePath: string;
  nextStoragePath: string;
};

export type MoveMediaServiceFailure = {
  status: number;
  error: string;
  details?: string;
};

export type MoveMediaServiceResult =
  | {
      ok: true;
      value: MoveMediaServiceSuccess;
    }
  | {
      ok: false;
      value: MoveMediaServiceFailure;
    };

const MEDIA_BUCKET = "media_library";

const MEDIA_FILE_SELECT =
  "id, user_id, filename, storage_path, file_type, source, source_ref, prompt_id, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at, updated_at";

/**
 * Returns true when the provided tab value is a valid media data tab.
 */
export const isMediaDataTab = (value: string): value is MediaDataTab =>
  value === "uploaded_images" ||
  value === "uploaded_videos" ||
  value === "private" ||
  value === "ai_generations";

/**
 * Moves a user-owned media file to a destination tab.
 */
export const moveMediaFileForUser = async ({
  userId,
  fileId,
  destinationTab,
}: {
  userId: string;
  fileId: string;
  destinationTab: MediaDataTab;
}): Promise<MoveMediaServiceResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const destination: MediaMoveDestination = destinationTab;

  const { data: fileRow, error: fileError } = await supabaseAdmin
    .from("media_files")
    .select(MEDIA_FILE_SELECT)
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fileError) {
    return {
      ok: false,
      value: {
        status: 500,
        error: "Failed to load media file",
        details: fileError.message,
      },
    };
  }
  if (!fileRow) {
    return {
      ok: false,
      value: {
        status: 404,
        error: "Media file not found",
      },
    };
  }

  const currentTab = getMediaDataTabForRow(fileRow);
  const moveValidation = validateMoveDestination(fileRow, destination);
  if (!moveValidation.allowed) {
    return {
      ok: false,
      value: {
        status: 400,
        error: "Invalid move destination",
        details: moveValidation.reason,
      },
    };
  }

  const destinationSource = resolveSourceForDataTab(destinationTab);
  const nextStoragePath = buildMovedStoragePath(userId, fileRow, destinationTab);
  const previousStoragePath = fileRow.storage_path;

  const { error: moveStorageError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .move(previousStoragePath, nextStoragePath);

  if (moveStorageError) {
    return {
      ok: false,
      value: {
        status: 500,
        error: "Failed to move storage object",
        details: moveStorageError.message,
      },
    };
  }

  const { data: updatedRow, error: updateRowError } = await supabaseAdmin
    .from("media_files")
    .update({
      source: destinationSource,
      storage_path: nextStoragePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileRow.id)
    .eq("user_id", userId)
    .select(MEDIA_FILE_SELECT)
    .maybeSingle();

  if (updateRowError || !updatedRow) {
    await supabaseAdmin.storage.from(MEDIA_BUCKET).move(nextStoragePath, previousStoragePath);
    return {
      ok: false,
      value: {
        status: 500,
        error: "Failed to update media metadata",
        details: updateRowError?.message ?? "Missing updated media row",
      },
    };
  }

  const { error: eventError } = await supabaseAdmin.from("media_events").insert({
    user_id: userId,
    event_type: "move",
    entity_type: "media_file",
    entity_id: updatedRow.id,
    metadata: {
      from_tab: currentTab,
      to_tab: destinationTab,
      from_source: fileRow.source,
      to_source: destinationSource,
      from_storage_path: previousStoragePath,
      to_storage_path: nextStoragePath,
    },
  });
  if (eventError) {
    console.warn("[media/move] media_events insert failed", eventError.message);
  }

  return {
    ok: true,
    value: {
      file: updatedRow as MediaFileRow,
      fromTab: currentTab,
      toTab: destinationTab,
      previousStoragePath,
      nextStoragePath,
    },
  };
};
