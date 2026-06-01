/**
 * Voice Changer staged-source finalization route.
 * Confirms a browser-direct storage upload, validates the stored media bytes server-side,
 * and returns the signed source contract used by the Voices panel.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  finalizeVoiceChangerSourceUploadForUser,
  MediaUploadServiceError,
} from "../../../lib/server/mediaUploadService";

type StageVoiceChangerSourceRequestBody = {
  sourceKind?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
};

type StageVoiceChangerSourceSuccessResponse = {
  source: {
    storagePath: string;
    previewUrl: string;
    mimeType: string;
    name: string;
    size: number;
  };
};

type StageVoiceChangerSourceErrorResponse = {
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

const STAGE_VOICE_CHANGER_SOURCE_RATE_LIMIT = {
  keyPrefix: "media-stage-voice-changer-source",
  maxRequests: 10,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    StageVoiceChangerSourceSuccessResponse | StageVoiceChangerSourceErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...STAGE_VOICE_CHANGER_SOURCE_RATE_LIMIT,
      keyPrefix: `${STAGE_VOICE_CHANGER_SOURCE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as StageVoiceChangerSourceRequestBody;
    const sourceKind = resolveRequestedKind(body.sourceKind);
    const sourceName = normalizeOptionalString(body.sourceName);
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType).toLowerCase();
    const sourceStoragePath = normalizeOptionalString(body.sourceStoragePath);

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
    if (!sourceStoragePath) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source storage path is required.",
      });
    }

    const staged = await finalizeVoiceChangerSourceUploadForUser({
      userId: user.id,
      kind: sourceKind,
      storagePath: sourceStoragePath,
      filename: sourceName,
      declaredMimeType: sourceMimeType,
    });

    return res.status(200).json({
      source: {
        storagePath: staged.path,
        previewUrl: staged.url,
        mimeType: staged.mimeType,
        name: staged.name,
        size: staged.size,
      },
    });
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-stage-voice-changer-source",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to stage voice changer source",
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
      routeLabel: "media-stage-voice-changer-source",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage voice changer source",
    });
  }
}
