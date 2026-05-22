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
import {
  deleteElevenLabsVoice,
  listElevenLabsVoices,
  type ElevenLabsVoice,
} from "../../../../lib/server/elevenlabs";
import {
  buildFallbackVoiceLibraryEntries,
  buildResolvedVoiceLibraryEntries,
} from "../../../../lib/server/elevenlabsVoiceLibrary";

type DeleteVoiceSuccessResponse = {
  status: "ok";
  voiceId: string;
  action: "remove" | "delete";
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
  const status =
    (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { status?: unknown; statusCode?: unknown }).statusCode;
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
    let providerVoices: ElevenLabsVoice[] = [];
    let providerLookupFailed = false;
    if (process.env.ELEVENLABS_API_KEY?.trim()) {
      try {
        providerVoices = await listElevenLabsVoices();
      } catch {
        providerLookupFailed = true;
      }
    }
    const effectiveVoices =
      providerVoices.length > 0 || savedVoices.length > 0
        ? buildResolvedVoiceLibraryEntries({
            providerVoices,
            savedVoices,
          })
        : buildFallbackVoiceLibraryEntries();
    const targetVoice =
      effectiveVoices.find(
        (voice) => voice.voiceId.trim().toLowerCase() === voiceId.toLowerCase()
      ) ?? null;

    if (!targetVoice) {
      if (providerLookupFailed && !hadSavedVoice) {
        return res.status(503).json({
          error: "Unable to delete voice",
          details:
            "Voice deletion is temporarily unavailable while provider voice access is degraded.",
        });
      }
      return res.status(404).json({
        error: "Voice not found",
        details: "The selected voice could not be found.",
      });
    }

    if (targetVoice.destructiveAction === "none") {
      return res.status(403).json({
        error: "Voice is protected",
        details:
          targetVoice.destructiveActionDisabledReason ??
          "This voice can't be deleted from ShortPulse.",
      });
    }

    if (targetVoice.destructiveAction === "remove") {
      const removedSavedVoice = await deleteSavedVoiceForUser({
        userId: user.id,
        voiceId,
      });

      if (!removedSavedVoice) {
        return res.status(404).json({
          error: "Voice not found",
          details: "The selected voice could not be found in your saved voices.",
        });
      }

      return res.status(200).json({
        status: "ok",
        voiceId,
        action: "remove",
      });
    }

    if (!process.env.ELEVENLABS_API_KEY?.trim()) {
      return res.status(503).json({
        error: "Unable to delete voice",
        details: "Provider voice deletion is temporarily unavailable.",
      });
    }

    let deletedProviderVoice = false;
    try {
      await deleteElevenLabsVoice(voiceId);
      deletedProviderVoice = true;
    } catch (error) {
      const status = getErrorStatus(error);
      if (!(hadSavedVoice && status === 404)) {
        throw error;
      }
    }

    const removedSavedVoice = await deleteSavedVoiceForUser({
      userId: user.id,
      voiceId,
    });

    if (!deletedProviderVoice && !removedSavedVoice) {
      return res.status(404).json({
        error: "Voice not found",
        details: "The selected voice could not be found.",
      });
    }

    return res.status(200).json({
      status: "ok",
      voiceId,
      action: "delete",
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
