/**
 * Explicit queue-status side-effect lane.
 * Allows one-shot dispatch/recovery kicks without overloading read polling.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import { runQueueStatusSideEffects } from "../../../lib/server/api/generationQueue/queueStatusSideEffects";

const asBodyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const flags = readFalRuntimeFlags();
  if (!flags.queueEnabled) {
    return res.status(404).json({ error: "Not found" });
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const sourceRef = asBodyString(body.sourceRef);
  const generationId = asBodyString(body.generationId);
  if (!sourceRef && !generationId) {
    return res.status(400).json({
      error: "Either sourceRef or generationId is required.",
    });
  }

  try {
    const result = await runQueueStatusSideEffects({
      req,
      routeLabel: "api/fal/queue-status-kick",
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

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/fal/queue-status-kick",
      user,
      metadata: {
        source_ref: sourceRef,
        generation_id: generationId,
      },
    });
    return res.status(500).json({
      error: "Unable to execute queued generation kick.",
    });
  }
}
