/**
 * Returns one persisted Media Library folder-canvas snapshot for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../../../../lib/server/mediaFoldersService";
import { getMediaFolderCanvasStateForUser } from "../../../../lib/server/mediaFolderCanvasService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const folderIdRaw = req.query?.folderId;
  const folderId = typeof folderIdRaw === "string" ? folderIdRaw.trim() : "";
  if (!folderId || folderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) {
    return res.status(400).json({ error: "Invalid folder id" });
  }

  try {
    const state = await getMediaFolderCanvasStateForUser({
      userId: user.id,
      folderId,
    });
    if (!state) {
      return res.status(200).json({ state: null });
    }
    return res.status(200).json({
      state: {
        folderId: state.folderId,
        schemaVersion: state.schemaVersion,
        snapshot: state.snapshot,
        saveSeq: state.saveSeq,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load folder canvas state";
    if (message === "Invalid folder id") {
      return res.status(400).json({ error: message });
    }
    if (message === "Folder not found") {
      return res.status(404).json({ error: message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/media-folder-canvas/:folderId",
      metadata: {
        user_id: user.id,
        folder_id: folderId,
      },
    });
    return res.status(500).json({ error: "Failed to load folder canvas state" });
  }
}
