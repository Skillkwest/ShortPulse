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
  normalizeGenerationReconcileProjectId,
  reconcileVisibleProjectGenerationsForUser,
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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "generation.reconcile.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to reconcile generation.",
    });
  }
  if (!user) return;

  const identities = normalizeGenerationReconcileIdentities(req.body?.runtimeIdentities);
  const projectId = normalizeGenerationReconcileProjectId(req.body?.projectId);
  if (!identities.length && !projectId) {
    return res.status(400).json({
      error: "Invalid request",
      details:
        "runtimeIdentities must include at least one generation, request, or source ref, or projectId must identify the project to reconcile.",
    });
  }

  try {
    const result = identities.length
      ? await reconcileVisibleGenerationsForUser({
          userId: user.id,
          identities,
        })
      : await reconcileVisibleProjectGenerationsForUser({
          userId: user.id,
          projectId: projectId as string,
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
