/**
 * Renames a project-owned custom media folder for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../api/auth";
import { logApiRouteException } from "../../api/appErrorLogs";
import {
  renameProjectMediaFolderForUser,
  sanitizeMediaFolderName,
} from "../../projectMediaFoldersService";
import { getProjectForUser, parseProjectId } from "../../projectsService";
import { isCustomMediaFolderId } from "../../mediaFoldersService";

type RenameFolderSuccessResponse = {
  folder: {
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
    itemCount: number;
  };
};

type RenameFolderErrorResponse = {
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
  res: NextApiResponse<RenameFolderSuccessResponse | RenameFolderErrorResponse>
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
    const name = sanitizeMediaFolderName(body.name);
    if (!isCustomMediaFolderId(folderId)) {
      return res.status(400).json({ error: "Invalid folder id" });
    }
    if (!name) {
      return res.status(400).json({
        error: "Invalid folder name",
        details: "Folder names must be 1-64 non-whitespace characters.",
      });
    }

    const folder = await renameProjectMediaFolderForUser({
      userId: user.id,
      projectId,
      folderId,
      name,
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
        itemCount: folder.item_count,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Folder name already exists") {
      return res.status(409).json({ error: "Folder name already exists" });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-media-folders-rename",
      user,
    });
    return res.status(500).json({
      error: "Failed to rename project folder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
