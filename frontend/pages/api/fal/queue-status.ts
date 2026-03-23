import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import { runQueueStatusSideEffects } from "../../../lib/server/api/generationQueue/queueStatusSideEffects";
import { readGenerationQueueStatus } from "../../../lib/server/api/generationQueue/service";

const asQueryString = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") {
      const trimmed = first.trim();
      return trimmed.length ? trimmed : null;
    }
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const flags = readFalRuntimeFlags();
  if (!flags.queueEnabled) {
    return res.status(404).json({ error: "Not found" });
  }

  const sourceRef = asQueryString(req.query.sourceRef);
  const generationId = asQueryString(req.query.generationId);
  if (!sourceRef && !generationId) {
    return res.status(400).json({
      error: "Either sourceRef or generationId is required.",
    });
  }

  try {
    if (!(flags.queueStatusReadOnlyEnabled ?? false)) {
      await runQueueStatusSideEffects({
        req,
        routeLabel: "api/fal/queue-status",
        userId: user.id,
        userEmail: user.email ?? null,
        sourceRef,
        generationId,
        flags: {
          queueStatusDispatchKickEnabled: flags.queueStatusDispatchKickEnabled ?? true,
          queueStatusRecoveryKickEnabled: flags.queueStatusRecoveryKickEnabled ?? true,
          reconcilerMaxAttempts: flags.reconcilerMaxAttempts,
        },
      });
    }

    const status = await readGenerationQueueStatus({
      userId: user.id,
      sourceRef,
      generationId,
    });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(status);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/fal/queue-status",
      user,
      metadata: {
        source_ref: sourceRef,
        generation_id: generationId,
      },
    });
    return res.status(500).json({
      error: "Unable to resolve queued generation status.",
    });
  }
}
