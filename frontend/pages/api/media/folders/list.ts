/**
 * Lists user-owned custom media folders.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logAuthVerificationUnavailableResponse } from "../../../../lib/server/api/authFailureLogging";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { listMediaFoldersForUser } from "../../../../lib/server/mediaFoldersService";

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

/**
 * Returns the authenticated user's custom media folders.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListFoldersSuccessResponse | ListFoldersErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-folders-list.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to list folders" });
  }
  if (!user) {
    await logAuthVerificationUnavailableResponse({
      req,
      res,
      routeLabel: "media-folders-list.auth",
    });
    return;
  }

  try {
    const folders = await listMediaFoldersForUser(user.id);
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
      routeLabel: "media-folders-list",
      user,
    });
    return res.status(500).json({
      error: "Failed to list folders",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
