import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  listSavedVoicesForUserWithDiagnostics,
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

const SAVED_VOICES_LOAD_TIMEOUT_MS = 8_000;
const PROVIDER_VOICES_LOAD_TIMEOUT_MS = 10_000;

const withTimeout = async <T>({
  promise,
  timeoutMs,
  message,
}: {
  promise: Promise<T>;
  timeoutMs: number;
  message: string;
}): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const buildFallbackVoicesResponse = ({
  savedVoices = [],
  warning,
}: {
  savedVoices?: SavedAiStudioVoice[];
  warning?: string | null;
} = {}) => ({
  source: "fallback" as const,
  warning: ["Showing default voices until live voices are configured.", warning?.trim() || null]
    .filter(Boolean)
    .join(" "),
  voices: buildResolvedVoiceLibraryEntries({
    providerVoices: buildFallbackVoiceLibraryEntries(),
    savedVoices,
  }),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoicesSuccessResponse | VoicesErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voices.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to load voices",
      details: "Unable to load voices.",
    });
  }
  if (!user) return;
  const userId = user.id;
  let savedVoices: SavedAiStudioVoice[] = [];
  let savedVoicesWarning: string | null = null;
  try {
    const savedVoiceResult = await withTimeout({
      promise: listSavedVoicesForUserWithDiagnostics(userId),
      timeoutMs: SAVED_VOICES_LOAD_TIMEOUT_MS,
      message: "Saved voices lookup timed out.",
    });
    savedVoices = savedVoiceResult.voices;
    savedVoicesWarning = savedVoiceResult.warning;
  } catch (persistenceError) {
    await logApiRouteException({
      req,
      error: persistenceError,
      routeLabel: "elevenlabs-voices-persistence",
      scope: "generation",
      user,
    });
    savedVoicesWarning = "Some saved voices are temporarily unavailable. Please try again.";
  }

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return res
      .status(200)
      .json(buildFallbackVoicesResponse({ savedVoices, warning: savedVoicesWarning }));
  }

  try {
    const voices = buildResolvedVoiceLibraryEntries({
      providerVoices: await withTimeout({
        promise: listElevenLabsVoices(),
        timeoutMs: PROVIDER_VOICES_LOAD_TIMEOUT_MS,
        message: "ElevenLabs voices lookup timed out.",
      }),
      savedVoices,
    });
    return res.status(200).json({
      voices,
      source: "api",
      ...(savedVoicesWarning ? { warning: savedVoicesWarning } : {}),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voices",
      scope: "generation",
      user,
    });
    return res
      .status(200)
      .json(buildFallbackVoicesResponse({ savedVoices, warning: savedVoicesWarning }));
  }
}
