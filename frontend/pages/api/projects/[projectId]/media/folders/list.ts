/**
 * Lists project-owned custom media folders for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { listProjectMediaFoldersForUser } from "../../../../../../lib/server/projectMediaFoldersService";
import { getProjectForUser, parseProjectId } from "../../../../../../lib/server/projectsService";

type ListFoldersSuccessResponse = {
  folders: Array<{
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
    itemCount: number;
  }>;
};

type ListFoldersErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListFoldersSuccessResponse | ListFoldersErrorResponse>
) {
  if (req.method !== "GET") {
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
    const folders = await listProjectMediaFoldersForUser({
      userId: user.id,
      projectId,
    });
    return res.status(200).json({
      folders: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentFolderId: folder.parent_folder_id,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        itemCount: folder.item_count,
      })),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-media-folders-list",
      user,
    });
    return res.status(500).json({
      error: "Failed to list project folders",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
