/**
 * Saves one Media Library folder-canvas snapshot for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../../../../lib/server/mediaFoldersService";
import {
  parseMediaFolderCanvasSnapshot,
  saveMediaFolderCanvasStateForUser,
} from "../../../../lib/server/mediaFolderCanvasService";

type SaveRequestBody = {
  folderId?: unknown;
  schemaVersion?: unknown;
  snapshot?: unknown;
};

const parseSchemaVersion = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 100) return null;
  return value;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as SaveRequestBody;
  const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
  if (!folderId || folderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) {
    return res.status(400).json({ error: "Invalid folder id" });
  }

  const schemaVersion = parseSchemaVersion(body.schemaVersion);
  if (schemaVersion === null) {
    return res.status(400).json({ error: "Invalid schemaVersion" });
  }

  const snapshot = parseMediaFolderCanvasSnapshot(body.snapshot);
  if (!snapshot) {
    return res.status(400).json({ error: "Invalid snapshot payload" });
  }

  try {
    const state = await saveMediaFolderCanvasStateForUser({
      userId: user.id,
      folderId,
      schemaVersion,
      snapshot,
    });
    return res.status(200).json({
      folderId: state.folderId,
      schemaVersion: state.schemaVersion,
      saveSeq: state.saveSeq,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save folder canvas state";
    if (message === "Invalid folder id") {
      return res.status(400).json({ error: message });
    }
    if (message === "Folder not found") {
      return res.status(404).json({ error: message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/media-folder-canvas/save",
      metadata: {
        user_id: user.id,
        folder_id: folderId,
      },
    });
    return res.status(500).json({ error: "Failed to save folder canvas state" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
