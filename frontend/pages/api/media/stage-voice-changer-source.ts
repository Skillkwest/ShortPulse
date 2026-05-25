/**
 * Storage-only Voice Changer source staging adapter.
 * Reuses shared upload-service primitives so local audio/video sources stage through the same server-authoritative path shape as the rest of AI Studio.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  MediaUploadServiceError,
  uploadVoiceChangerSourceForUser,
} from "../../../lib/server/mediaUploadService";

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

const readHeaderString = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.trim().toLowerCase() ?? "";
};

const resolveRequestedKind = (value: string): VoiceChangerSourceKind | null => {
  if (value === "audio" || value === "video") return value;
  return null;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  try {
    const requestedKind = resolveRequestedKind(
      readHeaderString(req.headers["x-shortpulse-voice-changer-kind"])
    );
    if (!requestedKind) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source kind must be 'audio' or 'video'.",
      });
    }

    const staged = await uploadVoiceChangerSourceForUser({
      req,
      userId: user.id,
      kind: requestedKind,
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
