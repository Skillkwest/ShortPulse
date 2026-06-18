/**
 * Transient motion-reference video staged-upload finalization route.
 * Validates browser-direct storage uploads and returns the Motion Control clip contract.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  deleteSignedStorageAssetForUser,
  finalizeMotionReferenceVideoUploadForUser,
  MediaUploadServiceError,
} from "../../../lib/server/mediaUploadService";
import { retireMotionReferenceVideoStoragePathForUser } from "../../../lib/server/motionReferenceVideoAssetLease";

type StageMotionReferenceVideoRequestBody = {
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
  path?: unknown;
  mode?: unknown;
};

type StageMotionReferenceVideoSuccessResponse = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
};

type StageMotionReferenceVideoErrorResponse = {
  error: string;
  details?: string;
};

const STAGE_MOTION_REFERENCE_VIDEO_RATE_LIMIT = {
  keyPrefix: "media-stage-motion-reference-video",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

const MOTION_CONTROL_STORAGE_FOLDER = "videos/motion-control";

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    StageMotionReferenceVideoSuccessResponse | StageMotionReferenceVideoErrorResponse
  >
) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...STAGE_MOTION_REFERENCE_VIDEO_RATE_LIMIT,
      keyPrefix: `${STAGE_MOTION_REFERENCE_VIDEO_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as StageMotionReferenceVideoRequestBody;

    if (req.method === "DELETE") {
      const storagePath = normalizeOptionalString(body.path);
      if (!storagePath) {
        return res.status(400).json({
          error: "Invalid request",
          details: "Motion reference video storage path is required.",
        });
      }
      if (body.mode === "retire") {
        await retireMotionReferenceVideoStoragePathForUser({
          userId: user.id,
          storagePath,
        });
      } else {
        await deleteSignedStorageAssetForUser({
          userId: user.id,
          storagePath,
          storageFolderOverride: MOTION_CONTROL_STORAGE_FOLDER,
        });
      }
      return res.status(204).end();
    }

    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();
    const sourceStoragePath = normalizeOptionalString(body.sourceStoragePath);

    if (!sourceName) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Motion reference video name is required.",
      });
    }
    if (!sourceMimeType) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Motion reference video mime type is required.",
      });
    }
    if (!sourceStoragePath) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Motion reference video storage path is required.",
      });
    }

    const staged = await finalizeMotionReferenceVideoUploadForUser({
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
          routeLabel: "media-stage-motion-reference-video",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to stage motion reference video",
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
      routeLabel: "media-stage-motion-reference-video",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage motion reference video",
    });
  }
}
