/**
 * Storage-only Voice Clone source staging adapter.
 * Stages one local audio sample into private storage before provider voice cloning.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  MediaUploadServiceError,
  uploadVoiceCloneSourceForUser,
} from "../../../lib/server/mediaUploadService";
import {
  recordVoiceSourceLifecycleState,
  VOICE_CLONE_SOURCE_RETENTION_DAYS,
} from "../../../lib/server/voiceSourceLifecycle";

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

const STAGE_VOICE_CLONE_SOURCE_RATE_LIMIT = {
  keyPrefix: "media-stage-voice-clone-source",
  maxRequests: 8,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StageVoiceCloneSourceSuccessResponse | StageVoiceCloneSourceErrorResponse>
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
      routeLabel: "media-stage-voice-clone-source.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to stage voice clone source",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...STAGE_VOICE_CLONE_SOURCE_RATE_LIMIT,
      keyPrefix: `${STAGE_VOICE_CLONE_SOURCE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const staged = await uploadVoiceCloneSourceForUser({
      req,
      userId: user.id,
    });
    await recordVoiceSourceLifecycleState({
      userId: user.id,
      workflowKind: "voice_clone",
      sourceKind: "audio",
      storagePath: staged.path,
      state: "staged",
      lifecycleKey: "staged",
      retentionDays: VOICE_CLONE_SOURCE_RETENTION_DAYS,
      metadata: {
        source_name: staged.name,
        mime_type: staged.mimeType,
        size_bytes: staged.size,
      },
    }).catch((lifecycleError) =>
      logApiRouteException({
        req,
        error: lifecycleError,
        routeLabel: "media-stage-voice-clone-source.lifecycle",
        scope: "generation",
        user,
      })
    );

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
          routeLabel: "media-stage-voice-clone-source",
          scope: "generation",
          user,
        });

        return res.status(500).json({
          error: "Unable to stage voice clone source",
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
      routeLabel: "media-stage-voice-clone-source",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage voice clone source",
    });
  }
}
