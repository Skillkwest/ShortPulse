/**
 * Compatibility adapter for AI Studio local audio-reference uploads.
 * Preserves a simple signed-upload response while reusing canonical validation/storage logic.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../lib/server/api/auth";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../lib/server/api/rateLimit";
import { logLegacyUploadAdapterUsage } from "../../lib/server/mediaUploadAdapterTelemetry";
import {
  MediaUploadServiceError,
  uploadSignedStorageAssetForUser,
} from "../../lib/server/mediaUploadService";

type UploadResponse = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const UPLOAD_AUDIO_RATE_LIMIT = {
  keyPrefix: "upload-audio",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

/**
 * Handles local audio-reference uploads for restore-safe AI Studio refs.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...UPLOAD_AUDIO_RATE_LIMIT,
      keyPrefix: `${UPLOAD_AUDIO_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const uploaded = await uploadSignedStorageAssetForUser({
      req,
      userId: user.id,
      defaultDestinationTab: "uploaded_videos",
      storageFolderOverride: "audio/reference-grid",
    });
    await logLegacyUploadAdapterUsage({
      req,
      routeLabel: "upload-audio",
      userId: user.id,
      userEmail: user.email,
      fileSize: uploaded.size,
      storagePath: uploaded.path,
    });
    return res.status(200).json(uploaded);
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "upload-audio",
          user,
        });

        return res.status(500).json({
          error: "Upload failed",
        });
      }

      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "upload-audio",
      user,
    });

    return res.status(500).json({
      error: "Upload failed",
    });
  }
}
