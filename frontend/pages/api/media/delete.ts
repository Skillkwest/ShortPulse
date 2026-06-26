/**
 * Authenticated Media Library delete route.
 * Deletes a caller-owned media row and server-owned storage/hidden generated-audio artifacts.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { deleteMediaFileForUser } from "../../../lib/server/mediaLibraryDeleteService";

type DeleteMediaResponse =
  | {
      deletedMediaId: string;
      deletedStoragePaths: string[];
      cleanedGeneratedAudioCompanionArt: boolean;
    }
  | {
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
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteMediaResponse>
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
      routeLabel: "media-delete.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to delete media" });
  }
  if (!user) return;

  try {
    const requestBody = toRequestBody(req.body);
    const mediaFileId = asString(requestBody.mediaFileId);
    if (!mediaFileId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await deleteMediaFileForUser({
      userId: user.id,
      mediaFileId,
    });
    return res.status(200).json(result);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-delete",
      user,
    });
    return res.status(500).json({
      error: "Failed to delete media",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
