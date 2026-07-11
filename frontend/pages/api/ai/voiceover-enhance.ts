/**
 * Authenticated Voiceover Enhance route for ElevenLabs v3 audio-tag script preparation.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enhanceVoiceoverScript } from "../../../lib/server/voiceoverEnhancement";
import { VOICEOVER_ENHANCE_MAX_CHARACTERS } from "../../../lib/server/voiceoverEnhancement";
import {
  admitOpenAiInternalCapacityRequest,
  OpenAiInternalCapacityError,
  resolveOpenAiInternalCapacityRequestId,
  settleOpenAiInternalCapacity,
} from "../../../lib/server/api/openAiInternalCapacityAdmission";

type VoiceoverEnhanceSuccessResponse = {
  enhancedScript: string;
};

type VoiceoverEnhanceErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceoverEnhanceSuccessResponse | VoiceoverEnhanceErrorResponse>
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
      routeLabel: "ai/voiceover-enhance.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Voiceover Enhance is unavailable",
      details: "Unable to verify your session.",
    });
  }
  if (!user) return;

  const script = (req.body as { script?: unknown } | undefined)?.script;
  const normalizedScript = typeof script === "string" ? script.trim() : "";
  if (!normalizedScript || normalizedScript.length > VOICEOVER_ENHANCE_MAX_CHARACTERS) {
    return res.status(400).json({
      error: "Invalid request",
      details: !normalizedScript
        ? "script is required."
        : `script must be ${VOICEOVER_ENHANCE_MAX_CHARACTERS.toLocaleString()} characters or fewer.`,
    });
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return res.status(503).json({
      error: "Voiceover Enhance is unavailable",
      details: "Voiceover Enhance is not configured right now.",
    });
  }

  let admission;
  try {
    admission = await admitOpenAiInternalCapacityRequest({
      userId: user.id,
      lane: "ai.voiceover_enhance",
      requestId: resolveOpenAiInternalCapacityRequestId(req),
      internalBudgetMicrousd: 25_000,
      maxAttempts: 1,
    });
  } catch (error) {
    if (error instanceof OpenAiInternalCapacityError) {
      return res.status(error.status).json({ error: error.message, details: error.code });
    }
    throw error;
  }

  const result = await enhanceVoiceoverScript({
    script: normalizedScript,
  });

  try {
    await settleOpenAiInternalCapacity({
      admissionId: admission.id,
      userId: user.id,
      status: result.ok ? "completed" : "failed",
      usage: { ...(result.ok ? result.usage : {}), requestCount: 1 },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/voiceover-enhance.admission-settlement",
      scope: "generation",
      user,
    });
    return res.status(503).json({
      error: "Voiceover Enhance is unavailable",
      details: "Unable to settle AI capacity usage.",
    });
  }

  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      ...(result.details ? { details: result.details } : {}),
    });
  }

  return res.status(200).json({ enhancedScript: result.enhancedScript });
}
