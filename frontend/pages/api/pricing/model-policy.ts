import type { NextApiRequest, NextApiResponse } from "next";
import { getModelPricingPolicySnapshot } from "../../../lib/model-runtime/pricingPolicy";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { resolveRuntimeModelPricingPolicy } from "../../../lib/server/api/modelPricingControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const resolution = await resolveRuntimeModelPricingPolicy();
    return res.status(200).json({
      modelPolicy: getModelPricingPolicySnapshot(resolution.policy, {
        activePolicyVersion: resolution.activePolicyVersion,
        policySource: resolution.source,
        updatedAt: resolution.updatedAt,
        updatedByEmail: resolution.updatedByEmail,
      }),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "pricing/model-policy",
      user,
      metadata: {
        source: "api.pricing.model-policy",
      },
    });
    return res.status(500).json({ error: "Unable to load model pricing policy." });
  }
}
