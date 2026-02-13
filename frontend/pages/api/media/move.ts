/**
 * Moves a user-owned media file between Media Library tabs.
 * Performs storage object move + `media_files` source/path update with ownership checks.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../_utils/appErrorLogs";
import { requireApiUser } from "../_utils/auth";
import {
  isMediaDataTab,
  moveMediaFileForUser,
  type MediaFileRow,
} from "../../../lib/server/mediaMoveService";
import type { MediaDataTab } from "../../../features/media-library/logic/mediaMoveRouting";

type MoveMediaSuccessResponse = {
  file: MediaFileRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
};

type MoveMediaErrorResponse = {
  error: string;
  details?: string;
};

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
    if (!isMediaDataTab(destination)) {
      return res.status(400).json({ error: "Invalid destination tab" });
    }

    const destinationTab: MediaDataTab = destination;
    const moveResult = await moveMediaFileForUser({
      userId: user.id,
      fileId,
      destinationTab,
    });
    if (!moveResult.ok) {
      return res.status(moveResult.value.status).json({
        error: moveResult.value.error,
        details: moveResult.value.details,
      });
    }

    return res.status(200).json({
      file: moveResult.value.file as MediaFileRow,
      fromTab: moveResult.value.fromTab,
      toTab: moveResult.value.toTab,
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
