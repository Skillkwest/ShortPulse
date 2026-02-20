/**
 * Admin replay route for generation recovery.
 * Delegates execution to the shared server-side recovery engine.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  executeGenerationRecovery,
  type RecoveryResultState,
} from "../../../../lib/server/falIntegration/recoveryExecution";

type ReplayResponse = {
  ok: boolean;
  requestId: string | null;
  generationId: string | null;
  state: RecoveryResultState;
  mediaFileIds: string[];
  mediaUrls: string[];
  details?: string;
};

const readBodyValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReplayResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const generationIdRaw = readBodyValue(req.body?.generationId);
  const requestIdRaw = readBodyValue(req.body?.requestId);
  if (!generationIdRaw && !requestIdRaw) {
    return res.status(400).json({ error: "Provide generationId or requestId." });
  }

  try {
    let result = await executeGenerationRecovery({
      actor: "admin_replay",
      generationId: generationIdRaw,
      requestId: requestIdRaw,
      routeLabel: "admin.generation_recovery.replay",
    });

    // Backward-compatible fallback: allow generationId input to be a requestId.
    if (!requestIdRaw && generationIdRaw && result.state === "missing_generation") {
      result = await executeGenerationRecovery({
        actor: "admin_replay",
        generationId: null,
        requestId: generationIdRaw,
        routeLabel: "admin.generation_recovery.replay",
      });
    }

    if (result.state === "missing_generation") {
      return res.status(404).json({ error: "Generation not found." });
    }

    return res.status(200).json({
      ok: result.ok,
      generationId: result.generationId,
      requestId: result.requestId,
      state: result.state,
      mediaFileIds: result.mediaFileIds,
      mediaUrls: result.mediaUrls,
      details: result.note,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "admin.generation_recovery.replay",
      error,
      metadata: {
        generation_id: generationIdRaw ?? null,
        request_id: requestIdRaw ?? null,
      },
      user: adminUser,
    });
    return res.status(500).json({ error: "Failed to replay generation recovery." });
  }
}
