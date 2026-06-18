import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  MediaUploadServiceError,
  prepareMediaUploadForUser,
  type MediaUploadDestinationTab,
} from "../../../lib/server/mediaUploadService";

type PrepareMediaUploadRequestBody = {
  destinationTab?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
};

type PrepareMediaUploadSuccessResponse = {
  target: {
    storagePath: string;
    uploadToken: string;
    mimeType: string;
    name: string;
  };
};

type PrepareMediaUploadErrorResponse = {
  error: string;
  details?: string;
};

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const resolveDestinationTab = (value: unknown): MediaUploadDestinationTab | null => {
  const normalized = normalizeOptionalString(value);
  if (normalized === "uploaded_images") return normalized;
  if (normalized === "uploaded_videos") return normalized;
  if (normalized === "private") return normalized;
  return null;
};

const PREPARE_MEDIA_UPLOAD_RATE_LIMIT = {
  keyPrefix: "media-prepare-upload",
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrepareMediaUploadSuccessResponse | PrepareMediaUploadErrorResponse>
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
      routeLabel: "media-prepare-upload.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Unable to prepare media upload",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PREPARE_MEDIA_UPLOAD_RATE_LIMIT,
      keyPrefix: `${PREPARE_MEDIA_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as PrepareMediaUploadRequestBody;
    const destinationTab = resolveDestinationTab(body.destinationTab);
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();

    if (!destinationTab) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Upload destination tab is required.",
      });
    }
    if (!sourceName) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Upload file name is required.",
      });
    }
    if (!sourceMimeType) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Upload file mime type is required.",
      });
    }

    const prepared = await prepareMediaUploadForUser({
      userId: user.id,
      destinationTab,
      filename: sourceName,
      declaredMimeType: sourceMimeType,
    });

    return res.status(200).json({
      target: {
        storagePath: prepared.path,
        uploadToken: prepared.token,
        mimeType: prepared.mimeType,
        name: prepared.name,
      },
    });
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-prepare-upload",
          user,
        });

        return res.status(500).json({
          error: "Unable to prepare media upload",
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
      routeLabel: "media-prepare-upload",
      user,
    });

    return res.status(500).json({
      error: "Unable to prepare media upload",
    });
  }
}
