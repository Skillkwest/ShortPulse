import type { NextApiRequest, NextApiResponse } from "next";
import { sanitizeCustomerFacingProviderText } from "../../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { saveVoiceForUser } from "../../../../lib/server/api/userSavedVoices";
import { cleanupFailedElevenLabsCustomVoice } from "../../../../lib/server/elevenlabsCustomVoiceCleanup";
import { createElevenLabsDesignedVoice } from "../../../../lib/server/elevenlabs";
import { verifyVoiceDesignPreviewToken } from "../../../../lib/server/elevenlabsVoiceDesignTokens";
import { createPersistedElevenLabsVoiceSample } from "../../../../lib/server/elevenlabsVoiceSamples";

type TextToVoiceCreateRequestBody = {
  voiceName?: unknown;
  voiceDescription?: unknown;
  generatedVoiceId?: unknown;
  generatedVoiceToken?: unknown;
  playedNotSelectedVoiceIds?: unknown;
  playedNotSelectedVoiceTokens?: unknown;
};

type TextToVoiceCreateSuccessResponse = {
  voice: {
    voiceId: string;
    name: string;
    previewUrl: string | null;
    description: string | null;
    isFallback: false;
  };
};

type TextToVoiceCreateErrorResponse = {
  error: string;
  details?: string;
};

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const normalizedValues = value
    .map((entry) => normalizeRequiredString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(normalizedValues));
};

const MIN_VOICE_DESCRIPTION_CHARACTERS = 20;
const MAX_VOICE_DESCRIPTION_CHARACTERS = 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TextToVoiceCreateSuccessResponse | TextToVoiceCreateErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as TextToVoiceCreateRequestBody;
    const voiceName = normalizeRequiredString(body.voiceName);
    const voiceDescription = normalizeRequiredString(body.voiceDescription);
    const generatedVoiceId = normalizeRequiredString(body.generatedVoiceId);
    const generatedVoiceToken = normalizeRequiredString(body.generatedVoiceToken);
    const playedNotSelectedVoiceIds = normalizeOptionalStringArray(body.playedNotSelectedVoiceIds);
    const playedNotSelectedVoiceTokens = normalizeOptionalStringArray(
      body.playedNotSelectedVoiceTokens
    );

    if (!voiceName || !voiceDescription || !generatedVoiceId || !generatedVoiceToken) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "voiceName, voiceDescription, generatedVoiceId, and generatedVoiceToken are required.",
      });
    }

    if (
      !verifyVoiceDesignPreviewToken({
        generatedVoiceId,
        token: generatedVoiceToken,
        userId: user.id,
      })
    ) {
      return res.status(403).json({
        error: "Voice preview is unavailable",
        details: "The selected voice preview is no longer available for this account.",
      });
    }

    const verifiedPlayedNotSelectedVoiceIds = playedNotSelectedVoiceIds.filter((voiceId, index) => {
      const token = playedNotSelectedVoiceTokens[index];
      if (!token || voiceId === generatedVoiceId) return false;
      return verifyVoiceDesignPreviewToken({
        generatedVoiceId: voiceId,
        token,
        userId: user.id,
      });
    });

    if (
      voiceDescription.length < MIN_VOICE_DESCRIPTION_CHARACTERS ||
      voiceDescription.length > MAX_VOICE_DESCRIPTION_CHARACTERS
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details: `voiceDescription must be between ${MIN_VOICE_DESCRIPTION_CHARACTERS} and ${MAX_VOICE_DESCRIPTION_CHARACTERS} characters.`,
      });
    }

    const createdVoice = await createElevenLabsDesignedVoice({
      voiceName,
      voiceDescription,
      generatedVoiceId,
      playedNotSelectedVoiceIds: verifiedPlayedNotSelectedVoiceIds,
    });
    const voiceSample: Awaited<ReturnType<typeof createPersistedElevenLabsVoiceSample>> =
      await createPersistedElevenLabsVoiceSample({
        userId: user.id,
        voiceId: createdVoice.voiceId,
      }).catch(async (sampleError) => {
        const cleanupResult = await cleanupFailedElevenLabsCustomVoice({
          userId: user.id,
          voiceId: createdVoice.voiceId,
          sampleStoragePath: null,
        });
        for (const cleanupError of cleanupResult.cleanupErrors) {
          await logApiRouteException({
            req,
            error: cleanupError,
            routeLabel: "elevenlabs-text-to-voice-create-cleanup",
            scope: "generation",
            user,
          });
        }
        throw sampleError;
      });

    try {
      const savedVoice = await saveVoiceForUser({
        userId: user.id,
        voice: {
          voiceId: createdVoice.voiceId,
          name: createdVoice.name,
          previewUrl: voiceSample.previewUrl,
          description: createdVoice.description,
          sampleStoragePath: voiceSample.sampleStoragePath,
          originKind: "provider-user-created",
          savedSource: "text-to-voice-create",
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
        routeLabel: "elevenlabs-text-to-voice-create-persistence",
        scope: "generation",
        user,
      });
      const cleanupResult = await cleanupFailedElevenLabsCustomVoice({
        userId: user.id,
        voiceId: createdVoice.voiceId,
        sampleStoragePath: voiceSample.sampleStoragePath,
      });
      for (const cleanupError of cleanupResult.cleanupErrors) {
        await logApiRouteException({
          req,
          error: cleanupError,
          routeLabel: "elevenlabs-text-to-voice-create-cleanup",
          scope: "generation",
          user,
        });
      }
      return res.status(500).json({
        error: "Unable to create voice",
        details: "We couldn't securely save this voice. Please try again.",
      });
    }

    return res.status(200).json({
      voice: {
        voiceId: createdVoice.voiceId,
        name: createdVoice.name,
        previewUrl: voiceSample.previewUrl,
        description: createdVoice.description,
        isFallback: false,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-text-to-voice-create",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to create voice",
      details: sanitizeCustomerFacingProviderText(
        error instanceof Error ? error.message : null,
        "Unable to create voice."
      ),
    });
  }
}
