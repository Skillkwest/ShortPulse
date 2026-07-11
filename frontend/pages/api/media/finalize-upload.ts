import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  assertPaidMediaLibraryAccess,
  MediaLibraryPaidAccessError,
} from "../../../lib/server/api/mediaLibraryPaidAccess";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  finalizePreparedMediaUploadForUser,
  MediaUploadServiceError,
  type MediaUploadDestinationTab,
  type MediaUploadResponseFile,
} from "../../../lib/server/mediaUploadService";

type FinalizeMediaUploadRequestBody = {
  intentId?: unknown;
  destinationTab?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
};

type FinalizeMediaUploadSuccessResponse = {
  file: MediaUploadResponseFile;
};

type FinalizeMediaUploadErrorResponse = {
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

const FINALIZE_MEDIA_UPLOAD_RATE_LIMIT = {
  keyPrefix: "media-finalize-upload",
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
} as const;

const buildMediaUploadErrorLogMetadata = (
  error: MediaUploadServiceError
): Record<string, unknown> => ({
  media_upload_error_status: error.status,
  media_upload_error_message: error.message,
  media_upload_error_details: error.details ?? null,
  ...(error.diagnostics ?? {}),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizeMediaUploadSuccessResponse | FinalizeMediaUploadErrorResponse>
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
      routeLabel: "media-finalize-upload.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Unable to finalize media upload",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...FINALIZE_MEDIA_UPLOAD_RATE_LIMIT,
      keyPrefix: `${FINALIZE_MEDIA_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    await assertPaidMediaLibraryAccess(user.id);
    const body = (req.body ?? {}) as FinalizeMediaUploadRequestBody;
    const destinationTab = resolveDestinationTab(body.destinationTab);
    const intentId = normalizeOptionalString(body.intentId);
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();
    const sourceStoragePath = normalizeOptionalString(body.sourceStoragePath);

    if (!intentId) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Upload intent is required.",
      });
    }
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
    if (!sourceStoragePath) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Prepared upload storage path is required.",
      });
    }

    const file = await finalizePreparedMediaUploadForUser({
      userId: user.id,
      intentId,
      destinationTab,
      storagePath: sourceStoragePath,
      filename: sourceName,
      declaredMimeType: sourceMimeType,
    });

    return res.status(200).json({ file });
  } catch (error) {
    if (error instanceof MediaLibraryPaidAccessError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }
    if (error instanceof MediaUploadServiceError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-finalize-upload",
          metadata: buildMediaUploadErrorLogMetadata(error),
          user,
        });

        return res.status(500).json({
          error: "Unable to finalize media upload",
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
      routeLabel: "media-finalize-upload",
      user,
    });

    return res.status(500).json({
      error: "Unable to finalize media upload",
    });
  }
}
