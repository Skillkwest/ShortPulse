/**
 * Moves a user-owned media file between Media Library tabs.
 * Performs storage object move + `media_files` source/path update with ownership checks.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildMovedStoragePath,
  getMediaDataTabForRow,
  resolveSourceForDataTab,
  type MediaDataTab,
  type MediaMoveDestination,
  validateMoveDestination,
} from "../../../features/media-library/logic/mediaMoveRouting";
import { logApiRouteException } from "../_utils/appErrorLogs";
import { requireApiUser } from "../_utils/auth";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";

type MediaFileRow = {
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

type MoveMediaSuccessResponse = {
  file: MediaFileRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
};

type MoveMediaErrorResponse = {
  error: string;
  details?: string;
};

const MEDIA_BUCKET = "media_library";

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toRequestBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
};

const isDataTab = (value: string): value is MediaDataTab =>
  value === "uploaded_images" ||
  value === "uploaded_videos" ||
  value === "private" ||
  value === "ai_generations";

/**
 * API handler for moving a media file between library tabs.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MoveMediaSuccessResponse | MoveMediaErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const requestBody = toRequestBody(req.body);
    const fileId = asString(requestBody.fileId);
    const destination = asString(requestBody.destinationTab);
    if (!fileId || !destination) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isDataTab(destination)) {
      return res.status(400).json({ error: "Invalid destination tab" });
    }

    const destinationTab: MediaMoveDestination = destination;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: fileRow, error: fileError } = await supabaseAdmin
      .from("media_files")
      .select(
        "id, user_id, filename, storage_path, file_type, source, source_ref, prompt_id, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at, updated_at"
      )
      .eq("id", fileId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fileError) {
      return res.status(500).json({
        error: "Failed to load media file",
        details: fileError.message,
      });
    }
    if (!fileRow) {
      return res.status(404).json({ error: "Media file not found" });
    }

    const currentTab = getMediaDataTabForRow(fileRow);
    const moveValidation = validateMoveDestination(fileRow, destinationTab);
    if (!moveValidation.allowed) {
      return res.status(400).json({
        error: "Invalid move destination",
        details: moveValidation.reason,
      });
    }

    const destinationSource = resolveSourceForDataTab(destination);
    const nextStoragePath = buildMovedStoragePath(user.id, fileRow, destination);
    const previousStoragePath = fileRow.storage_path;

    const { error: moveStorageError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .move(previousStoragePath, nextStoragePath);

    if (moveStorageError) {
      return res.status(500).json({
        error: "Failed to move storage object",
        details: moveStorageError.message,
      });
    }

    const { data: updatedRow, error: updateRowError } = await supabaseAdmin
      .from("media_files")
      .update({
        source: destinationSource,
        storage_path: nextStoragePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileRow.id)
      .eq("user_id", user.id)
      .select(
        "id, user_id, filename, storage_path, file_type, source, source_ref, prompt_id, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at, updated_at"
      )
      .maybeSingle();

    if (updateRowError || !updatedRow) {
      // Attempt to reverse the storage move so we do not leave a split-brain state.
      await supabaseAdmin.storage.from(MEDIA_BUCKET).move(nextStoragePath, previousStoragePath);
      return res.status(500).json({
        error: "Failed to update media metadata",
        details: updateRowError?.message ?? "Missing updated media row",
      });
    }

    const eventPayload = {
      user_id: user.id,
      event_type: "move",
      entity_type: "media_file",
      entity_id: updatedRow.id,
      metadata: {
        from_tab: currentTab,
        to_tab: destination,
        from_source: fileRow.source,
        to_source: destinationSource,
        from_storage_path: previousStoragePath,
        to_storage_path: nextStoragePath,
      },
    };

    const { error: eventError } = await supabaseAdmin.from("media_events").insert(eventPayload);
    if (eventError) {
      console.warn("[media/move] media_events insert failed", eventError.message);
    }

    return res.status(200).json({
      file: updatedRow as MediaFileRow,
      fromTab: currentTab,
      toTab: destination,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-move",
      user,
    });

    return res.status(500).json({
      error: "Failed to move media file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
