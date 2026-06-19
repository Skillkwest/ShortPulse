/**
 * Authenticated Voiceover Enhance route for ElevenLabs v3 audio-tag script preparation.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enhanceVoiceoverScript } from "../../../lib/server/voiceoverEnhancement";

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

  const result = await enhanceVoiceoverScript({
    script: (req.body as { script?: unknown } | undefined)?.script,
  });

  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      ...(result.details ? { details: result.details } : {}),
    });
  }

  return res.status(200).json({ enhancedScript: result.enhancedScript });
}
