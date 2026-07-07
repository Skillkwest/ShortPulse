import type { NextApiRequest, NextApiResponse } from "next";
import { validateCustomVoiceName } from "../../../../lib/customVoiceName";
import { resolveRequiredAudioVoiceDesignModelId } from "../../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { requireAiStudioWorkflowPlanAccess } from "../../../../lib/server/api/aiStudioWorkflowPlanGuard";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { designElevenLabsVoice } from "../../../../lib/server/elevenlabs";
import { issueVoiceDesignPreviewToken } from "../../../../lib/server/elevenlabsVoiceDesignTokens";

type TextToVoiceDesignRequestBody = {
  voiceDescription?: unknown;
  voiceName?: unknown;
};

type TextToVoiceDesignSuccessResponse = {
  previews: Array<{
    generatedVoiceId: string;
    previewToken: string;
    audioBase64: string;
    mediaType: string | null;
    durationSecs: number | null;
    language: string | null;
  }>;
  previewText: string | null;
  modelId: string;
};

type TextToVoiceDesignErrorResponse = {
  error: string;
  details?: string;
};

const DEFAULT_VOICE_DESIGN_MODEL_ID = resolveRequiredAudioVoiceDesignModelId();
const DEFAULT_VOICE_DESIGN_OUTPUT_FORMAT = "mp3_22050_32";
const MIN_VOICE_DESCRIPTION_CHARACTERS = 20;
const MAX_VOICE_DESCRIPTION_CHARACTERS = 1000;
const ELEVENLABS_VOICE_DESIGN_RATE_LIMIT = {
  keyPrefix: "elevenlabs-text-to-voice-design",
  maxRequests: 6,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TextToVoiceDesignSuccessResponse | TextToVoiceDesignErrorResponse>
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
      routeLabel: "elevenlabs-text-to-voice-design.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to generate voice previews",
      details: "Unable to generate voice previews.",
    });
  }
  if (!user) return;
  const workflowAccess = await requireAiStudioWorkflowPlanAccess({
    req,
    res,
    user,
    workflow: "audio",
    routeLabel: "elevenlabs-text-to-voice-design",
  });
  if (!workflowAccess.allowed) return;
  const userId = user.id;
  if (
    !enforceApiRateLimit(req, res, {
      ...ELEVENLABS_VOICE_DESIGN_RATE_LIMIT,
      keyPrefix: `${ELEVENLABS_VOICE_DESIGN_RATE_LIMIT.keyPrefix}:${userId}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as TextToVoiceDesignRequestBody;
    const voiceDescription = normalizeRequiredString(body.voiceDescription);
    const voiceName = normalizeRequiredString(body.voiceName);

    if (!voiceName || !voiceDescription) {
      return res.status(400).json({
        error: "Invalid request",
        details: "voiceName and voiceDescription are required.",
      });
    }

    const voiceNameValidationError = validateCustomVoiceName(voiceName);
    if (voiceNameValidationError) {
      return res.status(400).json({
        error: "Invalid request",
        details: voiceNameValidationError,
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

    const designedVoice = await designElevenLabsVoice({
      voiceDescription,
      modelId: DEFAULT_VOICE_DESIGN_MODEL_ID,
      autoGenerateText: true,
      text: null,
      outputFormat: DEFAULT_VOICE_DESIGN_OUTPUT_FORMAT,
    });

    return res.status(200).json({
      previews: designedVoice.previews.map((preview) => ({
        ...preview,
        previewToken: issueVoiceDesignPreviewToken({
          generatedVoiceId: preview.generatedVoiceId,
          userId,
        }),
      })),
      previewText: designedVoice.text,
      modelId: DEFAULT_VOICE_DESIGN_MODEL_ID,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-text-to-voice-design",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to generate voice previews",
      details: sanitizeCustomerFacingProviderText(
        error instanceof Error ? error.message : null,
        "Unable to generate voice previews."
      ),
    });
  }
}
