/**
 * Transient reference image direct-upload preparation route.
 * Issues a user-scoped signed storage upload target for one local reference image.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  MediaUploadServiceError,
  prepareReferenceImageUploadForUser,
} from "../../../lib/server/mediaUploadService";

type PrepareReferenceImageUploadRequestBody = {
  sourceMimeType?: unknown;
  sourceName?: unknown;
};

type PrepareReferenceImageUploadSuccessResponse = {
  target: {
    storagePath: string;
    uploadToken: string;
    mimeType: string;
    name: string;
  };
};

type PrepareReferenceImageUploadErrorResponse = {
  error: string;
  details?: string;
};

const PREPARE_REFERENCE_IMAGE_UPLOAD_RATE_LIMIT = {
  keyPrefix: "media-prepare-reference-image-upload",
  maxRequests: 16,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PrepareReferenceImageUploadSuccessResponse | PrepareReferenceImageUploadErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PREPARE_REFERENCE_IMAGE_UPLOAD_RATE_LIMIT,
      keyPrefix: `${PREPARE_REFERENCE_IMAGE_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as PrepareReferenceImageUploadRequestBody;
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();

    if (!sourceName) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Reference image name is required.",
      });
    }
    if (!sourceMimeType) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Reference image mime type is required.",
      });
    }

    const prepared = await prepareReferenceImageUploadForUser({
      userId: user.id,
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
          routeLabel: "media-prepare-reference-image-upload",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to prepare reference image upload",
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
      routeLabel: "media-prepare-reference-image-upload",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to prepare reference image upload",
    });
  }
}
