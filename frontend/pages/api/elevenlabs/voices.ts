import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { listSavedVoicesForUser } from "../../../lib/server/api/userSavedVoices";
import {
  buildFallbackElevenLabsVoices,
  listElevenLabsVoices,
  type ElevenLabsVoice,
} from "../../../lib/server/elevenlabs";

type VoicesSuccessResponse = {
  voices: Array<{
    voiceId: string;
    name: string;
    previewUrl: string | null;
    description: string | null;
    isFallback: boolean;
  }>;
  source: "api" | "fallback";
  warning?: string;
};

type VoicesErrorResponse = {
  error: string;
  details?: string;
};

const mergeVoices = (
  primaryVoices: ElevenLabsVoice[],
  secondaryVoices: ElevenLabsVoice[]
): ElevenLabsVoice[] => {
  const mergedVoices = new Map<string, ElevenLabsVoice>();
  for (const voice of [...primaryVoices, ...secondaryVoices]) {
    const lookupKey = voice.voiceId.trim().toLowerCase();
    if (!lookupKey || mergedVoices.has(lookupKey)) continue;
    mergedVoices.set(lookupKey, voice);
  }
  return Array.from(mergedVoices.values());
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoicesSuccessResponse | VoicesErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let savedVoices: ElevenLabsVoice[] = [];
  try {
    savedVoices = await listSavedVoicesForUser(user.id);
  } catch (persistenceError) {
    await logApiRouteException({
      req,
      error: persistenceError,
      routeLabel: "elevenlabs-voices-persistence",
      scope: "generation",
      user,
    });
  }

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return res.status(200).json({
      voices: mergeVoices(savedVoices, buildFallbackElevenLabsVoices()),
      source: "fallback",
      warning:
        savedVoices.length > 0
          ? "Showing your saved voices and the ElevenLabs default catalog until live voices are configured."
          : "Showing the ElevenLabs default catalog until live voices are configured.",
    });
  }

  try {
    const voices = mergeVoices(await listElevenLabsVoices(), savedVoices);
    return res.status(200).json({ voices, source: "api" });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voices",
      scope: "generation",
      user,
    });

    return res.status(200).json({
      voices: mergeVoices(savedVoices, buildFallbackElevenLabsVoices()),
      source: "fallback",
      warning:
        savedVoices.length > 0
          ? "Showing your saved voices and the ElevenLabs default catalog while live voices are unavailable."
          : "Showing the ElevenLabs default catalog while live voices are unavailable.",
    });
  }
}
