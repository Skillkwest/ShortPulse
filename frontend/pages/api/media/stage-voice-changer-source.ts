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
  assertTrustedRemoteMediaUrl,
  TrustedRemoteMediaUrlError,
} from "../../../lib/server/api/trustedRemoteMediaUrl";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  MediaAudioExtractionInputError,
  readRemoteMediaBuffer,
  readStoredMediaBuffer,
} from "../../../lib/server/mediaAudioExtraction";
import {
  finalizeVoiceChangerSourceUploadForUser,
  MediaUploadServiceError,
  stageVoiceChangerSourceBufferForUser,
} from "../../../lib/server/mediaUploadService";
import {
  recordVoiceSourceLifecycleState,
  VOICE_CHANGER_SOURCE_RETENTION_DAYS,
} from "../../../lib/server/voiceSourceLifecycle";

type StageVoiceChangerSourceRequestBody = {
  sourceKind?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
  sourceUrl?: unknown;
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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-stage-voice-changer-source.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to stage voice changer source",
    });
  }
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
    const sourceUrl = normalizeOptionalString(body.sourceUrl);

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
    if (!sourceStoragePath && !sourceUrl) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source storage path or trusted URL is required.",
      });
    }

    const canonicalPrefix = `${user.id}/voice-changer/${
      sourceKind === "video" ? "source-video" : "source-audio"
    }/`;
    let sourceDerivation = "direct_upload";
    const staged = await (async () => {
      if (sourceStoragePath?.startsWith(canonicalPrefix)) {
        return await finalizeVoiceChangerSourceUploadForUser({
          userId: user.id,
          kind: sourceKind,
          storagePath: sourceStoragePath,
          filename: sourceName,
          declaredMimeType: sourceMimeType,
        });
      }
      if (sourceKind !== "video") {
        throw new MediaUploadServiceError(
          400,
          "Invalid request",
          "Non-upload Voice Changer source promotion is supported only for video."
        );
      }

      let sourceBuffer: Buffer;
      let authoritativeMimeType = sourceMimeType;
      if (sourceStoragePath) {
        const safeStoragePath = assertUserScopedMediaStoragePath({
          path: sourceStoragePath,
          userId: user.id,
          label: "Voice changer reference video storage path",
        });
        const stored = await readStoredMediaBuffer({
          storagePath: safeStoragePath,
          maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
        });
        sourceBuffer = stored.buffer;
        authoritativeMimeType = stored.contentType ?? authoritativeMimeType;
        sourceDerivation = "owned_storage_reference";
      } else {
        const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
          rawUrl: sourceUrl!,
          req,
          userId: user.id,
          requireUserScope: true,
          label: "Voice changer reference video URL",
        });
        const remote = await readRemoteMediaBuffer({
          sourceUrl: trustedSourceUrl.toString(),
          maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
        });
        sourceBuffer = remote.buffer;
        authoritativeMimeType = remote.contentType ?? authoritativeMimeType;
        sourceDerivation = "trusted_url_reference";
      }

      return await stageVoiceChangerSourceBufferForUser({
        userId: user.id,
        kind: "video",
        buffer: sourceBuffer,
        filename: sourceName,
        declaredMimeType: authoritativeMimeType,
      });
    })();
    await recordVoiceSourceLifecycleState({
      userId: user.id,
      workflowKind: "voice_changer",
      sourceKind,
      storagePath: staged.path,
      state: "staged",
      lifecycleKey: "staged",
      retentionDays: VOICE_CHANGER_SOURCE_RETENTION_DAYS,
      metadata: {
        source_name: staged.name,
        mime_type: staged.mimeType,
        size_bytes: staged.size,
        source_derivation: sourceDerivation,
      },
    }).catch((lifecycleError) =>
      logApiRouteException({
        req,
        error: lifecycleError,
        routeLabel: "media-stage-voice-changer-source.lifecycle",
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
    if (
      error instanceof TrustedRemoteMediaUrlError ||
      error instanceof MediaAudioExtractionInputError
    ) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: error.message,
      });
    }
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
