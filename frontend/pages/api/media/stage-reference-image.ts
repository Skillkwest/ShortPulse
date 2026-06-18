/**
 * Transient reference image staged-upload finalization route.
 * Confirms a browser-direct storage upload, validates the stored image bytes server-side,
 * and returns the signed reference contract used by AI Studio submit flows.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  finalizeReferenceImageUploadForUser,
  MediaUploadServiceError,
} from "../../../lib/server/mediaUploadService";

type StageReferenceImageRequestBody = {
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
};

type StageReferenceImageSuccessResponse = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
};

type StageReferenceImageErrorResponse = {
  error: string;
  details?: string;
};

const STAGE_REFERENCE_IMAGE_RATE_LIMIT = {
  keyPrefix: "media-stage-reference-image",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StageReferenceImageSuccessResponse | StageReferenceImageErrorResponse>
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
      routeLabel: "media-stage-reference-image.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to stage reference image",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...STAGE_REFERENCE_IMAGE_RATE_LIMIT,
      keyPrefix: `${STAGE_REFERENCE_IMAGE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as StageReferenceImageRequestBody;
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();
    const sourceStoragePath = normalizeOptionalString(body.sourceStoragePath);

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
    if (!sourceStoragePath) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Reference image storage path is required.",
      });
    }

    const staged = await finalizeReferenceImageUploadForUser({
      userId: user.id,
      storagePath: sourceStoragePath,
      filename: sourceName,
      declaredMimeType: sourceMimeType,
    });

    return res.status(200).json({
      url: staged.url,
      path: staged.path,
      size: staged.size,
      mimeType: staged.mimeType,
      name: staged.name,
    });
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-stage-reference-image",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to stage reference image",
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
      routeLabel: "media-stage-reference-image",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage reference image",
    });
  }
}
