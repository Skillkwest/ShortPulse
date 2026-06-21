/**
 * Best-effort companion-art queueing for audio generation routes.
 * Keeps secondary artwork work from invalidating already-persisted audio outputs.
 */
import type { NextApiRequest } from "next";
import type { AuthenticatedApiUser } from "../api/auth";
import { logApiRouteException } from "../api/appErrorLogs";
import {
  generateAudioCompanionArtForGeneration,
  markAudioCompanionArtPending,
  type AudioCompanionArtDelivery,
} from "./processing";

type MarkAudioCompanionArtPendingBestEffortInput = {
  req: NextApiRequest;
  routeLabel: string;
  generationId: string;
  userId: string;
  user: AuthenticatedApiUser | null;
};

type GenerateAudioCompanionArtNowBestEffortInput = {
  req: NextApiRequest;
  routeLabel: string;
  generationId: string;
  userId: string;
  user: AuthenticatedApiUser | null;
};

/**
 * Marks companion art as pending, logging but not throwing if queueing is degraded.
 */
export const markAudioCompanionArtPendingBestEffort = async ({
  req,
  routeLabel,
  generationId,
  userId,
  user,
}: MarkAudioCompanionArtPendingBestEffortInput): Promise<void> => {
  try {
    await markAudioCompanionArtPending({ generationId, userId });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: `${routeLabel}.companion-art`,
      scope: "generation",
      user,
      metadata: {
        generation_id: generationId,
      },
    });
  }
};

/**
 * Generates companion art immediately when an audio route can afford the extra best-effort work.
 * The pending queue remains the durable fallback when Flux, signing, or storage is degraded.
 */
export const generateAudioCompanionArtNowBestEffort = async ({
  req,
  routeLabel,
  generationId,
  userId,
  user,
}: GenerateAudioCompanionArtNowBestEffortInput): Promise<AudioCompanionArtDelivery | null> => {
  try {
    return await generateAudioCompanionArtForGeneration({ generationId, userId });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: `${routeLabel}.companion-art.generate`,
      scope: "generation",
      user,
      metadata: {
        generation_id: generationId,
      },
    });
    return null;
  }
};
