/**
 * Deletes a selected AI Studio voice from saved preferences and, when applicable,
 * from the upstream ElevenLabs account.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  deleteSavedVoiceForUser,
  listSavedVoicesForUser,
} from "../../../../lib/server/api/userSavedVoices";
import { deleteElevenLabsVoice } from "../../../../lib/server/elevenlabs";

type DeleteVoiceSuccessResponse = {
  status: "ok";
  voiceId: string;
};

type DeleteVoiceErrorResponse = {
  error: string;
  details?: string;
};

const normalizeVoiceId = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return normalizeVoiceId(value[0]);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteVoiceSuccessResponse | DeleteVoiceErrorResponse>
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const voiceId = normalizeVoiceId(req.query.voiceId);
  if (!voiceId) {
    return res.status(400).json({
      error: "Invalid request",
      details: "voiceId is required.",
    });
  }

  try {
    const savedVoices = await listSavedVoicesForUser(user.id);
    const hadSavedVoice = savedVoices.some(
      (voice) => voice.voiceId.trim().toLowerCase() === voiceId.toLowerCase()
    );
    let deletedProviderVoice = false;

    if (process.env.ELEVENLABS_API_KEY?.trim()) {
      try {
        await deleteElevenLabsVoice(voiceId);
        deletedProviderVoice = true;
      } catch (error) {
        const status = getErrorStatus(error);
        if (!(hadSavedVoice && status === 404)) {
          throw error;
        }
      }
    }

    const removedSavedVoice = await deleteSavedVoiceForUser({
      userId: user.id,
      voiceId,
    });

    if (!deletedProviderVoice && !removedSavedVoice) {
      return res.status(404).json({
        error: "Voice not found",
        details: "The selected voice could not be found in your saved voices.",
      });
    }

    return res.status(200).json({
      status: "ok",
      voiceId,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-voice-delete",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to delete voice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
