/**
 * Media Library server-authoritative upload API.
 * Accepts authenticated uploads and persists media rows without trusting client classification.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  MediaUploadServiceError,
  type MediaUploadResponseFile,
  uploadMediaForUser,
} from "../../../lib/server/mediaUploadService";

type MediaUploadSuccessResponse = {
  file: MediaUploadResponseFile;
};

type MediaUploadErrorResponse = {
  error: string;
  details?: string;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const isMediaUploadApiEnabled = (): boolean =>
  parseBooleanEnv(process.env.SHORTPULSE_MEDIA_UPLOAD_API_ENABLED, true);

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Handles Media Library file uploads via a server-authoritative persistence path.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaUploadSuccessResponse | MediaUploadErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  if (!isMediaUploadApiEnabled()) {
    return res.status(503).json({
      error: "Media upload API is disabled",
      details: "Enable SHORTPULSE_MEDIA_UPLOAD_API_ENABLED to use this route.",
    });
  }

  try {
    const file = await uploadMediaForUser({
      req,
      userId: user.id,
    });

    return res.status(200).json({ file });
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-upload",
      user,
    });

    return res.status(500).json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
