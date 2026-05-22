import type { NextApiRequest, NextApiResponse } from "next";
import { assertUserScopedMediaStoragePath } from "../../../../lib/mediaStoragePath";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { saveVoiceForUser } from "../../../../lib/server/api/userSavedVoices";
import { createElevenLabsClonedVoice } from "../../../../lib/server/elevenlabs";
import {
  MediaAudioExtractionInputError,
  readStoredMediaBuffer,
} from "../../../../lib/server/mediaAudioExtraction";

type VoiceCloneRequestBody = {
  voiceName?: unknown;
  voiceDescription?: unknown;
  sourceStoragePath?: unknown;
  sourceName?: unknown;
  removeBackgroundNoise?: unknown;
};

type VoiceCloneSuccessResponse = {
  voice: {
    voiceId: string;
    name: string;
    previewUrl: string | null;
    description: string | null;
    isFallback: false;
  };
};

type VoiceCloneErrorResponse = {
  error: string;
  details?: string;
};

const MAX_VOICE_CLONE_SOURCE_BYTES = 100 * 1024 * 1024;

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

const normalizeProviderStatus = (error: unknown): number => {
  const statusCandidate =
    (error as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (error as { status?: unknown; statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCandidate !== "number" || !Number.isInteger(statusCandidate)) return 500;
  if (statusCandidate < 400 || statusCandidate > 599) return 500;
  return statusCandidate;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceCloneSuccessResponse | VoiceCloneErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as VoiceCloneRequestBody;
    const voiceName = normalizeRequiredString(body.voiceName);
    const voiceDescription = normalizeOptionalString(body.voiceDescription);
    const sourceStoragePath = normalizeRequiredString(body.sourceStoragePath);
    const sourceName = normalizeOptionalString(body.sourceName);
    const removeBackgroundNoise = normalizeBoolean(body.removeBackgroundNoise, true);

    if (!voiceName || !sourceStoragePath) {
      return res.status(400).json({
        error: "Invalid request",
        details: "voiceName and sourceStoragePath are required.",
      });
    }

    const trustedStoragePath = assertUserScopedMediaStoragePath({
      path: sourceStoragePath,
      userId: user.id,
      label: "Voice clone source storage path",
    });

    const storedSource = await readStoredMediaBuffer({
      storagePath: trustedStoragePath,
      maxBytes: MAX_VOICE_CLONE_SOURCE_BYTES,
    });
    const sourceFilename =
      sourceName ?? trustedStoragePath.split("/").filter(Boolean).pop() ?? "voice-clone-source";

    const clonedVoice = await createElevenLabsClonedVoice({
      voiceName,
      voiceDescription,
      sourceBuffer: storedSource.buffer,
      sourceFilename,
      sourceMimeType: storedSource.contentType,
      removeBackgroundNoise,
    });

    try {
      await saveVoiceForUser({
        userId: user.id,
        voice: {
          voiceId: clonedVoice.voiceId,
          name: clonedVoice.name,
          previewUrl: clonedVoice.previewUrl,
          description: clonedVoice.description,
          originKind: "provider-user-created",
          savedSource: "voice-clone",
          providerDeleteEligible: true,
        },
      });
    } catch (persistenceError) {
      await logApiRouteException({
        req,
        error: persistenceError,
        routeLabel: "elevenlabs-voice-clone-persistence",
        scope: "generation",
        user,
      });
    }

    return res.status(200).json({
      voice: {
        voiceId: clonedVoice.voiceId,
        name: clonedVoice.name,
        previewUrl: clonedVoice.previewUrl,
        description: clonedVoice.description,
        isFallback: false,
      },
    });
  } catch (error) {
    if (error instanceof MediaAudioExtractionInputError) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: error.message,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voice-clone",
      scope: "generation",
      user,
    });

    return res.status(normalizeProviderStatus(error)).json({
      error: "Unable to clone voice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
