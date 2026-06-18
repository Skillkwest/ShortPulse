/**
 * Deletes a custom media folder subtree for the authenticated user.
 * Descendants and junction memberships are removed via cascading FK deletes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  deleteMediaFolderForUser,
  isCustomMediaFolderId,
} from "../../../../lib/server/mediaFoldersService";

type DeleteFolderSuccessResponse = {
  deleted: boolean;
  folderId: string;
};

type DeleteFolderErrorResponse = {
  error: string;
  details?: string;
};

const toRequestBody = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

/**
 * Handles custom folder deletion.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteFolderSuccessResponse | DeleteFolderErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-folders-delete.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to delete folder" });
  }
  if (!user) return;

  try {
    const body = toRequestBody(req.body);
    const folderId = asString(body.folderId);

    if (!isCustomMediaFolderId(folderId)) {
      return res.status(400).json({
        error: "Invalid folder id",
      });
    }

    const deleted = await deleteMediaFolderForUser({
      userId: user.id,
      folderId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Folder not found" });
    }

    return res.status(200).json({
      deleted,
      folderId,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-folders-delete",
      user,
    });
    return res.status(500).json({
      error: "Failed to delete folder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
