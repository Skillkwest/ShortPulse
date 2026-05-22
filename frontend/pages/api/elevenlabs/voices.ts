import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  listSavedVoicesForUser,
  type SavedAiStudioVoice,
} from "../../../lib/server/api/userSavedVoices";
import { listElevenLabsVoices } from "../../../lib/server/elevenlabs";
import {
  buildFallbackVoiceLibraryEntries,
  buildResolvedVoiceLibraryEntries,
} from "../../../lib/server/elevenlabsVoiceLibrary";

type VoicesSuccessResponse = {
  voices: ReturnType<typeof buildFallbackVoiceLibraryEntries>;
  source: "api" | "fallback";
  warning?: string;
};

type VoicesErrorResponse = {
  error: string;
  details?: string;
};

const buildFallbackVoicesResponse = () => ({
  source: "fallback" as const,
  warning: "Showing the ElevenLabs default catalog until live voices are configured.",
  voices: buildFallbackVoiceLibraryEntries(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoicesSuccessResponse | VoicesErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let savedVoices: SavedAiStudioVoice[] = [];
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
    return res.status(200).json(buildFallbackVoicesResponse());
  }

  try {
    const voices = buildResolvedVoiceLibraryEntries({
      providerVoices: await listElevenLabsVoices(),
      savedVoices,
    });
    return res.status(200).json({ voices, source: "api" });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voices",
      scope: "generation",
      user,
    });
    return res.status(200).json(buildFallbackVoicesResponse());
  }
}
