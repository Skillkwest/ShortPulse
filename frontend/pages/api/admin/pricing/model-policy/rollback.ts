import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import { rollbackModelPricingPolicy } from "../../../../../lib/server/api/modelPricingControlPlane";

const normalizeReason = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 400) : null;
};

const statusToHttpCode = (status: string): number => {
  if (status === "not_initialized") return 503;
  if (status === "rejected") return 400;
  return 200;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/model-policy/rollback.auth",
      metadata: {
        source: "api.admin.pricing.model-policy.rollback",
      },
    });
    return res.status(500).json({
      error: "Unable to rollback model pricing policy.",
    });
  }
  if (!adminUser) return;

  try {
    const result = await rollbackModelPricingPolicy({
      reason: normalizeReason(req.body?.reason),
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    const statusCode = statusToHttpCode(result.status);
    return res.status(statusCode).json({ ok: statusCode < 400, ...result });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/model-policy/rollback",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.model-policy.rollback",
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to rollback model pricing policy.",
    });
  }
}
