/**
 * Creates a project-owned custom media folder for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import {
  createProjectMediaFolderForUser,
  sanitizeMediaFolderName,
} from "../../../../../../lib/server/projectMediaFoldersService";
import { getProjectForUser, parseProjectId } from "../../../../../../lib/server/projectsService";
import { sanitizeMediaFolderParentId } from "../../../../../../lib/server/mediaFoldersService";

type CreateFolderSuccessResponse = {
  folder: {
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

type CreateFolderErrorResponse = {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateFolderSuccessResponse | CreateFolderErrorResponse>
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
    const name = sanitizeMediaFolderName(body.name);
    const parentFolderId = sanitizeMediaFolderParentId(body.parentFolderId);
    if (!name) {
      return res.status(400).json({
        error: "Invalid folder name",
        details: "Folder names must be 1-64 non-whitespace characters.",
      });
    }
    if (parentFolderId === undefined) {
      return res.status(400).json({ error: "Invalid parent folder id" });
    }

    const folder = await createProjectMediaFolderForUser({
      userId: user.id,
      projectId,
      name,
      parentFolderId,
    });

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
    if (error instanceof Error && error.message === "Folder name already exists") {
      return res.status(409).json({ error: "Folder name already exists" });
    }
    if (error instanceof Error && error.message === "Parent folder not found") {
      return res.status(404).json({ error: "Parent folder not found" });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-media-folders-create",
      user,
    });
    return res.status(500).json({
      error: "Failed to create project folder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
