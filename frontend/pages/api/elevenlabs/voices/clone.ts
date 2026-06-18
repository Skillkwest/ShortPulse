import type { NextApiRequest, NextApiResponse } from "next";
import { validateCustomVoiceName } from "../../../../lib/customVoiceName";
import { assertUserScopedMediaStoragePath } from "../../../../lib/mediaStoragePath";
import { sanitizeCustomerFacingProviderText } from "../../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { saveVoiceForUser } from "../../../../lib/server/api/userSavedVoices";
import { cleanupFailedElevenLabsCustomVoice } from "../../../../lib/server/elevenlabsCustomVoiceCleanup";
import { createElevenLabsClonedVoice } from "../../../../lib/server/elevenlabs";
import { createPersistedElevenLabsVoiceSample } from "../../../../lib/server/elevenlabsVoiceSamples";
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
const ELEVENLABS_VOICE_CLONE_RATE_LIMIT = {
  keyPrefix: "elevenlabs-voice-clone",
  maxRequests: 4,
  windowMs: 10 * 60 * 1000,
} as const;

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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voice-clone.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to clone voice",
      details: "Unable to clone voice.",
    });
  }
  if (!user) return;
  const userId = user.id;
  if (
    !enforceApiRateLimit(req, res, {
      ...ELEVENLABS_VOICE_CLONE_RATE_LIMIT,
      keyPrefix: `${ELEVENLABS_VOICE_CLONE_RATE_LIMIT.keyPrefix}:${userId}`,
    })
  ) {
    return;
  }

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

    const voiceNameValidationError = validateCustomVoiceName(voiceName);
    if (voiceNameValidationError) {
      return res.status(400).json({
        error: "Invalid request",
        details: voiceNameValidationError,
      });
    }

    const trustedStoragePath = assertUserScopedMediaStoragePath({
      path: sourceStoragePath,
      userId,
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
    const voiceSample: Awaited<ReturnType<typeof createPersistedElevenLabsVoiceSample>> =
      await createPersistedElevenLabsVoiceSample({
        userId,
        voiceId: clonedVoice.voiceId,
      }).catch(async (sampleError) => {
        const cleanupResult = await cleanupFailedElevenLabsCustomVoice({
          userId,
          voiceId: clonedVoice.voiceId,
          sampleStoragePath: null,
        });
        for (const cleanupError of cleanupResult.cleanupErrors) {
          await logApiRouteException({
            req,
            error: cleanupError,
            routeLabel: "elevenlabs-voice-clone-cleanup",
            scope: "generation",
            user,
          });
        }
        throw sampleError;
      });

    try {
      const savedVoice = await saveVoiceForUser({
        userId,
        voice: {
          voiceId: clonedVoice.voiceId,
          name: clonedVoice.name,
          previewUrl: voiceSample.previewUrl,
          description: clonedVoice.description,
          sampleStoragePath: voiceSample.sampleStoragePath,
          originKind: "provider-user-created",
          savedSource: "voice-clone",
          providerDeleteEligible: true,
        },
      });
      if (!savedVoice) {
        throw new Error("Unable to persist custom voice ownership.");
      }
    } catch (persistenceError) {
      await logApiRouteException({
        req,
        error: persistenceError,
        routeLabel: "elevenlabs-voice-clone-persistence",
        scope: "generation",
        user,
      });
      const cleanupResult = await cleanupFailedElevenLabsCustomVoice({
        userId,
        voiceId: clonedVoice.voiceId,
        sampleStoragePath: voiceSample.sampleStoragePath,
      });
      for (const cleanupError of cleanupResult.cleanupErrors) {
        await logApiRouteException({
          req,
          error: cleanupError,
          routeLabel: "elevenlabs-voice-clone-cleanup",
          scope: "generation",
          user,
        });
      }
      return res.status(500).json({
        error: "Unable to clone voice",
        details: "We couldn't securely save this voice. Please try again.",
      });
    }

    return res.status(200).json({
      voice: {
        voiceId: clonedVoice.voiceId,
        name: clonedVoice.name,
        previewUrl: voiceSample.previewUrl,
        description: clonedVoice.description,
        isFallback: false,
      },
    });
  } catch (error) {
    if (error instanceof MediaAudioExtractionInputError) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: sanitizeCustomerFacingProviderText(error.message, "Invalid voice sample."),
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
      details: sanitizeCustomerFacingProviderText(
        error instanceof Error ? error.message : null,
        "Unable to clone voice."
      ),
    });
  }
}
