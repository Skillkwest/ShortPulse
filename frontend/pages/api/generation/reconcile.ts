/**
 * User-owned generation reconciliation route.
 * Reopened AI Studio sessions call this to nudge the server recovery engine for
 * visible in-flight Reference Grid work without making the browser the worker.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  normalizeGenerationReconcileIdentities,
  reconcileVisibleGenerationsForUser,
  type GenerationReconcileBatchResult,
} from "../../../lib/server/api/generationReconcile";

type GenerationReconcileResponse =
  | ({
      ok: true;
    } & GenerationReconcileBatchResult)
  | {
      error: string;
      details?: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerationReconcileResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const identities = normalizeGenerationReconcileIdentities(req.body?.runtimeIdentities);
  if (!identities.length) {
    return res.status(400).json({
      error: "Invalid request",
      details: "runtimeIdentities must include at least one generation, request, or source ref.",
    });
  }

  try {
    const result = await reconcileVisibleGenerationsForUser({
      userId: user.id,
      identities,
    });
    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "generation.reconcile",
      scope: "generation",
      user,
    });
    return res.status(500).json({
      error: "Unable to reconcile generation.",
    });
  }
}
