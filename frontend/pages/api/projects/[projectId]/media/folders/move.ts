/**
 * Moves a project-owned custom media folder for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { moveProjectMediaFolderForUser } from "../../../../../../lib/server/projectMediaFoldersService";
import { getProjectForUser, parseProjectId } from "../../../../../../lib/server/projectsService";
import {
  isCustomMediaFolderId,
  sanitizeMediaFolderParentId,
} from "../../../../../../lib/server/mediaFoldersService";

type MoveFolderSuccessResponse = {
  folder: {
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

type MoveFolderErrorResponse = {
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

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MoveFolderSuccessResponse | MoveFolderErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const projectId = parseProjectId(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "Invalid project id" });
  }

  try {
    const project = await getProjectForUser({ userId: user.id, projectId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const body = toRequestBody(req.body);
    const folderId = asString(body.folderId);
    const parentFolderId = sanitizeMediaFolderParentId(body.parentFolderId);
    if (!isCustomMediaFolderId(folderId)) {
      return res.status(400).json({ error: "Invalid folder id" });
    }
    if (parentFolderId === undefined) {
      return res.status(400).json({ error: "Invalid parent folder id" });
    }

    const folder = await moveProjectMediaFolderForUser({
      userId: user.id,
      projectId,
      folderId,
      parentFolderId,
    });
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    return res.status(200).json({
      folder: {
        id: folder.id,
        name: folder.name,
        parentFolderId: folder.parent_folder_id,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Parent folder not found") {
      return res.status(404).json({ error: "Parent folder not found" });
    }
    if (error instanceof Error && error.message === "Folder name already exists") {
      return res.status(409).json({ error: "Folder name already exists" });
    }
    if (
      error instanceof Error &&
      (error.message === "Invalid folder hierarchy" ||
        error.message === "Folder cannot be its own parent")
    ) {
      return res.status(409).json({ error: error.message });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-media-folders-move",
      user,
    });
    return res.status(500).json({
      error: "Failed to move project folder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
