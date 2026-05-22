import type { NextApiRequest, NextApiResponse } from "next";
import { sanitizeCustomerFacingProviderText } from "../../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { saveVoiceForUser } from "../../../../lib/server/api/userSavedVoices";
import { createElevenLabsDesignedVoice } from "../../../../lib/server/elevenlabs";

type TextToVoiceCreateRequestBody = {
  voiceName?: unknown;
  voiceDescription?: unknown;
  generatedVoiceId?: unknown;
  playedNotSelectedVoiceIds?: unknown;
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
    const playedNotSelectedVoiceIds = normalizeOptionalStringArray(body.playedNotSelectedVoiceIds);

    if (!voiceName || !voiceDescription || !generatedVoiceId) {
      return res.status(400).json({
        error: "Invalid request",
        details: "voiceName, voiceDescription, and generatedVoiceId are required.",
      });
    }

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
      playedNotSelectedVoiceIds: playedNotSelectedVoiceIds.filter(
        (voiceId) => voiceId !== generatedVoiceId
      ),
    });

    try {
      await saveVoiceForUser({
        userId: user.id,
        voice: {
          voiceId: createdVoice.voiceId,
          name: createdVoice.name,
          previewUrl: createdVoice.previewUrl,
          description: createdVoice.description,
          originKind: "provider-user-created",
          savedSource: "text-to-voice-create",
          providerDeleteEligible: true,
        },
      });
    } catch (persistenceError) {
      await logApiRouteException({
        req,
        error: persistenceError,
        routeLabel: "elevenlabs-text-to-voice-create-persistence",
        scope: "generation",
        user,
      });
    }

    return res.status(200).json({
      voice: {
        voiceId: createdVoice.voiceId,
        name: createdVoice.name,
        previewUrl: createdVoice.previewUrl,
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
