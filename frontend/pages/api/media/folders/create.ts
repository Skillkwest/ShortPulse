/**
 * Creates a custom media folder for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  createMediaFolderForUser,
  sanitizeMediaFolderName,
} from "../../../../lib/server/mediaFoldersService";

type CreateFolderSuccessResponse = {
  folder: {
    id: string;
    name: string;
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

/**
 * Handles custom folder creation.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateFolderSuccessResponse | CreateFolderErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = toRequestBody(req.body);
    const name = sanitizeMediaFolderName(body.name);
    if (!name) {
      return res.status(400).json({
        error: "Invalid folder name",
        details: "Folder names must be 1-64 non-whitespace characters.",
      });
    }

    const folder = await createMediaFolderForUser({
      userId: user.id,
      name,
    });

    return res.status(200).json({
      folder: {
        id: folder.id,
        name: folder.name,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Folder name already exists") {
      return res.status(409).json({
        error: "Folder name already exists",
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-folders-create",
      user,
    });
    return res.status(500).json({
      error: "Failed to create folder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
