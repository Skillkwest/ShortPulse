import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import { fetchActiveModelPricingPolicy } from "../../../../../lib/server/api/modelPricingControlPlane";
import { buildModelPricingPublicationDryRun } from "../../../../../lib/server/api/modelPricingPublicationDryRun";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/model-policy/dry-run.auth",
      metadata: { source: "api.admin.pricing.model-policy.dry_run" },
    });
    return res.status(500).json({ error: "Unable to inspect model pricing publication." });
  }
  if (!adminUser) return;

  try {
    const active = await fetchActiveModelPricingPolicy();
    if (!active) {
      return res.status(503).json({ error: "Model pricing policy is not initialized." });
    }
    return res.status(200).json({
      ok: true,
      ...buildModelPricingPublicationDryRun({
        activePolicyVersion: active.activePolicyVersion,
        activePolicy: active.activePolicy,
        activeCustomRows: active.activeCustomRows,
      }),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/model-policy/dry-run",
      user: adminUser,
      metadata: { source: "api.admin.pricing.model-policy.dry_run" },
    });
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to inspect model pricing publication.",
    });
  }
}
