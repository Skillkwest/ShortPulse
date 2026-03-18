/**
 * Compatibility adapter for AI Studio image-reference uploads.
 * Preserves the legacy response contract while reusing canonical upload validation/storage logic.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../lib/server/api/auth";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { logLegacyUploadAdapterUsage } from "../../lib/server/mediaUploadAdapterTelemetry";
import {
  MediaUploadServiceError,
  uploadSignedStorageAssetForUser,
} from "../../lib/server/mediaUploadService";

type UploadImageResponse = {
  url: string;
  path: string;
  size: number;
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

/**
 * Handles image uploads for generation references.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadImageResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const uploaded = await uploadSignedStorageAssetForUser({
      req,
      userId: user.id,
      defaultDestinationTab: "uploaded_images",
      storageFolderOverride: "images/reference",
    });
    await logLegacyUploadAdapterUsage({
      req,
      routeLabel: "upload-image",
      userId: user.id,
      userEmail: user.email,
      fileSize: uploaded.size,
      storagePath: uploaded.path,
    });
    return res.status(200).json(uploaded);
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
      routeLabel: "upload-image",
      user,
    });

    return res.status(500).json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
