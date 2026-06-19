/**
 * Best-effort companion-art queueing for audio generation routes.
 * Keeps secondary artwork work from invalidating already-persisted audio outputs.
 */
import type { NextApiRequest } from "next";
import type { AuthenticatedApiUser } from "../api/auth";
import { logApiRouteException } from "../api/appErrorLogs";
import { markAudioCompanionArtPending } from "./processing";

type MarkAudioCompanionArtPendingBestEffortInput = {
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
