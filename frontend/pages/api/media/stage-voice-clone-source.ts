/**
 * Storage-only Voice Clone source staging adapter.
 * Stages one local audio sample into private storage before provider voice cloning.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  MediaUploadServiceError,
  uploadVoiceCloneSourceForUser,
} from "../../../lib/server/mediaUploadService";

type StageVoiceCloneSourceSuccessResponse = {
  source: {
    storagePath: string;
    previewUrl: string;
    mimeType: string;
    name: string;
    size: number;
  };
};

type StageVoiceCloneSourceErrorResponse = {
  error: string;
  details?: string;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StageVoiceCloneSourceSuccessResponse | StageVoiceCloneSourceErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const staged = await uploadVoiceCloneSourceForUser({
      req,
      userId: user.id,
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
      routeLabel: "media-stage-voice-clone-source",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage voice clone source",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
