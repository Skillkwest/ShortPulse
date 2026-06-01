/**
 * Voice Changer direct-upload preparation route.
 * Issues a user-scoped signed storage upload target for one local Voice Changer source file.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  MediaUploadServiceError,
  prepareVoiceChangerSourceUploadForUser,
} from "../../../lib/server/mediaUploadService";

type PrepareVoiceChangerSourceUploadRequestBody = {
  sourceKind?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
};

type PrepareVoiceChangerSourceUploadSuccessResponse = {
  target: {
    storagePath: string;
    uploadToken: string;
    mimeType: string;
    name: string;
  };
};

type PrepareVoiceChangerSourceUploadErrorResponse = {
  error: string;
  details?: string;
};

type VoiceChangerSourceKind = "audio" | "video";

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const resolveRequestedKind = (value: unknown): VoiceChangerSourceKind | null => {
  const normalized = normalizeOptionalString(value).toLowerCase();
  if (normalized === "audio" || normalized === "video") return normalized;
  return null;
};

const PREPARE_VOICE_CHANGER_SOURCE_UPLOAD_RATE_LIMIT = {
  keyPrefix: "media-prepare-voice-changer-source-upload",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PrepareVoiceChangerSourceUploadSuccessResponse | PrepareVoiceChangerSourceUploadErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PREPARE_VOICE_CHANGER_SOURCE_UPLOAD_RATE_LIMIT,
      keyPrefix: `${PREPARE_VOICE_CHANGER_SOURCE_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as PrepareVoiceChangerSourceUploadRequestBody;
    const sourceKind = resolveRequestedKind(body.sourceKind);
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();

    if (!sourceKind) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source kind must be 'audio' or 'video'.",
      });
    }
    if (!sourceName) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source name is required.",
      });
    }
    if (!sourceMimeType) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source mime type is required.",
      });
    }

    const prepared = await prepareVoiceChangerSourceUploadForUser({
      userId: user.id,
      kind: sourceKind,
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
          routeLabel: "media-prepare-voice-changer-source-upload",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to prepare voice changer upload",
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
      routeLabel: "media-prepare-voice-changer-source-upload",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to prepare voice changer upload",
    });
  }
}
